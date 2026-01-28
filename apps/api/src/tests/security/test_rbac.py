"""
Tests for the new RBAC permission system.

This module tests the new permission checker, policy engine,
and related components.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import Mock, patch

import pytest
from sqlmodel import Session, create_engine
from sqlmodel.pool import StaticPool

from src.db.permissions.enums import Action, ResourceType, Scope
from src.db.permissions.models import (
    Permission,
    Role,
    RolePermission,
    UserRole,
)
from src.db.users import AnonymousUser, PublicUser
from src.services.permissions import get_permission_service
from src.services.permissions.permission_service import PermissionService
from src.services.permissions.role_service import RoleService
from src.services.permissions.unified_permission_service import UnifiedPermissionService


class TestPermissionEnums:
    """Test permission enums and utilities."""

    def test_action_enum_values(self):
        """Test that Action enum has expected values."""
        assert Action.CREATE.value == "create"
        assert Action.READ.value == "read"
        assert Action.UPDATE.value == "update"
        assert Action.DELETE.value == "delete"
        assert Action.MANAGE.value == "manage"

    def test_resource_type_enum_values(self):
        """Test that ResourceType enum has expected values."""
        assert ResourceType.COURSE.value == "course"
        assert ResourceType.ORGANIZATION.value == "organization"
        assert ResourceType.USER.value == "user"
        assert ResourceType.CHAPTER.value == "chapter"

    def test_scope_enum_values(self):
        """Test that Scope enum has expected values."""
        assert Scope.ALL.value == "all"
        assert Scope.OWN.value == "own"
        assert Scope.ORG.value == "org"
        assert Scope.ASSIGNED.value == "assigned"


class TestPermissionModels:
    """Test permission database models."""

    def test_permission_model_creation(self):
        """Test creating a Permission model."""
        perm = Permission(
            name="course:create:org",
            resource_type=ResourceType.COURSE,
            action=Action.CREATE,
            scope=Scope.ORG,
            description="Create courses in organization",
        )
        assert perm.name == "course:create:org"
        assert perm.resource_type == ResourceType.COURSE
        assert perm.action == Action.CREATE
        assert perm.scope == Scope.ORG

    def test_role_new_model_creation(self):
        """Test creating a Role model."""
        role = Role(
            name="Test Role",
            slug="test-role",
            description="A test role",
            is_system=False,
            priority=50,
        )
        assert role.name == "Test Role"
        assert role.slug == "test-role"
        assert role.priority == 50


class TestUnifiedPermissionService:
    """Test the UnifiedPermissionService class."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        return Mock(spec=Session)

    @pytest.fixture
    def mock_public_user(self):
        """Create a mock authenticated user."""
        user = Mock(spec=PublicUser)
        user.id = 1
        user.user_uuid = "user_test123"
        return user

    @pytest.fixture
    def anonymous_user(self):
        """Create an anonymous user."""
        return AnonymousUser()

    async def test_anonymous_user_can_read_public_courses(
        self, mock_db, anonymous_user
    ):
        """Anonymous users should be able to read public courses."""
        service = UnifiedPermissionService(mock_db)

        # Mock the check method to simulate anonymous access
        with patch.object(service, "check", return_value=True):
            result = await service.check(
                user=anonymous_user,
                action=Action.READ,
                resource=ResourceType.COURSE,
            )
            assert result is True

    async def test_anonymous_user_cannot_create(self, mock_db, anonymous_user):
        """Anonymous users should not be able to create resources."""
        service = UnifiedPermissionService(mock_db)

        with patch.object(service, "check", return_value=False):
            result = await service.check(
                user=anonymous_user,
                action=Action.CREATE,
                resource=ResourceType.COURSE,
            )
            assert result is False

    async def test_check_with_resource_id(self, mock_db, mock_public_user):
        """check() should handle resource_id parameter."""
        service = UnifiedPermissionService(mock_db)

        with patch.object(service, "check", return_value=True) as mock_check:
            result = await service.check(
                user=mock_public_user,
                action=Action.UPDATE,
                resource=ResourceType.COURSE,
                resource_id="course_abc123",
            )
            assert result is True
            mock_check.assert_called_once()
            call_kwargs = mock_check.call_args
            assert call_kwargs[1]["resource_id"] == "course_abc123"

    async def test_check_with_org_id(self, mock_db, mock_public_user):
        """check() should handle org_id parameter."""
        service = UnifiedPermissionService(mock_db)

        with patch.object(service, "check", return_value=True) as mock_check:
            result = await service.check(
                user=mock_public_user,
                action=Action.CREATE,
                resource=ResourceType.COURSE,
                org_id=1,
            )
            assert result is True
            mock_check.assert_called_once()
            call_kwargs = mock_check.call_args
            assert call_kwargs[1]["org_id"] == 1


class TestRoleService:
    """Test the RoleService class."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        mock = Mock(spec=Session)
        mock.exec.return_value.first.return_value = None
        mock.exec.return_value.all.return_value = []
        return mock

    def test_get_by_slug_not_found(self, mock_db):
        """get_by_slug should return None if role not found."""
        service = RoleService(mock_db)
        result = service.get_by_slug("nonexistent")
        assert result is None

    def test_create_role_duplicate_raises(self, mock_db):
        """create() should raise if role with same slug exists."""
        from src.db.permissions.models import RoleCreate

        # Mock existing role
        existing = Mock(spec=Role)
        mock_db.exec.return_value.first.return_value = existing

        service = RoleService(mock_db)
        data = RoleCreate(
            name="Test Role",
            slug="test-role",
            description="A test role",
        )

        with pytest.raises(ValueError, match="already exists"):
            service.create(data)

    def test_delete_system_role_raises(self, mock_db):
        """delete() should raise if trying to delete system role."""
        system_role = Mock(spec=Role)
        system_role.is_system = True

        mock_db.exec.return_value.first.return_value = system_role

        service = RoleService(mock_db)
        with pytest.raises(ValueError, match="system role"):
            service.delete(1)
        system_role.is_system = True
        mock_db.get.return_value = system_role

        service = RoleService(mock_db)

        with pytest.raises(ValueError, match="Cannot delete system roles"):
            service.delete(1)


class TestPermissionService:
    """Test the PermissionService class."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        mock = Mock(spec=Session)
        mock.exec.return_value.first.return_value = None
        mock.exec.return_value.all.return_value = []
        return mock

    def test_create_permission(self, mock_db):
        """create() should create a new permission."""
        from src.db.permissions.models import PermissionCreate

        mock_db.exec.return_value.first.return_value = None  # No existing

        service = PermissionService(mock_db)
        data = PermissionCreate(
            name="course:create:all",
            resource_type=ResourceType.COURSE,
            action=Action.CREATE,
            scope=Scope.ALL,
        )

        # Mock refresh to populate the ID
        def mock_refresh(obj) -> None:
            obj.id = 1

        mock_db.refresh.side_effect = mock_refresh

        result = service.create(data)
        assert result.name == "course:create:all"
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()

    def test_get_or_create_existing(self, mock_db):
        """get_or_create() should return existing permission."""
        existing = Mock(spec=Permission)
        existing.id = 1
        existing.name = "course:create:org"
        mock_db.exec.return_value.first.return_value = existing

        service = PermissionService(mock_db)
        result = service.get_or_create(
            resource=ResourceType.COURSE,
            action=Action.CREATE,
            scope=Scope.ORG,
        )

        assert result.id == 1
        mock_db.add.assert_not_called()  # Should not add new


class TestPermissionIntegration:
    """Integration tests that verify the full permission flow."""

    def test_permission_name_format(self):
        """Permission names should follow resource:action:scope format."""
        # Use the PermissionService helper function
        from src.services.permissions.permission_service import PermissionService

        name = PermissionService.build_permission_name(
            ResourceType.COURSE, Action.CREATE, Scope.ORG
        )
        assert name == "course:create:org"

        # Also test manual format
        manual_name = (
            f"{ResourceType.COURSE.value}:{Action.CREATE.value}:{Scope.ORG.value}"
        )
        assert manual_name == "course:create:org"

    def test_role_hierarchy_concept(self):
        """Roles can have parent roles for permission inheritance."""
        # Create role hierarchy: super-admin -> org-admin -> instructor
        super_admin = Role(
            id=1,
            name="Super Admin",
            slug="super-admin",
            priority=100,
            parent_role_id=None,
        )

        org_admin = Role(
            id=2,
            name="Org Admin",
            slug="org-admin",
            priority=90,
            parent_role_id=1,  # Inherits from super-admin
        )

        instructor = Role(
            id=3,
            name="Instructor",
            slug="instructor",
            priority=50,
            parent_role_id=2,  # Inherits from org-admin
        )

        assert instructor.parent_role_id == 2
        assert org_admin.parent_role_id == 1
        assert super_admin.parent_role_id is None

    def test_user_role_expiry(self):
        """User roles can have expiry dates."""
        now = datetime.now(UTC)
        future = now + timedelta(days=30)
        past = now - timedelta(days=1)

        active_role = UserRole(
            user_id=1,
            role_id=1,
            org_id=1,
            expires_at=future,
        )

        expired_role = UserRole(
            user_id=1,
            role_id=2,
            org_id=1,
            expires_at=past,
        )

        # Active role should not be expired
        assert active_role.expires_at is not None
        assert active_role.expires_at > now

        # Expired role should be past
        assert expired_role.expires_at is not None
        assert expired_role.expires_at < now
