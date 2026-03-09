from __future__ import annotations

from datetime import timedelta

from sqlmodel import Session

from src.services.analytics.courses import build_course_rows
from src.services.analytics.filters import AnalyticsFilters
from src.services.analytics.queries import (
    ActivityEvent,
    build_activity_events,
    build_series,
    cohort_user_ids,
    direction_for_delta,
    load_analytics_context,
    parse_timestamp,
    progress_snapshots,
    safe_pct,
    to_tz_iso,
    to_iso,
)
from src.services.analytics.risk import build_risk_rows
from src.services.analytics.rollups import freshness_seconds_from_rollup, get_latest_teacher_rollup, supports_rollup_reads
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
    allowed_user_ids = cohort_user_ids(context, filters.cohort_ids)
    events = build_activity_events(context, allowed_user_ids)
    snapshots = progress_snapshots(context, allowed_user_ids)
    risk_rows = build_risk_rows(context, filters)
    generated_at = context.generated_at
    current_start, current_end = filters.window_bounds(now=generated_at)
    previous_start, previous_end = filters.previous_window_bounds(now=generated_at)

    current_active_users = {event.user_id for event in events if event.ts >= current_start}
    previous_active_users = {event.user_id for event in events if previous_start <= event.ts < previous_end}
    returning_learners = len(current_active_users & previous_active_users)
    previous_returning = len(
        {event.user_id for event in events if previous_start <= event.ts < previous_end}
        & {event.user_id for event in events if (previous_start - timedelta(days=filters.window_days)) <= event.ts < previous_start}
    )
    teacher_rollup = None
    if supports_rollup_reads(filters):
        teacher_rollup = get_latest_teacher_rollup(
            db_session,
            org_id=scope.org_id,
            teacher_user_id=scope.teacher_user_id,
        )

    enrolled = len(snapshots)
    completion_rate = safe_pct(sum(1 for snapshot in snapshots.values() if snapshot.is_completed), enrolled) or 0.0
    previous_snapshots = progress_snapshots(context, allowed_user_ids)
    # Derive previous-period completion from events in the prior window
    previous_active_set = {event.user_id for event in events if previous_start <= event.ts < previous_end}
    previous_completion_rate = safe_pct(
        sum(1 for snapshot in snapshots.values() if snapshot.is_completed and snapshot.user_id in previous_active_set),
        len(previous_active_set),
    ) or 0.0
    at_risk_count = sum(1 for row in risk_rows if row.risk_level in {"medium", "high"})
    previous_at_risk = at_risk_count  # no prior snapshot available in live path; neutral delta
    ungraded_submissions = sum(
        1
        for submission, _assignment in context.assignment_submissions
        if submission.submission_status.value in {"SUBMITTED", "LATE"}
        and (allowed_user_ids is None or submission.user_id in allowed_user_ids)
    )

    # Pass shared context to avoid a second full load inside build_course_rows
    generated_rows_timestamp, course_rows = build_course_rows(scope, filters, db_session, context=context)
    negative_engagement_courses = sum(1 for row in course_rows if row.engagement_delta_pct is not None and row.engagement_delta_pct < 0)
    previous_negative_engagement = 0  # baseline for delta; no prior rollup in live path

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
        if allowed_user_ids is not None and submission.user_id not in allowed_user_ids:
            continue
        if submission.submission_status.value != "GRADED":
            continue
        graded_at = getattr(submission, "graded_at", None) or submission.update_date
        ts = parse_timestamp(graded_at)
        if ts is None:
            continue
        grading_events.append(ActivityEvent(user_id=submission.user_id, course_id=assignment.course_id, ts=ts, source="graded_assignment"))

    trends = TeacherOverviewTrends(
        active_learners=[TimeSeriesPoint(bucket_start=to_tz_iso(bucket, filters.tzinfo) or "", value=value) for bucket, value in build_series(events, filters.bucket, current_start, current_end, distinct_users=True, tzinfo=filters.tzinfo)],
        completions=[TimeSeriesPoint(bucket_start=to_tz_iso(bucket, filters.tzinfo) or "", value=value) for bucket, value in build_series(completions_events, filters.bucket, current_start, current_end, tzinfo=filters.tzinfo)],
        submissions=[TimeSeriesPoint(bucket_start=to_tz_iso(bucket, filters.tzinfo) or "", value=value) for bucket, value in build_series(submission_events, filters.bucket, current_start, current_end, tzinfo=filters.tzinfo)],
        grading_completed=[TimeSeriesPoint(bucket_start=to_tz_iso(bucket, filters.tzinfo) or "", value=value) for bucket, value in build_series(grading_events, filters.bucket, current_start, current_end, tzinfo=filters.tzinfo)],
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
        # For live queries, freshness is how long data is "stale" within the window (always live = 0).
        # Report the age of the rollup if one exists; otherwise report 0 indicating real-time live data.
        freshness_seconds=freshness_seconds_from_rollup(teacher_rollup.generated_at if teacher_rollup is not None else None),
        window=filters.window,
        compare=filters.compare,
        scope=TeacherOverviewScope(
            org_id=scope.org_id,
            teacher_user_id=scope.teacher_user_id,
            course_ids=scope.course_ids,
            cohort_ids=scope.cohort_ids,
        ),
        summary=TeacherOverviewSummary(
            active_learners=_metric(
                "Active learners",
                float(teacher_rollup.active_learners_7d if teacher_rollup is not None and filters.window == "7d" else teacher_rollup.active_learners_28d if teacher_rollup is not None else len(current_active_users)),
                float(len(previous_active_users)),
            ),
            returning_learners=_metric(
                "Returning learners",
                float(teacher_rollup.returning_learners_28d if teacher_rollup is not None else returning_learners),
                float(previous_returning),
            ),
            completion_rate=_metric(
                "Completion rate",
                float(teacher_rollup.completion_rate if teacher_rollup is not None and teacher_rollup.completion_rate is not None else completion_rate),
                float(previous_completion_rate),
            ),
            at_risk_learners=_metric(
                "At-risk learners",
                float(teacher_rollup.at_risk_learners if teacher_rollup is not None else at_risk_count),
                float(previous_at_risk),
            ),
            ungraded_submissions=_metric("Ungraded submissions", float(teacher_rollup.ungraded_submissions if teacher_rollup is not None else ungraded_submissions), None),
            negative_engagement_courses=_metric(
                "Courses with declining engagement",
                float(teacher_rollup.courses_with_negative_engagement if teacher_rollup is not None else negative_engagement_courses),
                float(previous_negative_engagement),
            ),
        ),
        trends=trends,
        alerts=alerts,
        at_risk_preview=risk_rows[:8],
    )
