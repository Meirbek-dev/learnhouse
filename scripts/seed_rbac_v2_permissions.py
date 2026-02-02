"""
Seed RBAC v2 Permissions - Populate from permissions.yaml

This script reads shared/permissions.yaml and seeds the RBAC v2 tables.

Usage:
    python seed_rbac_v2_permissions.py
"""

import yaml
from pathlib import Path
from datetime import UTC, datetime

from sqlalchemy import create_engine, text
from sqlmodel import Session

from config.config import get_platform_config


def load_permissions_yaml() -> dict:
    """Load permissions from YAML file."""
    yaml_path = Path(__file__).parent.parent / "shared" / "permissions.yaml"

    if not yaml_path.exists():
        raise FileNotFoundError(f"permissions.yaml not found at {yaml_path}")

    with open(yaml_path, "r") as f:
        return yaml.safe_load(f)


def seed_permissions(session: Session, schema: dict) -> int:
    """Seed permissions table."""
    print("\nSeeding permissions...")

    actions = schema.get("actions", [])
    resources = schema.get("resources", [])
    scopes = schema.get("scopes", [])

    count = 0

    # Generate all permission combinations
    for resource in resources:
        for action in actions:
            for scope in scopes:
                # Build permission name
                perm_name = f"{resource}:{action}:{scope}"

                # Check if already exists
                existing = session.execute(
                    text("SELECT id FROM permissions_v2 WHERE name = :name"),
                    {"name": perm_name}
                ).fetchone()

                if existing:
                    continue

                # Insert permission
                session.execute(
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
                count += 1

    session.commit()
    print(f"   ✅ Seeded {count} permissions")
    return count


def seed_roles(session: Session, schema: dict) -> int:
    """Seed roles table."""
    print("\nSeeding roles...")

    roles = schema.get("roles", {})
    count = 0

    for slug, role_config in roles.items():
        # Check if already exists
        existing = session.execute(
            text("SELECT id FROM roles_v2 WHERE slug = :slug AND org_id IS NULL"),
            {"slug": slug}
        ).fetchone()

        if existing:
            continue

        # Insert role
        session.execute(
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
        count += 1

    session.commit()
    print(f"   ✅ Seeded {count} roles")
    return count


def seed_role_permissions(session: Session, schema: dict) -> int:
    """Seed role-permission assignments."""
    print("\nSeeding role-permission assignments...")

    roles = schema.get("roles", {})
    count = 0

    for slug, role_config in roles.items():
        # Get role ID
        role = session.execute(
            text("SELECT id FROM roles_v2 WHERE slug = :slug"),
            {"slug": slug}
        ).fetchone()

        if not role:
            print(f"   ⚠️  Role not found: {slug}")
            continue

        permissions = role_config.get("permissions", [])

        for perm_pattern in permissions:
            if perm_pattern == "*:*:*":
                # Grant all permissions
                all_perms = session.execute(
                    text("SELECT id FROM permissions_v2")
                ).fetchall()

                for perm in all_perms:
                    # Check if already assigned
                    existing = session.execute(
                        text("""
                            SELECT 1 FROM role_permissions_v2
                            WHERE role_id = :role_id AND permission_id = :perm_id
                        """),
                        {"role_id": role.id, "perm_id": perm.id}
                    ).fetchone()

                    if not existing:
                        session.execute(
                            text("""
                                INSERT INTO role_permissions_v2
                                (role_id, permission_id, granted_at)
                                VALUES
                                (:role_id, :perm_id, :granted_at)
                            """),
                            {
                                "role_id": role.id,
                                "perm_id": perm.id,
                                "granted_at": datetime.now(UTC),
                            }
                        )
                        count += 1

            elif "*" in perm_pattern:
                # Handle wildcard patterns like "course:*:org"
                parts = perm_pattern.split(":")
                resource = parts[0] if parts[0] != "*" else "%"
                action = parts[1] if len(parts) > 1 and parts[1] != "*" else "%"
                scope = parts[2] if len(parts) > 2 and parts[2] != "*" else "%"

                # Find matching permissions
                matching_perms = session.execute(
                    text("""
                        SELECT id FROM permissions_v2
                        WHERE resource_type LIKE :resource
                        AND action LIKE :action
                        AND scope LIKE :scope
                    """),
                    {"resource": resource, "action": action, "scope": scope}
                ).fetchall()

                for perm in matching_perms:
                    # Check if already assigned
                    existing = session.execute(
                        text("""
                            SELECT 1 FROM role_permissions_v2
                            WHERE role_id = :role_id AND permission_id = :perm_id
                        """),
                        {"role_id": role.id, "perm_id": perm.id}
                    ).fetchone()

                    if not existing:
                        session.execute(
                            text("""
                                INSERT INTO role_permissions_v2
                                (role_id, permission_id, granted_at)
                                VALUES
                                (:role_id, :perm_id, :granted_at)
                            """),
                            {
                                "role_id": role.id,
                                "perm_id": perm.id,
                                "granted_at": datetime.now(UTC),
                            }
                        )
                        count += 1
            else:
                # Exact permission name
                perm = session.execute(
                    text("SELECT id FROM permissions_v2 WHERE name = :name"),
                    {"name": perm_pattern}
                ).fetchone()

                if not perm:
                    print(f"   ⚠️  Permission not found: {perm_pattern}")
                    continue

                # Check if already assigned
                existing = session.execute(
                    text("""
                        SELECT 1 FROM role_permissions_v2
                        WHERE role_id = :role_id AND permission_id = :perm_id
                    """),
                    {"role_id": role.id, "perm_id": perm.id}
                ).fetchone()

                if not existing:
                    session.execute(
                        text("""
                            INSERT INTO role_permissions_v2
                            (role_id, permission_id, granted_at)
                            VALUES
                            (:role_id, :perm_id, :granted_at)
                        """),
                        {
                            "role_id": role.id,
                            "perm_id": perm.id,
                            "granted_at": datetime.now(UTC),
                        }
                    )
                    count += 1

    session.commit()
    print(f"   ✅ Seeded {count} role-permission assignments")
    return count


def main():
    """Main seeding function."""
    print("=" * 80)
    print("RBAC v2 Permission Seeding")
    print("=" * 80)

    # Load schema
    schema = load_permissions_yaml()
    print("\nLoaded schema with:")
    print(f"  - {len(schema.get('actions', []))} actions")
    print(f"  - {len(schema.get('resources', []))} resources")
    print(f"  - {len(schema.get('scopes', []))} scopes")
    print(f"  - {len(schema.get('roles', {}))} roles")

    # Get database connection
    config = get_platform_config()
    engine = create_engine(config.database_config.sql_connection_string)

    with Session(engine) as session:
        # Seed data
        perm_count = seed_permissions(session, schema)
        role_count = seed_roles(session, schema)
        role_perm_count = seed_role_permissions(session, schema)

        # Summary
        print("\n" + "=" * 80)
        print("Seeding Summary")
        print("=" * 80)
        print(f"   Permissions: {perm_count}")
        print(f"   Roles: {role_count}")
        print(f"   Role-Permission Assignments: {role_perm_count}")
        print("\n   ✅ Seeding completed successfully!")


if __name__ == "__main__":
    main()
