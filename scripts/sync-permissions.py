#!/usr/bin/env python3
"""
Generate apps/web/types/permissions.ts from the Python permission enums.

Usage (from repo root):
    python scripts/sync-permissions.py
"""

from __future__ import annotations

import sys
import textwrap
from pathlib import Path

# ---------------------------------------------------------------------------
# Resolve paths relative to *this* script so it works from any cwd inside the
# repo, but the canonical invocation is `python scripts/sync-permissions.py`
# from the repository root.
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
ENUMS_MODULE = REPO_ROOT / "apps" / "api" / "src" / "db" / "permission_enums.py"
TS_OUTPUT = REPO_ROOT / "apps" / "web" / "types" / "permissions.ts"

# Make the enum module importable by adding its parent to sys.path.
sys.path.insert(0, str(ENUMS_MODULE.parent))

from permission_enums import Action, ResourceType, RoleSlug, Scope  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ts_const_block(const_name: str, enum_cls: type, indent: str = "  ") -> str:
    """Return a TypeScript `export const … = { … } as const;` block."""
    lines = [f"export const {const_name} = {{"]
    for member in enum_cls:
        lines.append(f"{indent}{member.name}: '{member.value}',")
    lines.append("} as const;")
    return "\n".join(lines)


def _ts_type_alias(type_name: str, const_name: str) -> str:
    """Return `export type Foo = (typeof Foos)[keyof typeof Foos];`."""
    return f"export type {type_name} = (typeof {const_name})[keyof typeof {const_name}];"


# ---------------------------------------------------------------------------
# Template
# ---------------------------------------------------------------------------

def generate_ts() -> str:
    """Return the full contents of the generated TypeScript file."""

    sections: list[str] = []

    # Header -------------------------------------------------------------------
    sections.append(textwrap.dedent("""\
        // AUTO-GENERATED - do not edit manually.
        // Run: python scripts/sync-permissions.py

        /**
         * Permission types - single source of truth for the frontend RBAC system.
         *
         * Constants use lowercase values to match the backend format directly.
         * No toLowerCase() conversion needed at check time.
         */
    """))

    # Constants ----------------------------------------------------------------
    sections.append("// " + "=" * 76)
    sections.append("// Constants")
    sections.append("// " + "=" * 76)
    sections.append("")

    sections.append(_ts_const_block("Actions", Action))
    sections.append("")
    sections.append(_ts_type_alias("Action", "Actions"))
    sections.append("")

    sections.append(_ts_const_block("Resources", ResourceType))
    sections.append("")
    sections.append(_ts_type_alias("Resource", "Resources"))
    sections.append("")

    sections.append(_ts_const_block("Scopes", Scope))
    sections.append("")
    sections.append(_ts_type_alias("Scope", "Scopes"))
    sections.append("")

    sections.append(_ts_const_block("RoleSlugs", RoleSlug))
    sections.append("")
    sections.append(_ts_type_alias("RoleSlug", "RoleSlugs"))

    # Types --------------------------------------------------------------------
    sections.append("")
    sections.append("// " + "=" * 76)
    sections.append("// Types")
    sections.append("// " + "=" * 76)

    sections.append(textwrap.dedent("""\

        /** Permission string format: "resource:action:scope" */
        export type PermissionString = `${Resource}:${Action}:${Scope}`;

        export interface Role {
          id: number;
          name: string;
          slug: string;
          description?: string;
          org_id?: number | null;
          is_system: boolean;
          priority: number;
        }

        /** Canonical type for user RBAC data from the API. */
        export interface UserRBACData {
          roles: Role[];
          permissions: string[];
          org_id: number | null;
        }

        /** Backend Permission entity. */
        export interface Permission {
          id: number;
          name: string;
          resource_type: string;
          action: string;
          scope: string;
          description: string | null;
          created_at: string;
        }

        /** Role with its assigned permissions. */
        export interface RoleWithPermissions extends Role {
          permissions: Permission[];
        }

        /** A user\u2194role assignment record. */
        export interface UserRoleAssignment {
          user_id: number;
          role_id: number;
          org_id: number;
          assigned_at: string;
          assigned_by: number | null;
          user?: {
            id: number;
            email: string;
            username: string;
            first_name?: string;
            last_name?: string;
            avatar_image?: string;
          };
          role?: Role;
        }

        /** Body for creating a role. */
        export interface CreateRoleBody {
          name: string;
          slug: string;
          description?: string;
        }

        /** Body for updating a role. */
        export interface UpdateRoleBody {
          name: string;
          description?: string;
        }"""))

    # Helpers ------------------------------------------------------------------
    sections.append("")
    sections.append("// " + "=" * 76)
    sections.append("// Helpers")
    sections.append("// " + "=" * 76)

    sections.append(textwrap.dedent("""\

        /** Build a permission string. Format: "resource:action:scope" */
        export function perm(resource: Resource, action: Action, scope: Scope): PermissionString {
          return `${resource}:${action}:${scope}`;
        }
    """))

    return "\n".join(sections)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    content = generate_ts()
    TS_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    TS_OUTPUT.write_text(content, encoding="utf-8", newline="\n")
    print(f"Generated {TS_OUTPUT.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
