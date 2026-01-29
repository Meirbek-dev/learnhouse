# RBAC System Developer Guide

## Overview

This guide explains how to use the new RBAC (Role-Based Access Control) system in the frontend
application.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Permission Checks](#permission-checks)
3. [Batch Permission Checks](#batch-permission-checks)
4. [Resource-Specific Permissions](#resource-specific-permissions)
5. [Role Management UI](#role-management-ui)
6. [Best Practices](#best-practices)

---

## Quick Start

### Basic Permission Check

```tsx
import { Actions, ResourceTypes } from '@/types/permissions';
import { usePermission } from '@/hooks/usePermission';

function MyComponent() {
  const { can, isAdmin, isLoading } = usePermission();

  if (isLoading) return <Skeleton />;

  return (
    <div>
      {can(Actions.CREATE, ResourceTypes.COURSE) && <Button>Create Course</Button>}

      {isAdmin && <AdminPanel />}
    </div>
  );
}
```

### Using Permission Guard

```tsx
import { PermissionGuard } from '@/components/Security/PermissionGuard';
import { Actions, ResourceTypes } from '@/types/permissions';

function MyComponent() {
  return (
    <PermissionGuard
      action={Actions.UPDATE}
      resource={ResourceTypes.ORGANIZATION}
      fallback={<PermissionDenied />}
    >
      <OrganizationSettings />
    </PermissionGuard>
  );
}
```

---

## Permission Checks

### Available Methods

The `usePermission` hook provides several methods:

```tsx
const {
  // Permission checks
  can, // Check specific permission
  canAny, // Check if user has ANY of the permissions
  canAll, // Check if user has ALL of the permissions
  permissions, // Raw permissions object

  // Role checks
  hasRole, // Check specific role
  hasAnyRole, // Check if user has any of the roles
  roles, // User's role slugs

  // Quick role checks
  isAdmin, // Is super-admin or org-admin
  isSuperAdmin, // Is super-admin
  isOrgAdmin, // Is org-admin
  isInstructor, // Is instructor or higher

  // State
  isAuthenticated,
  isLoading,
} = usePermission();
```

### Scopes

Permissions have different scopes that determine what resources they apply to:

- `Scopes.ALL` - All resources of this type
- `Scopes.ORG` - Resources within the organization
- `Scopes.OWN` - Only resources the user owns
- `Scopes.ASSIGNED` - Resources assigned to the user

```tsx
// Check if user can update ANY course
can(Actions.UPDATE, ResourceTypes.COURSE, Scopes.ALL);

// Check if user can update courses in their org
can(Actions.UPDATE, ResourceTypes.COURSE, Scopes.ORG);

// Check if user can update only their own courses
can(Actions.UPDATE, ResourceTypes.COURSE, Scopes.OWN);
```

### Multiple Permission Checks

```tsx
const canManageCourses = canAll([
  { action: Actions.CREATE, resource: ResourceTypes.COURSE },
  { action: Actions.UPDATE, resource: ResourceTypes.COURSE },
  { action: Actions.DELETE, resource: ResourceTypes.COURSE },
]);

const canDoSomething = canAny([
  { action: Actions.UPDATE, resource: ResourceTypes.COURSE, scope: Scopes.OWN },
  { action: Actions.UPDATE, resource: ResourceTypes.COURSE, scope: Scopes.ORG },
]);
```

---

## Batch Permission Checks

For pages that check multiple permissions, use `useBatchPermissions` to reduce API calls:

```tsx
import { useBatchPermissions } from '@/hooks/useBatchPermissions';
import { Actions, ResourceTypes } from '@/types/permissions';

function DashboardPage() {
  const { batchCheck, quickCheck, isChecking } = useBatchPermissions();
  const [permissions, setPermissions] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    const checkPermissions = async () => {
      const results = await batchCheck([
        { action: Actions.CREATE, resource: ResourceTypes.COURSE },
        { action: Actions.UPDATE, resource: ResourceTypes.ORGANIZATION },
        { action: Actions.READ, resource: ResourceTypes.ANALYTICS },
        { action: Actions.DELETE, resource: ResourceTypes.USER },
      ]);

      setPermissions(results);
    };

    checkPermissions();
  }, [batchCheck]);

  const canCreateCourse = permissions.get('course:create') ?? false;
  const canUpdateOrg = permissions.get('organization:update') ?? false;

  return (
    <div>
      {canCreateCourse && <CreateCourseButton />}
      {canUpdateOrg && <OrgSettings />}
    </div>
  );
}
```

### Quick Check Pattern

For common resource action combinations:

```tsx
const { quickCheck } = useBatchPermissions();

const coursePermissions = await quickCheck(ResourceTypes.COURSE, [
  Actions.CREATE,
  Actions.UPDATE,
  Actions.DELETE,
]);

// Returns: { create: true, update: true, delete: false }
```

---

## Resource-Specific Permissions

Check permissions for a specific resource instance:

```tsx
import { useResourcePermission } from '@/hooks/useResourcePermission';
import { ResourceTypes } from '@/types/permissions';

function CourseDetailPage({ courseId }: { courseId: string }) {
  const { canUpdate, canDelete, isOwner, availableActions, loading } = useResourcePermission(
    ResourceTypes.COURSE,
    courseId,
  );

  if (loading) return <Skeleton />;

  return (
    <div>
      <h1>Course Details</h1>

      {isOwner && <Badge>Owner</Badge>}

      <div className="actions">
        {canUpdate && <Button>Edit Course</Button>}
        {canDelete && <Button variant="destructive">Delete</Button>}
      </div>

      <p>Available actions: {availableActions.join(', ')}</p>
    </div>
  );
}
```

---

## Role Management UI

### Role Hierarchy Tree

Display roles in a tree structure showing parent-child relationships:

```tsx
import { RoleHierarchyTree } from '@/components/Security/RoleHierarchyTree';

function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <h2>Role Hierarchy</h2>
        <RoleHierarchyTree
          roles={roles}
          onRoleSelect={setSelectedRole}
          selectedRoleId={selectedRole?.id}
          showPermissions={true}
        />
      </div>

      <div>{selectedRole && <RoleDetails role={selectedRole} />}</div>
    </div>
  );
}
```

### Permission Denied Component

Show user-friendly permission denial messages:

```tsx
import { PermissionDenied } from '@/components/Security/PermissionDenied';
import { Actions, ResourceTypes } from '@/types/permissions';

function RestrictedFeature() {
  const { can } = usePermission();

  if (!can(Actions.MANAGE, ResourceTypes.ORGANIZATION)) {
    return (
      <PermissionDenied
        action={Actions.MANAGE}
        resource={ResourceTypes.ORGANIZATION}
        requiredPermission="organization:manage:own"
        reason="You need to be an organization administrator"
      />
    );
  }

  return <FeatureContent />;
}
```

---

## Best Practices

### 1. **Use Scopes Correctly**

```tsx
// ✅ Good - Specific scope
can(Actions.UPDATE, ResourceTypes.COURSE, Scopes.OWN);

// ❌ Bad - Too permissive
can(Actions.UPDATE, ResourceTypes.COURSE, Scopes.ALL);
```

### 2. **Batch Checks for Performance**

```tsx
// ✅ Good - One API call
const results = await batchCheck([
  { action: Actions.CREATE, resource: ResourceTypes.COURSE },
  { action: Actions.UPDATE, resource: ResourceTypes.COURSE },
]);

// ❌ Bad - Multiple API calls
const canCreate = can(Actions.CREATE, ResourceTypes.COURSE);
const canUpdate = can(Actions.UPDATE, ResourceTypes.COURSE);
```

### 3. **Handle Loading States**

```tsx
// ✅ Good
const { can, isLoading } = usePermission();

if (isLoading) {
  return <Skeleton />;
}

return can(Actions.CREATE, ResourceTypes.COURSE) ? <Button /> : null;

// ❌ Bad - Shows/hides button during loading
return can(Actions.CREATE, ResourceTypes.COURSE) ? <Button /> : null;
```

### 4. **Use Resource Permissions for Instance Checks**

```tsx
// ✅ Good - Checks specific resource instance
const { canUpdate } = useResourcePermission(ResourceTypes.COURSE, courseId);

// ❌ Bad - Only checks general permission
const { can } = usePermission();
const canUpdate = can(Actions.UPDATE, ResourceTypes.COURSE);
```

### 5. **Provide Fallbacks**

```tsx
// ✅ Good - Clear feedback
<PermissionGuard
  action={Actions.UPDATE}
  resource={ResourceTypes.COURSE}
  fallback={<PermissionDenied ... />}
>
  <Content />
</PermissionGuard>

// ❌ Bad - Silent failure
{can(Actions.UPDATE, ResourceTypes.COURSE) && <Content />}
```

### 6. **Don't Hardcode Role Names**

```tsx
// ✅ Good - Use constants
import { RoleSlugs } from '@/types/permissions';
hasRole(RoleSlugs.ORG_ADMIN);

// ❌ Bad - Hardcoded string
hasRole('org-admin');
```

### 7. **Cache Permission Checks**

```tsx
// ✅ Good - Memoized
const canManageCourses = useMemo(() => can(Actions.MANAGE, ResourceTypes.COURSE), [can]);

// ❌ Bad - Recalculated on every render
const canManageCourses = can(Actions.MANAGE, ResourceTypes.COURSE);
```

---

## Common Patterns

### Admin-Only Section

```tsx
function AdminSection() {
  const { isAdmin } = usePermission();

  if (!isAdmin) return null;

  return <AdminContent />;
}
```

### Owner or Admin Check

```tsx
function CourseActions({ courseId, isOwner }: Props) {
  const { isAdmin } = usePermission();
  const { canUpdate } = useResourcePermission(ResourceTypes.COURSE, courseId);

  const canEdit = isAdmin || (isOwner && canUpdate);

  return canEdit ? <EditButton /> : null;
}
```

### Multi-Permission Form

```tsx
function ComplexForm() {
  const { batchCheck } = useBatchPermissions();
  const [perms, setPerms] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    batchCheck([
      { action: Actions.CREATE, resource: ResourceTypes.COURSE },
      { action: Actions.UPDATE, resource: ResourceTypes.ORGANIZATION },
      { action: Actions.INVITE, resource: ResourceTypes.USER },
    ]).then(setPerms);
  }, [batchCheck]);

  return (
    <Form>
      {perms.get('course:create') && <CourseSection />}
      {perms.get('organization:update') && <OrgSection />}
      {perms.get('user:invite') && <InviteSection />}
    </Form>
  );
}
```

---

## Migration from Old System

### Before (Legacy)

```tsx
// Old pattern - session-based
const userRole = session?.user?.role;
if (userRole?.rights?.courses?.action_create) {
  // Show create button
}
```

### After (New RBAC)

```tsx
// New pattern - API-based
const { can } = usePermission();
if (can(Actions.CREATE, ResourceTypes.COURSE)) {
  // Show create button
}
```

---

## Troubleshooting

### Permission Not Working

1. Check if user is authenticated
2. Verify permission exists in backend
3. Check scope (ALL vs ORG vs OWN)
4. Verify role has the permission assigned
5. Check browser console for errors

### Loading Takes Too Long

1. Use `useBatchPermissions` for multiple checks
2. Enable Redis caching in backend
3. Check network tab for slow API calls

### Permission Denied

1. Use `<PermissionDenied />` component for clear feedback
2. Check if permission is required vs optional
3. Verify user has correct role assigned
4. Check organization membership

---

## API Reference

See full API documentation in:

- [usePermission Hook](../hooks/usePermission.ts)
- [useResourcePermission Hook](../hooks/useResourcePermission.ts)
- [useBatchPermissions Hook](../hooks/useBatchPermissions.ts)
- [Permission Types](../types/permissions.ts)
