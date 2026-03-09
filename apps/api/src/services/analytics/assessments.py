from __future__ import annotations

from collections import Counter, defaultdict

from sqlalchemy import select
from sqlmodel import Session

from src.db.courses.activities import Activity, ActivityTypeEnum
from src.db.courses.assignments import Assignment
from src.db.courses.courses import Course
from src.db.courses.exams import Exam
from src.services.analytics.filters import AnalyticsFilters
from src.services.analytics.queries import (
    AnalyticsContext,
    assessment_pass_threshold,
    cohort_user_ids,
    display_name,
    hours_between,
    load_analytics_context,
    median_or_none,
    percentile,
    progress_snapshots,
    safe_pct,
    to_iso,
)
from src.services.analytics.rollups import list_latest_assessment_rollups, supports_rollup_reads
from src.services.analytics.schemas import (
    AssessmentLearnerRow,
    AssessmentOutlierRow,
    CommonFailureRow,
    HistogramBucket,
    QuestionDifficultyRow,
    TeacherAssessmentDetailResponse,
    TeacherAssessmentDetailSummary,
    TeacherAssessmentListResponse,
)
from src.services.analytics.scope import TeacherAnalyticsScope


def _build_rollup_assessment_rows(
    db_session: Session,
    scope: TeacherAnalyticsScope,
    filters: AnalyticsFilters,
) -> tuple[str, list[AssessmentOutlierRow]] | None:
    if not supports_rollup_reads(filters):
        return None
    rollups = list_latest_assessment_rollups(db_session, org_id=scope.org_id, course_ids=scope.course_ids)
    if not rollups:
        return None

    course_map = {
        course.id: course
        for course in db_session.exec(select(Course).where(Course.id.in_(list({row.course_id for row in rollups})))).all()
    }
    assignments = {
        assignment.id: assignment
        for assignment in db_session.exec(
            select(Assignment).where(Assignment.id.in_(list({row.assessment_id for row in rollups if row.assessment_type == "assignment"})))
        ).all()
    }
    exams = {
        exam.id: exam
        for exam in db_session.exec(
            select(Exam).where(Exam.id.in_(list({row.assessment_id for row in rollups if row.assessment_type == "exam"})))
        ).all()
    }
    activities = {
        activity.id: activity
        for activity in db_session.exec(
            select(Activity).where(Activity.id.in_(list({row.assessment_id for row in rollups if row.assessment_type in {"quiz", "code_challenge"}})))
        ).all()
    }

    rows: list[AssessmentOutlierRow] = []
    for row in rollups:
        course = course_map.get(row.course_id)
        if course is None:
            continue
        if row.assessment_type == "assignment":
            title = assignments.get(row.assessment_id).title if row.assessment_id in assignments else f"Assignment {row.assessment_id}"
        elif row.assessment_type == "exam":
            title = exams.get(row.assessment_id).title if row.assessment_id in exams else f"Exam {row.assessment_id}"
        else:
            title = activities.get(row.assessment_id).name if row.assessment_id in activities else f"Assessment {row.assessment_id}"

        outlier_reason_codes: list[str] = []
        if row.submission_rate is not None and float(row.submission_rate) < 60:
            outlier_reason_codes.append("low_submission_rate")
        if row.pass_rate is not None and float(row.pass_rate) < 60:
            outlier_reason_codes.append("low_success_rate")
        if row.grading_latency_hours_p90 is not None and float(row.grading_latency_hours_p90) > 72:
            outlier_reason_codes.append("slow_feedback")

        rows.append(
            AssessmentOutlierRow(
                assessment_type=row.assessment_type,
                assessment_id=row.assessment_id,
                activity_id=row.activity_id,
                course_id=row.course_id,
                course_name=course.name,
                title=title,
                submission_rate=float(row.submission_rate) if row.submission_rate is not None else None,
                completion_rate=float(row.completion_rate) if row.completion_rate is not None else None,
                pass_rate=float(row.pass_rate) if row.pass_rate is not None else None,
                median_score=float(row.median_score) if row.median_score is not None else None,
                avg_attempts=float(row.avg_attempts) if row.avg_attempts is not None else None,
                grading_latency_hours_p50=float(row.grading_latency_hours_p50) if row.grading_latency_hours_p50 is not None else None,
                grading_latency_hours_p90=float(row.grading_latency_hours_p90) if row.grading_latency_hours_p90 is not None else None,
                difficulty_score=float(row.difficulty_score) if row.difficulty_score is not None else None,
                outlier_reason_codes=outlier_reason_codes,
            )
        )

    sort_by = filters.sort_by or "signals"
    reverse = filters.sort_order != "asc"
    sort_map = {
        "title": lambda current: current.title.lower(),
        "submission": lambda current: current.submission_rate if current.submission_rate is not None else -1,
        "pass": lambda current: current.pass_rate if current.pass_rate is not None else -1,
        "difficulty": lambda current: current.difficulty_score if current.difficulty_score is not None else -1,
        "latency": lambda current: current.grading_latency_hours_p90 if current.grading_latency_hours_p90 is not None else -1,
        "signals": lambda current: len(current.outlier_reason_codes),
    }
    rows.sort(key=sort_map.get(sort_by, sort_map["signals"]), reverse=reverse)
    generated_at = max((row.generated_at for row in rollups), default=None)
    return to_iso(generated_at) or "", rows


def _is_allowed(user_id: int, allowed_user_ids: set[int] | None) -> bool:
    return allowed_user_ids is None or user_id in allowed_user_ids


def _score_bucket(score: float | None) -> str:
    if score is None:
        return "Unknown"
    lower = int(min(80, (score // 20) * 20))
    upper = lower + 19 if lower < 80 else 100
    return f"{lower}-{upper}"


def _attempt_distribution(attempts_by_user: dict[int, int]) -> list[HistogramBucket]:
    buckets = Counter()
    for attempts in attempts_by_user.values():
        label = str(attempts if attempts < 5 else "5+")
        buckets[label] += 1
    order = ["1", "2", "3", "4", "5+"]
    return [HistogramBucket(label=label, count=buckets.get(label, 0)) for label in order if buckets.get(label, 0) > 0]


def _score_distribution(scores: list[float]) -> list[HistogramBucket]:
    buckets = Counter(_score_bucket(score) for score in scores)
    order = ["0-19", "20-39", "40-59", "60-79", "80-100", "Unknown"]
    return [HistogramBucket(label=label, count=buckets.get(label, 0)) for label in order if buckets.get(label, 0) > 0]


def _build_assignment_rows(
    context: AnalyticsContext,
    snapshots: dict[tuple[int, int], object],
    allowed_user_ids: set[int] | None,
) -> list[AssessmentOutlierRow]:
    eligible_by_course: dict[int, set[int]] = defaultdict(set)
    for course_id, user_id in snapshots.keys():
        eligible_by_course[course_id].add(user_id)

    submissions_by_assignment: dict[int, list] = defaultdict(list)
    for submission, assignment in context.assignment_submissions:
        if not _is_allowed(submission.user_id, allowed_user_ids):
            continue
        if assignment.id is not None:
            submissions_by_assignment[assignment.id].append((submission, assignment))

    rows: list[AssessmentOutlierRow] = []
    for assignment in context.assignments:
        assignment_id = assignment.id
        if assignment_id is None:
            continue
        submissions = submissions_by_assignment.get(assignment_id, [])
        eligible = len(eligible_by_course.get(assignment.course_id, set()))
        submitted = len({submission.user_id for submission, _ in submissions})
        graded = [submission for submission, _ in submissions if submission.submission_status.value == "GRADED"]
        grades = [float(submission.grade) for submission in graded]
        pass_rate = safe_pct(sum(1 for submission in graded if submission.grade >= 60), len(graded))
        latency_hours = [
            value
            for value in (hours_between(getattr(submission, "submitted_at", None), getattr(submission, "graded_at", None)) for submission in graded)
            if value is not None
        ]
        difficulty_score = round(100 - pass_rate, 2) if pass_rate is not None else None
        outlier_reason_codes: list[str] = []
        submission_rate = safe_pct(submitted, eligible)
        if submission_rate is not None and submission_rate < 60:
            outlier_reason_codes.append("low_submission_rate")
        if pass_rate is not None and pass_rate < 60:
            outlier_reason_codes.append("low_pass_rate")
        if latency_hours and percentile(latency_hours, 0.9) and percentile(latency_hours, 0.9) > 72:
            outlier_reason_codes.append("grading_latency")

        course = context.courses_by_id[assignment.course_id]
        rows.append(
            AssessmentOutlierRow(
                assessment_type="assignment",
                assessment_id=assignment_id,
                activity_id=assignment.activity_id,
                course_id=assignment.course_id,
                course_name=course.name,
                title=assignment.title,
                submission_rate=submission_rate,
                completion_rate=submission_rate,
                pass_rate=pass_rate,
                median_score=median_or_none(grades),
                avg_attempts=1.0 if submitted else None,
                grading_latency_hours_p50=percentile(latency_hours, 0.5),
                grading_latency_hours_p90=percentile(latency_hours, 0.9),
                difficulty_score=difficulty_score,
                outlier_reason_codes=outlier_reason_codes,
            )
        )
    return rows


def _build_exam_rows(
    context: AnalyticsContext,
    snapshots: dict[tuple[int, int], object],
    allowed_user_ids: set[int] | None,
) -> list[AssessmentOutlierRow]:
    eligible_by_course: dict[int, set[int]] = defaultdict(set)
    for course_id, user_id in snapshots.keys():
        eligible_by_course[course_id].add(user_id)

    attempts_by_exam: dict[int, list] = defaultdict(list)
    for attempt, exam in context.exam_attempts:
        if not _is_allowed(attempt.user_id, allowed_user_ids):
            continue
        if exam.id is not None and not attempt.is_preview:
            attempts_by_exam[exam.id].append((attempt, exam))

    rows: list[AssessmentOutlierRow] = []
    for exam in context.exams:
        exam_id = exam.id
        if exam_id is None:
            continue
        attempts = attempts_by_exam.get(exam_id, [])
        eligible = len(eligible_by_course.get(exam.course_id, set()))
        submitted_users = {attempt.user_id for attempt, _ in attempts if attempt.submitted_at}
        scores = [((float(attempt.score or 0) / float(attempt.max_score)) * 100) for attempt, _ in attempts if attempt.score is not None and attempt.max_score]
        attempts_by_user = Counter(attempt.user_id for attempt, _ in attempts)
        threshold = assessment_pass_threshold(exam.settings)
        pass_rate = safe_pct(sum(1 for score in scores if score >= threshold), len(scores))
        submission_rate = safe_pct(len(submitted_users), eligible)
        difficulty_score = round(100 - pass_rate, 2) if pass_rate is not None else None
        outlier_reason_codes: list[str] = []
        if submission_rate is not None and submission_rate < 60:
            outlier_reason_codes.append("low_completion_rate")
        if pass_rate is not None and pass_rate < threshold:
            outlier_reason_codes.append("below_threshold")

        course = context.courses_by_id[exam.course_id]
        rows.append(
            AssessmentOutlierRow(
                assessment_type="exam",
                assessment_id=exam_id,
                activity_id=exam.activity_id,
                course_id=exam.course_id,
                course_name=course.name,
                title=exam.title,
                submission_rate=submission_rate,
                completion_rate=submission_rate,
                pass_rate=pass_rate,
                median_score=median_or_none(scores),
                avg_attempts=round(sum(attempts_by_user.values()) / len(attempts_by_user), 2) if attempts_by_user else None,
                grading_latency_hours_p50=None,
                grading_latency_hours_p90=None,
                difficulty_score=difficulty_score,
                outlier_reason_codes=outlier_reason_codes,
            )
        )
    return rows


def _build_quiz_rows(
    context: AnalyticsContext,
    snapshots: dict[tuple[int, int], object],
    allowed_user_ids: set[int] | None,
) -> list[AssessmentOutlierRow]:
    eligible_by_course: dict[int, set[int]] = defaultdict(set)
    for course_id, user_id in snapshots.keys():
        eligible_by_course[course_id].add(user_id)

    attempts_by_activity: dict[int, list] = defaultdict(list)
    for attempt, activity in context.quiz_attempts:
        if not _is_allowed(attempt.user_id, allowed_user_ids):
            continue
        attempts_by_activity[activity.id].append((attempt, activity))

    rows: list[AssessmentOutlierRow] = []
    for activity_id, attempts in attempts_by_activity.items():
        activity = context.activities_by_id.get(activity_id)
        if activity is None or activity.course_id is None:
            continue
        eligible = len(eligible_by_course.get(activity.course_id, set()))
        submitted_users = {attempt.user_id for attempt, _ in attempts if attempt.end_ts}
        scores = [((float(attempt.score) / float(attempt.max_score)) * 100) for attempt, _ in attempts if attempt.end_ts and attempt.max_score]
        attempts_by_user = Counter(attempt.user_id for attempt, _ in attempts)
        pass_rate = safe_pct(sum(1 for score in scores if score >= 60), len(scores))
        submission_rate = safe_pct(len(submitted_users), eligible)
        difficulty_score = round(100 - pass_rate, 2) if pass_rate is not None else None
        outlier_reason_codes: list[str] = []
        if submission_rate is not None and submission_rate < 60:
            outlier_reason_codes.append("low_completion_rate")
        if pass_rate is not None and pass_rate < 60:
            outlier_reason_codes.append("low_accuracy")
        course = context.courses_by_id[activity.course_id]
        rows.append(
            AssessmentOutlierRow(
                assessment_type="quiz",
                assessment_id=activity_id,
                activity_id=activity_id,
                course_id=activity.course_id,
                course_name=course.name,
                title=activity.name,
                submission_rate=submission_rate,
                completion_rate=submission_rate,
                pass_rate=pass_rate,
                median_score=median_or_none(scores),
                avg_attempts=round(sum(attempts_by_user.values()) / len(attempts_by_user), 2) if attempts_by_user else None,
                grading_latency_hours_p50=None,
                grading_latency_hours_p90=None,
                difficulty_score=difficulty_score,
                outlier_reason_codes=outlier_reason_codes,
            )
        )
    return rows


def _build_code_rows(
    context: AnalyticsContext,
    snapshots: dict[tuple[int, int], object],
    allowed_user_ids: set[int] | None,
) -> list[AssessmentOutlierRow]:
    eligible_by_course: dict[int, set[int]] = defaultdict(set)
    for course_id, user_id in snapshots.keys():
        eligible_by_course[course_id].add(user_id)

    submissions_by_activity: dict[int, list] = defaultdict(list)
    for submission, activity in context.code_submissions:
        if not _is_allowed(submission.user_id, allowed_user_ids):
            continue
        submissions_by_activity[activity.id].append((submission, activity))

    rows: list[AssessmentOutlierRow] = []
    for activity_id, submissions in submissions_by_activity.items():
        activity = context.activities_by_id.get(activity_id)
        if activity is None or activity.course_id is None or activity.activity_type != ActivityTypeEnum.TYPE_CODE_CHALLENGE:
            continue
        eligible = len(eligible_by_course.get(activity.course_id, set()))
        submitted_users = {submission.user_id for submission, _ in submissions if submission.status.value == "COMPLETED"}
        scores = [float(submission.score) for submission, _ in submissions if submission.status.value == "COMPLETED"]
        attempts_by_user = Counter(submission.user_id for submission, _ in submissions)
        pass_rate = safe_pct(sum(1 for score in scores if score >= 60), len(scores))
        submission_rate = safe_pct(len(submitted_users), eligible)
        difficulty_score = round(100 - pass_rate, 2) if pass_rate is not None else None
        outlier_reason_codes: list[str] = []
        if submission_rate is not None and submission_rate < 60:
            outlier_reason_codes.append("low_submission_rate")
        if pass_rate is not None and pass_rate < 60:
            outlier_reason_codes.append("low_success_rate")
        course = context.courses_by_id[activity.course_id]
        rows.append(
            AssessmentOutlierRow(
                assessment_type="code_challenge",
                assessment_id=activity_id,
                activity_id=activity_id,
                course_id=activity.course_id,
                course_name=course.name,
                title=activity.name,
                submission_rate=submission_rate,
                completion_rate=submission_rate,
                pass_rate=pass_rate,
                median_score=median_or_none(scores),
                avg_attempts=round(sum(attempts_by_user.values()) / len(attempts_by_user), 2) if attempts_by_user else None,
                grading_latency_hours_p50=None,
                grading_latency_hours_p90=None,
                difficulty_score=difficulty_score,
                outlier_reason_codes=outlier_reason_codes,
            )
        )
    return rows


def build_assessment_rows(context: AnalyticsContext, filters: AnalyticsFilters | None = None) -> list[AssessmentOutlierRow]:
    allowed_user_ids = cohort_user_ids(context, filters.cohort_ids if filters else [])
    snapshots = progress_snapshots(context, allowed_user_ids)
    rows = [
        *_build_assignment_rows(context, snapshots, allowed_user_ids),
        *_build_quiz_rows(context, snapshots, allowed_user_ids),
        *_build_exam_rows(context, snapshots, allowed_user_ids),
        *_build_code_rows(context, snapshots, allowed_user_ids),
    ]
    sort_by = filters.sort_by if filters else None
    sort_order = filters.sort_order if filters else "desc"
    sort_map = {
        "title": lambda row: row.title.lower(),
        "submission": lambda row: row.submission_rate if row.submission_rate is not None else -1,
        "pass": lambda row: row.pass_rate if row.pass_rate is not None else -1,
        "difficulty": lambda row: row.difficulty_score if row.difficulty_score is not None else -1,
        "latency": lambda row: row.grading_latency_hours_p90 if row.grading_latency_hours_p90 is not None else -1,
        "signals": lambda row: len(row.outlier_reason_codes),
    }
    rows.sort(
        key=sort_map.get(sort_by or "signals", lambda row: (len(row.outlier_reason_codes), row.difficulty_score or 0, -(row.submission_rate or 0))),
        reverse=sort_order != "asc",
    )
    return rows


def get_teacher_assessment_list(db_session: Session, scope: TeacherAnalyticsScope, filters: AnalyticsFilters) -> TeacherAssessmentListResponse:
    rollup_rows = _build_rollup_assessment_rows(db_session, scope, filters)
    if rollup_rows is not None:
        generated_at, rows = rollup_rows
        return TeacherAssessmentListResponse(generated_at=generated_at, total=len(rows), items=rows)
    context = load_analytics_context(db_session, scope.course_ids)
    rows = build_assessment_rows(context, filters)
    return TeacherAssessmentListResponse(generated_at=to_iso(context.generated_at) or "", total=len(rows), items=rows)


def get_teacher_assessment_detail(
    db_session: Session,
    scope: TeacherAnalyticsScope,
    assessment_type: str,
    assessment_id: int,
    filters: AnalyticsFilters,
) -> TeacherAssessmentDetailResponse:
    context = load_analytics_context(db_session, scope.course_ids)
    allowed_user_ids = cohort_user_ids(context, filters.cohort_ids)
    snapshots = progress_snapshots(context, allowed_user_ids)
    eligible_by_course: dict[int, set[int]] = defaultdict(set)
    for course_id, user_id in snapshots.keys():
        eligible_by_course[course_id].add(user_id)

    if assessment_type == "assignment":
        assignment = next((item for item in context.assignments if item.id == assessment_id), None)
        if assignment is None:
            raise ValueError(f"Assignment not found: {assessment_id}")
        records = [
            (submission, _assignment)
            for submission, _assignment in context.assignment_submissions
            if _assignment.id == assessment_id and _is_allowed(submission.user_id, allowed_user_ids)
        ]
        eligible = len(eligible_by_course.get(assignment.course_id, set()))
        scores = [float(submission.grade) for submission, _ in records if submission.submission_status.value == "GRADED"]
        latencies = [
            value
            for value in (hours_between(getattr(submission, "submitted_at", None), getattr(submission, "graded_at", None)) for submission, _ in records)
            if value is not None
        ]
        attempts_by_user = Counter(submission.user_id for submission, _ in records)
        learner_rows = [
            AssessmentLearnerRow(
                user_id=submission.user_id,
                user_display_name=display_name(context.users_by_id.get(submission.user_id)),
                attempts=1,
                best_score=float(submission.grade),
                last_score=float(submission.grade),
                submitted_at=to_iso(getattr(submission, "submitted_at", None)),
                graded_at=to_iso(getattr(submission, "graded_at", None)),
                status=submission.submission_status.value,
            )
            for submission, _ in records
        ]
        common_failures = [
            CommonFailureRow(key="late", label="Late submissions", count=sum(1 for submission, _ in records if submission.submission_status.value == "LATE")),
            CommonFailureRow(key="ungraded", label="Awaiting grading", count=sum(1 for submission, _ in records if submission.submission_status.value in {"SUBMITTED", "LATE"})),
        ]
        common_failures = [item for item in common_failures if item.count > 0]
        pass_rate = safe_pct(sum(1 for score in scores if score >= 60), len(scores))
        return TeacherAssessmentDetailResponse(
            generated_at=to_iso(context.generated_at) or "",
            assessment_type="assignment",
            assessment_id=assessment_id,
            course_id=assignment.course_id,
            title=assignment.title,
            summary=TeacherAssessmentDetailSummary(
                eligible_learners=eligible,
                submitted_learners=len({submission.user_id for submission, _ in records}),
                submission_rate=safe_pct(len({submission.user_id for submission, _ in records}), eligible),
                pass_rate=pass_rate,
                median_score=median_or_none(scores),
                avg_attempts=1.0 if records else None,
                grading_latency_hours_p50=percentile(latencies, 0.5),
                grading_latency_hours_p90=percentile(latencies, 0.9),
            ),
            score_distribution=_score_distribution(scores),
            attempt_distribution=_attempt_distribution(dict(attempts_by_user)),
            question_breakdown=None,
            common_failures=common_failures,
            learner_rows=sorted(learner_rows, key=lambda row: row.user_display_name),
        )

    if assessment_type == "exam":
        exam = next((item for item in context.exams if item.id == assessment_id), None)
        if exam is None:
            raise ValueError(f"Exam not found: {assessment_id}")
        records = [
            (attempt, _exam)
            for attempt, _exam in context.exam_attempts
            if _exam.id == assessment_id and not attempt.is_preview and _is_allowed(attempt.user_id, allowed_user_ids)
        ]
        eligible = len(eligible_by_course.get(exam.course_id, set()))
        attempts_by_user = defaultdict(list)
        scores: list[float] = []
        for attempt, _exam in records:
            attempts_by_user[attempt.user_id].append(attempt)
            if attempt.score is not None and attempt.max_score:
                scores.append((float(attempt.score) / float(attempt.max_score)) * 100)
        learner_rows = []
        for user_id, attempts in attempts_by_user.items():
            best_score = max(((float(item.score) / float(item.max_score)) * 100 for item in attempts if item.score is not None and item.max_score), default=None)
            last_attempt = sorted(attempts, key=lambda item: item.submitted_at or item.started_at or "")[-1]
            last_score = (float(last_attempt.score) / float(last_attempt.max_score)) * 100 if last_attempt.score is not None and last_attempt.max_score else None
            learner_rows.append(
                AssessmentLearnerRow(
                    user_id=user_id,
                    user_display_name=display_name(context.users_by_id.get(user_id)),
                    attempts=len(attempts),
                    best_score=round(best_score, 2) if best_score is not None else None,
                    last_score=round(last_score, 2) if last_score is not None else None,
                    submitted_at=to_iso(last_attempt.submitted_at),
                    graded_at=None,
                    status=last_attempt.status.value,
                )
            )
        threshold = assessment_pass_threshold(exam.settings)
        return TeacherAssessmentDetailResponse(
            generated_at=to_iso(context.generated_at) or "",
            assessment_type="exam",
            assessment_id=assessment_id,
            course_id=exam.course_id,
            title=exam.title,
            summary=TeacherAssessmentDetailSummary(
                eligible_learners=eligible,
                submitted_learners=len(attempts_by_user),
                submission_rate=safe_pct(len(attempts_by_user), eligible),
                pass_rate=safe_pct(sum(1 for score in scores if score >= threshold), len(scores)),
                median_score=median_or_none(scores),
                avg_attempts=round(sum(len(items) for items in attempts_by_user.values()) / len(attempts_by_user), 2) if attempts_by_user else None,
                grading_latency_hours_p50=None,
                grading_latency_hours_p90=None,
            ),
            score_distribution=_score_distribution(scores),
            attempt_distribution=_attempt_distribution({user_id: len(items) for user_id, items in attempts_by_user.items()}),
            question_breakdown=None,
            common_failures=[],
            learner_rows=sorted(learner_rows, key=lambda row: row.user_display_name),
        )

    if assessment_type == "quiz":
        activity = context.activities_by_id.get(assessment_id)
        if activity is None or activity.course_id is None:
            raise ValueError(f"Quiz activity not found: {assessment_id}")
        records = [
            (attempt, _activity)
            for attempt, _activity in context.quiz_attempts
            if _activity.id == assessment_id and _is_allowed(attempt.user_id, allowed_user_ids)
        ]
        eligible = len(eligible_by_course.get(activity.course_id, set()))
        attempts_by_user = defaultdict(list)
        scores: list[float] = []
        for attempt, _activity in records:
            attempts_by_user[attempt.user_id].append(attempt)
            if attempt.end_ts and attempt.max_score:
                scores.append((float(attempt.score) / float(attempt.max_score)) * 100)
        question_breakdown = []
        for stat in [item for item in context.quiz_question_stats if item.activity_id == assessment_id]:
            question_breakdown.append(
                QuestionDifficultyRow(
                    question_id=stat.question_id,
                    question_label=f"Question {stat.question_id}",
                    accuracy_pct=safe_pct(stat.correct_count, stat.total_attempts),
                    avg_time_seconds=round(float(stat.avg_time_seconds), 2) if stat.avg_time_seconds is not None else None,
                )
            )
        common_failures = [
            CommonFailureRow(key=row.question_id, label=row.question_label, count=max(0, 100 - int(row.accuracy_pct or 0)))
            for row in sorted(question_breakdown, key=lambda item: item.accuracy_pct or 100)[:5]
            if row.accuracy_pct is not None and row.accuracy_pct < 80
        ]
        learner_rows = []
        for user_id, attempts in attempts_by_user.items():
            ordered_attempts = sorted(attempts, key=lambda item: item.end_ts or item.start_ts)
            best_score = max(((float(item.score) / float(item.max_score)) * 100 for item in attempts if item.max_score), default=None)
            last_attempt = ordered_attempts[-1]
            last_score = (float(last_attempt.score) / float(last_attempt.max_score)) * 100 if last_attempt.max_score else None
            learner_rows.append(
                AssessmentLearnerRow(
                    user_id=user_id,
                    user_display_name=display_name(context.users_by_id.get(user_id)),
                    attempts=len(attempts),
                    best_score=round(best_score, 2) if best_score is not None else None,
                    last_score=round(last_score, 2) if last_score is not None else None,
                    submitted_at=to_iso(last_attempt.end_ts),
                    graded_at=None,
                    status="COMPLETED" if last_attempt.end_ts else "IN_PROGRESS",
                )
            )
        return TeacherAssessmentDetailResponse(
            generated_at=to_iso(context.generated_at) or "",
            assessment_type="quiz",
            assessment_id=assessment_id,
            course_id=activity.course_id,
            title=activity.name,
            summary=TeacherAssessmentDetailSummary(
                eligible_learners=eligible,
                submitted_learners=len(attempts_by_user),
                submission_rate=safe_pct(len(attempts_by_user), eligible),
                pass_rate=safe_pct(sum(1 for score in scores if score >= 60), len(scores)),
                median_score=median_or_none(scores),
                avg_attempts=round(sum(len(items) for items in attempts_by_user.values()) / len(attempts_by_user), 2) if attempts_by_user else None,
                grading_latency_hours_p50=None,
                grading_latency_hours_p90=None,
            ),
            score_distribution=_score_distribution(scores),
            attempt_distribution=_attempt_distribution({user_id: len(items) for user_id, items in attempts_by_user.items()}),
            question_breakdown=sorted(question_breakdown, key=lambda row: row.accuracy_pct or 100),
            common_failures=common_failures,
            learner_rows=sorted(learner_rows, key=lambda row: row.user_display_name),
        )

    if assessment_type == "code_challenge":
        activity = context.activities_by_id.get(assessment_id)
        if activity is None or activity.course_id is None:
            raise ValueError(f"Code challenge activity not found: {assessment_id}")
        records = [
            (submission, _activity)
            for submission, _activity in context.code_submissions
            if _activity.id == assessment_id and _is_allowed(submission.user_id, allowed_user_ids)
        ]
        eligible = len(eligible_by_course.get(activity.course_id, set()))
        attempts_by_user = defaultdict(list)
        scores: list[float] = []
        failure_counter = Counter()
        for submission, _activity in records:
            attempts_by_user[submission.user_id].append(submission)
            if submission.status.value == "COMPLETED":
                scores.append(float(submission.score))
                failed_tests = submission.test_results.get("failed_tests") or submission.test_results.get("failed") or []
                for failed in failed_tests:
                    key = str(failed.get("id") if isinstance(failed, dict) else failed)
                    failure_counter[key] += 1
        learner_rows = []
        for user_id, attempts in attempts_by_user.items():
            ordered_attempts = sorted(attempts, key=lambda item: item.created_at)
            best_score = max((float(item.score) for item in attempts), default=None)
            last_attempt = ordered_attempts[-1]
            learner_rows.append(
                AssessmentLearnerRow(
                    user_id=user_id,
                    user_display_name=display_name(context.users_by_id.get(user_id)),
                    attempts=len(attempts),
                    best_score=round(best_score, 2) if best_score is not None else None,
                    last_score=round(float(last_attempt.score), 2),
                    submitted_at=to_iso(last_attempt.created_at),
                    graded_at=None,
                    status=last_attempt.status.value,
                )
            )
        common_failures = [
            CommonFailureRow(key=key, label=f"Failed test {key}", count=count)
            for key, count in failure_counter.most_common(8)
        ]
        return TeacherAssessmentDetailResponse(
            generated_at=to_iso(context.generated_at) or "",
            assessment_type="code_challenge",
            assessment_id=assessment_id,
            course_id=activity.course_id,
            title=activity.name,
            summary=TeacherAssessmentDetailSummary(
                eligible_learners=eligible,
                submitted_learners=len(attempts_by_user),
                submission_rate=safe_pct(len(attempts_by_user), eligible),
                pass_rate=safe_pct(sum(1 for score in scores if score >= 60), len(scores)),
                median_score=median_or_none(scores),
                avg_attempts=round(sum(len(items) for items in attempts_by_user.values()) / len(attempts_by_user), 2) if attempts_by_user else None,
                grading_latency_hours_p50=None,
                grading_latency_hours_p90=None,
            ),
            score_distribution=_score_distribution(scores),
            attempt_distribution=_attempt_distribution({user_id: len(items) for user_id, items in attempts_by_user.items()}),
            question_breakdown=None,
            common_failures=common_failures,
            learner_rows=sorted(learner_rows, key=lambda row: row.user_display_name),
        )

    raise ValueError(f"Unsupported assessment type: {assessment_type}")
