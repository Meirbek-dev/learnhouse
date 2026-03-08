from __future__ import annotations

import csv
import io

from sqlmodel import Session

from src.services.analytics.assessments import build_assessment_rows
from src.services.analytics.filters import AnalyticsFilters
from src.services.analytics.queries import load_analytics_context, progress_snapshots
from src.services.analytics.risk import build_risk_rows
from src.services.analytics.scope import TeacherAnalyticsScope


MAX_EXPORT_ROWS = 50_000


def _csv_string(headers: list[str], rows: list[list[object]]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(rows[:MAX_EXPORT_ROWS])
    return output.getvalue()


def export_at_risk_csv(db_session: Session, scope: TeacherAnalyticsScope, filters: AnalyticsFilters) -> str:
    context = load_analytics_context(db_session, scope.course_ids)
    rows = build_risk_rows(context, filters)
    return _csv_string(
        [
            "user_id",
            "user_display_name",
            "course_id",
            "course_name",
            "progress_pct",
            "days_since_last_activity",
            "risk_score",
            "risk_level",
            "reason_codes",
            "recommended_action",
        ],
        [
            [
                row.user_id,
                row.user_display_name,
                row.course_id,
                row.course_name,
                row.progress_pct,
                row.days_since_last_activity,
                row.risk_score,
                row.risk_level,
                ";".join(row.reason_codes),
                row.recommended_action,
            ]
            for row in rows
        ],
    )


def export_grading_backlog_csv(db_session: Session, scope: TeacherAnalyticsScope, _filters: AnalyticsFilters) -> str:
    context = load_analytics_context(db_session, scope.course_ids)
    rows = []
    for submission, assignment in context.assignment_submissions:
        if submission.submission_status.value not in {"SUBMITTED", "LATE"}:
            continue
        user = context.users_by_id.get(submission.user_id)
        rows.append(
            [
                submission.user_id,
                user.username if user else "Unknown",
                assignment.course_id,
                context.courses_by_id[assignment.course_id].name,
                assignment.id,
                assignment.title,
                submission.submission_status.value,
                getattr(submission, "submitted_at", None) or submission.update_date,
            ]
        )
    return _csv_string(
        ["user_id", "user_name", "course_id", "course_name", "assignment_id", "assignment_title", "status", "submitted_at"],
        rows,
    )


def export_course_progress_csv(db_session: Session, scope: TeacherAnalyticsScope, _filters: AnalyticsFilters) -> str:
    context = load_analytics_context(db_session, scope.course_ids)
    snapshots = progress_snapshots(context)
    return _csv_string(
        ["course_id", "course_name", "user_id", "user_display_name", "progress_pct", "completed_steps", "total_steps", "last_activity_at", "has_certificate"],
        [
            [
                snapshot.course_id,
                context.courses_by_id[snapshot.course_id].name,
                snapshot.user_id,
                (context.users_by_id[snapshot.user_id].username if snapshot.user_id in context.users_by_id else "Unknown"),
                snapshot.progress_pct,
                snapshot.completed_steps,
                snapshot.total_steps,
                snapshot.last_activity_at.isoformat() if snapshot.last_activity_at else None,
                snapshot.has_certificate,
            ]
            for snapshot in snapshots.values()
        ],
    )


def export_assessment_outcomes_csv(db_session: Session, scope: TeacherAnalyticsScope, _filters: AnalyticsFilters) -> str:
    context = load_analytics_context(db_session, scope.course_ids)
    rows = build_assessment_rows(context)
    return _csv_string(
        ["assessment_type", "assessment_id", "course_id", "course_name", "title", "submission_rate", "pass_rate", "median_score", "difficulty_score", "outlier_reason_codes"],
        [
            [
                row.assessment_type,
                row.assessment_id,
                row.course_id,
                row.course_name,
                row.title,
                row.submission_rate,
                row.pass_rate,
                row.median_score,
                row.difficulty_score,
                ";".join(row.outlier_reason_codes),
            ]
            for row in rows
        ],
    )
