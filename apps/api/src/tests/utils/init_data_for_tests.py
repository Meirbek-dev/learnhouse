from sqlmodel import Session, select

from src.db.organizations import OrganizationCreate
from src.db.users import User, UserCreate
from src.services.permissions import get_permission_service
from src.services.setup.setup import (
    install_create_organization,
    install_create_organization_user,
    install_default_elements,
)


# TODO: Depreceated and need to be removed and remade
async def create_initial_data_for_tests(db_session: Session) -> bool:
    # Install default elements
    install_default_elements(db_session)

    # Initiate test Organization
    test_org = OrganizationCreate(
        name="Ashyq Bilim",
        description=None,
        about=None,
        slug="openu",
        email="meirbek.b2k@gmail.com",
        logo_image=None,
        thumbnail_image=None,
        label=None,
    )

    # Create test organization
    install_create_organization(test_org, db_session)

    users = [
        UserCreate(
            username="studento",
            first_name="Студент",
            last_name="Студентов",
            email="student@test.com",
            password="imstudent",
        ),
        UserCreate(
            username="testo",
            first_name="Тест Тестович",
            last_name="Тестов",
            email="test@test.com",
            password="test1234",
        ),
    ]

    # Create 2 users in that Organization
    for user in users:
        install_create_organization_user(user, "openu", db_session)

    # Make testo a normal user (role_id 3)
    statement = select(User).where(User.username == "testo")
    test_user = db_session.exec(statement).first()

    if test_user and test_user.id:
        # Get org ID
        from src.db.organizations import Organization
        org_statement = select(Organization).where(Organization.slug == "openu")
        org = db_session.exec(org_statement).first()

        if org and org.id:
            # Remove current role and assign new one
            permission_service = get_permission_service(db_session)
            # Remove admin role (role_id 1)
            permission_service.remove_role(
                user_id=test_user.id, role_id=1, org_id=org.id
            )
            # Assign normal user role (role_id 3)
            permission_service.assign_role(
                user_id=test_user.id, role_id=3, org_id=org.id
            )

    return True
