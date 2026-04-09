"""Session management - Redis-primary (async), PostgreSQL audit-only."""

import hashlib
import json
import logging
import secrets
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

from sqlmodel import Session, select

from src.db.auth_sessions import AuthSession
from src.db.users import User
from src.services.cache.redis_client import get_async_redis_client

logger = logging.getLogger(__name__)

REFRESH_SESSION_TTL = int(timedelta(days=7).total_seconds())
REFRESH_SESSION_HARD_CAP = int(timedelta(days=30).total_seconds())
SESSION_PREFIX = "session:"
USER_SESSIONS_PREFIX = "user_sessions:"

RefreshSessionStatus = Literal["active", "expired", "revoked", "reused", "invalid"]


@dataclass(slots=True)
class SessionData:
    session_id: str
    token_family_id: str
    user_id: int
    user_uuid: str
    refresh_token_hash: str
    ip_address: str | None
    user_agent: str | None
    created_at: int
    last_seen_at: int
    rotated_count: int
    absolute_expires_at: int


@dataclass(slots=True)
class RefreshSessionInspection:
    status: RefreshSessionStatus
    session: SessionData | None = None
    session_id: str | None = None
    token_family_id: str | None = None
    user_id: int | None = None


def _now_ts() -> int:
    return int(time.time())


def _generate_session_id() -> str:
    return "sess_" + secrets.token_hex(16)


def _generate_family_id() -> str:
    return "fam_" + secrets.token_hex(16)


def _generate_refresh_token(session_id: str) -> str:
    return session_id + "." + secrets.token_hex(32)


def _extract_session_id(refresh_token: str) -> str | None:
    parts = refresh_token.split(".", 1)
    if len(parts) != 2:
        return None
    session_id = parts[0].strip()
    return session_id or None


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _session_key(session_id: str) -> str:
    return SESSION_PREFIX + session_id


def _user_sessions_key(user_id: int) -> str:
    return USER_SESSIONS_PREFIX + str(user_id)


def _session_data_to_dict(data: SessionData) -> dict:
    return {
        "session_id": data.session_id,
        "token_family_id": data.token_family_id,
        "user_id": data.user_id,
        "user_uuid": data.user_uuid,
        "refresh_token_hash": data.refresh_token_hash,
        "ip_address": data.ip_address,
        "user_agent": data.user_agent,
        "created_at": data.created_at,
        "last_seen_at": data.last_seen_at,
        "rotated_count": data.rotated_count,
        "absolute_expires_at": data.absolute_expires_at,
    }


def _parse_session_data(raw: bytes | str) -> SessionData | None:
    try:
        d = json.loads(raw)
        return SessionData(**d)
    except Exception:
        return None


# ── Async Redis operations ────────────────────────────────────────────────────


async def _write_session_to_redis(data: SessionData, ttl: int) -> None:
    r = get_async_redis_client()
    if not r:
        return
    payload = json.dumps(_session_data_to_dict(data))
    async with r.pipeline(transaction=False) as pipe:
        await pipe.set(_session_key(data.session_id), payload, ex=ttl)
        await pipe.sadd(_user_sessions_key(data.user_id), data.session_id)
        await pipe.expire(_user_sessions_key(data.user_id), REFRESH_SESSION_HARD_CAP)
        await pipe.execute()


async def _read_session_from_redis(session_id: str) -> SessionData | None:
    r = get_async_redis_client()
    if not r:
        return None
    raw = await r.get(_session_key(session_id))
    if not raw:
        return None
    data = _parse_session_data(raw)
    if data is None:
        logger.warning("Corrupt session in Redis: %s", session_id)
    return data


async def _delete_session_from_redis(session_id: str, user_id: int) -> None:
    r = get_async_redis_client()
    if not r:
        return
    async with r.pipeline(transaction=False) as pipe:
        await pipe.delete(_session_key(session_id))
        await pipe.srem(_user_sessions_key(user_id), session_id)
        await pipe.execute()


async def _find_session_by_refresh_token(refresh_token: str) -> SessionData | None:
    session_id = _extract_session_id(refresh_token)
    if session_id is None:
        return None
    data = await _read_session_from_redis(session_id)
    if data is None:
        return None
    if data.refresh_token_hash != hash_refresh_token(refresh_token):
        return None
    return data


# ── Synchronous PostgreSQL audit writes ──────────────────────────────────────
# These remain sync since they run in the request-scoped DB session alongside
# session creation/rotation, ensuring the audit record and the Redis write are
# logically paired. Failures are swallowed so auth flows are never blocked.


def _audit_create(db_session: Session, data: SessionData) -> None:
    try:
        now = datetime.now(UTC)
        record = AuthSession(
            session_id=data.session_id,
            token_family_id=data.token_family_id,
            user_id=data.user_id,
            refresh_token_hash=data.refresh_token_hash,
            created_at=now,
            last_seen_at=now,
            expires_at=now + timedelta(seconds=REFRESH_SESSION_TTL),
            ip_address=data.ip_address,
            user_agent=data.user_agent,
        )
        db_session.add(record)
        db_session.commit()
    except Exception:
        logger.warning("Audit write failed for session %s", data.session_id)


def _audit_revoke(db_session: Session | None, session_id: str) -> None:
    if db_session is None:
        return
    try:
        record = db_session.exec(
            select(AuthSession).where(AuthSession.session_id == session_id)
        ).first()
        if record and record.revoked_at is None:
            record.revoked_at = datetime.now(UTC)
            db_session.add(record)
            db_session.commit()
    except Exception:
        logger.warning("Audit revoke failed for session %s", session_id)


# ── Public API ────────────────────────────────────────────────────────────────


async def create_auth_session(
    db_session: Session,
    *,
    user: User,
    ip_address: str | None,
    user_agent: str | None,
    token_family_id: str | None = None,
) -> tuple[SessionData, str]:
    now = _now_ts()
    session_id = _generate_session_id()
    refresh_token = _generate_refresh_token(session_id)
    data = SessionData(
        session_id=session_id,
        token_family_id=token_family_id or _generate_family_id(),
        user_id=user.id,
        user_uuid=str(user.user_uuid),
        refresh_token_hash=hash_refresh_token(refresh_token),
        ip_address=ip_address,
        user_agent=user_agent,
        created_at=now,
        last_seen_at=now,
        rotated_count=0,
        absolute_expires_at=now + REFRESH_SESSION_HARD_CAP,
    )
    await _write_session_to_redis(data, REFRESH_SESSION_TTL)
    _audit_create(db_session, data)
    return data, refresh_token


async def get_session_by_id(session_id: str) -> SessionData | None:
    return await _read_session_from_redis(session_id)


async def get_session_owner_id(
    db_session: Session | None, session_id: str
) -> int | None:
    active = await _read_session_from_redis(session_id)
    if active is not None:
        return active.user_id

    if db_session is None:
        return None

    try:
        record = db_session.exec(
            select(AuthSession).where(AuthSession.session_id == session_id)
        ).first()
        return record.user_id if record else None
    except Exception:
        logger.warning("Failed to resolve owner for session %s", session_id)
        return None


async def inspect_refresh_session(
    db_session: Session, refresh_token: str
) -> RefreshSessionInspection:
    session_id = _extract_session_id(refresh_token)
    if session_id is None:
        return RefreshSessionInspection(status="invalid")

    data = await _find_session_by_refresh_token(refresh_token)
    if data is not None:
        now = _now_ts()
        if now >= data.absolute_expires_at:
            await _delete_session_from_redis(data.session_id, data.user_id)
            _audit_revoke(db_session, data.session_id)
            return RefreshSessionInspection(
                status="expired",
                session_id=data.session_id,
                token_family_id=data.token_family_id,
                user_id=data.user_id,
            )

        # Slide the window: update last_seen_at and rewrite with remaining TTL
        data.last_seen_at = now
        remaining = min(REFRESH_SESSION_TTL, data.absolute_expires_at - now)
        await _write_session_to_redis(data, remaining)
        return RefreshSessionInspection(
            status="active",
            session=data,
            session_id=data.session_id,
            token_family_id=data.token_family_id,
            user_id=data.user_id,
        )

    # Session not in Redis — check PostgreSQL for reuse / revocation diagnosis
    record = db_session.exec(
        select(AuthSession).where(AuthSession.session_id == session_id)
    ).first()
    if record is None:
        return RefreshSessionInspection(status="invalid", session_id=session_id)

    if record.refresh_token_hash != hash_refresh_token(refresh_token):
        return RefreshSessionInspection(
            status="invalid",
            session_id=session_id,
            token_family_id=record.token_family_id,
            user_id=record.user_id,
        )

    now_dt = datetime.now(UTC)
    if record.expires_at <= now_dt:
        return RefreshSessionInspection(
            status="expired",
            session_id=session_id,
            token_family_id=record.token_family_id,
            user_id=record.user_id,
        )

    # Token hash matches but session is gone from Redis — it was either
    # rotated (replaced_by_session_id is set) or explicitly revoked.
    return RefreshSessionInspection(
        status="reused" if record.replaced_by_session_id else "revoked",
        session_id=session_id,
        token_family_id=record.token_family_id,
        user_id=record.user_id,
    )


async def rotate_session(
    db_session: Session,
    *,
    old_session: SessionData,
    user: User,
    ip_address: str | None,
    user_agent: str | None,
) -> tuple[SessionData, str]:
    now = _now_ts()
    await _delete_session_from_redis(old_session.session_id, old_session.user_id)

    new_session_id = _generate_session_id()
    new_refresh_token = _generate_refresh_token(new_session_id)
    new_data = SessionData(
        session_id=new_session_id,
        token_family_id=old_session.token_family_id,
        user_id=old_session.user_id,
        user_uuid=old_session.user_uuid,
        refresh_token_hash=hash_refresh_token(new_refresh_token),
        ip_address=ip_address,
        user_agent=user_agent,
        created_at=now,
        last_seen_at=now,
        rotated_count=old_session.rotated_count + 1,
        absolute_expires_at=old_session.absolute_expires_at,
    )
    remaining = max(1, min(REFRESH_SESSION_TTL, old_session.absolute_expires_at - now))
    await _write_session_to_redis(new_data, remaining)

    try:
        record = db_session.exec(
            select(AuthSession).where(AuthSession.session_id == old_session.session_id)
        ).first()
        if record is not None:
            record.revoked_at = datetime.now(UTC)
            record.rotated_at = datetime.now(UTC)
            record.replaced_by_session_id = new_session_id
            db_session.add(record)
            db_session.commit()
    except Exception:
        logger.warning("Audit rotate failed for session %s", old_session.session_id)

    _audit_create(db_session, new_data)
    return new_data, new_refresh_token


async def revoke_session(
    db_session: Session | None, session_id: str, user_id: int
) -> None:
    await _delete_session_from_redis(session_id, user_id)
    _audit_revoke(db_session, session_id)


async def revoke_token_family(
    db_session: Session | None,
    token_family_id: str,
    user_id: int,
) -> None:
    r = get_async_redis_client()
    if not r:
        return
    members = await r.smembers(_user_sessions_key(user_id))
    for member in members:
        sid = member.decode() if isinstance(member, bytes) else member
        data = await _read_session_from_redis(sid)
        if data and data.token_family_id == token_family_id:
            await _delete_session_from_redis(sid, user_id)
            _audit_revoke(db_session, sid)


async def revoke_all_user_sessions(db_session: Session | None, user_id: int) -> int:
    r = get_async_redis_client()
    if not r:
        return 0
    members = await r.smembers(_user_sessions_key(user_id))
    if not members:
        return 0

    # Batch-delete all session keys plus the user set in one pipeline pass
    session_keys = [
        _session_key(m.decode() if isinstance(m, bytes) else m) for m in members
    ]
    async with r.pipeline(transaction=False) as pipe:
        for key in session_keys:
            await pipe.delete(key)
        await pipe.delete(_user_sessions_key(user_id))
        await pipe.execute()

    # Audit revocations (synchronous DB writes, best-effort)
    for member in members:
        sid = member.decode() if isinstance(member, bytes) else member
        _audit_revoke(db_session, sid)

    return len(members)


async def get_user_active_sessions(user_id: int) -> list[dict]:
    r = get_async_redis_client()
    if not r:
        return []
    members = await r.smembers(_user_sessions_key(user_id))
    result = []
    for member in members:
        sid = member.decode() if isinstance(member, bytes) else member
        data = await _read_session_from_redis(sid)
        if data:
            result.append(
                {
                    "session_id": data.session_id,
                    "ip_address": data.ip_address,
                    "user_agent": data.user_agent,
                    "created_at": data.created_at,
                    "last_seen_at": data.last_seen_at,
                }
            )
    return result
