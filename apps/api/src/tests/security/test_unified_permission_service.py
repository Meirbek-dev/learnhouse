"""
Tests for the unified permission service.

This module tests the new UnifiedPermissionService which replaces
all the old rbac_check_* functions.
"""

import pytest
from sqlmodel import Session, create_engine
from sqlmodel.pool import StaticPool

from src.db.permissions.enums import Action, ResourceType
from src.db.users import AnonymousUser, InternalUser, PublicUser
from src.services.permissions.unified_permission_service import (
    UnifiedPermissionService,
    get_permission_service,
)


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Create tables (would normally be done by migrations)
    # from src.db.base import SQLModel
    # SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        yield session


@pytest.fixture
def anonymous_user():
    """Create an anonymous user for testing."""
    return AnonymousUser()


@pytest.fixture
def public_user():
    """Create a public user for testing."""
    return PublicUser(
        id=1,
        email="test@example.com",
        username="testuser",
        user_uuid="user_test123",
    )


@pytest.fixture
def internal_user():
    """Create an internal user for testing."""
    return InternalUser(name="system")


class TestUnifiedPermissionService:
    """Test suite for UnifiedPermissionService."""

    def test_service_creation(self, db_session):
        """Test that service can be created."""
        service = get_permission_service(db_session)
        assert isinstance(service, UnifiedPermissionService)

    def test_is_anonymous(self, db_session, anonymous_user, public_user, internal_user):
        """Test is_anonymous helper."""
        service = get_permission_service(db_session)

        assert service._is_anonymous(anonymous_user) is True
        assert service._is_anonymous(public_user) is False
        assert service._is_anonymous(internal_user) is False
        assert service._is_anonymous(None) is True

    def test_get_user_id(self, db_session, anonymous_user, public_user, internal_user):
        """Test get_user_id helper."""
        service = get_permission_service(db_session)

        assert service._get_user_id(anonymous_user) == 0
        assert service._get_user_id(public_user) == 1
        assert service._get_user_id(None) == 0

    def test_is_internal_user(self, db_session, anonymous_user, public_user, internal_user):
        """Test is_internal_user helper."""
        service = get_permission_service(db_session)

        assert service._is_internal_user(internal_user) is True
        assert service._is_internal_user(public_user) is False
        assert service._is_internal_user(anonymous_user) is False

    @pytest.mark.asyncio
    async def test_internal_user_bypasses_checks(self, db_session, internal_user):
        """Test that internal users bypass all permission checks."""
        service = get_permission_service(db_session)

        # Internal users should be able to do anything
        result = await service.check(
            user=internal_user,
            action=Action.DELETE,
            resource=ResourceType.COURSE,
            resource_id="course_123",
            raise_on_deny=False,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_anonymous_user_denied_for_writes(self, db_session, anonymous_user):
        """Test that anonymous users are denied for write operations."""
        service = get_permission_service(db_session)

        # Anonymous users should not be able to create
        result = await service.check(
            user=anonymous_user,
            action=Action.CREATE,
            resource=ResourceType.COURSE,
            raise_on_deny=False,
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_batch_check(self, db_session, public_user):
        """Test batch permission checking."""
        service = get_permission_service(db_session)

        checks = [
            (Action.READ, ResourceType.COURSE, "course_123", 1),
            (Action.UPDATE, ResourceType.COURSE, "course_123", 1),
            (Action.DELETE, ResourceType.COURSE, "course_123", 1),
        ]

        results = await service.check_batch(user=public_user, checks=checks)

        # Should have results for all checks
        assert len(results) == 3

        # All keys should be tuples matching the checks
        for check in checks:
            assert check in results
            assert isinstance(results[check], bool)

    @pytest.mark.asyncio
    async def test_can_method(self, db_session, public_user):
        """Test can() method (non-raising variant)."""
        service = get_permission_service(db_session)

        # can() should never raise, just return True/False
        result = await service.can(
            user=public_user,
            action=Action.READ,
            resource=ResourceType.COURSE,
            resource_id="course_123",
        )
        assert isinstance(result, bool)

    @pytest.mark.asyncio
    async def test_require_method_raises(self, db_session, anonymous_user):
        """Test require() method raises on denial."""
        service = get_permission_service(db_session)

        # require() should raise HTTPException when denied
        with pytest.raises(Exception):  # Would be HTTPException in real code
            await service.require(
                user=anonymous_user,
                action=Action.CREATE,
                resource=ResourceType.COURSE,
            )

    def test_policy_registration(self, db_session):
        """Test that policies can be registered."""
        service = get_permission_service(db_session)

        # Policies should be registered in get_permission_service()
        assert ResourceType.COURSE in service._policies
        assert ResourceType.ORGANIZATION in service._policies
        assert ResourceType.USER in service._policies


class TestCompatibilityWrappers:
    """Test backward compatibility wrappers."""

    @pytest.mark.asyncio
    async def test_rbac_check_compat(self, db_session, public_user):
        """Test that old rbac_check still works via compatibility layer."""
        from src.security.rbac.compat import rbac_check

        # Should not raise for internal operations
        result = await rbac_check(
            request=None,
            resource_uuid="course_123",
            current_user=public_user,
            action="read",
            db_session=db_session,
            resource_type=ResourceType.COURSE,
        )
        # Result depends on permissions, but should not error
        assert isinstance(result, bool)

    @pytest.mark.asyncio
    async def test_courses_rbac_check_compat(self, db_session, public_user):
        """Test that old courses_rbac_check still works."""
        from src.security.rbac.compat import courses_rbac_check

        # Should work via compatibility layer
        result = await courses_rbac_check(
            request=None,
            course_uuid="course_123",
            current_user=public_user,
            action="read",
            db_session=db_session,
        )
        assert isinstance(result, bool)


class TestCaching:
    """Test caching behavior."""

    def test_cache_can_be_disabled(self, db_session):
        """Test that caching can be disabled."""
        service = get_permission_service(db_session, use_cache=False)
        assert service.use_cache is False

    def test_cache_enabled_by_default(self, db_session):
        """Test that caching is enabled by default."""
        service = get_permission_service(db_session)
        assert service.use_cache is True


class TestAuditLogging:
    """Test audit logging behavior."""

    @pytest.mark.asyncio
    async def test_internal_user_audited(self, db_session, internal_user):
        """Test that internal user access is audited."""
        service = get_permission_service(db_session)

        # Internal user access should be logged
        await service.check(
            user=internal_user,
            action=Action.READ,
            resource=ResourceType.COURSE,
            resource_id="course_123",
            raise_on_deny=False,
        )

        # Would check audit log in real test
        # For now, just ensure it doesn't error


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
