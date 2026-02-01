#!/usr/bin/env python3
"""
RBAC System Verification Script

This script verifies that the RBAC system has been properly refactored
to use the new flattened schema (user_permissions only).

Usage:
    uv run python scripts/verify_rbac_refactoring.py

Run this script to ensure:
1. No deprecated RolePermission/UserRole model usage
2. No hardcoded role IDs exist
3. PermissionService is used consistently
4. All code uses the new user_permissions architecture
"""

import re
import sys
from pathlib import Path
from typing import List, Tuple

# ANSI color codes
RED = '\033[91m'
GREEN = '\033[92m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_header(text: str):
    """Print a formatted header."""
    print(f"\n{BLUE}{'=' * 80}{RESET}")
    print(f"{BLUE}{text.center(80)}{RESET}")
    print(f"{BLUE}{'=' * 80}{RESET}\n")

def print_success(text: str):
    """Print success message."""
    print(f"{GREEN}✓ {text}{RESET}")

def print_warning(text: str):
    """Print warning message."""
    print(f"{YELLOW}⚠ {text}{RESET}")

def print_error(text: str):
    """Print error message."""
    print(f"{RED}✗ {text}{RESET}")

def search_files(directory: Path, pattern: str, extensions: List[str]) -> List[Tuple[Path, int, str]]:
    """Search for a pattern in files with specific extensions."""
    matches = []
    for ext in extensions:
        for file_path in directory.rglob(f"*.{ext}"):
            # Skip node_modules, venv, __pycache__, etc.
            if any(skip in str(file_path) for skip in ['node_modules', 'venv', '__pycache__', '.git', 'dist', 'build']):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    for line_num, line in enumerate(f, 1):
                        if re.search(pattern, line, re.IGNORECASE):
                            matches.append((file_path, line_num, line.strip()))
            except (UnicodeDecodeError, PermissionError):
                # Skip binary files or files we can't read
                pass

    return matches

def check_legacy_rbac_functions(backend_path: Path) -> bool:
    """Check for deprecated model usage (RolePermission, UserRole)."""
    print_header("Checking for Deprecated Model Usage")

    patterns = [
        r'from.*RolePermission',
        r'from.*UserRole',
        r'RolePermission\(',
        r'UserRole\(',
    ]

    all_clean = True
    for pattern in patterns:
        matches = search_files(backend_path, pattern, ['py'])
        if matches:
            all_clean = False
            print_error(f"Found deprecated model usage '{pattern}':")
            for file_path, line_num, line in matches[:5]:  # Show first 5 matches
                print(f"  {file_path}:{line_num} - {line[:100]}")
            if len(matches) > 5:
                print(f"  ... and {len(matches) - 5} more matches")
        else:
            print_success(f"No deprecated model usage for '{pattern}'")

    return all_clean

def check_hardcoded_role_ids(project_path: Path) -> bool:
    """Check for hardcoded role ID checks."""
    print_header("Checking for Hardcoded Role IDs")

    patterns = [
        r'role(_id)?\.id\s+in\s+\[',
        r'role(_id)?\.id\s*==\s*[1-9]',
        r'role(_id)?\s*===?\s*[1-9]',  # JavaScript/TypeScript
    ]

    all_clean = True
    for pattern in patterns:
        # Check Python files
        py_matches = search_files(project_path / 'apps' / 'api', pattern, ['py'])
        # Check TypeScript files
        ts_matches = search_files(project_path / 'apps' / 'web', pattern, ['ts', 'tsx'])

        matches = py_matches + ts_matches

        # Filter out false positives (user.id == 0 for anonymous users is OK)
        # Also filter out test assertions (assert role.parent_role_id == X is OK in tests)
        filtered_matches = [
            m for m in matches
            if not re.search(r'user\.id\s*==\s*0', m[2])
            and not re.search(r'current_user\.id\s*==\s*0', m[2])
            and not re.search(r'assert\s+\w+\.parent_role_id\s*==', m[2])  # Test assertions
            and 'test_' not in str(m[0])  # Skip test files entirely for role ID checks
        ]

        if filtered_matches:
            all_clean = False
            print_error(f"Found hardcoded role IDs with pattern '{pattern}':")
            for file_path, line_num, line in filtered_matches[:5]:
                print(f"  {file_path}:{line_num} - {line[:100]}")
            if len(filtered_matches) > 5:
                print(f"  ... and {len(filtered_matches) - 5} more matches")
        else:
            print_success(f"No hardcoded role IDs for pattern '{pattern}'")

    return all_clean

def check_rights_based_logic(backend_path: Path) -> bool:
    """Check for old rights-based permission logic."""
    print_header("Checking for Rights-Based Logic")

    patterns = [
        r'user_role\.rights',
        r'role\.rights',
        r'\.get\(["\']rights["\']',
    ]

    all_clean = True
    for pattern in patterns:
        matches = search_files(backend_path, pattern, ['py'])
        if matches:
            all_clean = False
            print_error(f"Found rights-based logic '{pattern}':")
            for file_path, line_num, line in matches[:5]:
                print(f"  {file_path}:{line_num} - {line[:100]}")
            if len(matches) > 5:
                print(f"  ... and {len(matches) - 5} more matches")
        else:
            print_success(f"No rights-based logic for '{pattern}'")

    return all_clean

def check_session_permissions_frontend(web_path: Path) -> bool:
    """Check for session permission fallbacks in frontend."""
    print_header("Checking for Session Permission Fallbacks")

    patterns = [
        r'session\?\.permissions',
        r'session\.user\.role',
    ]

    all_clean = True
    for pattern in patterns:
        matches = search_files(web_path, pattern, ['ts', 'tsx'])

        # Filter out auth.ts which handles session creation (allowed)
        filtered_matches = [
            m for m in matches
            if 'auth.ts' not in str(m[0])
        ]

        if filtered_matches:
            all_clean = False
            print_error(f"Found session permission fallback '{pattern}':")
            for file_path, line_num, line in filtered_matches[:5]:
                print(f"  {file_path}:{line_num} - {line[:100]}")
            if len(filtered_matches) > 5:
                print(f"  ... and {len(filtered_matches) - 5} more matches")
        else:
            print_success(f"No session permission fallbacks for '{pattern}'")

    return all_clean

def check_unified_permission_service_usage(backend_path: Path) -> bool:
    """Verify UnifiedPermissionService is being used."""
    print_header("Checking UnifiedPermissionService Usage")

    # Look for imports
    import_matches = search_files(
        backend_path,
        r'from\s+src\.services\.permissions\.unified_permission_service\s+import\s+UnifiedPermissionService',
        ['py']
    )

    if import_matches:
        print_success(f"Found {len(import_matches)} files importing UnifiedPermissionService")
        return True
    else:
        print_warning("No files found importing UnifiedPermissionService")
        return False

def verify_critical_files(project_path: Path) -> bool:
    """Verify critical files exist and have no errors."""
    print_header("Verifying Critical Files")

    critical_files = [
        'apps/api/src/services/permissions/unified_permission_service.py',
        'apps/api/src/security/rbac/dependencies.py',
        'apps/api/src/services/roles/roles.py',
        'apps/web/hooks/usePermission.ts',
        'apps/web/hooks/useResourcePermission.ts',
        'apps/web/components/Security/PermissionDenied.tsx',
        'apps/web/types/permissions.ts',
        'scripts/verify_rbac_data_integrity.sql',
    ]

    all_exist = True
    for file_rel_path in critical_files:
        file_path = project_path / file_rel_path
        if file_path.exists():
            print_success(f"Found {file_rel_path}")
        else:
            all_exist = False
            print_error(f"Missing {file_rel_path}")

    return all_exist

def main():
    """Run all verification checks."""
    # Determine project root (assuming script is in scripts/ directory)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    print_header("RBAC System Verification")
    print(f"Project Root: {project_root}\n")

    backend_path = project_root / 'apps' / 'api'
    web_path = project_root / 'apps' / 'web'

    # Run all checks
    checks = [
        ("Critical Files", verify_critical_files(project_root)),
        ("Legacy RBAC Functions", check_legacy_rbac_functions(backend_path)),
        ("Hardcoded Role IDs", check_hardcoded_role_ids(project_root)),
        ("Rights-Based Logic", check_rights_based_logic(backend_path)),
        ("Session Permission Fallbacks", check_session_permissions_frontend(web_path)),
        ("UnifiedPermissionService Usage", check_unified_permission_service_usage(backend_path)),
    ]

    # Print summary
    print_header("Verification Summary")

    passed = sum(1 for _, result in checks if result)
    total = len(checks)

    for check_name, result in checks:
        if result:
            print_success(f"{check_name}: PASS")
        else:
            print_error(f"{check_name}: FAIL")

    print(f"\n{BLUE}{'=' * 80}{RESET}")
    if passed == total:
        print_success(f"All {total} checks passed! ✓")
        print(f"\n{GREEN}RBAC system refactoring is complete and verified.{RESET}\n")
        return 0
    else:
        print_error(f"{passed}/{total} checks passed")
        print(f"\n{RED}Please address the issues above.{RESET}\n")
        return 1

if __name__ == '__main__':
    sys.exit(main())
