from __future__ import annotations

from datetime import date

from sqlmodel import Session


def refresh_teacher_analytics_rollups(db_session: Session, *, org_id: int | None = None, snapshot_date: date | None = None) -> dict[str, object]:
    target_date = snapshot_date or date.today()
    # Live queries currently power the dashboard. This refresh hook exists so scheduled
    # jobs can be wired without blocking the analytics API rollout.
    return {
        "status": "ok",
        "org_id": org_id,
        "snapshot_date": target_date.isoformat(),
        "message": "Teacher analytics currently use live read models; rollup refresh hook is available for scheduling.",
    }
