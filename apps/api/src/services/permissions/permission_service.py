"""
Permission service for managing permission definitions.

This service handles CRUD operations for permissions and provides
utilities for building permission names from components.
"""

from sqlmodel import Session, select

from src.db.permissions.enums import Action, ResourceType, Scope
from src.db.permissions.models import Permission, PermissionCreate, PermissionRead


class PermissionService:
    """Service for managing permission definitions."""

    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def build_permission_name(
        resource: ResourceType,
        action: Action,
        scope: Scope = Scope.ALL,
    ) -> str:
        """
        Build a permission name string from components.

        Format: resource:action:scope
        Example: course:create:org
        """
        return f"{resource.value}:{action.value}:{scope.value}"

    @staticmethod
    def parse_permission_name(name: str) -> tuple[ResourceType, Action, Scope]:
        """
        Parse a permission name string into components.

        Args:
            name: Permission name like "course:create:org"

        Returns:
            Tuple of (ResourceType, Action, Scope)

        Raises:
            ValueError: If the permission name is invalid
        """
        parts = name.split(":")
        if len(parts) != 3:
            raise ValueError(f"Invalid permission name format: {name}")

        return (
            ResourceType(parts[0]),
            Action(parts[1]),
            Scope(parts[2]),
        )

    def get_by_id(self, permission_id: int) -> Permission | None:
        """Get a permission by ID."""
        return self.db.get(Permission, permission_id)

    def get_by_name(self, name: str) -> Permission | None:
        """Get a permission by its unique name."""
        statement = select(Permission).where(Permission.name == name)
        return self.db.exec(statement).first()

    def get_or_create(
        self,
        resource: ResourceType,
        action: Action,
        scope: Scope = Scope.ALL,
        description: str | None = None,
    ) -> Permission:
        """
        Get an existing permission or create a new one.

        Args:
            resource: Resource type
            action: Action type
            scope: Permission scope
            description: Optional description

        Returns:
            The existing or newly created Permission
        """
        name = self.build_permission_name(resource, action, scope)
        existing = self.get_by_name(name)

        if existing:
            return existing

        permission = Permission(
            name=name,
            resource_type=resource,
            action=action,
            scope=scope,
            description=description,
        )
        self.db.add(permission)
        self.db.commit()
        self.db.refresh(permission)
        return permission

    def list_all(self, resource_type: ResourceType | None = None) -> list[PermissionRead]:
        """
        List all permissions, optionally filtered by resource type.

        Args:
            resource_type: Optional filter by resource type

        Returns:
            List of permissions
        """
        statement = select(Permission)
        if resource_type:
            statement = statement.where(Permission.resource_type == resource_type)
        statement = statement.order_by(Permission.resource_type, Permission.action)

        results = self.db.exec(statement).all()
        return [PermissionRead.model_validate(p) for p in results]

    def create(self, data: PermissionCreate) -> Permission:
        """
        Create a new permission.

        Args:
            data: Permission creation data

        Returns:
            The created Permission

        Raises:
            ValueError: If a permission with this name already exists
        """
        name = self.build_permission_name(data.resource_type, data.action, data.scope)

        if self.get_by_name(name):
            raise ValueError(f"Permission '{name}' already exists")

        permission = Permission(
            name=name,
            resource_type=data.resource_type,
            action=data.action,
            scope=data.scope,
            description=data.description,
        )
        self.db.add(permission)
        self.db.commit()
        self.db.refresh(permission)
        return permission

    def delete(self, permission_id: int) -> bool:
        """
        Delete a permission by ID.

        Args:
            permission_id: ID of the permission to delete

        Returns:
            True if deleted, False if not found
        """
        permission = self.get_by_id(permission_id)
        if not permission:
            return False

        self.db.delete(permission)
        self.db.commit()
        return True

    def seed_default_permissions(self) -> list[Permission]:
        """
        Seed the database with default permissions.

        Returns:
            List of created/existing permissions
        """
        default_permissions = [
            # Organization permissions
            (ResourceType.ORGANIZATION, Action.READ, Scope.OWN, "Read own organization"),
            (ResourceType.ORGANIZATION, Action.UPDATE, Scope.OWN, "Update own organization"),
            (ResourceType.ORGANIZATION, Action.MANAGE, Scope.OWN, "Manage own organization settings"),
            (ResourceType.ORGANIZATION, Action.DELETE, Scope.OWN, "Delete own organization"),
            # Course permissions
            (ResourceType.COURSE, Action.CREATE, Scope.ORG, "Create courses in organization"),
            (ResourceType.COURSE, Action.READ, Scope.ALL, "Read all public courses"),
            (ResourceType.COURSE, Action.READ, Scope.OWN, "Read own courses"),
            (ResourceType.COURSE, Action.UPDATE, Scope.OWN, "Update own courses"),
            (ResourceType.COURSE, Action.DELETE, Scope.OWN, "Delete own courses"),
            (ResourceType.COURSE, Action.MANAGE, Scope.OWN, "Manage own course settings"),
            (ResourceType.COURSE, Action.MANAGE, Scope.ALL, "Manage all courses"),
            # Chapter permissions
            (ResourceType.CHAPTER, Action.CREATE, Scope.OWN, "Create chapters in own courses"),
            (ResourceType.CHAPTER, Action.READ, Scope.ALL, "Read chapters"),
            (ResourceType.CHAPTER, Action.UPDATE, Scope.OWN, "Update own chapters"),
            (ResourceType.CHAPTER, Action.DELETE, Scope.OWN, "Delete own chapters"),
            # Activity permissions
            (ResourceType.ACTIVITY, Action.CREATE, Scope.OWN, "Create activities in own courses"),
            (ResourceType.ACTIVITY, Action.READ, Scope.ALL, "Read activities"),
            (ResourceType.ACTIVITY, Action.UPDATE, Scope.OWN, "Update own activities"),
            (ResourceType.ACTIVITY, Action.DELETE, Scope.OWN, "Delete own activities"),
            # User permissions
            (ResourceType.USER, Action.READ, Scope.ORG, "Read users in organization"),
            (ResourceType.USER, Action.READ, Scope.ALL, "Read all users"),
            (ResourceType.USER, Action.UPDATE, Scope.OWN, "Update own profile"),
            (ResourceType.USER, Action.UPDATE, Scope.ORG, "Update users in organization"),
            (ResourceType.USER, Action.DELETE, Scope.ORG, "Delete users in organization"),
            (ResourceType.USER, Action.INVITE, Scope.ORG, "Invite users to organization"),
            # Usergroup permissions
            (ResourceType.USERGROUP, Action.CREATE, Scope.ORG, "Create usergroups in organization"),
            (ResourceType.USERGROUP, Action.READ, Scope.ORG, "Read usergroups in organization"),
            (ResourceType.USERGROUP, Action.UPDATE, Scope.ORG, "Update usergroups in organization"),
            (ResourceType.USERGROUP, Action.DELETE, Scope.ORG, "Delete usergroups in organization"),
            # Collection permissions
            (ResourceType.COLLECTION, Action.CREATE, Scope.ORG, "Create collections in organization"),
            (ResourceType.COLLECTION, Action.READ, Scope.ALL, "Read public collections"),
            (ResourceType.COLLECTION, Action.UPDATE, Scope.OWN, "Update own collections"),
            (ResourceType.COLLECTION, Action.DELETE, Scope.OWN, "Delete own collections"),
            # Role permissions
            (ResourceType.ROLE, Action.CREATE, Scope.ORG, "Create roles in organization"),
            (ResourceType.ROLE, Action.READ, Scope.ORG, "Read roles in organization"),
            (ResourceType.ROLE, Action.UPDATE, Scope.ORG, "Update roles in organization"),
            (ResourceType.ROLE, Action.DELETE, Scope.ORG, "Delete roles in organization"),
            # Certificate permissions
            (ResourceType.CERTIFICATE, Action.CREATE, Scope.OWN, "Create certificates for own courses"),
            (ResourceType.CERTIFICATE, Action.READ, Scope.ALL, "Read certificates"),
            # Analytics permissions
            (ResourceType.ANALYTICS, Action.READ, Scope.OWN, "Read own analytics"),
            (ResourceType.ANALYTICS, Action.READ, Scope.ORG, "Read organization analytics"),
            # Assignment/Quiz permissions
            (ResourceType.ASSIGNMENT, Action.GRADE, Scope.OWN, "Grade assignments in own courses"),
            (ResourceType.ASSIGNMENT, Action.SUBMIT, Scope.ALL, "Submit assignments"),
            (ResourceType.QUIZ, Action.GRADE, Scope.OWN, "Grade quizzes in own courses"),
            (ResourceType.QUIZ, Action.SUBMIT, Scope.ALL, "Submit quizzes"),
            # Exam permissions
            (ResourceType.EXAM, Action.CREATE, Scope.ORG, "Create exams in organization"),
            (ResourceType.EXAM, Action.READ, Scope.OWN, "Read own exams"),
            (ResourceType.EXAM, Action.UPDATE, Scope.OWN, "Update own exams"),
            (ResourceType.EXAM, Action.DELETE, Scope.OWN, "Delete own exams"),
            # File permissions
            (ResourceType.FILE, Action.CREATE, Scope.ORG, "Upload files to organization"),
            (ResourceType.FILE, Action.READ, Scope.ORG, "Read files in organization"),
            (ResourceType.FILE, Action.DELETE, Scope.OWN, "Delete own files"),
            # API Token permissions
            (ResourceType.API_TOKEN, Action.CREATE, Scope.ORG, "Create API tokens"),
            (ResourceType.API_TOKEN, Action.READ, Scope.ORG, "Read API tokens"),
            (ResourceType.API_TOKEN, Action.DELETE, Scope.ORG, "Delete API tokens"),
        ]

        permissions = []
        for resource, action, scope, description in default_permissions:
            permission = self.get_or_create(resource, action, scope, description)
            permissions.append(permission)

        return permissions
