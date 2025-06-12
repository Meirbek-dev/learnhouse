import random
import string
from typing import Annotated
from pydantic import EmailStr
from sqlalchemy import create_engine
from sqlmodel import SQLModel, Session
import typer
from config.config import get_openu_config
from src.db.organizations import OrganizationCreate
from src.db.users import UserCreate
from src.services.install.install import (
    install_create_organization,
    install_create_organization_user,
    install_default_elements,
)

cli = typer.Typer()


def generate_password(length):
    characters = string.ascii_uppercase + string.ascii_lowercase + string.digits
    password = "".join(random.choice(characters) for _ in range(length))
    return password


@cli.command()
def install(
    short: Annotated[bool, typer.Option(help="Install with predefined values")] = False,
):
    # Get the database session
    openu_config = get_openu_config()
    engine = create_engine(
        openu_config.database_config.sql_connection_string,
        echo=False,
        pool_pre_ping=True,  # type: ignore
    )
    SQLModel.metadata.create_all(engine)

    db_session = Session(engine)

    # Install the default elements
    print("Installing default elements...")
    install_default_elements(db_session)
    print("Default elements installed ✅")

    if short:
        # Create the Organization
        print("Creating OpenU...")
        org = OrganizationCreate(
            name="OpenU",
            description="OpenU",
            slug="openu",
            email="meirbek.123@gmail.com",
            logo_image="",
            thumbnail_image="",
        )
        install_create_organization(org, db_session)
        print("OpenU created ✅")

        # Create Organization User
        print("Creating OpenU user...")
        # Generate random 8 digit password
        email = "meirbek.dev@gmail.com"
        password = generate_password(8)
        user = UserCreate(username="Meirbek", email=EmailStr(email), password=password)
        install_create_organization_user(user, "openu", db_session)
        print("OpenU user created ✅")

        # Show the user how to login
        print("Installation completed ✅")
        print("")
        print("Login with the following credentials:")
        print("email: " + email)
        print("password: " + password)
        print("⚠️ Remember to change the password after logging in ⚠️")

    else:
        # Create the Organization
        print("Creating your organization...")
        orgname = typer.prompt("What's shall we call your organization?")
        org = OrganizationCreate(
            name=orgname,
            description="OpenU",
            slug="openu",
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
        user = UserCreate(username=username, email=EmailStr(email), password=password)
        install_create_organization_user(user, "openu", db_session)
        print(username + " user created ✅")

        # Show the user how to login
        print("Installation completed ✅\n")
        print("Login with the following credentials:")
        print("email: " + email)
        print("password: The password you entered")


@cli.command()
def main():
    cli()


if __name__ == "__main__":
    cli()
