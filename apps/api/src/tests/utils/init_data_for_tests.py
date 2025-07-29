from pydantic import EmailStr
from sqlmodel import Session, select

from src.db.organizations import OrganizationCreate
from src.db.user_organizations import UserOrganization
from src.db.users import User, UserCreate
from src.services.install.install import (
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
        name="OpenU",
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

    # Make robin a normal user
    statement = select(UserOrganization).join(User).where(User.username == "testo")
    user_org = db_session.exec(statement).first()

    user_org.role_id = 3  # type: ignore
    db_session.add(user_org)
    db_session.commit()

    return True
