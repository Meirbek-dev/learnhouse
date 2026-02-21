from __future__ import annotations

from types import SimpleNamespace

import pytest

from src.security.rbac import PermissionChecker, PermissionDenied


class _QueryResult:
    def __init__(self, first_value):
        self._first_value = first_value

    def first(self):
        return self._first_value


class _FakeDb:
    def __init__(self, role):
        self.role = role
        self.added = []

    def get(self, _model, _id):
        return self.role

    def exec(self, _query):
        return _QueryResult(None)

    def add(self, value):
        self.added.append(value)

    def flush(self):
        return None


def test_assign_role_blocks_higher_priority_assignment(monkeypatch):
    role = SimpleNamespace(id=2, org_id=1, priority=90)
    db = _FakeDb(role)
    checker = PermissionChecker(db)  # type: ignore[arg-type]

    monkeypatch.setattr(
        checker,
        "get_user_roles",
        lambda _user_id, _org_id: [{"priority": 50}],
    )

    with pytest.raises(PermissionDenied):
        checker.assign_role(user_id=100, role_id=2, org_id=1, assigned_by=200)


def test_assign_role_allows_equal_or_lower_priority_assignment(monkeypatch):
    role = SimpleNamespace(id=2, org_id=1, priority=50)
    db = _FakeDb(role)
    checker = PermissionChecker(db)  # type: ignore[arg-type]

    monkeypatch.setattr(
        checker,
        "get_user_roles",
        lambda _user_id, _org_id: [{"priority": 50}],
    )

    checker.assign_role(user_id=100, role_id=2, org_id=1, assigned_by=200)

    assert len(db.added) == 1
