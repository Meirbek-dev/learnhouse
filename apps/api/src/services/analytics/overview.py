from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlmodel import Session

from src.db.analytics import DailyTeacherMetrics, LearnerRiskSnapshot
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


def _metric(label: str, value: float, previous: float | None, *, unit: str | None = None, is_higher_better: bool = True) -> MetricCard:
    delta_value = round(value - previous, 1) if previous is not None else None
    # When previous is 0 and current is non-zero, delta_pct is infinite — return None and
    # let the frontend display "no prior data" rather than the misleading "Stable" label.
    delta_pct = round(((value - previous) / previous) * 100, 1) if previous not in (None, 0) else None
    return MetricCard(
        value=round(value, 1),
        delta_value=delta_value,
        delta_pct=delta_pct,
        direction=direction_for_delta(delta_value),
        label=label,
        unit=unit,
        is_higher_better=is_higher_better,
    )


def _query_previous_at_risk_count(db_session: Session, org_id: int, course_ids: list[int], before_date: date) -> float:
    """Return the at-risk learner count from the most recent LearnerRiskSnapshot before *before_date*."""
    latest_date_result = db_session.exec(
        select(func.max(LearnerRiskSnapshot.snapshot_date)).where(
            LearnerRiskSnapshot.org_id == org_id,
            LearnerRiskSnapshot.snapshot_date < before_date,
        )
    ).one_or_none()
    latest_date = latest_date_result if isinstance(latest_date_result, date) else None
    if latest_date is None:
        return 0.0
    filter_clause = [
        LearnerRiskSnapshot.org_id == org_id,
        LearnerRiskSnapshot.snapshot_date == latest_date,
        LearnerRiskSnapshot.risk_level.in_(["medium", "high"]),
    ]
    if course_ids:
        filter_clause.append(LearnerRiskSnapshot.course_id.in_(course_ids))
    result = db_session.exec(
        select(func.count()).select_from(LearnerRiskSnapshot).where(*filter_clause)
    ).one_or_none()
    return float(result if result is not None else 0)


def _query_previous_negative_engagement(db_session: Session, org_id: int, teacher_user_id: int, before_date: date) -> float:
    """Return the courses_with_negative_engagement from the most recent DailyTeacherMetrics before *before_date*."""
    stmt = select(DailyTeacherMetrics).where(
        DailyTeacherMetrics.org_id == org_id,
        DailyTeacherMetrics.teacher_user_id == teacher_user_id,
        DailyTeacherMetrics.metric_date < before_date,
    ).order_by(DailyTeacherMetrics.metric_date.desc()).limit(1)
    row = db_session.exec(stmt).first()
    return float(row.courses_with_negative_engagement) if row is not None else 0.0


def get_teacher_overview(db_session: Session, scope: TeacherAnalyticsScope, filters: AnalyticsFilters) -> TeacherOverviewResponse:
    # Pre-compute window bounds so we can pass them as date filters to load_analytics_context,
    # avoiding a full unbounded pull of TrailStep/TrailRun for every period.
    now = None  # will be resolved inside window_bounds using system clock
    _pre_start, _pre_end = filters.window_bounds(now=now)
    previous_start_pre, _ = filters.previous_window_bounds(now=now)
    # Fetch data starting from the previous period so delta calculations have the earlier data.
    context = load_analytics_context(db_session, scope.course_ids, activity_start=previous_start_pre)
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
    # Previous-period completion rate: count learners who completed and whose last activity
    # was before the current window start (proxy for "completed before this period").
    # Use all enrolled as denominator to keep it comparable to the current period rate.
    previous_completions = sum(
        1 for snapshot in snapshots.values()
        if snapshot.is_completed
        and snapshot.last_activity_at is not None
        and snapshot.last_activity_at < current_start
    )
    previous_completion_rate = safe_pct(previous_completions, enrolled) or 0.0
    at_risk_count = sum(1 for row in risk_rows if row.risk_level in {"medium", "high"})
    # Query the most recent LearnerRiskSnapshot before the current window to get a real previous value.
    previous_at_risk: float = _query_previous_at_risk_count(db_session, scope.org_id, scope.course_ids, previous_end.date())
    ungraded_submissions = sum(
        1
        for submission, _assignment in context.assignment_submissions
        if submission.submission_status.value in {"SUBMITTED", "LATE"}
        and (allowed_user_ids is None or submission.user_id in allowed_user_ids)
    )

    # Pass shared context to avoid a second full load inside build_course_rows
    generated_rows_timestamp, course_rows = build_course_rows(scope, filters, db_session, context=context)
    negative_engagement_courses = sum(1 for row in course_rows if row.engagement_delta_pct is not None and row.engagement_delta_pct < 0)
    # Query the previous period's DailyTeacherMetrics to get actual previous value instead of hardcoded 0.
    previous_negative_engagement: float = _query_previous_negative_engagement(
        db_session, scope.org_id, scope.teacher_user_id, previous_end.date()
    )

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
                title="Риск учащихся требует вмешательства",
                body=f"{at_risk_count} учащихся в текущем охвате имеют средний или высокий уровень риска.",
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
                "Активные учащиеся",
                float(teacher_rollup.active_learners_7d if teacher_rollup is not None and filters.window == "7d" else teacher_rollup.active_learners_28d if teacher_rollup is not None else len(current_active_users)),
                float(len(previous_active_users)),
                is_higher_better=True,
            ),
            returning_learners=_metric(
                "Вернувшиеся учащиеся",
                # Only use the 28d rollup when the window is actually 28d; otherwise use live computation.
                float(teacher_rollup.returning_learners_28d if teacher_rollup is not None and filters.window == "28d" else returning_learners),
                float(previous_returning),
                is_higher_better=True,
            ),
            completion_rate=_metric(
                "Доля завершения",
                float(teacher_rollup.completion_rate if teacher_rollup is not None and teacher_rollup.completion_rate is not None else completion_rate),
                float(previous_completion_rate),
                unit="%",
                is_higher_better=True,
            ),
            at_risk_learners=_metric(
                "Учащиеся в зоне риска",
                float(teacher_rollup.at_risk_learners if teacher_rollup is not None else at_risk_count),
                float(previous_at_risk),
                is_higher_better=False,
            ),
            ungraded_submissions=_metric("Непроверенные отправки", float(teacher_rollup.ungraded_submissions if teacher_rollup is not None else ungraded_submissions), None, is_higher_better=False),
            negative_engagement_courses=_metric(
                "Курсы со снижением вовлеченности",
                float(teacher_rollup.courses_with_negative_engagement if teacher_rollup is not None else negative_engagement_courses),
                float(previous_negative_engagement),
                is_higher_better=False,
            ),
        ),
        trends=trends,
        alerts=alerts,
        at_risk_preview=risk_rows[:8],
    )
