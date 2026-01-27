"""Seed default RBAC permissions for existing roles."""

from sqlalchemy import create_engine, text

from config.config import get_platform_config


def seed_permissions():
    """Seed default permissions and assign to roles."""
    cfg = get_platform_config()
    engine = create_engine(cfg.database_config.sql_connection_string)

    with engine.connect() as conn:
        print("Seeding RBAC permissions...")

        # Define all permissions
        permissions = [
            ("course", "create", "org"),
            ("course", "read", "all"),
            ("course", "update", "all"),
            ("course", "delete", "all"),
            ("user", "read", "org"),
            ("user", "update", "org"),
            ("user", "invite", "org"),
            ("user", "manage", "org"),
            ("organization", "update", "own"),
            ("organization", "manage", "own"),
            ("role", "create", "org"),
            ("role", "read", "org"),
            ("role", "update", "org"),
        ]

        # Insert permissions
        for resource_type, action, scope in permissions:
            result = conn.execute(
                text(
                    "SELECT id FROM permissions WHERE resource_type = :rt AND action = :a AND scope = :s"
                ),
                {"rt": resource_type, "a": action, "s": scope},
            )
            existing = result.first()

            if not existing:
                conn.execute(
                    text(
                        "INSERT INTO permissions (name, resource_type, action, scope, created_at) VALUES (:name, :rt, :a, :s, NOW())"
                    ),
                    {
                        "name": f"{resource_type}:{action}:{scope}",
                        "rt": resource_type,
                        "a": action,
                        "s": scope,
                    },
                )
                print(f"Created permission: {resource_type}:{action}:{scope}")

        conn.commit()

        # Assign all permissions to both super-admin (id=1) and org-admin (id=2) roles
        for role_id, role_name in [(1, "super-admin"), (2, "org-admin")]:
            print(f"\nAssigning permissions to {role_name} (ID={role_id})...")
            for rt, a, s in permissions:
                result = conn.execute(
                    text(
                        "SELECT id FROM permissions WHERE resource_type = :rt AND action = :a AND scope = :s"
                    ),
                    {"rt": rt, "a": a, "s": s},
                )
                row = result.first()
                if not row:
                    continue

                perm_id = row[0]
                result = conn.execute(
                    text(
                        "SELECT 1 FROM role_permissions WHERE role_id = :rid AND permission_id = :pid"
                    ),
                    {"rid": role_id, "pid": perm_id},
                )
                existing = result.first()
                if not existing:
                    conn.execute(
                        text(
                            "INSERT INTO role_permissions (role_id, permission_id, granted_at) VALUES (:rid, :pid, NOW())"
                        ),
                        {"rid": role_id, "pid": perm_id},
                    )
                    print(f"  Assigned {rt}:{a}:{s}")

        conn.commit()
        print("\n✅ Permissions seeded successfully!")


if __name__ == "__main__":
    seed_permissions()
