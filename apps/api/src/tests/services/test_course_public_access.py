from __future__ import annotations

from unittest.mock import Mock

import pytest

from src.db.courses.courses import Course
from src.db.users import AnonymousUser
from src.services.courses.courses import get_course, get_course_by_id


class _ExecResult:
    def __init__(self, *, first_value=None, all_value=None) -> None:
        self._first_value = first_value
        self._all_value = all_value

    def first(self):
        return self._first_value

    def all(self):
        return self._all_value


class _FakeSession:
    def __init__(self, responses: list[_ExecResult]) -> None:
        self._responses = responses
        self._index = 0

    def exec(self, _statement) -> _ExecResult:
        response = self._responses[self._index]
        self._index += 1
        return response


def _public_course() -> Course:
    return Course(
        id=1,
        org_id=11,
        name="Public course",
        description="",
        about="",
        learnings="",
        tags="",
        thumbnail_image="",
        public=True,
        open_to_contributors=False,
        course_uuid="course_public",
        creator_id=77,
        creation_date="2026-01-01T00:00:00Z",
        update_date="2026-01-01T00:00:00Z",
    )


@pytest.mark.asyncio
async def test_get_public_course_allows_anonymous_without_rbac_check():
    session = _FakeSession(
        [
            _ExecResult(first_value=_public_course()),
            _ExecResult(all_value=[]),
        ]
    )
    checker = Mock()

    result = await get_course(
        request=None,  # type: ignore[arg-type]
        course_uuid="course_public",
        current_user=AnonymousUser(),
        db_session=session,  # type: ignore[arg-type]
        checker=checker,
    )

    checker.require.assert_not_called()
    assert result.course_uuid == "course_public"
    assert result.public is True


@pytest.mark.asyncio
async def test_get_public_course_by_id_allows_anonymous_without_rbac_check():
    session = _FakeSession(
        [
            _ExecResult(first_value=_public_course()),
            _ExecResult(all_value=[]),
        ]
    )
    checker = Mock()

    result = await get_course_by_id(
        request=None,  # type: ignore[arg-type]
        course_id=1,
        current_user=AnonymousUser(),
        db_session=session,  # type: ignore[arg-type]
        checker=checker,
    )

    checker.require.assert_not_called()
    assert result.id == 1
    assert result.public is True
