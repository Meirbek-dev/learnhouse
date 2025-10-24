from typing import Annotated

import typer
from sqlalchemy import create_engine
from sqlmodel import Session, SQLModel

from config.config import get_platform_config
from src.db.organizations import OrganizationCreate
from src.db.users import UserCreate
from src.security.security import generate_secure_password
from src.services.install.install import (
    install_create_organization,
    install_create_organization_user,
    install_default_elements,
)

cli = typer.Typer()


@cli.command()
def install(
    short: Annotated[bool, typer.Option(help="Install with predefined values")] = False,
) -> None:
    # Get the database session
    platform_config = get_platform_config()
    engine = create_engine(
        platform_config.database_config.sql_connection_string,
        echo=False,
        pool_pre_ping=True,
    )
    SQLModel.metadata.create_all(engine)

    db_session = Session(engine)

    # Install the default elements
    print("Installing default elements...")
    install_default_elements(db_session)
    print("Default elements installed ✅")

    if short:
        # Create the Organization
        print("Creating Ashyq Bilim...")
        org = OrganizationCreate(
            name="OpenU",
            description="Ashyq Bilim",
            about="Ashyq Bilim - Образовательная платформа для онлайн-обучения",
            slug="openu",
            email="meirbek.dev@gmail.com",
            logo_image="",
            thumbnail_image="",
            label="OpenU",
        )
        install_create_organization(org, db_session)
        print("OpenU created ✅")

        # Create Organization User
        print("Creating Ashyq Bilim user...")
        # Generate random 8 digit password
        email = "meirbek.dev@gmail.com"
        password = generate_secure_password(8)
        user = UserCreate(username="Meirbek", email=email, password=password)
        install_create_organization_user(user, "openu", db_session)
        print("Ashyq Bilim user created ✅")

        # Show the user how to login
        print("Installation completed ✅")
        print()
        print("Login with the following credentials:")
        print("email: " + email)
        print("password: " + password)
        print("⚠️ Remember to change the password after logging in ⚠️")

    else:
        # Create the Organization
        print("Creating your organization...")
        orgname = typer.prompt("What's shall we call your organization?")
        slug = typer.prompt(
            "What's the slug for your organization? (e.g. school, acme)"
        )
        org = OrganizationCreate(
            name=orgname,
            description="Ashyq Bilim",
            slug=slug,
            email="",
            logo_image="",
            thumbnail_image="",
        )
        install_create_organization(org, db_session)
        print(orgname + " Organization created ✅")

        # Create Organization User
        print("Creating your organization user...")
        username = typer.prompt("What's the username for the user?")
        email = typer.prompt("What's the email for the user?")
        password = typer.prompt("What's the password for the user?", hide_input=True)
        user = UserCreate(username=username, email=email, password=password)
        install_create_organization_user(user, "openu", db_session)
        print(username + " user created ✅")

        # Show the user how to login
        print("Installation completed ✅\n")
        print("Login with the following credentials:")
        print("email: " + email)
        print("password: The password you entered")


@cli.command()
def main() -> None:
    cli()


if __name__ == "__main__":
    cli()
