-- RBAC System Data Integrity Verification Script
-- This script checks the integrity of the permission system after migration
-- Run this against your PostgreSQL database to verify everything is properly configured

-- ============================================================================
-- 1. CHECK FOR USERS WITHOUT ROLES
-- ============================================================================
-- This identifies users who don't have any role assigned
SELECT
    u.id,
    u.email,
    u.username,
    u.created_at
FROM "user" u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.user_id IS NULL
ORDER BY u.created_at DESC;

-- Expected: Ideally empty, or only very recent users who haven't been assigned roles yet


-- ============================================================================
-- 2. CHECK FOR ROLES WITHOUT PERMISSIONS
-- ============================================================================
-- This finds roles that don't have any permissions assigned
SELECT
    r.id,
    r.slug,
    r.name,
    r.org_id,
    r.is_system,
    COUNT(rp.permission_id) as perm_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
GROUP BY r.id, r.slug, r.name, r.org_id, r.is_system
HAVING COUNT(rp.permission_id) = 0
ORDER BY r.is_system DESC, r.org_id;

-- Expected: Empty or only custom roles that haven't been configured yet


-- ============================================================================
-- 3. CHECK FOR ORPHANED USER_ROLES
-- ============================================================================
-- This finds user_roles entries where the role doesn't exist
SELECT
    ur.id,
    ur.user_id,
    ur.role_id,
    ur.org_id,
    ur.created_at
FROM user_roles ur
LEFT JOIN roles r ON ur.role_id = r.id
WHERE r.id IS NULL;

-- Expected: Empty (no orphaned entries)


-- ============================================================================
-- 4. VERIFY PERMISSION NAME FORMAT
-- ============================================================================
-- This checks that all permissions follow the resource:action:scope format
SELECT
    id,
    name,
    resource_type,
    action,
    scope
FROM permissions
WHERE name NOT LIKE '%:%:%'
ORDER BY name;

-- Expected: Empty (all permissions should have the correct format)


-- ============================================================================
-- 5. CHECK SYSTEM ROLES EXIST
-- ============================================================================
-- This verifies that all required system roles are present
SELECT
    slug,
    name,
    is_system,
    org_id,
    COUNT(*) as role_count
FROM roles
WHERE slug IN ('super-admin', 'org-admin', 'instructor', 'student')
GROUP BY slug, name, is_system, org_id
ORDER BY slug;

-- Expected: At least one of each system role (super-admin, org-admin, instructor, student)


-- ============================================================================
-- 6. CHECK FOR DUPLICATE ROLE SLUGS IN SAME ORGANIZATION
-- ============================================================================
-- This finds duplicate role slugs within the same organization
SELECT
    slug,
    org_id,
    COUNT(*) as duplicate_count,
    array_agg(id) as role_ids
FROM roles
WHERE org_id IS NOT NULL
GROUP BY slug, org_id
HAVING COUNT(*) > 1
ORDER BY slug, org_id;

-- Expected: Empty (no duplicate slugs per org)


-- ============================================================================
-- 7. PERMISSION COVERAGE BY ROLE
-- ============================================================================
-- This shows how many permissions each role has
SELECT
    r.slug,
    r.name,
    r.org_id,
    r.is_system,
    COUNT(DISTINCT rp.permission_id) as permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
GROUP BY r.id, r.slug, r.name, r.org_id, r.is_system
ORDER BY r.is_system DESC, permission_count DESC;

-- Expected: System roles should have many permissions, custom roles may vary


-- ============================================================================
-- 8. CHECK USER ROLE ASSIGNMENTS PER ORGANIZATION
-- ============================================================================
-- This shows how many users have roles in each organization
SELECT
    o.id as org_id,
    o.name as org_name,
    COUNT(DISTINCT ur.user_id) as user_count,
    COUNT(*) as total_role_assignments
FROM organizations o
LEFT JOIN user_roles ur ON o.id = ur.org_id
GROUP BY o.id, o.name
ORDER BY user_count DESC;

-- Expected: Each organization should have at least one admin user


-- ============================================================================
-- 9. CHECK FOR CIRCULAR ROLE HIERARCHIES
-- ============================================================================
-- This recursively checks for circular parent-child relationships
WITH RECURSIVE role_hierarchy AS (
    -- Base case: all roles with their direct parents
    SELECT
        id,
        slug,
        parent_role_id,
        ARRAY[id] as path,
        0 as depth
    FROM roles
    WHERE parent_role_id IS NULL

    UNION ALL

    -- Recursive case: add child roles
    SELECT
        r.id,
        r.slug,
        r.parent_role_id,
        rh.path || r.id,
        rh.depth + 1
    FROM roles r
    JOIN role_hierarchy rh ON r.parent_role_id = rh.id
    WHERE NOT (r.id = ANY(rh.path)) -- Prevent cycles
    AND rh.depth < 10 -- Safety limit
)
SELECT
    r.id,
    r.slug,
    r.parent_role_id,
    pr.slug as parent_slug
FROM roles r
LEFT JOIN roles pr ON r.parent_role_id = pr.id
WHERE r.parent_role_id IS NOT NULL
AND r.id NOT IN (SELECT id FROM role_hierarchy);

-- Expected: Empty (no circular hierarchies)


-- ============================================================================
-- 10. VERIFY RESOURCE PERMISSIONS
-- ============================================================================
-- This checks resource-specific permission overrides
SELECT
    rp.id,
    rp.resource_type,
    rp.resource_id,
    u.email as user_email,
    p.name as permission_name,
    rp.granted,
    rp.created_at
FROM resource_permissions rp
LEFT JOIN "user" u ON rp.user_id = u.id
LEFT JOIN permissions p ON rp.permission_id = p.id
ORDER BY rp.created_at DESC
LIMIT 100;

-- Expected: Only intentional resource-level overrides


-- ============================================================================
-- 11. CHECK PERMISSION AUDIT LOG
-- ============================================================================
-- This shows recent permission checks and denials
SELECT
    pa.created_at,
    u.email as user_email,
    pa.action,
    pa.resource_type,
    pa.resource_id,
    pa.org_id,
    pa.result,
    pa.error_code
FROM permission_audits pa
LEFT JOIN "user" u ON pa.user_id = u.id
ORDER BY pa.created_at DESC
LIMIT 100;

-- Expected: Recent permission checks, both granted and denied


-- ============================================================================
-- 12. SUMMARY STATISTICS
-- ============================================================================
-- This provides an overview of the entire RBAC system
SELECT
    'Total Users' as metric,
    COUNT(*)::text as value
FROM "user"
UNION ALL
SELECT
    'Total Roles',
    COUNT(*)::text
FROM roles
UNION ALL
SELECT
    'System Roles',
    COUNT(*)::text
FROM roles
WHERE is_system = true
UNION ALL
SELECT
    'Custom Roles',
    COUNT(*)::text
FROM roles
WHERE is_system = false
UNION ALL
SELECT
    'Total Permissions',
    COUNT(*)::text
FROM permissions
UNION ALL
SELECT
    'User-Role Assignments',
    COUNT(*)::text
FROM user_roles
UNION ALL
SELECT
    'Role-Permission Assignments',
    COUNT(*)::text
FROM role_permissions
UNION ALL
SELECT
    'Resource Permission Overrides',
    COUNT(*)::text
FROM resource_permissions;

-- Expected: All counts should be > 0 for a functioning system
