"""Structured audit log for security events.

All writes are append-only. The table is never read during token validation.
"""

import logging
from datetime import datetime
from typing import Any

from sqlmodel import Session

from src.db.auth_audit_log import AuthAuditLog

logger = logging.getLogger(__name__)


def write_audit_event(
    db_session: Session,
    *,
    event_type: str,
    user_id: str | None = None,
    session_id: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    metadata: dict[str, Any] | None = None,
    severity: str = "info",
) -> None:
    """Write a security audit event to the database.

    Never raises — audit failures must not block auth flows.
    """
    try:
        entry = AuthAuditLog(
            created_at=datetime.utcnow(),
            user_id=user_id,
            event_type=event_type,
            session_id=session_id,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata_=metadata,
            severity=severity,
        )
        db_session.add(entry)
        db_session.commit()
    except Exception:
        logger.exception("Failed to write audit event: %s", event_type)
