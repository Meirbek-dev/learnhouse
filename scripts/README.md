# RBAC Refactoring Verification Tools

This directory contains tools to verify the RBAC system refactoring is complete.

## Tools

### 1. Python Verification Script

**File**: `verify_rbac_refactoring.py`

Checks the codebase for:

- Legacy RBAC function usage
- Hardcoded role IDs
- Old rights-based permission logic
- Session permission fallbacks
- UnifiedPermissionService adoption

**Usage**:

```bash
# From project root
uv run python scripts/verify_rbac_refactoring.py
```

**Expected Output**: All checks should pass (green ✓)

---

### 2. SQL Data Integrity Script

**File**: `verify_rbac_data_integrity.sql`

Runs 12 comprehensive database checks:

1. Users without roles
2. Roles without permissions
3. Orphaned user_roles
4. Permission name format validation
5. System roles existence
6. Duplicate role slugs per organization
7. Permission coverage by role
8. User role assignments per org
9. Circular role hierarchies detection
10. Resource permission overrides
11. Permission audit log review
12. System statistics summary

**Usage**:

```bash
# Connect to your database
psql -U your_user -d your_database -f scripts/verify_rbac_data_integrity.sql

# Or with environment variables
psql -f scripts/verify_rbac_data_integrity.sql
```

**Expected Results**:

- Queries 1-4, 6, 9: Should return **empty** (no issues)
- Queries 5, 7-8, 10-12: Should return data showing healthy system state

---

## Post-Migration Checklist

After running the verification tools:

- [ ] Python verification script passes all checks
- [ ] SQL integrity checks show no critical issues
- [ ] No users locked out of system
- [ ] All system roles exist (super-admin, org-admin, instructor, student)
- [ ] Each organization has at least one admin
- [ ] Permission audit log shows recent activity

---

## Troubleshooting

### Python Script Issues

**Issue**: Import errors when running script

```bash
# Ensure you're in the project root
cd /path/to/ashyq-bilim
uv run python scripts/verify_rbac_refactoring.py
```

**Issue**: False positives for `user.id == 0`

- This is **correct** - checking for anonymous users is allowed

---

### SQL Script Issues

**Issue**: Connection refused

```bash
# Check PostgreSQL is running
docker-compose ps

# Or check local PostgreSQL
pg_isready
```

**Issue**: Permission denied

```bash
# Use superuser or database owner
psql -U postgres -d your_database -f scripts/verify_rbac_data_integrity.sql
```

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: RBAC Verification

on: [push, pull_request]

jobs:
  verify-rbac:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: astral-sh/setup-uv@v1
      - name: Run RBAC verification
        run: uv run python scripts/verify_rbac_refactoring.py
```

### Pre-commit Hook

```bash
# .git/hooks/pre-commit
#!/bin/bash
uv run python scripts/verify_rbac_refactoring.py || {
    echo "RBAC verification failed. Please fix issues before committing."
    exit 1
}
```

---

## Related Documentation

- [RBAC Implementation Completion](../docs/RBAC_IMPLEMENTATION_COMPLETION.md)
- [RBAC Developer Guide](../apps/web/docs/RBAC_DEVELOPER_GUIDE.md)
- [RBAC Migration Guide](../apps/web/docs/RBAC_MIGRATION_GUIDE.md)
- [Original Refactoring Plan](../plans/RBAC%20System%20Frontend%20Refactoring%20Plan.md)
