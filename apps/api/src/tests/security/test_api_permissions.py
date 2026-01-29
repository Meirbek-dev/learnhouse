"""
Integration tests for API permission checks on critical endpoints.

Tests that permission checks are properly enforced across all secured endpoints.
"""

import pytest
from httpx import AsyncClient
from sqlmodel import Session

from src.db.users import PublicUser
from src.db.organizations import Organization
from src.db.courses.courses import Course
from src.db.permissions.models import Role, Permission
from src.db.permissions.enums import Action, ResourceType, Scope


@pytest.fixture
async def org_with_users(db_session: Session):
    """Create an organization with multiple users having different roles."""
    # Create organization
    org = Organization(
        name="Test Org",
        slug="test-org",
        email="admin@test.org",
        org_uuid="org_test_123",
    )
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)

    # Create roles
    student_role = Role(
        name="Student",
        slug="student",
        org_id=org.id,
        is_system=True,
    )
    instructor_role = Role(
        name="Instructor",
        slug="instructor",
        org_id=org.id,
        is_system=True,
        parent_role_id=student_role.id,
    )
    admin_role = Role(
        name="Org Admin",
        slug="org-admin",
        org_id=org.id,
        is_system=True,
        parent_role_id=instructor_role.id,
    )

    db_session.add_all([student_role, instructor_role, admin_role])
    db_session.commit()

    # Create users
    student = PublicUser(
        email="student@test.org",
        username="student",
        user_uuid="user_student_123",
        first_name="Test",
        last_name="Student",
    )
    instructor = PublicUser(
        email="instructor@test.org",
        username="instructor",
        user_uuid="user_instructor_123",
        first_name="Test",
        last_name="Instructor",
    )
    admin = PublicUser(
        email="admin@test.org",
        username="admin",
        user_uuid="user_admin_123",
        first_name="Test",
        last_name="Admin",
    )

    db_session.add_all([student, instructor, admin])
    db_session.commit()

    return {
        "org": org,
        "roles": {
            "student": student_role,
            "instructor": instructor_role,
            "admin": admin_role,
        },
        "users": {
            "student": student,
            "instructor": instructor,
            "admin": admin,
        },
    }


class TestCourseEndpointPermissions:
    """Test permission checks on course endpoints."""

    @pytest.mark.asyncio
    async def test_create_course_requires_permission(
        self, client: AsyncClient, org_with_users
    ):
        """Test that creating a course requires course:create:org permission."""
        student = org_with_users["users"]["student"]
        org = org_with_users["org"]

        # Student without permission should be denied
        response = await client.post(
            "/api/v1/courses",
            json={
                "name": "Test Course",
                "org_id": org.id,
            },
            headers={"Authorization": f"Bearer {student.user_uuid}"},
        )

        assert response.status_code == 403
        assert "permission" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_instructor_can_create_course(
        self, client: AsyncClient, org_with_users, db_session: Session
    ):
        """Test that instructor with permission can create course."""
        instructor = org_with_users["users"]["instructor"]
        instructor_role = org_with_users["roles"]["instructor"]
        org = org_with_users["org"]

        # Grant permission
        permission = Permission(
            name="course:create:org",
            action=Action.CREATE,
            resource_type=ResourceType.COURSE,
            scope=Scope.ORG,
        )
        db_session.add(permission)
        instructor_role.permissions.append(permission)
        db_session.commit()

        # Instructor should be allowed
        response = await client.post(
            "/api/v1/courses",
            json={
                "name": "Test Course",
                "org_id": org.id,
            },
            headers={"Authorization": f"Bearer {instructor.user_uuid}"},
        )

        assert response.status_code in [200, 201]

    @pytest.mark.asyncio
    async def test_update_course_checks_ownership(
        self, client: AsyncClient, org_with_users, db_session: Session
    ):
        """Test that updating course checks resource ownership."""
        instructor1 = org_with_users["users"]["instructor"]
        instructor2 = PublicUser(
            email="instructor2@test.org",
            username="instructor2",
            user_uuid="user_instructor2_123",
        )
        db_session.add(instructor2)
        db_session.commit()

        # Create course owned by instructor1
        course = Course(
            name="Test Course",
            org_id=org_with_users["org"].id,
            course_uuid="course_123",
        )
        course.authors = [instructor1]
        db_session.add(course)
        db_session.commit()

        # Instructor2 should not be able to update instructor1's course
        response = await client.put(
            f"/api/v1/courses/{course.course_uuid}",
            json={"name": "Updated Course"},
            headers={"Authorization": f"Bearer {instructor2.user_uuid}"},
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_course_requires_permission(
        self, client: AsyncClient, org_with_users, db_session: Session
    ):
        """Test that deleting course requires course:delete permission."""
        student = org_with_users["users"]["student"]

        course = Course(
            name="Test Course",
            org_id=org_with_users["org"].id,
            course_uuid="course_delete_123",
        )
        db_session.add(course)
        db_session.commit()

        # Student should not be able to delete
        response = await client.delete(
            f"/api/v1/courses/{course.course_uuid}",
            headers={"Authorization": f"Bearer {student.user_uuid}"},
        )

        assert response.status_code == 403


class TestUserEndpointPermissions:
    """Test permission checks on user management endpoints."""

    @pytest.mark.asyncio
    async def test_create_user_requires_admin(
        self, client: AsyncClient, org_with_users
    ):
        """Test that creating users requires admin permission."""
        student = org_with_users["users"]["student"]
        org = org_with_users["org"]

        response = await client.post(
            f"/api/v1/users/{org.id}",
            json={
                "email": "newuser@test.org",
                "username": "newuser",
                "password": "password123",
            },
            headers={"Authorization": f"Bearer {student.user_uuid}"},
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_update_own_profile_allowed(
        self, client: AsyncClient, org_with_users
    ):
        """Test that users can update their own profile."""
        student = org_with_users["users"]["student"]

        response = await client.put(
            f"/api/v1/users/{student.id}",
            json={"first_name": "Updated"},
            headers={"Authorization": f"Bearer {student.user_uuid}"},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_update_other_user_requires_permission(
        self, client: AsyncClient, org_with_users
    ):
        """Test that updating other users requires user:update:org permission."""
        student = org_with_users["users"]["student"]
        instructor = org_with_users["users"]["instructor"]

        # Student trying to update instructor
        response = await client.put(
            f"/api/v1/users/{instructor.id}",
            json={"first_name": "Hacked"},
            headers={"Authorization": f"Bearer {student.user_uuid}"},
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_user_requires_org_permission(
        self, client: AsyncClient, org_with_users
    ):
        """Test that deleting users requires user:delete:org permission."""
        instructor = org_with_users["users"]["instructor"]
        student = org_with_users["users"]["student"]

        response = await client.delete(
            f"/api/v1/users/user_id/{student.id}",
            headers={"Authorization": f"Bearer {instructor.user_uuid}"},
        )

        assert response.status_code == 403


class TestPaymentEndpointPermissions:
    """Test permission checks on payment configuration endpoints."""

    @pytest.mark.asyncio
    async def test_payment_config_requires_admin(
        self, client: AsyncClient, org_with_users
    ):
        """Test that payment configuration requires organization:manage:own."""
        instructor = org_with_users["users"]["instructor"]
        org = org_with_users["org"]

        # Instructor should not be able to configure payments
        response = await client.post(
            f"/api/v1/payments/{org.id}/config",
            json={
                "provider": "stripe",
                "api_key": "sk_test_123",
            },
            headers={"Authorization": f"Bearer {instructor.user_uuid}"},
        )

        assert response.status_code == 403
        assert "permission" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_admin_can_configure_payments(
        self, client: AsyncClient, org_with_users, db_session: Session
    ):
        """Test that org admin can configure payments."""
        admin = org_with_users["users"]["admin"]
        admin_role = org_with_users["roles"]["admin"]
        org = org_with_users["org"]

        # Grant permission
        permission = Permission(
            name="organization:manage:own",
            action=Action.MANAGE,
            resource_type=ResourceType.ORGANIZATION,
            scope=Scope.OWN,
        )
        db_session.add(permission)
        admin_role.permissions.append(permission)
        db_session.commit()

        response = await client.post(
            f"/api/v1/payments/{org.id}/config",
            json={
                "provider": "stripe",
                "api_key": "sk_test_123",
            },
            headers={"Authorization": f"Bearer {admin.user_uuid}"},
        )

        assert response.status_code in [200, 201]


class TestUsergroupEndpointPermissions:
    """Test permission checks on usergroup endpoints."""

    @pytest.mark.asyncio
    async def test_create_usergroup_requires_permission(
        self, client: AsyncClient, org_with_users
    ):
        """Test that creating usergroups requires usergroup:create:org."""
        student = org_with_users["users"]["student"]
        org = org_with_users["org"]

        response = await client.post(
            "/api/v1/usergroups",
            json={
                "name": "Test Group",
                "org_id": org.id,
            },
            headers={"Authorization": f"Bearer {student.user_uuid}"},
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_usergroup_requires_permission(
        self, client: AsyncClient, org_with_users, db_session: Session
    ):
        """Test that deleting usergroups requires usergroup:delete:org."""
        from src.db.usergroups import Usergroup

        instructor = org_with_users["users"]["instructor"]
        org = org_with_users["org"]

        usergroup = Usergroup(
            name="Test Group",
            org_id=org.id,
            usergroup_uuid="ug_123",
        )
        db_session.add(usergroup)
        db_session.commit()

        response = await client.delete(
            f"/api/v1/usergroups/{usergroup.id}",
            headers={"Authorization": f"Bearer {instructor.user_uuid}"},
        )

        assert response.status_code == 403


class TestAssignmentGradingPermissions:
    """Test permission checks on assignment grading endpoints."""

    @pytest.mark.asyncio
    async def test_grading_requires_instructor_permission(
        self, client: AsyncClient, org_with_users, db_session: Session
    ):
        """Test that grading requires submission:grade:assigned permission."""
        from src.db.courses.assignments import Assignment
        from src.db.submissions import Submission

        student = org_with_users["users"]["student"]
        instructor = org_with_users["users"]["instructor"]
        org = org_with_users["org"]

        # Create course and assignment
        course = Course(
            name="Test Course",
            org_id=org.id,
            course_uuid="course_grade_123",
        )
        db_session.add(course)
        db_session.commit()

        assignment = Assignment(
            name="Test Assignment",
            course_id=course.id,
            assignment_uuid="assign_123",
        )
        db_session.add(assignment)
        db_session.commit()

        # Student submits assignment
        submission = Submission(
            assignment_id=assignment.id,
            user_id=student.id,
            submission_uuid="sub_123",
        )
        db_session.add(submission)
        db_session.commit()

        # Student should not be able to grade their own submission
        response = await client.post(
            f"/api/v1/assignments/{assignment.assignment_uuid}/submissions/{student.id}/grade",
            json={
                "grade": 95,
                "feedback": "Great work!",
            },
            headers={"Authorization": f"Bearer {student.user_uuid}"},
        )

        assert response.status_code == 403


class TestOrganizationEndpointPermissions:
    """Test permission checks on organization management endpoints."""

    @pytest.mark.asyncio
    async def test_update_org_settings_requires_permission(
        self, client: AsyncClient, org_with_users
    ):
        """Test that updating org settings requires organization:update:own."""
        instructor = org_with_users["users"]["instructor"]
        org = org_with_users["org"]

        response = await client.put(
            f"/api/v1/orgs/{org.id}/signup_mechanism",
            json={"signup_mechanism": "invite_only"},
            headers={"Authorization": f"Bearer {instructor.user_uuid}"},
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_invite_user_requires_permission(
        self, client: AsyncClient, org_with_users
    ):
        """Test that inviting users requires user:invite:org permission."""
        student = org_with_users["users"]["student"]
        org = org_with_users["org"]

        response = await client.post(
            f"/api/v1/orgs/{org.id}/invites",
            json={
                "email": "newuser@test.org",
                "role_id": org_with_users["roles"]["student"].id,
            },
            headers={"Authorization": f"Bearer {student.user_uuid}"},
        )

        assert response.status_code == 403
