# RBAC System Testing Plan

## Overview

This document outlines the testing strategy for the new RBAC (Role-Based Access Control) system.

## Test Categories

1. [Unit Tests](#unit-tests)
2. [Integration Tests](#integration-tests)
3. [E2E Tests](#e2e-tests)
4. [Performance Tests](#performance-tests)

---

## Unit Tests

### Permission Hooks

#### `usePermission.test.tsx`

```tsx
import { Actions, ResourceTypes, Scopes } from '@/types/permissions';
import { usePermission } from '@/hooks/usePermission';
import { renderHook } from '@testing-library/react';

describe('usePermission', () => {
  it('should check basic permission', () => {
    const { result } = renderHook(() => usePermission());

    expect(result.current.can(Actions.CREATE, ResourceTypes.COURSE)).toBe(true);
  });

  it('should respect scopes', () => {
    const { result } = renderHook(() => usePermission());

    // User can create in org
    expect(result.current.can(Actions.CREATE, ResourceTypes.COURSE, Scopes.ORG)).toBe(true);

    // But not globally
    expect(result.current.can(Actions.CREATE, ResourceTypes.COURSE, Scopes.ALL)).toBe(false);
  });

  it('should check multiple permissions with canAll', () => {
    const { result } = renderHook(() => usePermission());

    const hasAllPerms = result.current.canAll([
      { action: Actions.CREATE, resource: ResourceTypes.COURSE },
      { action: Actions.UPDATE, resource: ResourceTypes.COURSE },
    ]);

    expect(hasAllPerms).toBe(true);
  });

  it('should check multiple permissions with canAny', () => {
    const { result } = renderHook(() => usePermission());

    const hasAnyPerm = result.current.canAny([
      { action: Actions.MANAGE, resource: ResourceTypes.ORGANIZATION },
      { action: Actions.UPDATE, resource: ResourceTypes.COURSE },
    ]);

    expect(hasAnyPerm).toBe(true);
  });

  it('should identify admin roles', () => {
    const { result } = renderHook(() => usePermission());

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isSuperAdmin).toBe(false);
    expect(result.current.isOrgAdmin).toBe(true);
  });

  it('should handle loading state', () => {
    const { result } = renderHook(() => usePermission());

    expect(result.current.isLoading).toBe(false);
  });
});
```

#### `useResourcePermission.test.tsx`

```tsx
import { useResourcePermission } from '@/hooks/useResourcePermission';
import { renderHook, waitFor } from '@testing-library/react';
import { ResourceTypes } from '@/types/permissions';

describe('useResourcePermission', () => {
  it('should fetch resource permissions', async () => {
    const { result } = renderHook(() => useResourcePermission(ResourceTypes.COURSE, 'course-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.canRead).toBe(true);
    expect(result.current.canUpdate).toBe(true);
  });

  it('should identify resource owner', async () => {
    const { result } = renderHook(() =>
      useResourcePermission(ResourceTypes.COURSE, 'owned-course'),
    );

    await waitFor(() => {
      expect(result.current.isOwner).toBe(true);
    });
  });

  it('should provide available actions', async () => {
    const { result } = renderHook(() => useResourcePermission(ResourceTypes.COURSE, 'course-123'));

    await waitFor(() => {
      expect(result.current.availableActions).toContain('read');
      expect(result.current.availableActions).toContain('update');
    });
  });

  it('should support custom action checks', async () => {
    const { result } = renderHook(() => useResourcePermission(ResourceTypes.COURSE, 'course-123'));

    await waitFor(() => {
      const canPublish = result.current.can('publish');
      expect(canPublish).toBe(true);
    });
  });
});
```

#### `useBatchPermissions.test.tsx`

```tsx
import { useBatchPermissions } from '@/hooks/useBatchPermissions';
import { renderHook, waitFor } from '@testing-library/react';
import { Actions, ResourceTypes } from '@/types/permissions';

describe('useBatchPermissions', () => {
  it('should batch check multiple permissions', async () => {
    const { result } = renderHook(() => useBatchPermissions());

    const permissions = await result.current.batchCheck([
      { action: Actions.CREATE, resource: ResourceTypes.COURSE },
      { action: Actions.UPDATE, resource: ResourceTypes.COURSE },
      { action: Actions.DELETE, resource: ResourceTypes.COURSE },
    ]);

    expect(permissions.get('course:create')).toBe(true);
    expect(permissions.get('course:update')).toBe(true);
    expect(permissions.get('course:delete')).toBe(false);
  });

  it('should use quickCheck pattern', async () => {
    const { result } = renderHook(() => useBatchPermissions());

    const perms = await result.current.quickCheck(ResourceTypes.COURSE, [
      Actions.CREATE,
      Actions.UPDATE,
      Actions.DELETE,
    ]);

    expect(perms.create).toBe(true);
    expect(perms.update).toBe(true);
    expect(perms.delete).toBe(false);
  });

  it('should handle empty batch', async () => {
    const { result } = renderHook(() => useBatchPermissions());

    const permissions = await result.current.batchCheck([]);

    expect(permissions.size).toBe(0);
  });
});
```

### Components

#### `PermissionDenied.test.tsx`

```tsx
import { PermissionDenied } from '@/components/Security/PermissionDenied';
import { Actions, ResourceTypes } from '@/types/permissions';
import { render, screen } from '@testing-library/react';

describe('PermissionDenied', () => {
  it('should render denial message', () => {
    render(
      <PermissionDenied
        action={Actions.CREATE}
        resource={ResourceTypes.COURSE}
      />,
    );

    expect(screen.getByText(/Permission Denied/i)).toBeInTheDocument();
    expect(screen.getByText(/Create Course/i)).toBeInTheDocument();
  });

  it('should show required permission', () => {
    render(
      <PermissionDenied
        action={Actions.CREATE}
        resource={ResourceTypes.COURSE}
        requiredPermission="course:create:org"
      />,
    );

    expect(screen.getByText(/course:create:org/i)).toBeInTheDocument();
  });

  it('should show custom reason', () => {
    render(
      <PermissionDenied
        action={Actions.CREATE}
        resource={ResourceTypes.COURSE}
        reason="Custom denial reason"
      />,
    );

    expect(screen.getByText(/Custom denial reason/i)).toBeInTheDocument();
  });

  it('should show admin link for admins', () => {
    // Mock usePermission to return isAdmin: true
    render(
      <PermissionDenied
        action={Actions.CREATE}
        resource={ResourceTypes.COURSE}
      />,
    );

    expect(screen.getByText(/Manage Roles/i)).toBeInTheDocument();
  });
});
```

#### `RoleHierarchyTree.test.tsx`

```tsx
import { RoleHierarchyTree } from '@/components/Security/RoleHierarchyTree';
import { render, screen, fireEvent } from '@testing-library/react';

describe('RoleHierarchyTree', () => {
  const mockRoles = [
    {
      id: 1,
      slug: 'super-admin',
      name: 'Super Admin',
      parent_role_id: null,
      is_system: true,
      permissions_count: 100,
    },
    {
      id: 2,
      slug: 'org-admin',
      name: 'Organization Admin',
      parent_role_id: 1,
      is_system: true,
      permissions_count: 50,
    },
    {
      id: 3,
      slug: 'instructor',
      name: 'Instructor',
      parent_role_id: 2,
      is_system: false,
      permissions_count: 25,
    },
  ];

  it('should render role tree', () => {
    render(<RoleHierarchyTree roles={mockRoles} />);

    expect(screen.getByText('Super Admin')).toBeInTheDocument();
    expect(screen.getByText('Organization Admin')).toBeInTheDocument();
    expect(screen.getByText('Instructor')).toBeInTheDocument();
  });

  it('should show permission counts', () => {
    render(
      <RoleHierarchyTree
        roles={mockRoles}
        showPermissions={true}
      />,
    );

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('should expand/collapse nodes', () => {
    render(<RoleHierarchyTree roles={mockRoles} />);

    const expandButton = screen.getAllByRole('button')[0];
    fireEvent.click(expandButton);

    // Should show child roles
    expect(screen.getByText('Organization Admin')).toBeVisible();
  });

  it('should handle role selection', () => {
    const onSelect = jest.fn();
    render(
      <RoleHierarchyTree
        roles={mockRoles}
        onRoleSelect={onSelect}
      />,
    );

    const roleNode = screen.getByText('Instructor');
    fireEvent.click(roleNode);

    expect(onSelect).toHaveBeenCalledWith(mockRoles[2]);
  });

  it('should highlight selected role', () => {
    render(
      <RoleHierarchyTree
        roles={mockRoles}
        selectedRoleId={2}
      />,
    );

    const selectedNode = screen.getByText('Organization Admin').closest('div');
    expect(selectedNode).toHaveClass('border-primary');
  });
});
```

---

## Integration Tests

### Role Management Flow

```tsx
describe('Role Management Integration', () => {
  it('should create new role with permissions', async () => {
    // 1. Navigate to roles page
    const user = userEvent.setup();
    render(<RolesPage />);

    // 2. Click create role
    await user.click(screen.getByText('Create Role'));

    // 3. Fill form
    await user.type(screen.getByLabelText('Role Name'), 'Content Manager');
    await user.selectOptions(screen.getByLabelText('Parent Role'), 'instructor');

    // 4. Select permissions
    await user.click(screen.getByLabelText('course:create'));
    await user.click(screen.getByLabelText('course:update'));

    // 5. Submit
    await user.click(screen.getByText('Create'));

    // 6. Verify success
    await waitFor(() => {
      expect(screen.getByText('Content Manager')).toBeInTheDocument();
    });
  });

  it('should prevent circular hierarchy', async () => {
    const user = userEvent.setup();
    render(<RoleEditForm roleId="instructor" />);

    // Try to set child role as parent
    const parentSelect = screen.getByLabelText('Parent Role');
    const childOption = screen.queryByText('Student');

    // Child should not be available as parent
    expect(childOption).not.toBeInTheDocument();
  });

  it('should inherit parent permissions', async () => {
    render(<RoleHierarchyTree roles={mockRoles} />);

    // Expand tree
    const orgAdminNode = screen.getByText('Organization Admin');
    fireEvent.click(orgAdminNode);

    // Check inherited permissions indicator
    expect(screen.getByText(/Inherits \d+ permissions/i)).toBeInTheDocument();
  });
});
```

### Permission Check Flow

```tsx
describe('Permission Checks Integration', () => {
  it('should enforce permissions on course creation', async () => {
    // Mock user without create permission
    mockUser({ permissions: { 'course:read': true } });

    render(<CoursesPage />);

    // Create button should not be visible
    expect(screen.queryByText('Create Course')).not.toBeInTheDocument();

    // Should show permission denied if accessing directly
    render(<CreateCoursePage />);
    expect(screen.getByText(/Permission Denied/i)).toBeInTheDocument();
  });

  it('should show/hide actions based on resource permissions', async () => {
    mockUser({ id: 'user-123' });
    mockCourse({ id: 'course-1', owner_id: 'user-123' });

    render(<CourseDetailPage courseId="course-1" />);

    await waitFor(() => {
      // Owner should see edit button
      expect(screen.getByText('Edit Course')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  it('should batch check permissions efficiently', async () => {
    const apiSpy = jest.spyOn(api, 'post');

    render(<DashboardPage />);

    await waitFor(() => {
      // Should make only ONE API call for all permission checks
      expect(apiSpy).toHaveBeenCalledTimes(1);
      expect(apiSpy).toHaveBeenCalledWith('/permissions/batch', {
        checks: expect.arrayContaining([
          { action: 'create', resource: 'course' },
          { action: 'update', resource: 'organization' },
        ]),
      });
    });
  });
});
```

---

## E2E Tests

### User Role Assignment

```tsx
// tests/e2e/role-assignment.spec.ts

test('admin can assign roles to users', async ({ page }) => {
  // Login as org admin
  await page.goto('/auth/signin');
  await page.fill('[name="email"]', 'admin@test.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Navigate to users page
  await page.goto('/orgs/test-org/dash/admin/users');

  // Select user
  await page.click('text=John Doe');

  // Open roles dialog
  await page.click('text=Manage Roles');

  // Assign instructor role
  await page.selectOption('[name="role"]', 'instructor');
  await page.click('text=Assign Role');

  // Verify assignment
  await expect(page.locator('text=Instructor')).toBeVisible();
});
```

### Permission Enforcement

```tsx
test('non-admin cannot access admin pages', async ({ page }) => {
  // Login as regular user
  await page.goto('/auth/signin');
  await page.fill('[name="email"]', 'user@test.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Try to access admin page
  await page.goto('/orgs/test-org/dash/admin/roles');

  // Should show permission denied
  await expect(page.locator('text=Permission Denied')).toBeVisible();
});
```

### Role Hierarchy Management

```tsx
test('admin can create role hierarchy', async ({ page }) => {
  await loginAsAdmin(page);

  // Create parent role
  await page.goto('/orgs/test-org/dash/admin/roles');
  await page.click('text=Create Role');
  await page.fill('[name="name"]', 'Content Manager');
  await page.click('text=Create');

  // Create child role
  await page.click('text=Create Role');
  await page.fill('[name="name"]', 'Course Author');
  await page.selectOption('[name="parent_role"]', 'content-manager');
  await page.click('text=Create');

  // Verify hierarchy in tree view
  await page.click('text=View Hierarchy');

  const tree = page.locator('[data-testid="role-tree"]');
  await expect(tree.locator('text=Content Manager')).toBeVisible();
  await expect(tree.locator('text=Course Author')).toBeVisible();

  // Expand to see child
  await tree.locator('text=Content Manager').click();
  const childNode = tree.locator('text=Course Author');
  await expect(childNode).toBeVisible();
});
```

---

## Performance Tests

### Batch Permission Loading

```tsx
test('batch permissions should load in < 500ms', async () => {
  const startTime = Date.now();

  const { result } = renderHook(() => useBatchPermissions());

  const permissions = await result.current.batchCheck([
    { action: Actions.CREATE, resource: ResourceTypes.COURSE },
    { action: Actions.UPDATE, resource: ResourceTypes.COURSE },
    { action: Actions.DELETE, resource: ResourceTypes.COURSE },
    { action: Actions.READ, resource: ResourceTypes.ANALYTICS },
    { action: Actions.MANAGE, resource: ResourceTypes.ORGANIZATION },
  ]);

  const duration = Date.now() - startTime;

  expect(duration).toBeLessThan(500);
  expect(permissions.size).toBe(5);
});
```

### Permission Cache Effectiveness

```tsx
test('permission hook should cache results', async () => {
  const apiSpy = jest.spyOn(api, 'get');

  const { result, rerender } = renderHook(() => usePermission());

  // First render - should call API
  expect(apiSpy).toHaveBeenCalledTimes(1);

  // Rerender - should use cache
  rerender();
  expect(apiSpy).toHaveBeenCalledTimes(1);

  // Wait for cache to expire (30 seconds)
  jest.advanceTimersByTime(31000);
  rerender();

  // Should call API again
  expect(apiSpy).toHaveBeenCalledTimes(2);
});
```

### Large Role Hierarchy Rendering

```tsx
test('should render 100+ roles efficiently', async () => {
  const largeRoleSet = Array.from({ length: 150 }, (_, i) => ({
    id: i,
    slug: `role-${i}`,
    name: `Role ${i}`,
    parent_role_id: i > 0 ? Math.floor(i / 3) : null,
    is_system: false,
    permissions_count: Math.floor(Math.random() * 50),
  }));

  const startTime = Date.now();

  render(<RoleHierarchyTree roles={largeRoleSet} />);

  const renderTime = Date.now() - startTime;

  expect(renderTime).toBeLessThan(1000); // Should render in < 1 second
});
```

---

## Test Data

### Mock Users

```tsx
export const mockUsers = {
  superAdmin: {
    id: 'user-1',
    email: 'super@test.com',
    roles: ['super-admin'],
    permissions: { '*:*:*': true },
  },
  orgAdmin: {
    id: 'user-2',
    email: 'admin@test.com',
    roles: ['org-admin'],
    permissions: {
      'course:*:org': true,
      'user:*:org': true,
      'organization:*:own': true,
    },
  },
  instructor: {
    id: 'user-3',
    email: 'instructor@test.com',
    roles: ['instructor'],
    permissions: {
      'course:create:org': true,
      'course:update:own': true,
      'course:read:org': true,
    },
  },
  student: {
    id: 'user-4',
    email: 'student@test.com',
    roles: ['student'],
    permissions: {
      'course:read:org': true,
      'submission:create:own': true,
    },
  },
};
```

### Mock Roles

```tsx
export const mockRoles = [
  {
    id: 1,
    slug: 'super-admin',
    name: 'Super Admin',
    parent_role_id: null,
    is_system: true,
    permissions_count: 100,
  },
  {
    id: 2,
    slug: 'org-admin',
    name: 'Organization Admin',
    parent_role_id: 1,
    is_system: true,
    permissions_count: 50,
  },
  {
    id: 3,
    slug: 'instructor',
    name: 'Instructor',
    parent_role_id: 2,
    is_system: false,
    permissions_count: 25,
  },
  {
    id: 4,
    slug: 'student',
    name: 'Student',
    parent_role_id: null,
    is_system: true,
    permissions_count: 10,
  },
];
```

---

## Coverage Goals

- **Unit Tests**: 90%+ coverage of hooks and components
- **Integration Tests**: All major user flows
- **E2E Tests**: Critical paths (role assignment, permission checks)
- **Performance Tests**: Key operations under load

---

## Running Tests

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests with coverage
npm run test:coverage

# Performance tests
npm run test:perf
```

---

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: RBAC Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run unit tests
        run: npm run test:coverage

      - name: Run integration tests
        run: npm run test:integration

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Next Steps

1. Implement unit tests for all hooks
2. Add integration tests for role management
3. Create E2E test suite for permission flows
4. Set up performance benchmarks
5. Achieve 90%+ test coverage
6. Integrate with CI/CD pipeline
