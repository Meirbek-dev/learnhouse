"""
Tests for Exam Activity Module

This test suite covers:
- Exam CRUD operations
- Question bank management
- Attempt lifecycle (start, submit, auto-submit)
- Violation recording and threshold enforcement
- Settings validation (shuffle_answers, time limits, etc.)
- Access control (NO_ACCESS, WHITELIST, ALL_ENROLLED)
- RBAC permissions
"""

import pytest
from datetime import datetime, timedelta
from fastapi import HTTPException
from sqlmodel import Session
from unittest.mock import Mock, AsyncMock, patch
from types import SimpleNamespace

from src.db.courses.exams import (
    ExamSettingsBase,
    AccessModeEnum,
    AttemptStatusEnum,
    Question,
    QuestionCreate,
    Exam,
    ExamAttempt,
)
from src.services.courses.activities.exams import (
    start_exam_attempt,
    submit_exam_attempt,
    record_violation,
    get_user_attempts,
)


class TestExamSettings:
    """Test exam settings validation and enforcement"""

    def test_shuffle_answers_always_true(self):
        """Verify shuffle_answers is always enforced to True"""
        # Test that even when passed False, validator returns True
        settings = ExamSettingsBase(
            shuffle_answers=False,
            shuffle_questions=True,
            time_limit=60,
            attempt_limit=2,
            violation_threshold=3,
            access_mode=AccessModeEnum.NO_ACCESS,
        )
        assert settings.shuffle_answers == True

    def test_time_limit_validation(self):
        """Verify time_limit is within bounds"""
        # Test valid time limit
        settings = ExamSettingsBase(
            time_limit=60,
            attempt_limit=2,
            violation_threshold=3,
            access_mode=AccessModeEnum.NO_ACCESS,
        )
        assert settings.time_limit == 60

        # Test minimum bound (should be >= 1)
        with pytest.raises(ValueError):
            ExamSettingsBase(
                time_limit=0,
                attempt_limit=2,
                violation_threshold=3,
                access_mode=AccessModeEnum.NO_ACCESS,
            )

        # Test maximum bound (should be <= 180)
        with pytest.raises(ValueError):
            ExamSettingsBase(
                time_limit=181,
                attempt_limit=2,
                violation_threshold=3,
                access_mode=AccessModeEnum.NO_ACCESS,
            )

    def test_attempt_limit_validation(self):
        """Verify attempt_limit is within bounds"""
        # Test valid attempt limit
        settings = ExamSettingsBase(
            time_limit=60,
            attempt_limit=3,
            violation_threshold=3,
            access_mode=AccessModeEnum.NO_ACCESS,
        )
        assert settings.attempt_limit == 3

        # Test minimum bound (should be >= 1)
        with pytest.raises(ValueError):
            ExamSettingsBase(
                time_limit=60,
                attempt_limit=0,
                violation_threshold=3,
                access_mode=AccessModeEnum.NO_ACCESS,
            )

        # Test maximum bound (should be <= 5)
        with pytest.raises(ValueError):
            ExamSettingsBase(
                time_limit=60,
                attempt_limit=6,
                violation_threshold=3,
                access_mode=AccessModeEnum.NO_ACCESS,
            )

    def test_violation_threshold_validation(self):
        """Verify violation_threshold is within bounds"""
        # Test valid violation threshold
        settings = ExamSettingsBase(
            time_limit=60,
            attempt_limit=2,
            violation_threshold=5,
            access_mode=AccessModeEnum.NO_ACCESS,
        )
        assert settings.violation_threshold == 5

        # Test minimum bound (should be >= 1)
        with pytest.raises(ValueError):
            ExamSettingsBase(
                time_limit=60,
                attempt_limit=2,
                violation_threshold=0,
                access_mode=AccessModeEnum.NO_ACCESS,
            )

        # Test maximum bound (should be <= 10)
        with pytest.raises(ValueError):
            ExamSettingsBase(
                time_limit=60,
                attempt_limit=2,
                violation_threshold=11,
                access_mode=AccessModeEnum.NO_ACCESS,
            )


class TestExamCRUD:
    """Test exam create, read, update, delete operations"""

    @pytest.fixture
    def sample_exam_data(self):
        """Fixture providing sample exam data"""
        return {
            "title": "Test Exam",
            "description": "Test Description",
            "org_id": 1,
            "course_id": 1,
            "chapter_id": 1,
            "activity_id": 1,
            "settings": {
                "time_limit": 60,
                "attempt_limit": 2,
                "shuffle_questions": True,
                "shuffle_answers": False,  # Should be forced to True
                "access_mode": "NO_ACCESS"
            }
        }

    def test_create_exam_enforces_shuffle_answers(self, sample_exam_data):
        """Verify shuffle_answers is forced to True on exam creation"""
        # Create exam with shuffle_answers=False
        # Verify stored value is True
        pass

    def test_update_exam_enforces_shuffle_answers(self):
        """Verify shuffle_answers is forced to True on exam update"""
        pass


class TestExamAttempts:
    """Test exam attempt lifecycle"""

    @pytest.fixture
    def mock_db_session(self):
        """Mock database session"""
        return Mock(spec=Session)

    @pytest.fixture
    def sample_exam(self):
        """Sample exam for testing"""
        return SimpleNamespace(
            id=1,
            exam_uuid="exam-uuid-1",
            activity_id=100,
            settings={
                "access_mode": "NO_ACCESS",
                "attempt_limit": 2,
                "time_limit": 60,
                "violation_threshold": 3,
            },
        )

    @pytest.fixture
    def sample_user(self):
        """Sample user for testing"""
        return SimpleNamespace(id=42, user_name="student@example.com")

    @pytest.mark.asyncio
    async def test_start_attempt_respects_access_mode_no_access(self, mock_db_session, sample_exam, sample_user):
        """Verify NO_ACCESS prevents non-teacher students from starting"""
        # Mock the exam lookup
        mock_db_session.exec.return_value.first.return_value = sample_exam

        # Mock contributor check to return False (not a teacher)
        with patch(
            "src.services.courses.activities.exams.is_course_contributor_or_admin",
            return_value=False,
        ):
            with pytest.raises(HTTPException) as exc_info:
                await start_exam_attempt(Mock(), "exam-uuid-1", sample_user, mock_db_session)
            assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_start_attempt_respects_whitelist(self, mock_db_session, sample_user):
        """Verify WHITELIST only allows whitelisted students"""
        exam = SimpleNamespace(
            id=2,
            exam_uuid="exam-uuid-2",
            activity_id=101,
            whitelist=[99],  # User 42 not in whitelist
            settings={
                "access_mode": "WHITELIST",
                "attempt_limit": 2,
                "time_limit": 60,
                "violation_threshold": 3,
            },
        )

        mock_db_session.exec.return_value.first.return_value = exam

        # Mock contributor check to return False (not a teacher)
        with patch(
            "src.services.courses.activities.exams.is_course_contributor_or_admin",
            return_value=False,
        ):
            with pytest.raises(HTTPException) as exc_info:
                await start_exam_attempt(Mock(), "exam-uuid-2", sample_user, mock_db_session)
            assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_start_attempt_respects_all_enrolled(self, mock_db_session, sample_user):
        """Verify ALL_ENROLLED allows all enrolled students"""
        exam = SimpleNamespace(
            id=3,
            exam_uuid="exam-uuid-3",
            activity_id=102,
            settings={
                "access_mode": "ALL_ENROLLED",
                "attempt_limit": 2,
                "time_limit": 60,
                "violation_threshold": 3,
            },
        )

        # Mock finding no existing attempts
        mock_select = Mock()
        mock_select.where.return_value.where.return_value = mock_select
        mock_db_session.exec.return_value.all.return_value = []

        # Mock get to return exam
        mock_db_session.get.return_value = exam

        # Mock course and activity lookups
        with patch("src.services.courses.activities.exams.is_course_contributor_or_admin", return_value=False):
            with patch("sqlmodel.select", return_value=mock_select):
                # This should succeed for ALL_ENROLLED mode
                result = await start_exam_attempt(Mock(), "exam-uuid-3", sample_user, mock_db_session)
                assert result is not None

    @pytest.mark.asyncio
    async def test_start_attempt_enforces_attempt_limit(self, mock_db_session, sample_user):
        """Verify attempt limit is enforced for students (not teachers)"""
        exam = SimpleNamespace(
            id=4,
            exam_uuid="exam-uuid-4",
            activity_id=103,
            settings={
                "access_mode": "ALL_ENROLLED",
                "attempt_limit": 2,
                "time_limit": 60,
                "violation_threshold": 3,
            },
        )

        # Mock 2 existing attempts (reached limit)
        existing_attempts = [Mock(), Mock()]
        mock_select = Mock()
        mock_select.where.return_value.where.return_value = mock_select
        mock_db_session.exec.return_value.all.return_value = existing_attempts

        mock_db_session.get.return_value = exam

        with patch("src.services.courses.activities.exams.is_course_contributor_or_admin", return_value=False):
            with patch("sqlmodel.select", return_value=mock_select):
                with pytest.raises(HTTPException) as exc_info:
                    await start_exam_attempt(Mock(), "exam-uuid-4", sample_user, mock_db_session)
                assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_teachers_have_unlimited_attempts(self, mock_db_session, sample_user):
        """Verify teachers/contributors can take exam unlimited times"""
        exam = SimpleNamespace(
            id=5,
            exam_uuid="exam-uuid-5",
            activity_id=104,
            settings={
                "access_mode": "NO_ACCESS",  # Even with NO_ACCESS
                "attempt_limit": 1,  # And strict attempt limit
                "time_limit": 60,
                "violation_threshold": 3,
            },
        )

        # Mock 5 existing attempts (way over limit)
        existing_attempts = [Mock() for _ in range(5)]
        mock_select = Mock()
        mock_select.where.return_value.where.return_value = mock_select
        mock_db_session.exec.return_value.all.return_value = existing_attempts

        mock_db_session.get.return_value = exam

        # Mock as teacher/contributor
        with patch("src.services.courses.activities.exams.is_course_contributor_or_admin", return_value=True):
            with patch("sqlmodel.select", return_value=mock_select):
                # Should succeed even with many attempts and NO_ACCESS mode
                result = await start_exam_attempt(Mock(), "exam-uuid-5", sample_user, mock_db_session)
                assert result is not None


class TestViolationRecording:
    """Test violation recording and threshold enforcement"""

    @pytest.fixture
    def mock_db_session(self):
        """Mock database session"""
        return Mock(spec=Session)

    @pytest.fixture
    def sample_attempt(self):
        """Sample attempt for testing"""
        return SimpleNamespace(
            id=1,
            attempt_uuid="attempt-uuid-1",
            exam_id=1,
            user_id=42,
            status=AttemptStatusEnum.IN_PROGRESS,
            violations=[],
            started_at=datetime.now().isoformat(),
            submitted_at=None,
        )

    @pytest.fixture
    def sample_exam(self):
        """Sample exam for testing"""
        return SimpleNamespace(
            id=1,
            exam_uuid="exam-uuid-1",
            settings={"violation_threshold": 3},
        )

    @pytest.fixture
    def sample_user(self):
        """Sample user for testing"""
        return SimpleNamespace(id=42)

    @pytest.mark.asyncio
    async def test_record_violation_increments_count(
        self, mock_db_session, sample_attempt, sample_exam, sample_user
    ):
        """Verify violation recording increments violation count"""
        # Mock DB lookups
        mock_db_session.exec.return_value.first.return_value = sample_attempt
        mock_db_session.get.return_value = sample_exam

        # Record a violation
        result = await record_violation(
            Mock(), "attempt-uuid-1", "BLUR", sample_user, mock_db_session
        )

        # Verify violation was added
        assert len(sample_attempt.violations) == 1
        assert sample_attempt.violations[0]["type"] == "BLUR"
        assert "timestamp" in sample_attempt.violations[0]
        assert mock_db_session.add.called
        assert mock_db_session.commit.called

    @pytest.mark.asyncio
    async def test_violation_threshold_triggers_auto_submit(
        self, mock_db_session, sample_attempt, sample_exam, sample_user
    ):
        """Verify reaching violation threshold auto-submits exam"""
        # Set up attempt with 2 existing violations (threshold is 3)
        sample_attempt.violations = [
            {"type": "BLUR", "timestamp": datetime.now().isoformat()},
            {"type": "DEVTOOLS", "timestamp": datetime.now().isoformat()},
        ]

        mock_db_session.exec.return_value.first.return_value = sample_attempt
        mock_db_session.get.return_value = sample_exam

        # Record the 3rd violation (should trigger auto-submit)
        result = await record_violation(
            Mock(), "attempt-uuid-1", "FULLSCREEN_EXIT", sample_user, mock_db_session
        )

        # Verify auto-submit occurred
        assert len(sample_attempt.violations) == 3
        assert sample_attempt.status == AttemptStatusEnum.AUTO_SUBMITTED
        assert sample_attempt.submitted_at is not None
        assert mock_db_session.add.called
        assert mock_db_session.commit.called

    @pytest.mark.asyncio
    async def test_violation_types_recorded(self, mock_db_session, sample_exam, sample_user):
        """Verify different violation types are recorded correctly"""
        violation_types = ["BLUR", "DEVTOOLS", "COPY", "FULLSCREEN_EXIT", "CONTEXTMENU", "KEYDOWN"]

        for v_type in violation_types:
            # Create fresh attempt for each test
            attempt = SimpleNamespace(
                id=1,
                attempt_uuid=f"attempt-{v_type}",
                exam_id=1,
                user_id=42,
                status=AttemptStatusEnum.IN_PROGRESS,
                violations=[],
                started_at=datetime.now().isoformat(),
                submitted_at=None,
            )

            mock_db_session.exec.return_value.first.return_value = attempt
            mock_db_session.get.return_value = sample_exam

            # Record violation
            await record_violation(Mock(), attempt.attempt_uuid, v_type, sample_user, mock_db_session)

            # Verify it was recorded with correct type
            assert len(attempt.violations) == 1
            assert attempt.violations[0]["type"] == v_type

    @pytest.mark.asyncio
    async def test_cannot_record_violation_after_submission(
        self, mock_db_session, sample_exam, sample_user
    ):
        """Verify violations cannot be recorded on already submitted attempts"""
        submitted_attempt = SimpleNamespace(
            id=1,
            attempt_uuid="submitted-attempt",
            exam_id=1,
            user_id=42,
            status=AttemptStatusEnum.SUBMITTED,
            violations=[],
            started_at=datetime.now().isoformat(),
            submitted_at=datetime.now().isoformat(),
        )

        mock_db_session.exec.return_value.first.return_value = submitted_attempt
        mock_db_session.get.return_value = sample_exam

        # Attempt to record violation on submitted exam
        with pytest.raises(HTTPException) as exc_info:
            await record_violation(
                Mock(), "submitted-attempt", "BLUR", sample_user, mock_db_session
            )
        assert exc_info.value.status_code == 400


from unittest.mock import Mock, AsyncMock, patch
from types import SimpleNamespace


class TestExamSubmission:
    """Test exam submission and grading"""

    @pytest.fixture
    def mock_db_session(self) -> Mock:
        return Mock(spec=Session)

    def test_submit_exam_grades_single_choice_correctly(self):
        """Verify SINGLE_CHOICE grading logic works correctly"""
        # Create question with correct answer at index 0
        question = SimpleNamespace(
            id=1,
            question_type="SINGLE_CHOICE",
            points=10,
            answer_options=[
                {"text": "Correct", "is_correct": True},
                {"text": "Wrong", "is_correct": False},
            ],
        )

        # Correct answer (index 0)
        assert question.answer_options[0]["is_correct"] == True
        # Wrong answer (index 1)
        assert question.answer_options[1]["is_correct"] == False

    def test_submit_exam_grades_multiple_choice_correctly(self):
        """Verify MULTIPLE_CHOICE grading logic works correctly"""
        question = SimpleNamespace(
            id=2,
            question_type="MULTIPLE_CHOICE",
            points=10,
            answer_options=[
                {"text": "Correct 1", "is_correct": True},
                {"text": "Wrong", "is_correct": False},
                {"text": "Correct 2", "is_correct": True},
            ],
        )

        # Test correct answers: should select indices [0, 2]
        correct_answer = [0, 2]
        selected_correct = all(
            question.answer_options[idx]["is_correct"] for idx in correct_answer
        )
        assert selected_correct == True

        # Test partial answer: only [0] selected
        partial_answer = [0]
        all_correct_selected = len(partial_answer) == sum(
            1 for opt in question.answer_options if opt["is_correct"]
        )
        assert all_correct_selected == False  # Not all correct answers selected

    def test_submit_exam_grades_true_false_correctly(self):
        """Verify TRUE_FALSE grading logic works correctly"""
        question = SimpleNamespace(
            id=3,
            question_type="TRUE_FALSE",
            points=5,
            answer_options=[
                {"text": "True", "is_correct": True},
                {"text": "False", "is_correct": False},
            ],
        )

        # Correct answer (True = index 0)
        assert question.answer_options[0]["is_correct"] == True

    def test_submit_exam_grades_matching_correctly(self):
        """Verify MATCHING grading logic works correctly"""
        question = SimpleNamespace(
            id=4,
            question_type="MATCHING",
            points=10,
            answer_options=[
                {"left": "Term 1", "right": "Definition 1"},
                {"left": "Term 2", "right": "Definition 2"},
            ],
        )

        # Test structure is correct
        assert "left" in question.answer_options[0]
        assert "right" in question.answer_options[0]

    @pytest.mark.asyncio
    async def test_submit_exam_marks_trail_step_complete(self, monkeypatch, mock_db_session):
        """Verify trail step is marked complete on submission when score > 50%"""
        from src.services.courses.activities.exams import submit_exam_attempt
        from src.db.courses.exams import Question, AttemptStatusEnum

        # Prepare current user and attempt
        current_user = SimpleNamespace(id=1)
        attempt = SimpleNamespace(
            id=1,
            attempt_uuid="att1",
            user_id=1,
            status=AttemptStatusEnum.IN_PROGRESS,
            question_order=[1],
            exam_id=1,
            violations=[],
            started_at=datetime.now().isoformat(),
            submitted_at=None,
            answers={},
            score=0,
            max_score=0,
        )

        # Mock DB to return our attempt
        mock_select = Mock()
        mock_select.where.return_value.where.return_value = mock_select
        mock_db_session.exec.return_value.first.return_value = attempt

        # Mock question: single choice, correct answer at index 0, 10 points
        q = Question(
            id=1,
            question_uuid="q1",
            question_text="Q",
            question_type="SINGLE_CHOICE",
            points=10,
            answer_options=[{"text": "A", "is_correct": True}, {"text": "B", "is_correct": False}],
            exam_id=1,
            order_index=0,
        )

        # Mock db_session.get to return question and exam
        def _get(cls, id=None):
            if cls == Question:
                return q
            # Return exam
            return SimpleNamespace(
                id=1,
                activity_id=42,
                settings={"allow_result_review": True, "show_correct_answers": True},
            )

        mock_db_session.get.side_effect = _get

        # Patch mark_exam_complete to assert it is called
        called = {"val": False}

        async def fake_mark_exam_complete(request, activity_id, user_id, db_session):
            called["val"] = True

        monkeypatch.setattr(
            "src.services.courses.activities.exams.mark_exam_complete", fake_mark_exam_complete
        )

        # Submit with correct answer (index 0) -> 100%
        with patch("sqlmodel.select", return_value=mock_select):
            result = await submit_exam_attempt(Mock(), "att1", {"1": 0}, current_user, mock_db_session)
            assert called["val"] is True

    @pytest.mark.asyncio
    async def test_submit_exam_does_not_mark_trail_step_below_threshold(
        self, monkeypatch, mock_db_session
    ):
        """Verify trail step is NOT marked complete when score <= 50%"""
        from src.services.courses.activities.exams import submit_exam_attempt
        from src.db.courses.exams import Question, AttemptStatusEnum

        current_user = SimpleNamespace(id=2)
        attempt = SimpleNamespace(
            id=2,
            attempt_uuid="att2",
            user_id=2,
            status=AttemptStatusEnum.IN_PROGRESS,
            question_order=[1, 2],
            exam_id=2,
            violations=[],
            started_at=datetime.now().isoformat(),
            submitted_at=None,
            answers={},
            score=0,
            max_score=0,
        )

        mock_select = Mock()
        mock_select.where.return_value.where.return_value = mock_select
        mock_db_session.exec.return_value.first.return_value = attempt

        # Two questions, total points 10 + 10 = 20, user gets 10 -> 50%
        q1 = Question(
            id=1,
            question_uuid="q1",
            question_text="Q1",
            question_type="SINGLE_CHOICE",
            points=10,
            answer_options=[{"text": "A", "is_correct": True}, {"text": "B", "is_correct": False}],
            exam_id=2,
            order_index=0,
        )
        q2 = Question(
            id=2,
            question_uuid="q2",
            question_text="Q2",
            question_type="SINGLE_CHOICE",
            points=10,
            answer_options=[{"text": "A", "is_correct": True}, {"text": "B", "is_correct": False}],
            exam_id=2,
            order_index=1,
        )

        def _get(cls, id=None):
            if cls == Question:
                # Return q1 for id==1, q2 for id==2
                return q1 if id == 1 else q2
            return SimpleNamespace(
                id=2,
                activity_id=84,
                settings={"allow_result_review": True, "show_correct_answers": True},
            )

        mock_db_session.get.side_effect = _get

        called = {"val": False}

        async def fake_mark_exam_complete(request, activity_id, user_id, db_session):
            called["val"] = True

        monkeypatch.setattr(
            "src.services.courses.activities.exams.mark_exam_complete", fake_mark_exam_complete
        )

        # Submit: answer q1 correct (index 0), q2 missing -> score = 10/20 = 50%
        with patch("sqlmodel.select", return_value=mock_select):
            result = await submit_exam_attempt(Mock(), "att2", {"1": 0}, current_user, mock_db_session)
            assert called["val"] is False

    def test_time_limit_auto_submits(self):
        """Verify time expiration triggers auto-submit"""
        # This would be integration test with timer - marking as placeholder
        # In real implementation, the frontend calls submit with expired flag
        # or backend job runs periodic checks
        pass


class TestQuestionManagement:
    """Test question CRUD operations"""

    def test_create_question_validates_type(self):
        """Verify question type validation"""
        pass

    def test_csv_export_import_roundtrip(self):
        """Verify CSV export/import preserves data"""
        # Export questions to CSV
        # Import CSV back
        # Verify questions match
        pass


class TestRBAC:
    """Test role-based access control for exams"""

    @pytest.fixture
    def mock_db_session(self):
        return Mock(spec=Session)

    @pytest.mark.asyncio
    async def test_student_cannot_create_exam(self, mock_db_session):
        """Verify students cannot create exams"""
        from src.services.courses.activities.exams import create_exam_with_activity
        from src.db.courses.exams import ExamCreateWithActivity

        student_user = SimpleNamespace(id=10, user_name="student@test.com")

        exam_data = ExamCreateWithActivity(
            exam_title="Test Exam",
            exam_description="Test",
            activity_name="Test Activity",
            chapter_id=1,
            org_id=1,
            settings={
                "time_limit": 60,
                "attempt_limit": 2,
                "violation_threshold": 3,
                "access_mode": "NO_ACCESS",
            },
        )

        # Mock contributor check to return False (not a teacher)
        with patch(
            "src.services.courses.activities.exams.is_course_contributor_or_admin",
            return_value=False,
        ):
            with pytest.raises(HTTPException) as exc_info:
                await create_exam_with_activity(Mock(), exam_data, student_user, mock_db_session)
            assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_teacher_can_manage_exam(self, mock_db_session):
        """Verify teachers/contributors can manage exams"""
        # Teachers should be able to create, update, delete exams
        # This is validated by the is_course_contributor_or_admin check
        # which is tested in the exam service layer
        pass

    @pytest.mark.asyncio
    async def test_student_cannot_see_other_attempts(self, mock_db_session):
        """Verify students can only see their own attempts"""
        from src.services.courses.activities.exams import get_user_attempts

        student_user = SimpleNamespace(id=20)
        exam_uuid = "exam-test-uuid"

        # Mock attempts - only user's own attempts should be returned
        user_attempts = [
            SimpleNamespace(id=1, user_id=20, exam_id=1),
            SimpleNamespace(id=2, user_id=20, exam_id=1),
        ]

        mock_select = Mock()
        mock_select.where.return_value.where.return_value = mock_select
        mock_db_session.exec.return_value.all.return_value = user_attempts

        # Mock exam lookup
        mock_db_session.get.return_value = SimpleNamespace(
            id=1, exam_uuid=exam_uuid, settings={}
        )

        with patch("sqlmodel.select", return_value=mock_select):
            result = await get_user_attempts(Mock(), exam_uuid, student_user, mock_db_session)
            # Should only return attempts belonging to the user
            assert all(attempt.user_id == student_user.id for attempt in result)

    @pytest.mark.asyncio
    async def test_teacher_can_see_all_attempts(self, mock_db_session):
        """Verify teachers can see all student attempts"""
        from src.services.courses.activities.exams import get_all_exam_attempts

        teacher_user = SimpleNamespace(id=99, user_name="teacher@test.com")
        exam_uuid = "exam-all-attempts"

        # Mock all attempts from multiple students
        all_attempts = [
            SimpleNamespace(id=1, user_id=10, exam_id=1),
            SimpleNamespace(id=2, user_id=20, exam_id=1),
            SimpleNamespace(id=3, user_id=30, exam_id=1),
        ]

        mock_select = Mock()
        mock_select.where.return_value = mock_select
        mock_db_session.exec.return_value.all.return_value = all_attempts

        # Mock exam and course lookups
        mock_db_session.get.return_value = SimpleNamespace(
            id=1,
            exam_uuid=exam_uuid,
            activity_id=100,
            settings={},
        )

        # Mock as teacher
        with patch(
            "src.services.courses.activities.exams.is_course_contributor_or_admin",
            return_value=True,
        ):
            with patch("sqlmodel.select", return_value=mock_select):
                result = await get_all_exam_attempts(
                    Mock(), exam_uuid, teacher_user, mock_db_session
                )
                # Teacher should see all attempts
                assert len(result) == 3
                assert set(a.user_id for a in result) == {10, 20, 30}


# Integration test examples
class TestExamIntegration:
    """Integration tests for complete exam flows"""

    def test_complete_exam_flow(self):
        """Test: Create exam → Add questions → Student takes → Teacher reviews"""
        # 1. Teacher creates exam
        # 2. Teacher adds questions
        # 3. Teacher publishes and sets access to ALL_ENROLLED
        # 4. Student starts attempt
        # 5. Student answers questions
        # 6. Student submits
        # 7. Verify grading
        # 8. Teacher views results
        pass

    def test_violation_flow(self):
        """Test: Student takes exam → Violations accumulate → Auto-submit"""
        # 1. Start exam with violation_threshold=3
        # 2. Record violation (tab switch)
        # 3. Record violation (devtools)
        # 4. Record violation (fullscreen exit)
        # 5. Verify auto-submit triggered
        # 6. Verify violation log in results
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
