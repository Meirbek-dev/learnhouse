"""Session management - Redis-primary, PostgreSQL audit-only."""

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
from src.services.cache.redis_client import get_redis_client

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


def _write_session_to_redis(data: SessionData, ttl: int) -> None:
    r = get_redis_client()
    if not r:
        return
    payload = json.dumps(
        {
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
    )
    pipe = r.pipeline()
    pipe.set(_session_key(data.session_id), payload, ex=ttl)
    pipe.sadd(_user_sessions_key(data.user_id), data.session_id)
    pipe.expire(_user_sessions_key(data.user_id), REFRESH_SESSION_HARD_CAP)
    pipe.execute()


def _read_session_from_redis(session_id: str) -> SessionData | None:
    r = get_redis_client()
    if not r:
        return None
    raw = r.get(_session_key(session_id))
    if not raw:
        return None
    try:
        d = json.loads(raw)
        return SessionData(**d)
    except Exception:
        logger.warning("Corrupt session in Redis: %s", session_id)
        return None


def _delete_session_from_redis(session_id: str, user_id: int) -> None:
    r = get_redis_client()
    if not r:
        return
    pipe = r.pipeline()
    pipe.delete(_session_key(session_id))
    pipe.srem(_user_sessions_key(user_id), session_id)
    pipe.execute()


def _find_session_by_refresh_token(refresh_token: str) -> SessionData | None:
    session_id = _extract_session_id(refresh_token)
    if session_id is None:
        return None
    data = _read_session_from_redis(session_id)
    if data is None:
        return None
    if data.refresh_token_hash != hash_refresh_token(refresh_token):
        return None
    return data


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
        from sqlmodel import select

        record = db_session.exec(
            select(AuthSession).where(AuthSession.session_id == session_id)
        ).first()
        if record and record.revoked_at is None:
            record.revoked_at = datetime.now(UTC)
            db_session.add(record)
            db_session.commit()
    except Exception:
        logger.warning("Audit revoke failed for session %s", session_id)


def create_auth_session(
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
    _write_session_to_redis(data, REFRESH_SESSION_TTL)
    _audit_create(db_session, data)
    return data, refresh_token


def get_session_by_id(session_id: str) -> SessionData | None:
    return _read_session_from_redis(session_id)


def get_session_owner_id(db_session: Session | None, session_id: str) -> int | None:
    active = _read_session_from_redis(session_id)
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


def inspect_refresh_session(
    db_session: Session, refresh_token: str
) -> RefreshSessionInspection:
    session_id = _extract_session_id(refresh_token)
    if session_id is None:
        return RefreshSessionInspection(status="invalid")

    data = _find_session_by_refresh_token(refresh_token)
    if data is not None:
        now = _now_ts()
        if now >= data.absolute_expires_at:
            _delete_session_from_redis(data.session_id, data.user_id)
            _audit_revoke(db_session, data.session_id)
            return RefreshSessionInspection(
                status="expired",
                session_id=data.session_id,
                token_family_id=data.token_family_id,
                user_id=data.user_id,
            )

        data.last_seen_at = now
        remaining = min(REFRESH_SESSION_TTL, data.absolute_expires_at - now)
        _write_session_to_redis(data, remaining)
        return RefreshSessionInspection(
            status="active",
            session=data,
            session_id=data.session_id,
            token_family_id=data.token_family_id,
            user_id=data.user_id,
        )

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

    return RefreshSessionInspection(
        status="reused" if record.replaced_by_session_id else "revoked",
        session_id=session_id,
        token_family_id=record.token_family_id,
        user_id=record.user_id,
    )


def resolve_refresh_session(
    db_session: Session, refresh_token: str
) -> SessionData | None:
    inspection = inspect_refresh_session(db_session, refresh_token)
    return inspection.session if inspection.status == "active" else None


def rotate_session(
    db_session: Session,
    *,
    old_session: SessionData,
    user: User,
    ip_address: str | None,
    user_agent: str | None,
) -> tuple[SessionData, str]:
    now = _now_ts()
    _delete_session_from_redis(old_session.session_id, old_session.user_id)
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
    _write_session_to_redis(new_data, remaining)

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


def revoke_session(db_session: Session | None, session_id: str, user_id: int) -> None:
    _delete_session_from_redis(session_id, user_id)
    _audit_revoke(db_session, session_id)


def revoke_token_family(
    db_session: Session | None,
    token_family_id: str,
    user_id: int,
) -> None:
    r = get_redis_client()
    if not r:
        return
    for member in r.smembers(_user_sessions_key(user_id)):
        sid = member.decode() if isinstance(member, bytes) else member
        data = _read_session_from_redis(sid)
        if data and data.token_family_id == token_family_id:
            _delete_session_from_redis(sid, user_id)
            _audit_revoke(db_session, sid)


def revoke_all_user_sessions(db_session: Session | None, user_id: int) -> int:
    r = get_redis_client()
    if not r:
        return 0
    count = 0
    for member in r.smembers(_user_sessions_key(user_id)):
        sid = member.decode() if isinstance(member, bytes) else member
        _delete_session_from_redis(sid, user_id)
        _audit_revoke(db_session, sid)
        count += 1
    r.delete(_user_sessions_key(user_id))
    return count


def get_user_active_sessions(user_id: int) -> list[dict]:
    r = get_redis_client()
    if not r:
        return []
    result = []
    for member in r.smembers(_user_sessions_key(user_id)):
        sid = member.decode() if isinstance(member, bytes) else member
        data = _read_session_from_redis(sid)
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
