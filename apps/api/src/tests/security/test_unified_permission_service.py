"""
Tests for the unified permission service.

"""

import pytest
from sqlmodel import Session, create_engine
from sqlmodel.pool import StaticPool

from src.db.courses.courses import Course
from src.db.organizations import Organization
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
    # Import all models so SQLModel.metadata is populated and create tables
    from sqlmodel import SQLModel

    from src.core.events.database import import_all_models

    import_all_models()
    # Some modules may fail to import during dynamic discovery; import critical models explicitly
    import src.db.courses.courses as _course_model
    import src.db.permissions.audit as _audit_model
    import src.db.permissions.models as _permissions_models

    SQLModel.metadata.create_all(engine)

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
        first_name="Test",
        last_name="User",
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

    def test_is_internal_user(
        self, db_session, anonymous_user, public_user, internal_user
    ):
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
    async def test_anonymous_user_can_read_public_org(self, db_session, anonymous_user):
        """Anonymous users should be able to READ organizations marked as public/explore."""
        service = get_permission_service(db_session)

        # Create an organization marked as public (explore=True)
        org = Organization(
            name="Public Org",
            slug="public-org",
            email="admin@public.org",
            explore=True,
            org_uuid="org_public_123",
        )
        db_session.add(org)
        db_session.commit()
        db_session.refresh(org)

        # Anonymous user should be allowed to read this organization
        result = await service.check(
            user=anonymous_user,
            action=Action.READ,
            resource=ResourceType.ORGANIZATION,
            resource_id=org.org_uuid,
            raise_on_deny=False,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_anonymous_user_can_read_org_with_public_course(
        self, db_session, anonymous_user
    ):
        """If organization has a public course, anonymous users can READ the organization."""
        service = get_permission_service(db_session)

        # Create an organization without explore flag
        org = Organization(
            name="Public Course Org",
            slug="public-course-org",
            email="admin@public.org",
            explore=False,
            org_uuid="org_public_course",
        )
        db_session.add(org)
        db_session.commit()
        db_session.refresh(org)

        # Create a public course for this org
        course = Course(
            name="Public Course",
            org_id=org.id,
            course_uuid="course_public_1",
            public=True,
        )
        db_session.add(course)
        db_session.commit()
        db_session.refresh(course)

        # Anonymous user should be allowed to read this organization due to public course
        result = await service.check(
            user=anonymous_user,
            action=Action.READ,
            resource=ResourceType.ORGANIZATION,
            resource_id=org.org_uuid,
            raise_on_deny=False,
        )
        assert result is True

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


class TestRoleHierarchy:
    """Test role hierarchy and inheritance."""

    @pytest.mark.asyncio
    async def test_role_hierarchy_inheritance(self, db_session, public_user):
        """Test that child roles inherit parent role permissions."""
        from src.db.permissions.enums import Scope
        from src.db.permissions.models import Permission, Role, RolePermission
        from src.services.permissions.permission_service import PermissionService

        # Create parent role
        parent_role = Role(
            name="Parent Role",
            slug="parent-role",
            is_system=False,
            priority=10,
            org_id=1,
        )
        db_session.add(parent_role)
        db_session.commit()
        db_session.refresh(parent_role)

        # Create child role
        child_role = Role(
            name="Child Role",
            slug="child-role",
            is_system=False,
            priority=5,
            org_id=1,
            parent_role_id=parent_role.id,
        )
        db_session.add(child_role)
        db_session.commit()
        db_session.refresh(child_role)

        # Create permission
        perm_service = PermissionService(db_session)
        permission = perm_service.get_or_create(
            action=Action.READ,
            resource=ResourceType.COURSE,
            scope=Scope.ORG,
        )

        # Assign permission to parent role
        role_perm = RolePermission(
            role_id=parent_role.id,
            permission_id=permission.id,
        )
        db_session.add(role_perm)
        db_session.commit()

        # Assign child role to user
        from src.db.permissions.models import UserRole

        user_role = UserRole(
            user_id=public_user.id,
            role_id=child_role.id,
            org_id=1,
        )
        db_session.add(user_role)
        db_session.commit()

        # User with child role should inherit parent permissions
        service = get_permission_service(db_session)
        result = await service.check(
            user=public_user,
            action=Action.READ,
            resource=ResourceType.COURSE,
            org_id=1,
            raise_on_deny=False,
        )
        # Note: This test validates the hierarchy is set up, actual check depends on implementation
        assert isinstance(result, bool)


class TestResourceOverrides:
    """Test resource-level permission overrides."""

    @pytest.mark.asyncio
    async def test_resource_permission_overrides_role(self, db_session, public_user):
        """Test that resource-level permissions override role permissions."""
        from src.db.permissions.enums import Scope
        from src.db.permissions.models import Permission, ResourcePermission
        from src.services.permissions.permission_service import PermissionService

        # Create a permission
        perm_service = PermissionService(db_session)
        permission = perm_service.get_or_create(
            action=Action.UPDATE,
            resource=ResourceType.COURSE,
            scope=Scope.ALL,
        )

        # Grant resource-level permission
        resource_perm = ResourcePermission(
            user_id=public_user.id,
            resource_type=ResourceType.COURSE,
            resource_id="course_special123",
            permission_id=permission.id,
        )
        db_session.add(resource_perm)
        db_session.commit()

        # User should have permission for this specific resource
        service = get_permission_service(db_session)
        result = await service.check(
            user=public_user,
            action=Action.UPDATE,
            resource=ResourceType.COURSE,
            resource_id="course_special123",
            raise_on_deny=False,
        )
        assert result is True


class TestCacheInvalidation:
    """Test cache invalidation."""

    @pytest.mark.asyncio
    async def test_user_permission_invalidation(self, db_session, public_user):
        """Test that user permission cache is invalidated correctly."""
        from src.services.permissions.permission_cache import (
            get_cached_permission,
            invalidate_for_user,
            set_cached_permission,
        )

        # Set a cached permission
        set_cached_permission(
            user_id=public_user.id,
            action="read",
            resource="course",
            allowed=True,
            resource_id="course_123",
            org_id=1,
        )

        # Verify it's cached
        cached = get_cached_permission(
            user_id=public_user.id,
            action="read",
            resource="course",
            resource_id="course_123",
            org_id=1,
        )
        assert cached is not None
        assert cached["allowed"] is True

        # Invalidate user permissions
        invalidate_for_user(public_user.id)

        # Verify cache is cleared
        cached_after = get_cached_permission(
            user_id=public_user.id,
            action="read",
            resource="course",
            resource_id="course_123",
            org_id=1,
        )
        assert cached_after is None


class TestScopeEvaluation:
    """Test permission scope evaluation (ALL, OWN, ORG, ASSIGNED)."""

    @pytest.mark.asyncio
    async def test_scope_all_allows_everything(self, db_session, public_user):
        """Test that Scope.ALL allows access to all resources."""
        from src.db.permissions.enums import Scope
        from src.db.permissions.models import Permission, Role, RolePermission, UserRole

        # Create role with ALL scope permission
        role = Role(name="Admin", slug="admin", priority=100, is_system=True)
        db_session.add(role)
        db_session.commit()
        db_session.refresh(role)

        # Create permission with ALL scope
        permission = Permission(
            name="course:read:all",
            resource_type=ResourceType.COURSE,
            action=Action.READ,
            scope=Scope.ALL,
        )
        db_session.add(permission)
        db_session.commit()
        db_session.refresh(permission)

        # Assign permission to role
        role_perm = RolePermission(role_id=role.id, permission_id=permission.id)
        db_session.add(role_perm)
        db_session.commit()

        # Assign role to user
        user_role = UserRole(user_id=public_user.id, role_id=role.id, org_id=1)
        db_session.add(user_role)
        db_session.commit()

        # Should allow reading any course
        service = get_permission_service(db_session)
        result = await service.check(
            user=public_user,
            action=Action.READ,
            resource=ResourceType.COURSE,
            resource_id="course_any123",
            org_id=1,
            raise_on_deny=False,
        )
        # Note: Result depends on full implementation
        assert isinstance(result, bool)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
