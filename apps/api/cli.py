import os
from typing import Annotated

import typer
from sqlalchemy import create_engine
from sqlalchemy.engine.base import Engine
from sqlmodel import Session, SQLModel

from config.config import get_platform_config
from src.db.organizations import OrganizationCreate
from src.db.users import UserCreate
from src.services.setup.setup import (
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
    engine: Engine = create_engine(
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
            name="Ashyq Bilim",
            description="Ashyq Bilim",
            about="Ashyq Bilim - Образовательная платформа для онлайн-обучения",
            slug="openu",
            email="meirbek.dev@gmail.com",
            logo_image="",
            thumbnail_image="",
            label="Ashyq Bilim",
        )
        install_create_organization(org, db_session)
        print("Ashyq Bilim created ✅")

        # Create Organization User
        print("Creating Ashyq Bilim user...")
        # Use email from environment variable if provided, otherwise default to "meirbek.dev@gmail.com"
        email: str = os.environ.get(
            "PLATFORM_INITIAL_ADMIN_EMAIL", "meirbek.dev@gmail.com"
        )
        # Require password from environment variable
        password: str | None = os.environ.get("PLATFORM_INITIAL_ADMIN_PASSWORD")
        if not password:
            print(
                "❌ Error: PLATFORM_INITIAL_ADMIN_PASSWORD environment variable is required"
            )
            print(
                "Please set PLATFORM_INITIAL_ADMIN_PASSWORD environment variable before running installation."
            )
            raise typer.Exit(code=1)
        print(
            "Using password from PLATFORM_INITIAL_ADMIN_PASSWORD environment variable"
        )
        if email != "meirbek.dev@gmail.com":
            print(
                f"Using email from PLATFORM_INITIAL_ADMIN_EMAIL environment variable: {email}"
            )
        user = UserCreate(username="Meirbek", email=email, password=password)
        install_create_organization_user(user, "openu", db_session)
        print("Ashyq Bilim user created ✅")

        # Show the user how to login
        print("Installation completed ✅")
        print()
        print("Login with the following credentials:")
        print("email: " + email)
        print("password: (the password you set in PLATFORM_INITIAL_ADMIN_PASSWORD)")
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
