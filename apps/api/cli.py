import asyncio
from datetime import date
from typing import Annotated

import typer
from sqlalchemy import create_engine
from sqlalchemy.engine.base import Engine
from sqlmodel import Session, SQLModel, select

from config.config import get_settings
from src.db.organizations import Organization, OrganizationCreate
from src.db.users import User, UserCreate
from src.services.analytics.rollups import refresh_teacher_analytics_rollups
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
    settings = get_settings()
    engine: Engine = create_engine(
        settings.database_config.sql_connection_string,
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
        bootstrap_config = settings.bootstrap
        admin_email = bootstrap_config.initial_admin_email
        admin_password = bootstrap_config.initial_admin_password

        if not admin_email:
            print(
                "❌ Error: PLATFORM_INITIAL_ADMIN_EMAIL environment variable is required"
            )
            raise typer.Exit(code=1)

        if not admin_password:
            print(
                "❌ Error: PLATFORM_INITIAL_ADMIN_PASSWORD environment variable is required"
            )
            print(
                "Please set PLATFORM_INITIAL_ADMIN_PASSWORD environment variable before running installation."
            )
            raise typer.Exit(code=1)

        # Create the Organization
        print("Creating Ashyq Bilim...")
        org = OrganizationCreate(
            name="Ashyq Bilim",
            description="Ashyq Bilim",
            about="Ashyq Bilim - Образовательная платформа для онлайн-обучения",
            slug="openu",
            email=settings.contact_email,
            logo_image="",
            thumbnail_image="",
            label="Ashyq Bilim",
        )
        install_create_organization(org, db_session)
        print("Ashyq Bilim created ✅")

        # Create Organization User
        print("Creating Ashyq Bilim user...")
        print(
            f"Using email from PLATFORM_INITIAL_ADMIN_EMAIL environment variable: {admin_email}"
        )
        print(
            "Using password from PLATFORM_INITIAL_ADMIN_PASSWORD environment variable"
        )
        user = UserCreate(
            username="Admin",
            email=str(admin_email),
            password=admin_password,
        )
        asyncio.run(install_create_organization_user(user, "openu", db_session))
        print("Ashyq Bilim user created ✅")

        # Show the user how to login
        print("Installation completed ✅")
        print()
        print("Login with the following credentials:")
        print("email: " + str(admin_email))
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
        asyncio.run(install_create_organization_user(user, "openu", db_session))
        print(username + " user created ✅")

        # Show the user how to login
        print("Installation completed ✅\n")
        print("Login with the following credentials:")
        print("email: " + email)
        print("password: The password you entered")


@cli.command()
def main() -> None:
    cli()


@cli.command()
def refresh_analytics(
    org_id: Annotated[
        int | None, typer.Option(help="Optional organization id to refresh")
    ] = None,
    snapshot_date: Annotated[
        str | None, typer.Option(help="Optional snapshot date in YYYY-MM-DD format")
    ] = None,
) -> None:
    settings = get_settings()
    engine: Engine = create_engine(
        settings.database_config.sql_connection_string,
        echo=False,
        pool_pre_ping=True,
    )
    db_session = Session(engine)
    parsed_snapshot = date.fromisoformat(snapshot_date) if snapshot_date else None
    result = refresh_teacher_analytics_rollups(
        db_session, org_id=org_id, snapshot_date=parsed_snapshot
    )
    print(result)


@cli.command()
def migrate_users_to_default_org() -> None:
    """Migrate all existing users without organization membership to the default 'openu' organization."""
    from src.db.permission_enums import RoleSlug
    from src.db.permissions import Role, UserRole

    # Get the database session
    settings = get_settings()
    engine: Engine = create_engine(
        settings.database_config.sql_connection_string,
        echo=False,
        pool_pre_ping=True,
    )

    db_session = Session(engine)

    print("=" * 80)
    print("Migrating users to default organization")
    print("=" * 80)

    # Get the default organization
    default_org = db_session.exec(
        select(Organization).where(Organization.slug == "openu")
    ).first()

    if not default_org:
        print("❌ Error: Default organization 'openu' not found")
        print(
            "Please create the default organization first using 'python cli.py install'"
        )
        raise typer.Exit(code=1)

    print(f"✅ Found default organization: {default_org.name} (ID: {default_org.id})")

    # Get the default 'user' role
    user_role = db_session.exec(select(Role).where(Role.slug == RoleSlug.USER)).first()

    if not user_role:
        print("❌ Error: Default 'user' role not found")
        print("Please run migrations first")
        raise typer.Exit(code=1)

    print(f"✅ Found default user role: {user_role.name} (ID: {user_role.id})")

    # Get all users
    all_users = db_session.exec(select(User)).all()
    print(f"\n📊 Found {len(all_users)} total users in database")

    # Get users who already have roles in any organization
    users_with_roles = db_session.exec(select(UserRole.user_id).distinct()).all()
    user_ids_with_roles = {user_id for (user_id,) in users_with_roles}
    print(f"📊 {len(user_ids_with_roles)} users already have organization memberships")

    # Filter to users without any organization membership
    users_without_org = [u for u in all_users if u.id not in user_ids_with_roles]
    print(
        f"📊 {len(users_without_org)} users need to be migrated to default organization\n"
    )

    if not users_without_org:
        print("✅ All users already have organization memberships. Nothing to do!")
        return

    # Add users to default organization
    migrated_count = 0
    skipped_count = 0

    for user in users_without_org:
        try:
            # Create UserRole record
            new_user_role = UserRole(
                user_id=user.id,
                role_id=user_role.id,
                org_id=default_org.id,
            )
            db_session.add(new_user_role)
            migrated_count += 1
            print(
                f"  ✅ Added user {user.username} (ID: {user.id}) to {default_org.name}"
            )
        except Exception as e:
            skipped_count += 1
            print(f"  ⚠️  Skipping user {user.username} (ID: {user.id}): {e!s}")

    # Commit changes
    db_session.commit()

    print("\n" + "=" * 80)
    print("Migration complete!")
    print("=" * 80)
    print(f"✅ Successfully migrated: {migrated_count} users")
    if skipped_count > 0:
        print(f"⚠️  Skipped: {skipped_count} users")
    print()


if __name__ == "__main__":
    cli()
