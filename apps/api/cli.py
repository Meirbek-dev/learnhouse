import asyncio
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
        asyncio.run(install_create_organization_user(user, "openu", db_session))
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
        asyncio.run(install_create_organization_user(user, "openu", db_session))
        print(username + " user created ✅")

        # Show the user how to login
        print("Installation completed ✅\n")
        print("Login with the following credentials:")
        print("email: " + email)
        print("password: The password you entered")


@cli.command()
def seed_rbac_v2(
    dry_run: Annotated[bool, typer.Option(help="Preview changes without applying")] = False,
) -> None:
    """Seed RBAC v2 permissions from shared/permissions.yaml"""
    import yaml
    from pathlib import Path
    from datetime import UTC, datetime

    # Get the database session
    platform_config = get_platform_config()
    engine: Engine = create_engine(
        platform_config.database_config.sql_connection_string,
        echo=False,
        pool_pre_ping=True,
    )

    db_session = Session(engine)

    # Load permissions.yaml
    yaml_path = Path(__file__).parent.parent.parent / "shared" / "permissions.yaml"
    if not yaml_path.exists():
        print(f"❌ Error: {yaml_path} not found")
        raise typer.Exit(code=1)

    with open(yaml_path, "r") as f:
        schema = yaml.safe_load(f)

    print("=" * 60)
    print("RBAC v2 Permission Seeding")
    print("=" * 60)

    if dry_run:
        print("\n⚠️  DRY RUN MODE - No changes will be made\n")

    actions = schema.get("actions", [])
    resources = schema.get("resources", [])
    scopes = schema.get("scopes", [])
    roles = schema.get("roles", {})

    print(f"Loaded: {len(actions)} actions, {len(resources)} resources, {len(scopes)} scopes, {len(roles)} roles")

    # Seed permissions
    from sqlalchemy import text

    perm_count = 0
    for resource in resources:
        for action in actions:
            for scope in scopes:
                perm_name = f"{resource}:{action}:{scope}"

                existing = db_session.execute(
                    text("SELECT id FROM permissions_v2 WHERE name = :name"),
                    {"name": perm_name}
                ).fetchone()

                if existing:
                    continue

                if not dry_run:
                    db_session.execute(
                        text("""
                            INSERT INTO permissions_v2
                            (name, resource_type, action, scope, description, created_at)
                            VALUES
                            (:name, :resource_type, :action, :scope, :description, :created_at)
                        """),
                        {
                            "name": perm_name,
                            "resource_type": resource,
                            "action": action,
                            "scope": scope,
                            "description": f"{action.capitalize()} {resource} in {scope} scope",
                            "created_at": datetime.now(UTC),
                        }
                    )
                perm_count += 1

    if not dry_run:
        db_session.commit()
    print(f"✅ Seeded {perm_count} permissions")

    # Seed roles
    role_count = 0
    for slug, role_config in roles.items():
        existing = db_session.execute(
            text("SELECT id FROM roles_v2 WHERE slug = :slug AND org_id IS NULL"),
            {"slug": slug}
        ).fetchone()

        if existing:
            continue

        if not dry_run:
            db_session.execute(
                text("""
                    INSERT INTO roles_v2
                    (slug, name, description, org_id, is_system, created_at, updated_at)
                    VALUES
                    (:slug, :name, :description, NULL, TRUE, :created_at, :updated_at)
                """),
                {
                    "slug": slug,
                    "name": role_config.get("description", slug.replace("-", " ").title()),
                    "description": role_config.get("description"),
                    "created_at": datetime.now(UTC),
                    "updated_at": datetime.now(UTC),
                }
            )
        role_count += 1

    if not dry_run:
        db_session.commit()
    print(f"✅ Seeded {role_count} roles")

    print("\n✅ RBAC v2 seeding complete!")


@cli.command()
def main() -> None:
    cli()


if __name__ == "__main__":
    cli()
