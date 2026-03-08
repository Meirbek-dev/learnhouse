from __future__ import annotations

from sqlmodel import Session

from src.services.analytics.courses import build_course_rows
from src.services.analytics.filters import AnalyticsFilters
from src.services.analytics.queries import (
    ActivityEvent,
    build_activity_events,
    build_series,
    direction_for_delta,
    load_analytics_context,
    parse_timestamp,
    progress_snapshots,
    safe_pct,
    to_iso,
)
from src.services.analytics.risk import build_risk_rows
from src.services.analytics.schemas import (
    AlertItem,
    MetricCard,
    TeacherOverviewResponse,
    TeacherOverviewScope,
    TeacherOverviewSummary,
    TeacherOverviewTrends,
    TimeSeriesPoint,
)
from src.services.analytics.scope import TeacherAnalyticsScope


def _metric(label: str, value: float, previous: float | None) -> MetricCard:
    delta_value = round(value - previous, 1) if previous is not None else None
    delta_pct = round(((value - previous) / previous) * 100, 1) if previous not in (None, 0) else None
    return MetricCard(
        value=round(value, 1),
        delta_value=delta_value,
        delta_pct=delta_pct,
        direction=direction_for_delta(delta_value),
        label=label,
    )


def get_teacher_overview(db_session: Session, scope: TeacherAnalyticsScope, filters: AnalyticsFilters) -> TeacherOverviewResponse:
    context = load_analytics_context(db_session, scope.course_ids)
    events = build_activity_events(context)
    snapshots = progress_snapshots(context)
    risk_rows = build_risk_rows(context, filters)
    generated_at = context.generated_at
    current_start, current_end = filters.window_bounds(now=generated_at)
    previous_start, previous_end = filters.previous_window_bounds(now=generated_at)

    current_active_users = {event.user_id for event in events if event.ts >= current_start}
    previous_active_users = {event.user_id for event in events if previous_start <= event.ts < previous_end}
    returning_learners = len(current_active_users & previous_active_users)

    enrolled = len(snapshots)
    completion_rate = safe_pct(sum(1 for snapshot in snapshots.values() if snapshot.is_completed), enrolled) or 0.0
    at_risk_count = sum(1 for row in risk_rows if row.risk_level in {"medium", "high"})
    ungraded_submissions = sum(
        1
        for submission, _assignment in context.assignment_submissions
        if submission.submission_status.value in {"SUBMITTED", "LATE"}
    )

    generated_rows_timestamp, course_rows = build_course_rows(scope, filters, db_session)
    negative_engagement_courses = sum(1 for row in course_rows if row.engagement_delta_pct is not None and row.engagement_delta_pct < 0)

    completions_events = []
    for snapshot in snapshots.values():
        if snapshot.is_completed and snapshot.last_activity_at is not None:
            completions_events.append(
                ActivityEvent(
                    user_id=snapshot.user_id,
                    course_id=snapshot.course_id,
                    ts=snapshot.last_activity_at,
                    source="completion",
                )
            )
    submission_events = [event for event in events if event.source in {"assignment", "quiz", "exam", "code_challenge"}]
    grading_events = []
    for submission, assignment in context.assignment_submissions:
        if submission.submission_status.value != "GRADED":
            continue
        graded_at = getattr(submission, "graded_at", None) or submission.update_date
        ts = parse_timestamp(graded_at)
        if ts is None:
            continue
        grading_events.append(ActivityEvent(user_id=submission.user_id, course_id=assignment.course_id, ts=ts, source="graded_assignment"))

    trends = TeacherOverviewTrends(
        active_learners=[TimeSeriesPoint(bucket_start=to_iso(bucket) or "", value=value) for bucket, value in build_series(events, filters.bucket, current_start, current_end, distinct_users=True)],
        completions=[TimeSeriesPoint(bucket_start=to_iso(bucket) or "", value=value) for bucket, value in build_series(completions_events, filters.bucket, current_start, current_end)],
        submissions=[TimeSeriesPoint(bucket_start=to_iso(bucket) or "", value=value) for bucket, value in build_series(submission_events, filters.bucket, current_start, current_end)],
        grading_completed=[TimeSeriesPoint(bucket_start=to_iso(bucket) or "", value=value) for bucket, value in build_series(grading_events, filters.bucket, current_start, current_end)],
    )

    alerts: list[AlertItem] = []
    for row in course_rows:
        if row.top_alert is not None:
            alerts.append(row.top_alert)
    if at_risk_count > 0:
        alerts.append(
            AlertItem(
                id="risk-overview",
                type="risk_spike",
                severity="critical" if at_risk_count >= 15 else "warning",
                title="Learner risk requires outreach",
                body=f"{at_risk_count} learners in your current scope are medium or high risk.",
                learner_count=at_risk_count,
            )
        )
    alerts = sorted(alerts, key=lambda alert: {"critical": 2, "warning": 1, "info": 0}[alert.severity], reverse=True)[:8]

    return TeacherOverviewResponse(
        generated_at=to_iso(generated_at) or generated_rows_timestamp,
        freshness_seconds=0,
        window=filters.window,
        compare=filters.compare,
        scope=TeacherOverviewScope(
            org_id=scope.org_id,
            teacher_user_id=scope.teacher_user_id,
            course_ids=scope.course_ids,
            cohort_ids=scope.cohort_ids,
        ),
        summary=TeacherOverviewSummary(
            active_learners=_metric("Active learners", float(len(current_active_users)), float(len(previous_active_users))),
            returning_learners=_metric("Returning learners", float(returning_learners), None),
            completion_rate=_metric("Completion rate", completion_rate, None),
            at_risk_learners=_metric("At-risk learners", float(at_risk_count), None),
            ungraded_submissions=_metric("Ungraded submissions", float(ungraded_submissions), None),
            negative_engagement_courses=_metric("Courses with declining engagement", float(negative_engagement_courses), None),
        ),
        trends=trends,
        alerts=alerts,
        at_risk_preview=risk_rows[:8],
    )
