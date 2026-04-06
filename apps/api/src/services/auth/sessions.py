import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlmodel import Session, select

from src.db.auth_sessions import AuthSession
from src.db.users import User

REFRESH_SESSION_EXPIRE = timedelta(days=30)


@dataclass(slots=True)
class RotatedSessionTokens:
    access_token: str
    refresh_token: str
    session: AuthSession
    user: User


def _now() -> datetime:
    return datetime.now(UTC)


def hash_refresh_token(refresh_token: str) -> str:
    return hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def generate_session_id() -> str:
    return f"sess_{uuid4().hex}"


def generate_token_family_id() -> str:
    return f"fam_{uuid4().hex}"


def create_auth_session(
    db_session: Session,
    *,
    user_id: int,
    ip_address: str | None,
    user_agent: str | None,
    token_family_id: str | None = None,
    expires_delta: timedelta | None = None,
) -> tuple[AuthSession, str]:
    now = _now()
    refresh_token = generate_refresh_token()
    auth_session = AuthSession(
        session_id=generate_session_id(),
        token_family_id=token_family_id or generate_token_family_id(),
        user_id=user_id,
        refresh_token_hash=hash_refresh_token(refresh_token),
        created_at=now,
        last_seen_at=now,
        expires_at=now + (expires_delta or REFRESH_SESSION_EXPIRE),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db_session.add(auth_session)
    db_session.commit()
    db_session.refresh(auth_session)
    return auth_session, refresh_token


def get_session_by_id(db_session: Session, session_id: str) -> AuthSession | None:
    return db_session.exec(
        select(AuthSession).where(AuthSession.session_id == session_id)
    ).first()


def get_session_by_refresh_token(
    db_session: Session, refresh_token: str
) -> AuthSession | None:
    return db_session.exec(
        select(AuthSession).where(
            AuthSession.refresh_token_hash == hash_refresh_token(refresh_token)
        )
    ).first()


def revoke_session(
    db_session: Session, auth_session: AuthSession, *, commit: bool = True
) -> None:
    now = _now()
    auth_session.revoked_at = auth_session.revoked_at or now
    auth_session.rotated_at = auth_session.rotated_at or now
    db_session.add(auth_session)
    if commit:
        db_session.commit()


def revoke_token_family(
    db_session: Session, token_family_id: str, *, commit: bool = True
) -> int:
    now = _now()
    sessions = db_session.exec(
        select(AuthSession).where(AuthSession.token_family_id == token_family_id)
    ).all()

    revoked = 0
    for auth_session in sessions:
        if auth_session.revoked_at is None:
            auth_session.revoked_at = now
            db_session.add(auth_session)
            revoked += 1

    if commit and revoked > 0:
        db_session.commit()

    return revoked


def validate_active_session(auth_session: AuthSession | None) -> AuthSession | None:
    if auth_session is None:
        return None

    now = _now()
    if auth_session.revoked_at is not None:
        return None
    if auth_session.expires_at <= now:
        return None
    return auth_session


def rotate_session(
    db_session: Session,
    *,
    auth_session: AuthSession,
    ip_address: str | None,
    user_agent: str | None,
) -> tuple[AuthSession, str]:
    now = _now()
    auth_session.revoked_at = now
    auth_session.rotated_at = now
    db_session.add(auth_session)
    db_session.flush()

    new_session, refresh_token = create_auth_session(
        db_session,
        user_id=auth_session.user_id,
        ip_address=ip_address,
        user_agent=user_agent,
        token_family_id=auth_session.token_family_id,
        expires_delta=auth_session.expires_at - now,
    )
    auth_session.replaced_by_session_id = new_session.session_id
    db_session.add(auth_session)
    db_session.commit()
    db_session.refresh(auth_session)
    return new_session, refresh_token


def resolve_refresh_session(
    db_session: Session, refresh_token: str
) -> AuthSession | None:
    auth_session = get_session_by_refresh_token(db_session, refresh_token)
    if auth_session is None:
        return None

    now = _now()
    if auth_session.expires_at <= now:
        revoke_session(db_session, auth_session)
        return None

    if auth_session.revoked_at is not None:
        revoke_token_family(db_session, auth_session.token_family_id)
        return None

    auth_session.last_seen_at = now
    db_session.add(auth_session)
    db_session.commit()
    db_session.refresh(auth_session)
    return auth_session


def get_user_for_session(db_session: Session, auth_session: AuthSession) -> User | None:
    return db_session.exec(select(User).where(User.id == auth_session.user_id)).first()
