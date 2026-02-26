"""
repair_rbac_data.py
-------------------
Re-runs the data-seeding steps from the RBAC rewrite migration that failed
due to column-name mismatches:

  * permissions.permission_key  → column does not exist; use name for conflict key
  * user_roles.granted_at       → column is actually assigned_at
  * ON CONFLICT (user_id,role_id,org_id) → no such unique constraint; use explicit check

Run from apps/api:
    $env:PYTHONPATH='.'; uv run python scripts/repair_rbac_data.py
"""

import sys
from datetime import UTC, datetime

import sqlalchemy as sa
from sqlalchemy import text

sys.path.insert(0, ".")
from config.config import get_platform_config

engine = sa.create_engine(get_platform_config().database_config.sql_connection_string)


# ---------------------------------------------------------------------------
# Permission definitions (mirror of migration, minus permission_key column)
# ---------------------------------------------------------------------------
PERMISSIONS: list[tuple[str, str, str, str]] = [
    # organization
    ("organization", "read", "own", "Read own organization"),
    ("organization", "update", "own", "Update own organization"),
    ("organization", "manage", "own", "Manage own organization settings"),
    ("organization", "delete", "own", "Delete own organization"),
    # course
    ("course", "create", "org", "Create courses in organization"),
    ("course", "read", "all", "Read all public courses"),
    ("course", "read", "own", "Read own courses"),
    ("course", "update", "own", "Update own courses"),
    ("course", "update", "org", "Update courses in organization"),
    ("course", "update", "all", "Update all courses"),
    ("course", "delete", "own", "Delete own courses"),
    ("course", "delete", "org", "Delete courses in organization"),
    ("course", "delete", "all", "Delete all courses"),
    ("course", "manage", "own", "Manage own course settings"),
    ("course", "manage", "all", "Manage all courses"),
    # chapter
    ("chapter", "create", "own", "Create chapters in own courses"),
    ("chapter", "create", "org", "Create chapters in organization"),
    ("chapter", "read", "all", "Read chapters"),
    ("chapter", "update", "own", "Update own chapters"),
    ("chapter", "update", "org", "Update chapters in organization"),
    ("chapter", "update", "all", "Update all chapters"),
    ("chapter", "delete", "own", "Delete own chapters"),
    ("chapter", "delete", "org", "Delete chapters in organization"),
    ("chapter", "delete", "all", "Delete all chapters"),
    # activity
    ("activity", "create", "own", "Create activities in own courses"),
    ("activity", "create", "org", "Create activities in organization"),
    ("activity", "read", "all", "Read activities"),
    ("activity", "update", "own", "Update own activities"),
    ("activity", "update", "org", "Update activities in organization"),
    ("activity", "update", "all", "Update all activities"),
    ("activity", "delete", "own", "Delete own activities"),
    ("activity", "delete", "org", "Delete activities in organization"),
    ("activity", "delete", "all", "Delete all activities"),
    # user
    ("user", "read", "own", "Read own profile"),
    ("user", "read", "org", "Read users in organization"),
    ("user", "read", "all", "Read all users"),
    ("user", "update", "own", "Update own profile"),
    ("user", "update", "org", "Update users in organization"),
    ("user", "delete", "org", "Delete users in organization"),
    ("user", "invite", "org", "Invite users to organization"),
    ("user", "manage", "org", "Manage organization users"),
    # usergroup
    ("usergroup", "create", "org", "Create usergroups in organization"),
    ("usergroup", "read", "org", "Read usergroups in organization"),
    ("usergroup", "update", "org", "Update usergroups in organization"),
    ("usergroup", "delete", "org", "Delete usergroups in organization"),
    # collection
    ("collection", "create", "org", "Create collections in organization"),
    ("collection", "read", "all", "Read public collections"),
    ("collection", "update", "own", "Update own collections"),
    ("collection", "update", "org", "Update collections in organization"),
    ("collection", "update", "all", "Update all collections"),
    ("collection", "delete", "own", "Delete own collections"),
    ("collection", "delete", "org", "Delete collections in organization"),
    ("collection", "delete", "all", "Delete all collections"),
    # role
    ("role", "create", "org", "Create roles in organization"),
    ("role", "read", "org", "Read roles in organization"),
    ("role", "update", "org", "Update roles in organization"),
    ("role", "delete", "org", "Delete roles in organization"),
    # certificate
    ("certificate", "create", "own", "Create certificates for own courses"),
    ("certificate", "read", "all", "Read certificates"),
    # analytics
    ("analytics", "read", "own", "Read own analytics"),
    ("analytics", "read", "org", "Read organization analytics"),
    # assignment / quiz
    ("assignment", "create", "org", "Create assignments"),
    ("assignment", "read", "all", "Read assignments"),
    ("assignment", "update", "all", "Update assignments"),
    ("assignment", "delete", "all", "Delete assignments"),
    ("assignment", "grade", "own", "Grade assignments in own courses"),
    ("assignment", "grade", "org", "Grade assignments in organization"),
    ("assignment", "submit", "all", "Submit assignments"),
    ("quiz", "grade", "own", "Grade quizzes in own courses"),
    ("quiz", "submit", "all", "Submit quizzes"),
    # exam
    ("exam", "create", "org", "Create exams in organization"),
    ("exam", "read", "own", "Read own exams"),
    ("exam", "update", "own", "Update own exams"),
    ("exam", "delete", "own", "Delete own exams"),
    # file
    ("file", "create", "org", "Upload files to organization"),
    ("file", "read", "org", "Read files in organization"),
    ("file", "delete", "own", "Delete own files"),
    # api_token
    ("api_token", "create", "org", "Create API tokens"),
    ("api_token", "read", "org", "Read API tokens"),
    ("api_token", "delete", "org", "Delete API tokens"),
    # discussion
    ("discussion", "moderate", "org", "Moderate discussions in organization"),
]

# ---------------------------------------------------------------------------
# Role definitions
# ---------------------------------------------------------------------------
ROLES: list[tuple[str, str, str, bool, int]] = [
    ("admin", "Администратор", "Администратор платформы с полным доступом", True, 100),
    ("maintainer", "Куратор", "Управление контентом и администрирование курсов", True, 70),
    ("instructor", "Преподаватель", "Создание и ведение курсов", True, 50),
    ("moderator", "Модератор", "Модерация сообщества", True, 40),
    ("user", "Пользователь", "Стандартный авторизованный пользователь", True, 10),
]

# Old role_id → new role slug (from legacy `role` table)
OLD_ROLE_MAPPING: dict[int, str] = {
    1: "admin",
    2: "maintainer",
    3: "instructor",
    4: "user",
}


def seed_permissions(conn) -> dict[str, int]:
    """Insert permissions, return {name: id} map."""
    print("  Seeding permissions...")
    for resource_type, action, scope, description in PERMISSIONS:
        name = f"{resource_type}:{action}:{scope}"
        conn.execute(
            text("""
                INSERT INTO permissions (name, resource_type, action, scope, description, created_at)
                VALUES (:name, :resource_type, :action, :scope, :description, NOW())
                ON CONFLICT (name) DO NOTHING
            """),
            {"name": name, "resource_type": resource_type, "action": action,
             "scope": scope, "description": description},
        )

    rows = conn.execute(text("SELECT id, name FROM permissions")).fetchall()
    perm_map = {name: pid for pid, name in rows}
    print(f"  ✅ {len(perm_map)} permissions in DB")
    return perm_map


def seed_roles(conn, perm_map: dict[str, int]) -> dict[str, int]:
    """Insert system roles and their permission assignments, return {slug: id}."""
    print("  Seeding roles...")
    for slug, name, description, is_system, priority in ROLES:
        conn.execute(
            text("""
                INSERT INTO roles (slug, name, description, is_system, priority, org_id, created_at, updated_at)
                VALUES (:slug, :name, :description, :is_system, :priority, NULL, NOW(), NOW())
                ON CONFLICT (slug, org_id) DO NOTHING
            """),
            {"slug": slug, "name": name, "description": description,
             "is_system": is_system, "priority": priority},
        )

    rows = conn.execute(text("SELECT id, slug FROM roles WHERE org_id IS NULL")).fetchall()
    role_map = {slug: rid for rid, slug in rows}
    print(f"  ✅ {len(role_map)} system roles in DB: {list(role_map.keys())}")

    # Role → permission assignments
    role_permissions: dict[str, list[str]] = {
        "admin": list(perm_map.keys()),
        "maintainer": [
            p for p in perm_map
            if any(x in p for x in [
                "course:", "chapter:", "activity:", "collection:",
                "user:read", "usergroup:read", "analytics:read",
            ])
        ],
        "instructor": [
            "course:create:org", "course:read:all", "course:update:own",
            "course:delete:own", "course:manage:own",
            "chapter:create:own", "chapter:read:all", "chapter:update:own", "chapter:delete:own",
            "activity:create:own", "activity:read:all", "activity:update:own", "activity:delete:own",
            "assignment:grade:own", "quiz:grade:own",
            "certificate:create:own", "analytics:read:own", "user:read:own",
        ],
        "moderator": ["course:read:all", "user:read:org", "discussion:moderate:org"],
        "user": [
            "course:read:all", "user:read:own", "user:update:own",
            "assignment:submit:all", "quiz:submit:all",
            "analytics:read:own", "collection:read:all", "certificate:read:all",
        ],
    }

    rp_count = 0
    for role_slug, perms in role_permissions.items():
        role_id = role_map.get(role_slug)
        if not role_id:
            print(f"  ⚠️  Role '{role_slug}' not found, skipping permissions")
            continue
        for perm_key in perms:
            perm_id = perm_map.get(perm_key)
            if not perm_id:
                continue
            conn.execute(
                text("""
                    INSERT INTO role_permissions (role_id, permission_id, granted_at)
                    VALUES (:role_id, :permission_id, NOW())
                    ON CONFLICT (role_id, permission_id) DO NOTHING
                """),
                {"role_id": role_id, "permission_id": perm_id},
            )
            rp_count += 1

    print(f"  ✅ {rp_count} role-permission assignments written")
    return role_map


def migrate_userorganization(conn, role_map: dict[str, int]) -> None:
    """Migrate legacy userorganization rows → user_roles (fixed column names)."""
    exists = conn.execute(text("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema='public' AND table_name='userorganization'
        )
    """)).scalar()

    if not exists:
        print("  ℹ️  userorganization table not found, skipping migration")
        return

    rows = conn.execute(
        text("SELECT user_id, org_id, role_id, creation_date FROM userorganization")
    ).fetchall()

    migrated = 0
    skipped = 0
    for user_id, org_id, old_role_id, creation_date in rows:
        new_role_slug = OLD_ROLE_MAPPING.get(old_role_id, "user")
        new_role_id = role_map.get(new_role_slug)
        if not new_role_id:
            skipped += 1
            continue

        assigned_at = creation_date or datetime.now(UTC)

        # Check if already exists (no unique constraint available)
        existing = conn.execute(text("""
            SELECT id FROM user_roles
            WHERE user_id = :user_id AND role_id = :role_id AND org_id = :org_id
        """), {"user_id": user_id, "role_id": new_role_id, "org_id": org_id}).fetchone()

        if existing:
            skipped += 1
            continue

        conn.execute(
            text("""
                INSERT INTO user_roles (user_id, role_id, org_id, assigned_at)
                VALUES (:user_id, :role_id, :org_id, :assigned_at)
            """),
            {"user_id": user_id, "role_id": new_role_id,
             "org_id": org_id, "assigned_at": assigned_at},
        )
        migrated += 1

    print(f"  ✅ Migrated {migrated} user-org rows to user_roles ({skipped} already existed/skipped)")


def main() -> None:
    print("=" * 60)
    print("RBAC Data Repair Script")
    print("=" * 60)

    with engine.begin() as conn:
        perm_map = seed_permissions(conn)
        role_map = seed_roles(conn, perm_map)
        migrate_userorganization(conn, role_map)

    # Verify
    with engine.connect() as conn:
        ur = conn.execute(text("SELECT COUNT(*) FROM user_roles")).scalar()
        roles = conn.execute(text("SELECT COUNT(*) FROM roles")).scalar()
        perms = conn.execute(text("SELECT COUNT(*) FROM permissions")).scalar()
        rp = conn.execute(text("SELECT COUNT(*) FROM role_permissions")).scalar()
        print()
        print("Final state:")
        print(f"  roles            : {roles}")
        print(f"  permissions      : {perms}")
        print(f"  role_permissions : {rp}")
        print(f"  user_roles       : {ur}")

        # Show user 1's roles
        user1 = conn.execute(text("""
            SELECT ur.user_id, r.slug, r.name, ur.org_id
            FROM user_roles ur JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = 1
        """)).fetchall()
        print(f"  user 1 roles     : {user1}")

    print()
    print("✅ Repair complete!")


if __name__ == "__main__":
    main()
