from collections import deque
from datetime import UTC, datetime
from threading import Lock

from pydantic import BaseModel


class RoleAuditEvent(BaseModel):
    timestamp: datetime
    actor_id: int | None = None
    action: str
    target_role_id: int | None = None
    target_role_slug: str | None = None
    org_id: int | None = None
    diff_summary: str | None = None


class RoleAuditListResponse(BaseModel):
    items: list[RoleAuditEvent]
    total: int
    page: int
    page_size: int


_events: deque[RoleAuditEvent] = deque(maxlen=5000)
_lock = Lock()


def append_role_audit_event(
    *,
    actor_id: int | None,
    action: str,
    target_role_id: int | None,
    target_role_slug: str | None,
    org_id: int | None,
    diff_summary: str | None = None,
) -> None:
    event = RoleAuditEvent(
        timestamp=datetime.now(UTC),
        actor_id=actor_id,
        action=action,
        target_role_id=target_role_id,
        target_role_slug=target_role_slug,
        org_id=org_id,
        diff_summary=diff_summary,
    )
    with _lock:
        _events.appendleft(event)


def list_role_audit_events(org_id: int | None = None) -> list[RoleAuditEvent]:
    with _lock:
        events = list(_events)
    if org_id is None:
        return events
    return [event for event in events if event.org_id == org_id]
