# RBAC System Migration Guide

## Overview

This guide helps developers migrate from the legacy rights-based RBAC system to the new
permission-based system.

---

## Quick Reference: Old vs New

### Permission Checks

| Old System                                            | New System                                  |
| ----------------------------------------------------- | ------------------------------------------- |
| `session?.user?.role?.rights?.courses?.action_create` | `can(Actions.CREATE, ResourceTypes.COURSE)` |
| `session?.user?.role?.rights?.users?.action_manage`   | `can(Actions.MANAGE, ResourceTypes.USER)`   |
| `session?.permissions?.['course:create']`             | `can(Actions.CREATE, ResourceTypes.COURSE)` |

### Role Identification

| Old System                              | New System                     |
| --------------------------------------- | ------------------------------ |
| `role.role_uuid === 'some-uuid'`        | `role.slug === 'org-admin'`    |
| `role.role_type === 'TYPE_GLOBAL'`      | `role.is_system === true`      |
| `session?.user?.role?.name === 'Admin'` | `hasRole(RoleSlugs.ORG_ADMIN)` |

### API Endpoints

| Old System                    | New System                 |
| ----------------------------- | -------------------------- |
| `/api/v1/roles-new`           | `/api/v1/roles`            |
| `/api/v1/permissions-new`     | `/api/v1/permissions`      |
| `/api/v1/user/{id}/roles-new` | `/api/v1/users/{id}/roles` |

---

## Migration Steps

### Step 1: Update Imports

#### Before

```tsx
import { useSession } from 'next-auth/react';

function MyComponent() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  // ...
}
```

#### After

```tsx
import { Actions, ResourceTypes } from '@/types/permissions';
import { usePermission } from '@/hooks/usePermission';

function MyComponent() {
  const { can, hasRole, isAdmin } = usePermission();
  // ...
}
```

---

### Step 2: Replace Permission Checks

#### Before - Nested Rights Object

```tsx
const canCreateCourse = session?.user?.role?.rights?.courses?.action_create;
const canUpdateCourse = session?.user?.role?.rights?.courses?.action_update;
const canDeleteCourse = session?.user?.role?.rights?.courses?.action_delete;

if (canCreateCourse) {
  return <CreateCourseButton />;
}
```

#### After - Permission Hook

```tsx
const { can } = usePermission();

const canCreateCourse = can(Actions.CREATE, ResourceTypes.COURSE);
const canUpdateCourse = can(Actions.UPDATE, ResourceTypes.COURSE);
const canDeleteCourse = can(Actions.DELETE, ResourceTypes.COURSE);

if (canCreateCourse) {
  return <CreateCourseButton />;
}
```

#### Even Better - Batch Check

```tsx
const { batchCheck } = useBatchPermissions();
const [perms, setPerms] = useState<Map<string, boolean>>(new Map());

useEffect(() => {
  batchCheck([
    { action: Actions.CREATE, resource: ResourceTypes.COURSE },
    { action: Actions.UPDATE, resource: ResourceTypes.COURSE },
    { action: Actions.DELETE, resource: ResourceTypes.COURSE },
  ]).then(setPerms);
}, [batchCheck]);

if (perms.get('course:create')) {
  return <CreateCourseButton />;
}
```

---

### Step 3: Update Role Checks

#### Before - UUID Comparison

```tsx
const ADMIN_ROLE_UUID = '550e8400-e29b-41d4-a716-446655440000';
const isAdmin = session?.user?.role?.role_uuid === ADMIN_ROLE_UUID;
```

#### After - Slug-Based Check

```tsx
import { RoleSlugs } from '@/types/permissions';

const { hasRole, isAdmin } = usePermission();
const isOrgAdmin = hasRole(RoleSlugs.ORG_ADMIN);
// or simply
const admin = isAdmin; // Checks both super-admin and org-admin
```

---

### Step 4: Update API Calls

#### Before - Old Endpoints

```tsx
const { data: roles } = useSWR('/api/v1/roles-new', fetcher);
const { data: permissions } = useSWR('/api/v1/permissions-new', fetcher);
```

#### After - New Endpoints

```tsx
const { data: roles } = useSWR('/api/v1/roles', fetcher);
const { data: permissions } = useSWR('/api/v1/permissions', fetcher);
```

---

### Step 5: Update Role References

#### Before - role_uuid Field

```tsx
<select value={selectedRoleId}>
  {roles.map((role) => (
    <option
      key={role.role_uuid}
      value={role.role_uuid}
    >
      {role.name}
    </option>
  ))}
</select>
```

#### After - slug Field

```tsx
<select value={selectedRoleSlug}>
  {roles.map((role) => (
    <option
      key={role.slug}
      value={role.slug}
    >
      {role.name}
    </option>
  ))}
</select>
```

---

### Step 6: Update System Role Detection

#### Before - role_type Enum

```tsx
function isSystemRole(role: any) {
  return role.role_type === 'TYPE_GLOBAL';
}
```

#### After - is_system Flag

```tsx
function isSystemRole(role: any) {
  const systemSlugs = ['super-admin', 'org-admin', 'instructor', 'student'];
  return role.is_system === true || systemSlugs.includes(role.slug);
}
```

---

## Common Migration Patterns

### Pattern 1: Admin-Only Components

#### Before

```tsx
function AdminPanel() {
  const { data: session } = useSession();
  const isAdmin =
    session?.user?.role?.name === 'Admin' || session?.user?.role?.name === 'Super Admin';

  if (!isAdmin) return null;

  return <div>Admin Content</div>;
}
```

#### After

```tsx
function AdminPanel() {
  const { isAdmin } = usePermission();

  if (!isAdmin) return null;

  return <div>Admin Content</div>;
}
```

---

### Pattern 2: Conditional Rendering

#### Before

```tsx
function CourseActions({ course }: Props) {
  const { data: session } = useSession();
  const canEdit = session?.user?.role?.rights?.courses?.action_update;
  const canDelete = session?.user?.role?.rights?.courses?.action_delete;

  return (
    <div>
      {canEdit && <Button>Edit</Button>}
      {canDelete && <Button variant="destructive">Delete</Button>}
    </div>
  );
}
```

#### After

```tsx
function CourseActions({ courseId }: Props) {
  const { canUpdate, canDelete } = useResourcePermission(ResourceTypes.COURSE, courseId);

  return (
    <div>
      {canUpdate && <Button>Edit</Button>}
      {canDelete && <Button variant="destructive">Delete</Button>}
    </div>
  );
}
```

---

### Pattern 3: Multiple Permission Checks

#### Before

```tsx
function Dashboard() {
  const { data: session } = useSession();

  const canCreateCourse = session?.user?.role?.rights?.courses?.action_create;
  const canManageUsers = session?.user?.role?.rights?.users?.action_manage;
  const canViewAnalytics = session?.user?.role?.rights?.analytics?.action_view;

  return (
    <div>
      {canCreateCourse && <CreateCourseWidget />}
      {canManageUsers && <UserManagementWidget />}
      {canViewAnalytics && <AnalyticsWidget />}
    </div>
  );
}
```

#### After - Efficient Batch Check

```tsx
function Dashboard() {
  const { batchCheck } = useBatchPermissions();
  const [perms, setPerms] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    batchCheck([
      { action: Actions.CREATE, resource: ResourceTypes.COURSE },
      { action: Actions.MANAGE, resource: ResourceTypes.USER },
      { action: Actions.READ, resource: ResourceTypes.ANALYTICS },
    ]).then(setPerms);
  }, [batchCheck]);

  return (
    <div>
      {perms.get('course:create') && <CreateCourseWidget />}
      {perms.get('user:manage') && <UserManagementWidget />}
      {perms.get('analytics:read') && <AnalyticsWidget />}
    </div>
  );
}
```

---

### Pattern 4: Owner Checks

#### Before - Manual Comparison

```tsx
function CourseEdit({ course }: Props) {
  const { data: session } = useSession();
  const isOwner = session?.user?.id === course.owner_id;
  const canEdit = isOwner || session?.user?.role?.rights?.courses?.action_update;

  if (!canEdit) {
    return <div>Access Denied</div>;
  }

  return <CourseEditForm course={course} />;
}
```

#### After - Resource Permission Hook

```tsx
function CourseEdit({ courseId }: Props) {
  const { canUpdate, isOwner } = useResourcePermission(ResourceTypes.COURSE, courseId);

  if (!canUpdate) {
    return (
      <PermissionDenied
        action={Actions.UPDATE}
        resource={ResourceTypes.COURSE}
      />
    );
  }

  return <CourseEditForm courseId={courseId} />;
}
```

---

### Pattern 5: Form Field Permissions

#### Before

```tsx
function CourseForm({ course }: Props) {
  const { data: session } = useSession();
  const canPublish = session?.user?.role?.rights?.courses?.action_publish;
  const canSetPrice = session?.user?.role?.rights?.courses?.action_manage_pricing;

  return (
    <Form>
      <Input name="title" />
      <Input name="description" />

      {canPublish && (
        <Checkbox
          name="published"
          label="Publish Course"
        />
      )}

      {canSetPrice && (
        <Input
          name="price"
          type="number"
          label="Price"
        />
      )}
    </Form>
  );
}
```

#### After

```tsx
function CourseForm({ courseId }: Props) {
  const { can } = useResourcePermission(ResourceTypes.COURSE, courseId);

  const canPublish = can('publish');
  const canSetPrice = can('manage_pricing');

  return (
    <Form>
      <Input name="title" />
      <Input name="description" />

      {canPublish && (
        <Checkbox
          name="published"
          label="Publish Course"
        />
      )}

      {canSetPrice && (
        <Input
          name="price"
          type="number"
          label="Price"
        />
      )}
    </Form>
  );
}
```

---

## Breaking Changes

### 1. Session No Longer Contains Permissions

**Old Behavior:**

```tsx
const permissions = session?.permissions;
const roles = session?.roles;
```

**New Behavior:**

```tsx
// Session does NOT contain permissions
// Use hooks instead:
const { permissions } = usePermission();
```

### 2. Role UUIDs Replaced with Slugs

**Old Behavior:**

```tsx
const roleId = role.role_uuid; // UUID string
```

**New Behavior:**

```tsx
const roleId = role.slug; // Human-readable slug
```

### 3. API Endpoint Changes

**Old Endpoints:**

- `/api/v1/roles-new`
- `/api/v1/permissions-new`

**New Endpoints:**

- `/api/v1/roles`
- `/api/v1/permissions`

### 4. Role Type Enum Removed

**Old Behavior:**

```tsx
if (role.role_type === 'TYPE_GLOBAL') {
  // System role
}
```

**New Behavior:**

```tsx
if (role.is_system) {
  // System role
}
```

---

## Deprecation Timeline

| Feature               | Deprecated | Removal Date |
| --------------------- | ---------- | ------------ |
| `session.permissions` | ✅         | Immediate    |
| `session.roles`       | ✅         | Immediate    |
| `role.role_uuid`      | ✅         | Immediate    |
| `role.role_type` enum | ✅         | Immediate    |
| `role.rights` JSON    | ✅         | Immediate    |
| `/api/v1/roles-new`   | ✅         | Immediate    |

All deprecated features have been removed. No backward compatibility.

---

## Testing Your Migration

### 1. Check for Session Permission Usage

Search your codebase for:

```bash
grep -r "session?.permissions" apps/web/
grep -r "session?.roles" apps/web/
```

Replace all instances with `usePermission()` hook.

### 2. Check for role_uuid Usage

Search your codebase for:

```bash
grep -r "role_uuid" apps/web/
```

Replace with `role.slug`.

### 3. Check for Old API Endpoints

Search your codebase for:

```bash
grep -r "roles-new" apps/web/
grep -r "permissions-new" apps/web/
```

Replace with new endpoints.

### 4. Check for role.rights Usage

Search your codebase for:

```bash
grep -r "role?.rights" apps/web/
grep -r "role.rights" apps/web/
```

Replace with `can()` checks.

---

## Troubleshooting

### Issue: "Permissions not loading"

**Solution:** Make sure you're using `usePermission()` hook, not reading from session:

```tsx
// ❌ Wrong
const { data: session } = useSession();
const canCreate = session?.permissions?.['course:create'];

// ✅ Correct
const { can } = usePermission();
const canCreate = can(Actions.CREATE, ResourceTypes.COURSE);
```

---

### Issue: "Role not found"

**Solution:** Use slug instead of UUID:

```tsx
// ❌ Wrong
const role = roles.find((r) => r.role_uuid === 'some-uuid');

// ✅ Correct
const role = roles.find((r) => r.slug === 'org-admin');
```

---

### Issue: "API endpoint 404"

**Solution:** Update to new endpoints:

```tsx
// ❌ Wrong
const { data } = useSWR('/api/v1/roles-new', fetcher);

// ✅ Correct
const { data } = useSWR('/api/v1/roles', fetcher);
```

---

### Issue: "Too many API calls"

**Solution:** Use `useBatchPermissions` for multiple checks:

```tsx
// ❌ Wrong - Multiple hooks, multiple API calls
const { can: canCreate } = usePermission();
const { can: canUpdate } = usePermission();
const { can: canDelete } = usePermission();

// ✅ Correct - One API call
const { batchCheck } = useBatchPermissions();
const perms = await batchCheck([...]);
```

---

## Migration Checklist

- [ ] Remove all `session?.permissions` references
- [ ] Remove all `session?.roles` references
- [ ] Replace all `role.role_uuid` with `role.slug`
- [ ] Replace all `role.role_type` checks with `role.is_system`
- [ ] Update all API endpoints (remove `-new` suffix)
- [ ] Replace `role.rights` checks with `can()` method
- [ ] Add `usePermission()` hook to components
- [ ] Use `useBatchPermissions()` for multiple checks
- [ ] Use `useResourcePermission()` for resource-specific checks
- [ ] Add `PermissionDenied` component for better UX
- [ ] Test all permission-gated features
- [ ] Run full test suite
- [ ] Update documentation

---

## Getting Help

- **Developer Guide**: [RBAC_DEVELOPER_GUIDE.md](./RBAC_DEVELOPER_GUIDE.md)
- **Testing Plan**: [RBAC_TESTING_PLAN.md](./RBAC_TESTING_PLAN.md)
- **Refactoring Plan**:
  [../plans/RBAC System Frontend Refactoring Plan.md](../../../plans/RBAC%20System%20Frontend%20Refactoring%20Plan.md)

---

## Examples from Codebase

### Example 1: Updated OrgRoles Component

**Before:**

```tsx
function isSystemRole(role: any) {
  return role.role_type === 'TYPE_GLOBAL';
}
```

**After:**

```tsx
function isSystemRole(role: any) {
  const systemRoleSlugs = ['super-admin', 'org-admin', 'instructor', 'student'];
  return role.is_system === true || systemRoleSlugs.includes(role.slug);
}
```

---

### Example 2: Updated RolesUpdate Component

**Before:**

```tsx
roles.map((role: any) => ({
  value: role.role_uuid || role.id.toString(),
  label: role.name,
}));
```

**After:**

```tsx
roles.map((role: any) => ({
  value: role.slug || role.id.toString(),
  label: role.name,
}));
```

---

### Example 3: Updated usePermission Hook

**Before:**

```tsx
const permissions = useMemo(() => {
  if (permissionsData?.permissions) {
    return permissionsData.permissions;
  }
  // Fallback to session permissions
  return session?.permissions ?? {};
}, [permissionsData, session]);
```

**After:**

```tsx
const permissions = useMemo(
  () => permissionsData?.permissions ?? {},
  [permissionsData?.permissions],
);
```

---

## Summary

The new RBAC system provides:

✅ **Better Performance** - Batch permission checks, caching ✅ **Type Safety** - TypeScript enums
for actions/resources ✅ **Better UX** - Clear permission denial messages ✅ **Scalability** - Role
hierarchy with inheritance ✅ **Consistency** - Single source of truth (API) ✅ **Security** - No
client-side permission storage

Follow this guide to migrate your code and enjoy these benefits!
