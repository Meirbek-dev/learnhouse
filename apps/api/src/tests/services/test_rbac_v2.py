"""
RBAC v2 Service Tests - Comprehensive Test Suite

Test coverage:
- Permission checks (granted, denied, cached, expired)
- Role management (assign, revoke, create)
- Cache operations (set, get, invalidate)
- Audit logging
- Batch operations
- Edge cases and error handling
"""

import pytest
from datetime import datetime, timedelta, UTC
from unittest.mock import Mock, MagicMock, patch

from src.services.rbac import RBACService, PermissionCheck, CheckResult
from src.services.rbac.cache import CacheService
from src.services.rbac.audit import AuditService


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def mock_db():
    """Mock database session."""
    db = Mock()
    db.exec = Mock()
    db.add = Mock()
    db.commit = Mock()
    db.rollback = Mock()
    db.flush = Mock()
    db.refresh = Mock()
    db.delete = Mock()
    return db


@pytest.fixture
def mock_cache():
    """Mock cache service."""
    cache = Mock(spec=CacheService)
    cache.get_permission = Mock(return_value=None)
    cache.set_permission = Mock()
    cache.invalidate_user = Mock()
    cache.invalidate_role = Mock()
    cache.invalidate_org = Mock()
    return cache


@pytest.fixture
def mock_audit():
    """Mock audit service."""
    audit = Mock(spec=AuditService)
    audit.log_permission_check = Mock()
    audit.log_role_assignment = Mock()
    audit.log_role_revocation = Mock()
    audit.log_role_creation = Mock()
    return audit


@pytest.fixture
def rbac_service(mock_db, mock_cache, mock_audit):
    """RBAC service instance with mocks."""
    return RBACService(
        db=mock_db,
        cache=mock_cache,
        audit=mock_audit,
        cache_ttl=300,
        audit_enabled=True,
    )


# ============================================================================
# Permission Check Tests
# ============================================================================

class TestPermissionChecks:
    """Tests for permission checking."""

    async def test_check_permission_granted(self, rbac_service, mock_db, mock_cache):
        """Test successful permission check."""
        # Setup: permission exists
        mock_result = Mock()
        mock_result.first = Mock(return_value=Mock(id=1, name="course:update:org"))
        mock_db.exec = Mock(return_value=mock_result)

        # Execute
        result = await rbac_service.check(
            user_id=123,
            action="update",
            resource="course",
            org_id=1,
        )

        # Assert
        assert result.granted is True
        assert "granted" in result.reason
        assert result.cached is False
        mock_cache.set_permission.assert_called_once()

    async def test_check_permission_denied_no_role(self, rbac_service, mock_db):
        """Test permission denied when user has no role."""
        # Setup: no permission found
        mock_result = Mock()
        mock_result.first = Mock(return_value=None)
        mock_db.exec = Mock(return_value=mock_result)

        # Execute
        result = await rbac_service.check(
            user_id=123,
            action="delete",
            resource="course",
            org_id=1,
        )

        # Assert
        assert result.granted is False
        assert "no_role_with_permission" in result.reason

    async def test_check_permission_uses_cache(self, rbac_service, mock_cache, mock_db):
        """Test that cache is used when available."""
        # Setup: cache hit
        mock_cache.get_permission = Mock(return_value=True)

        # Execute
        result = await rbac_service.check(
            user_id=123,
            action="read",
            resource="course",
            org_id=1,
        )

        # Assert
        assert result.granted is True
        assert result.cached is True
        # DB should not be queried
        mock_db.exec.assert_not_called()

    async def test_check_permission_cache_miss(self, rbac_service, mock_cache, mock_db):
        """Test cache miss triggers DB query."""
        # Setup: cache miss
        mock_cache.get_permission = Mock(return_value=None)
        mock_result = Mock()
        mock_result.first = Mock(return_value=Mock(id=1, name="course:read:all"))
        mock_db.exec = Mock(return_value=mock_result)

        # Execute
        result = await rbac_service.check(
            user_id=123,
            action="read",
            resource="course",
            org_id=1,
        )

        # Assert
        assert result.granted is True
        assert result.cached is False
        mock_db.exec.assert_called()
        mock_cache.set_permission.assert_called_once()

    async def test_check_permission_expired_role(self, rbac_service, mock_db):
        """Test permission denied when role has expired."""
        # Setup: permission exists but role expired
        mock_perm_result = Mock()
        mock_perm_result.first = Mock(return_value=Mock(id=1, name="course:update:org"))

        mock_user_role = Mock()
        mock_user_role.expires_at = datetime.now(UTC) - timedelta(days=1)
        mock_role_result = Mock()
        mock_role_result.first = Mock(return_value=mock_user_role)

        mock_db.exec = Mock(side_effect=[mock_perm_result, mock_role_result])

        # Execute
        result = await rbac_service.check(
            user_id=123,
            action="update",
            resource="course",
            org_id=1,
        )

        # Assert
        assert result.granted is False
        assert result.reason == "role_expired"

    async def test_check_permission_audits_denial(self, rbac_service, mock_db, mock_audit):
        """Test that permission denials are audited."""
        # Setup: denied permission
        mock_result = Mock()
        mock_result.first = Mock(return_value=None)
        mock_db.exec = Mock(return_value=mock_result)

        # Execute
        await rbac_service.check(
            user_id=123,
            action="delete",
            resource="organization",
            org_id=1,
        )

        # Assert
        mock_audit.log_permission_check.assert_called_once()
        call_args = mock_audit.log_permission_check.call_args[1]
        assert call_args["result"] == CheckResult.DENIED


# ============================================================================
# Batch Operations Tests
# ============================================================================

class TestBatchOperations:
    """Tests for batch permission checks."""

    async def test_check_many(self, rbac_service, mock_db):
        """Test batch permission check."""
        # Setup: mock multiple permission checks
        # Need to mock both the permission lookup and user_role lookup
        mock_perm1 = Mock()
        mock_perm1.id = 1
        mock_perm1.name = "course:update:org"

        mock_perm2 = Mock()
        mock_perm2.id = 2
        mock_perm2.name = "assignment:create:org"

        mock_user_role = Mock()
        mock_user_role.expires_at = None

        # Setup exec mock to return different results for different queries
        call_count = [0]
        def mock_exec(query):
            result = Mock()
            idx = call_count[0]
            call_count[0] += 1

            # Alternating between permission check and user_role check
            if idx == 0:  # First permission check
                result.first = Mock(return_value=mock_perm1)
            elif idx == 1:  # First user_role check
                result.first = Mock(return_value=mock_user_role)
            elif idx == 2:  # Second permission check (denied)
                result.first = Mock(return_value=None)
            elif idx == 3:  # Third permission check
                result.first = Mock(return_value=mock_perm2)
            elif idx == 4:  # Third user_role check
                result.first = Mock(return_value=mock_user_role)
            else:
                result.first = Mock(return_value=None)
            return result

        mock_db.exec = Mock(side_effect=mock_exec)

        # Execute
        results = rbac_service.check_many(
            user_id=123,
            checks=[
                ("update", "course", "course_123"),
                ("delete", "course", "course_123"),
                ("create", "assignment", None),
            ],
            org_id=1,
        )

        # Assert
        assert results["course:update:org"] is True
        assert results["course:delete:org"] is False
        assert results["assignment:create:org"] is True


# ============================================================================
# Role Management Tests
# ============================================================================

class TestRoleManagement:
    """Tests for role assignment and revocation."""

    def test_assign_role_success(self, rbac_service, mock_db, mock_cache, mock_audit):
        """Test successful role assignment."""
        # Setup: role exists, not yet assigned
        mock_role = Mock(id=5, slug="instructor", org_id=1)
        mock_result = Mock()
        mock_result.first = Mock(side_effect=[mock_role, None])
        mock_db.exec = Mock(return_value=mock_result)

        # Execute
        rbac_service.assign_role(
            user_id=123,
            role_slug="instructor",
            org_id=1,
            assigned_by=456,
        )

        # Assert
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_cache.invalidate_user.assert_called_once_with(123, 1)
        mock_audit.log_role_assignment.assert_called_once()

    def test_assign_role_not_found(self, rbac_service, mock_db):
        """Test role assignment fails when role doesn't exist."""
        # Setup: role not found
        mock_result = Mock()
        mock_result.first = Mock(return_value=None)
        mock_db.exec = Mock(return_value=mock_result)

        # Execute & Assert
        with pytest.raises(Exception) as exc:
            rbac_service.assign_role(
                user_id=123,
                role_slug="nonexistent",
                org_id=1,
            )

        assert "not found" in str(exc.value).lower()

    def test_assign_role_already_assigned(self, rbac_service, mock_db):
        """Test role assignment fails when role already assigned."""
        # Setup: role exists and already assigned
        mock_role = Mock(id=5, slug="instructor")
        mock_existing = Mock()  # Already assigned
        mock_result = Mock()
        mock_result.first = Mock(side_effect=[mock_role, mock_existing])
        mock_db.exec = Mock(return_value=mock_result)

        # Execute & Assert
        with pytest.raises(Exception) as exc:
            rbac_service.assign_role(
                user_id=123,
                role_slug="instructor",
                org_id=1,
            )

        assert "already assigned" in str(exc.value).lower()

    def test_revoke_role_success(self, rbac_service, mock_db, mock_cache, mock_audit):
        """Test successful role revocation."""
        # Setup: role exists and is assigned
        mock_role = Mock(id=5, slug="instructor")
        mock_user_role = Mock()
        mock_result = Mock()
        mock_result.first = Mock(side_effect=[mock_role, mock_user_role])
        mock_db.exec = Mock(return_value=mock_result)

        # Execute
        rbac_service.revoke_role(
            user_id=123,
            role_slug="instructor",
            org_id=1,
            revoked_by=456,
        )

        # Assert
        mock_db.delete.assert_called_once_with(mock_user_role)
        mock_db.commit.assert_called_once()
        mock_cache.invalidate_user.assert_called_once_with(123, 1)
        mock_audit.log_role_revocation.assert_called_once()

    def test_create_role(self, rbac_service, mock_db, mock_audit):
        """Test role creation."""
        # Setup: role doesn't exist
        mock_result = Mock()
        mock_result.first = Mock(return_value=None)
        mock_db.exec = Mock(return_value=mock_result)

        # Execute
        role = rbac_service.create_role(
            slug="custom-role",
            name="Custom Role",
            org_id=1,
            description="A custom role",
            created_by=123,
        )

        # Assert
        mock_db.add.assert_called()
        mock_db.commit.assert_called()
        assert role["slug"] == "custom-role"
        mock_audit.log_role_creation.assert_called_once()


# ============================================================================
# Utility Tests
# ============================================================================

class TestUtilities:
    """Tests for utility methods."""

    def test_get_user_roles(self, rbac_service, mock_db):
        """Test getting user's roles."""
        # Setup: user has roles
        mock_role = Mock(
            id=1,
            slug="instructor",
            name="Instructor",
            description="Course instructor",
        )
        mock_user_role = Mock(org_id=1, expires_at=None)
        mock_result = Mock()
        mock_result.all = Mock(return_value=[(mock_role, mock_user_role)])
        mock_db.exec = Mock(return_value=mock_result)

        # Execute
        roles = rbac_service.get_user_roles(user_id=123, org_id=1)

        # Assert
        assert len(roles) == 1
        assert roles[0]["slug"] == "instructor"
        assert roles[0]["org_id"] == 1

    def test_get_user_permissions(self, rbac_service, mock_db):
        """Test getting user's permissions."""
        # Setup: user has permissions - use a proper mock with spec
        class MockPerm:
            id = 1
            name = "course:update:org"
            resource_type = "course"
            action = "update"
            scope = "org"
            description = "Update courses"

        mock_perm = MockPerm()
        mock_result = Mock()
        mock_result.all = Mock(return_value=[mock_perm])
        mock_db.exec = Mock(return_value=mock_result)

        # Execute
        perms = rbac_service.get_user_permissions(user_id=123, org_id=1)

        # Assert
        assert len(perms) == 1
        assert perms[0]["name"] == "course:update:org"
        assert perms[0]["resource_type"] == "course"

    def test_build_permission_name(self, rbac_service):
        """Test permission name builder."""
        # Test default scope
        name = rbac_service._build_permission_name("update", "course")
        assert name == "course:update:org"

        # Test custom scope
        name = rbac_service._build_permission_name("read", "user", "all")
        assert name == "user:read:all"


# ============================================================================
# Edge Cases and Error Handling
# ============================================================================

class TestEdgeCases:
    """Tests for edge cases and error handling."""

    async def test_check_with_db_error(self, rbac_service, mock_db, mock_audit):
        """Test handling of database errors."""
        # Setup: DB raises exception
        mock_db.exec = Mock(side_effect=Exception("Database error"))

        # Execute
        result = await rbac_service.check(
            user_id=123,
            action="update",
            resource="course",
            org_id=1,
        )

        # Assert
        assert result.granted is False
        assert "db_error" in result.reason

    async def test_check_without_cache(self, mock_db):
        """Test permission check without cache service."""
        # Create service without cache
        rbac = RBACService(db=mock_db, cache=None, audit=None)

        # Setup: permission exists
        mock_result = Mock()
        mock_result.first = Mock(return_value=Mock(id=1, name="course:read:all"))
        mock_db.exec = Mock(return_value=mock_result)

        # Execute
        result = await rbac.check(
            user_id=123,
            action="read",
            resource="course",
            org_id=1,
        )

        # Assert
        assert result.granted is True
        assert result.cached is False

    async def test_check_without_audit(self, mock_db, mock_cache):
        """Test permission check without audit service."""
        # Create service without audit
        rbac = RBACService(db=mock_db, cache=mock_cache, audit=None)

        # Setup: permission denied
        mock_result = Mock()
        mock_result.first = Mock(return_value=None)
        mock_db.exec = Mock(return_value=mock_result)

        # Execute (should not raise exception)
        result = await rbac.check(
            user_id=123,
            action="delete",
            resource="course",
            org_id=1,
        )

        # Assert
        assert result.granted is False

    async def test_permission_check_raise_if_denied(self, rbac_service, mock_db):
        """Test PermissionCheck.raise_if_denied method."""
        from fastapi import HTTPException

        # Setup: denied permission
        mock_result = Mock()
        mock_result.first = Mock(return_value=None)
        mock_db.exec = Mock(return_value=mock_result)

        # Execute
        result = await rbac_service.check(
            user_id=123,
            action="delete",
            resource="course",
            org_id=1,
        )

        # Assert
        with pytest.raises(HTTPException) as exc:
            result.raise_if_denied("Custom error message")

        assert exc.value.status_code == 403
        assert "Custom error message" in str(exc.value.detail)


# ============================================================================
# Performance Tests
# ============================================================================

class TestPerformance:
    """Performance-related tests."""

    @pytest.mark.benchmark
    def test_permission_check_performance(self, rbac_service, mock_db, mock_cache):
        """Test that permission checks complete in reasonable time."""
        import time

        # Setup
        mock_cache.get_permission = Mock(return_value=None)
        mock_result = Mock()
        mock_result.first = Mock(return_value=Mock(id=1, name="course:read:all"))
        mock_db.exec = Mock(return_value=mock_result)

        # Benchmark - use sync check for performance testing
        start = time.perf_counter()

        for _ in range(100):
            rbac_service.check_sync(
                user_id=123,
                action="read",
                resource="course",
                org_id=1,
            )

        elapsed = (time.perf_counter() - start) * 1000  # ms
        avg_time = elapsed / 100

        # Assert: Average check should be fast (< 10ms for mock)
        assert avg_time < 10, f"Average check time {avg_time:.2f}ms exceeds 10ms"

    @pytest.mark.benchmark
    def test_cached_permission_check_performance(self, rbac_service, mock_cache):
        """Test that cached permission checks are very fast."""
        import time

        # Setup: always cache hit
        mock_cache.get_permission = Mock(return_value=True)

        # Benchmark - use sync check for performance testing
        start = time.perf_counter()

        for _ in range(1000):
            rbac_service.check_sync(
                user_id=123,
                action="read",
                resource="course",
                org_id=1,
            )

        elapsed = (time.perf_counter() - start) * 1000  # ms
        avg_time = elapsed / 1000

        # Assert: Cached checks should be very fast (< 1ms)
        assert avg_time < 1, f"Average cached check time {avg_time:.2f}ms exceeds 1ms"
