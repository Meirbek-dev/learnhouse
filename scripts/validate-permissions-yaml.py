#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

import yaml


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    permissions_yaml = repo_root / "shared" / "permissions.yaml"

    content = yaml.safe_load(permissions_yaml.read_text(encoding="utf-8"))

    declared_actions = set(content.get("actions", []))
    invalid: list[str] = []

    for role_slug, role_data in content.get("roles", {}).items():
        for permission in role_data.get("permissions", []):
            parts = permission.split(":")
            if len(parts) != 3:
                invalid.append(f"{role_slug}: invalid permission format '{permission}'")
                continue

            _resource, action, _scope = parts
            if action == "*":
                continue

            if action not in declared_actions:
                invalid.append(
                    f"{role_slug}: action '{action}' in permission '{permission}' is not declared in actions"
                )

    if invalid:
        print("Permission YAML validation failed:")
        for row in invalid:
            print(f"- {row}")
        return 1

    print("Permission YAML validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
