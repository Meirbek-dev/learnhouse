from __future__ import annotations

from pathlib import Path

import yaml


def test_permissions_yaml_role_actions_are_declared() -> None:
    repo_root = Path(__file__).resolve().parents[5]
    permissions_yaml = repo_root / "shared" / "permissions.yaml"

    content = yaml.safe_load(permissions_yaml.read_text(encoding="utf-8"))

    declared_actions = set(content["actions"])
    invalid_permissions: list[tuple[str, str]] = []

    for role_slug, role_data in content["roles"].items():
        for permission in role_data.get("permissions", []):
            parts = permission.split(":")
            if len(parts) != 3:
                continue

            _resource, action, _scope = parts
            if action == "*":
                continue

            if action not in declared_actions:
                invalid_permissions.append((role_slug, permission))

    assert not invalid_permissions, (
        f"Undeclared actions found in role permissions: {invalid_permissions}"
    )
