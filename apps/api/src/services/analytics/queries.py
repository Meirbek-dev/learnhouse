from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from statistics import median
from typing import Any, Iterable, TypeVar

from sqlalchemy import and_, select
from sqlmodel import Session

from src.db.courses.activities import Activity, ActivityTypeEnum
from src.db.courses.assignments import Assignment, AssignmentUserSubmission, AssignmentUserSubmissionStatus
from src.db.courses.certifications import CertificateUser, Certifications
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import Chapter
from src.db.courses.code_challenges import CodeSubmission, SubmissionStatus
from src.db.courses.course_chapters import CourseChapter
from src.db.courses.courses import Course
from src.db.courses.exams import Exam, ExamAttempt
from src.db.courses.quiz import QuizAttempt, QuizQuestionStat
from src.db.trail_runs import TrailRun
from src.db.trail_steps import TrailStep
from src.db.users import User

ModelT = TypeVar("ModelT")
LeftT = TypeVar("LeftT")
RightT = TypeVar("RightT")


@dataclass(slots=True)
class ActivityEvent:
    user_id: int
    course_id: int
    ts: datetime
    source: str
    assessment_type: str | None = None
    assessment_id: int | None = None
    activity_id: int | None = None


@dataclass(slots=True)
class ProgressSnapshot:
    course_id: int
    user_id: int
    completed_steps: int
    total_steps: int
    progress_pct: float
    is_completed: bool
    has_certificate: bool
    last_activity_at: datetime | None
    trailrun_id: int | None


@dataclass(slots=True)
class AnalyticsContext:
    generated_at: datetime
    courses_by_id: dict[int, Course]
    activities_by_id: dict[int, Activity]
    chapters_by_id: dict[int, Chapter]
    course_chapters: list[CourseChapter]
    chapter_activities: list[ChapterActivity]
    trail_runs: list[TrailRun]
    trail_steps: list[TrailStep]
    certificates: list[tuple[CertificateUser, Certifications]]
    assignments: list[Assignment]
    assignment_submissions: list[tuple[AssignmentUserSubmission, Assignment]]
    exams: list[Exam]
    exam_attempts: list[tuple[ExamAttempt, Exam]]
    quiz_attempts: list[tuple[QuizAttempt, Activity]]
    quiz_question_stats: list[QuizQuestionStat]
    code_submissions: list[tuple[CodeSubmission, Activity]]
    users_by_id: dict[int, User]


def _unwrap_model(value: Any, model_type: type[ModelT]) -> ModelT:
    if isinstance(value, model_type):
        return value
    if hasattr(value, "_mapping"):
        for candidate in value._mapping.values():
            if isinstance(candidate, model_type):
                return candidate
    if isinstance(value, (tuple, list)):
        for candidate in value:
            if isinstance(candidate, model_type):
                return candidate
    raise TypeError(f"Expected {model_type.__name__}, got {type(value).__name__}")


def _unwrap_pair(value: Any, left_type: type[LeftT], right_type: type[RightT]) -> tuple[LeftT, RightT]:
    if isinstance(value, (tuple, list)):
        left = next((candidate for candidate in value if isinstance(candidate, left_type)), None)
        right = next((candidate for candidate in value if isinstance(candidate, right_type)), None)
        if left is not None and right is not None:
            return left, right
    if hasattr(value, "_mapping"):
        mapped_values = list(value._mapping.values())
        left = next((candidate for candidate in mapped_values if isinstance(candidate, left_type)), None)
        right = next((candidate for candidate in mapped_values if isinstance(candidate, right_type)), None)
        if left is not None and right is not None:
            return left, right
    raise TypeError(
        f"Expected pair ({left_type.__name__}, {right_type.__name__}), got {type(value).__name__}"
    )


def now_utc() -> datetime:
    return datetime.now(tz=UTC)


def parse_timestamp(value: object) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        if raw.endswith("Z"):
            raw = f"{raw[:-1]}+00:00"
        try:
            parsed = datetime.fromisoformat(raw)
        except ValueError:
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    return None


def to_iso(value: object) -> str | None:
    normalized = parse_timestamp(value)
    if normalized is None:
        return None
    normalized = normalized.astimezone(UTC)
    return normalized.isoformat().replace("+00:00", "Z")


def safe_pct(numerator: int | float, denominator: int | float, *, digits: int = 1) -> float | None:
    if not denominator:
        return None
    return round((float(numerator) / float(denominator)) * 100, digits)


def percentile(values: list[float], target: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return round(ordered[0], 2)
    rank = (len(ordered) - 1) * target
    lower = int(rank)
    upper = min(lower + 1, len(ordered) - 1)
    weight = rank - lower
    result = ordered[lower] * (1 - weight) + ordered[upper] * weight
    return round(result, 2)


def median_or_none(values: list[float]) -> float | None:
    if not values:
        return None
    return round(float(median(values)), 2)


def direction_for_delta(delta_value: float | None) -> str:
    if delta_value is None:
        return "flat"
    if delta_value > 0:
        return "up"
    if delta_value < 0:
        return "down"
    return "flat"


def display_name(user: User | None) -> str:
    if user is None:
        return "Unknown learner"
    parts = [user.first_name, user.last_name]
    joined = " ".join(part for part in parts if part).strip()
    return joined or user.username or user.email


def bucket_start(ts: datetime, bucket: str) -> datetime:
    normalized = ts.astimezone(UTC)
    if bucket == "week":
        start = normalized - timedelta(days=normalized.weekday())
        return start.replace(hour=0, minute=0, second=0, microsecond=0)
    return normalized.replace(hour=0, minute=0, second=0, microsecond=0)


def build_series(events: list[ActivityEvent], bucket: str, start: datetime, end: datetime, *, distinct_users: bool = False) -> list[tuple[datetime, float]]:
    buckets: dict[datetime, float | set[int]] = {}
    cursor = bucket_start(start, bucket)
    while cursor <= end:
        buckets[cursor] = set() if distinct_users else 0.0
        cursor += timedelta(days=7 if bucket == "week" else 1)

    for event in events:
        if event.ts < start or event.ts > end:
            continue
        key = bucket_start(event.ts, bucket)
        if key not in buckets:
            buckets[key] = set() if distinct_users else 0.0
        if distinct_users:
            current = buckets[key]
            assert isinstance(current, set)
            current.add(event.user_id)
        else:
            current_count = buckets[key]
            assert not isinstance(current_count, set)
            buckets[key] = current_count + 1

    series: list[tuple[datetime, float]] = []
    for key in sorted(buckets.keys()):
        value = buckets[key]
        if isinstance(value, set):
            series.append((key, float(len(value))))
        else:
            series.append((key, value))
    return series


def load_analytics_context(db_session: Session, course_ids: list[int]) -> AnalyticsContext:
    if not course_ids:
        return AnalyticsContext(
            generated_at=now_utc(),
            courses_by_id={},
            activities_by_id={},
            chapters_by_id={},
            course_chapters=[],
            chapter_activities=[],
            trail_runs=[],
            trail_steps=[],
            certificates=[],
            assignments=[],
            assignment_submissions=[],
            exams=[],
            exam_attempts=[],
            quiz_attempts=[],
            quiz_question_stats=[],
            code_submissions=[],
            users_by_id={},
        )

    courses = [
        _unwrap_model(course, Course)
        for course in db_session.exec(select(Course).where(Course.id.in_(course_ids))).all()
    ]
    course_map = {course.id: course for course in courses if course.id is not None}

    activities = [
        _unwrap_model(activity, Activity)
        for activity in db_session.exec(select(Activity).where(Activity.course_id.in_(course_ids))).all()
    ]
    activity_map = {activity.id: activity for activity in activities if activity.id is not None}

    course_chapters = [
        _unwrap_model(item, CourseChapter)
        for item in db_session.exec(select(CourseChapter).where(CourseChapter.course_id.in_(course_ids))).all()
    ]
    chapter_ids = [item.chapter_id for item in course_chapters]

    chapters = []
    if chapter_ids:
        chapters = [
            _unwrap_model(chapter, Chapter)
            for chapter in db_session.exec(select(Chapter).where(Chapter.id.in_(chapter_ids))).all()
        ]
    chapter_map = {chapter.id: chapter for chapter in chapters if chapter.id is not None}

    chapter_activities = [
        _unwrap_model(item, ChapterActivity)
        for item in db_session.exec(select(ChapterActivity).where(ChapterActivity.course_id.in_(course_ids))).all()
    ]

    trail_runs = [
        _unwrap_model(run, TrailRun)
        for run in db_session.exec(select(TrailRun).where(TrailRun.course_id.in_(course_ids))).all()
    ]
    trail_steps = [
        _unwrap_model(step, TrailStep)
        for step in db_session.exec(select(TrailStep).where(TrailStep.course_id.in_(course_ids))).all()
    ]

    assignments = [
        _unwrap_model(assignment, Assignment)
        for assignment in db_session.exec(select(Assignment).where(Assignment.course_id.in_(course_ids))).all()
    ]
    assignment_ids = [assignment.id for assignment in assignments if assignment.id is not None]
    assignment_submissions: list[tuple[AssignmentUserSubmission, Assignment]] = []
    if assignment_ids:
        assignment_submissions = [
            _unwrap_pair(row, AssignmentUserSubmission, Assignment)
            for row in db_session.exec(
                select(AssignmentUserSubmission, Assignment)
                .join(Assignment, Assignment.id == AssignmentUserSubmission.assignment_id)
                .where(Assignment.id.in_(assignment_ids))
            ).all()
        ]

    exams = [_unwrap_model(exam, Exam) for exam in db_session.exec(select(Exam).where(Exam.course_id.in_(course_ids))).all()]
    exam_ids = [exam.id for exam in exams if exam.id is not None]
    exam_attempts: list[tuple[ExamAttempt, Exam]] = []
    if exam_ids:
        exam_attempts = [
            _unwrap_pair(row, ExamAttempt, Exam)
            for row in db_session.exec(
                select(ExamAttempt, Exam)
                .join(Exam, Exam.id == ExamAttempt.exam_id)
                .where(Exam.id.in_(exam_ids))
            ).all()
        ]

    activity_ids = [activity.id for activity in activities if activity.id is not None]
    quiz_attempts: list[tuple[QuizAttempt, Activity]] = []
    if activity_ids:
        quiz_attempts = [
            _unwrap_pair(row, QuizAttempt, Activity)
            for row in db_session.exec(
                select(QuizAttempt, Activity)
                .join(Activity, Activity.id == QuizAttempt.activity_id)
                .where(Activity.id.in_(activity_ids))
            ).all()
        ]

    quiz_question_stats: list[QuizQuestionStat] = []
    if activity_ids:
        quiz_question_stats = [
            _unwrap_model(stat, QuizQuestionStat)
            for stat in db_session.exec(
                select(QuizQuestionStat).where(QuizQuestionStat.activity_id.in_(activity_ids))
            ).all()
        ]

    code_submissions: list[tuple[CodeSubmission, Activity]] = []
    if activity_ids:
        code_submissions = [
            _unwrap_pair(row, CodeSubmission, Activity)
            for row in db_session.exec(
                select(CodeSubmission, Activity)
                .join(Activity, Activity.id == CodeSubmission.activity_id)
                .where(Activity.id.in_(activity_ids))
            ).all()
        ]

    certificate_rows = [
        _unwrap_pair(row, CertificateUser, Certifications)
        for row in db_session.exec(
            select(CertificateUser, Certifications)
            .join(Certifications, Certifications.id == CertificateUser.certification_id)
            .where(Certifications.course_id.in_(course_ids))
        ).all()
    ]

    user_ids: set[int] = set()
    for trail_run in trail_runs:
        user_ids.add(trail_run.user_id)
    for trail_step in trail_steps:
        user_ids.add(trail_step.user_id)
    for submission, _assignment in assignment_submissions:
        user_ids.add(submission.user_id)
    for attempt, _exam in exam_attempts:
        user_ids.add(attempt.user_id)
    for attempt, _activity in quiz_attempts:
        user_ids.add(attempt.user_id)
    for submission, _activity in code_submissions:
        user_ids.add(submission.user_id)
    for certificate, _certification in certificate_rows:
        user_ids.add(certificate.user_id)
    creator_ids = {course.creator_id for course in courses if course.creator_id is not None}
    user_ids.update(creator_ids)

    users = []
    if user_ids:
        users = [
            _unwrap_model(user, User)
            for user in db_session.exec(select(User).where(User.id.in_(sorted(user_ids)))).all()
        ]
    user_map = {user.id: user for user in users if user.id is not None}

    return AnalyticsContext(
        generated_at=now_utc(),
        courses_by_id=course_map,
        activities_by_id=activity_map,
        chapters_by_id=chapter_map,
        course_chapters=course_chapters,
        chapter_activities=chapter_activities,
        trail_runs=trail_runs,
        trail_steps=trail_steps,
        certificates=certificate_rows,
        assignments=assignments,
        assignment_submissions=assignment_submissions,
        exams=exams,
        exam_attempts=exam_attempts,
        quiz_attempts=quiz_attempts,
        quiz_question_stats=quiz_question_stats,
        code_submissions=code_submissions,
        users_by_id=user_map,
    )


def build_activity_events(context: AnalyticsContext) -> list[ActivityEvent]:
    events: list[ActivityEvent] = []

    for step in context.trail_steps:
        if not step.complete:
            continue
        ts = parse_timestamp(step.update_date) or parse_timestamp(step.creation_date)
        if ts is None:
            continue
        events.append(ActivityEvent(user_id=step.user_id, course_id=step.course_id, ts=ts, source="trail_step", activity_id=step.activity_id))

    for attempt, activity in context.quiz_attempts:
        ts = parse_timestamp(attempt.end_ts)
        if ts is None or activity.course_id is None:
            continue
        events.append(
            ActivityEvent(
                user_id=attempt.user_id,
                course_id=activity.course_id,
                ts=ts,
                source="quiz",
                assessment_type="quiz",
                assessment_id=activity.id,
                activity_id=activity.id,
            )
        )

    for attempt, exam in context.exam_attempts:
        if attempt.is_preview:
            continue
        ts = parse_timestamp(attempt.submitted_at) or parse_timestamp(attempt.started_at)
        if ts is None:
            continue
        events.append(
            ActivityEvent(
                user_id=attempt.user_id,
                course_id=exam.course_id,
                ts=ts,
                source="exam",
                assessment_type="exam",
                assessment_id=exam.id,
                activity_id=exam.activity_id,
            )
        )

    for submission, assignment in context.assignment_submissions:
        ts = parse_timestamp(getattr(submission, "submitted_at", None)) or parse_timestamp(submission.update_date) or parse_timestamp(submission.creation_date)
        if ts is None:
            continue
        events.append(
            ActivityEvent(
                user_id=submission.user_id,
                course_id=assignment.course_id,
                ts=ts,
                source="assignment",
                assessment_type="assignment",
                assessment_id=assignment.id,
                activity_id=assignment.activity_id,
            )
        )

    for submission, activity in context.code_submissions:
        if submission.status != SubmissionStatus.COMPLETED or activity.course_id is None:
            continue
        ts = parse_timestamp(submission.created_at)
        if ts is None:
            continue
        events.append(
            ActivityEvent(
                user_id=submission.user_id,
                course_id=activity.course_id,
                ts=ts,
                source="code_challenge",
                assessment_type="code_challenge",
                assessment_id=activity.id,
                activity_id=activity.id,
            )
        )

    return events


def progress_snapshots(context: AnalyticsContext) -> dict[tuple[int, int], ProgressSnapshot]:
    total_steps_by_course: dict[int, set[int]] = defaultdict(set)
    for chapter_activity in context.chapter_activities:
        total_steps_by_course[chapter_activity.course_id].add(chapter_activity.activity_id)

    completed_by_course_user: dict[tuple[int, int], set[int]] = defaultdict(set)
    trailrun_by_course_user: dict[tuple[int, int], int] = {}
    for trail_run in context.trail_runs:
        trailrun_by_course_user[(trail_run.course_id, trail_run.user_id)] = trail_run.id or 0

    for step in context.trail_steps:
        if step.complete:
            completed_by_course_user[(step.course_id, step.user_id)].add(step.activity_id)

    certificate_pairs = {(certification.course_id, certificate.user_id) for certificate, certification in context.certificates}

    last_activity: dict[tuple[int, int], datetime] = {}
    for event in build_activity_events(context):
        key = (event.course_id, event.user_id)
        existing = last_activity.get(key)
        if existing is None or event.ts > existing:
            last_activity[key] = event.ts

    snapshots: dict[tuple[int, int], ProgressSnapshot] = {}
    seen_pairs = {*(completed_by_course_user.keys()), *(trailrun_by_course_user.keys()), *certificate_pairs}
    for course_id, user_id in seen_pairs:
        total_steps = len(total_steps_by_course.get(course_id, set()))
        completed_steps = len(completed_by_course_user.get((course_id, user_id), set()))
        has_certificate = (course_id, user_id) in certificate_pairs
        progress_pct = 100.0 if total_steps == 0 and has_certificate else round((completed_steps / total_steps) * 100, 1) if total_steps else 0.0
        is_completed = has_certificate or (total_steps > 0 and completed_steps >= total_steps)
        snapshots[(course_id, user_id)] = ProgressSnapshot(
            course_id=course_id,
            user_id=user_id,
            completed_steps=completed_steps,
            total_steps=total_steps,
            progress_pct=100.0 if is_completed else progress_pct,
            is_completed=is_completed,
            has_certificate=has_certificate,
            last_activity_at=last_activity.get((course_id, user_id)),
            trailrun_id=trailrun_by_course_user.get((course_id, user_id)),
        )
    return snapshots


def course_last_content_update(context: AnalyticsContext, course_id: int) -> datetime | None:
    candidates: list[datetime] = []
    course = context.courses_by_id.get(course_id)
    if course is not None:
        course_ts = parse_timestamp(course.update_date)
        if course_ts is not None:
            candidates.append(course_ts)
    for activity in context.activities_by_id.values():
        if activity.course_id != course_id:
            continue
        activity_ts = parse_timestamp(activity.update_date)
        if activity_ts is not None:
            candidates.append(activity_ts)
    return max(candidates) if candidates else None


def hours_between(start_value: object, end_value: object) -> float | None:
    start = parse_timestamp(start_value)
    end = parse_timestamp(end_value)
    if start is None or end is None or end < start:
        return None
    return round((end - start).total_seconds() / 3600, 2)


def assessment_pass_threshold(settings: dict | None) -> float:
    raw = (settings or {}).get("passing_score", 60)
    try:
        return float(raw)
    except (TypeError, ValueError):
        return 60.0
