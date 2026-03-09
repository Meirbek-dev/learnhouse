from __future__ import annotations

import csv
import io
from collections.abc import Iterable, Iterator

from sqlmodel import Session

from src.services.analytics.assessments import build_assessment_rows
from src.services.analytics.filters import AnalyticsFilters
from src.services.analytics.queries import cohort_user_ids, load_analytics_context, progress_snapshots
from src.services.analytics.risk import build_risk_rows
from src.services.analytics.scope import TeacherAnalyticsScope


MAX_EXPORT_ROWS = 50_000


def _csv_string(headers: list[str], rows: list[list[object]]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(rows[:MAX_EXPORT_ROWS])
    return output.getvalue()


def _csv_stream(headers: list[str], rows: Iterable[list[object]]) -> Iterator[str]:
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(headers)
    yield output.getvalue()
    output.seek(0)
    output.truncate(0)

    for index, row in enumerate(rows):
        if index >= MAX_EXPORT_ROWS:
            break
        writer.writerow(row)
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)


def export_at_risk_csv(db_session: Session, scope: TeacherAnalyticsScope, filters: AnalyticsFilters) -> Iterator[str]:
    context = load_analytics_context(db_session, scope.course_ids)
    rows = build_risk_rows(context, filters)
    return _csv_stream(
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


def export_grading_backlog_csv(db_session: Session, scope: TeacherAnalyticsScope, filters: AnalyticsFilters) -> Iterator[str]:
    context = load_analytics_context(db_session, scope.course_ids)
    allowed_user_ids = cohort_user_ids(context, filters.cohort_ids)

    def row_iter() -> Iterator[list[object]]:
        for submission, assignment in context.assignment_submissions:
            if submission.submission_status.value not in {"SUBMITTED", "LATE"}:
                continue
            if allowed_user_ids is not None and submission.user_id not in allowed_user_ids:
                continue
            user = context.users_by_id.get(submission.user_id)
            yield [
                submission.user_id,
                user.username if user else "Unknown",
                assignment.course_id,
                context.courses_by_id[assignment.course_id].name,
                assignment.id,
                assignment.title,
                submission.submission_status.value,
                getattr(submission, "submitted_at", None) or submission.update_date,
            ]

    return _csv_stream(
        ["user_id", "user_name", "course_id", "course_name", "assignment_id", "assignment_title", "status", "submitted_at"],
        row_iter(),
    )


def export_course_progress_csv(db_session: Session, scope: TeacherAnalyticsScope, filters: AnalyticsFilters) -> Iterator[str]:
    context = load_analytics_context(db_session, scope.course_ids)
    allowed_user_ids = cohort_user_ids(context, filters.cohort_ids)
    snapshots = progress_snapshots(context, allowed_user_ids)

    def row_iter() -> Iterator[list[object]]:
        for snapshot in snapshots.values():
            yield [
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

    return _csv_stream(
        ["course_id", "course_name", "user_id", "user_display_name", "progress_pct", "completed_steps", "total_steps", "last_activity_at", "has_certificate"],
        row_iter(),
    )


def export_assessment_outcomes_csv(db_session: Session, scope: TeacherAnalyticsScope, filters: AnalyticsFilters) -> Iterator[str]:
    context = load_analytics_context(db_session, scope.course_ids)
    rows = build_assessment_rows(context, filters)
    return _csv_stream(
        ["assessment_type", "assessment_id", "course_id", "course_name", "title", "submission_rate", "pass_rate", "median_score", "difficulty_score", "outlier_reason_codes"],
        (
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
        ),
    )
