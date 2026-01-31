'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, Edit, Lock, Plus, Search, Shield, Trash2, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { PermissionGuard } from '@/components/Security/PermissionGuard';
import { Actions, ResourceTypes } from '@/types/permissions';
import { useOrg } from '@components/Contexts/OrgContext';
import { usePermission } from '@/hooks/usePermission';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { getAPIUrl } from '@services/config/config';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Role {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  org_id: number | null;
  parent_role_id: number | null;
  is_system: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

interface Permission {
  id: number;
  name: string;
  resource_type: string;
  action: string;
  scope: string;
  description: string | null;
  created_at: string;
}

interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export default function RBACAdminClient() {
  const org = useOrg() as { id: number } | null;
  const session = usePlatformSession();
  const { can } = usePermission();

  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleWithPermissions | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);

  const accessToken = session?.data?.tokens?.access_token;

  // Fetch roles and permissions
  useEffect(() => {
    const fetchData = async () => {
      if (!accessToken || !org?.id) return;

      try {
        setLoading(true);
        const [rolesRes, permsRes] = await Promise.all([
          fetch(`${getAPIUrl()}roles?org_id=${org.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch(`${getAPIUrl()}permissions`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ]);

        if (rolesRes.ok) {
          const rolesData = await rolesRes.json();
          setRoles(rolesData);
        }

        if (permsRes.ok) {
          const permsData = await permsRes.json();
          setPermissions(permsData);
        }
      } catch (error) {
        console.error('Failed to fetch RBAC data:', error);
        toast.error('Failed to load roles and permissions');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [accessToken, org?.id]);

  // Filter roles by search
  const filteredRoles = roles.filter(
    (role) =>
      role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      role.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      role.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Group permissions by resource
  const permissionsByResource = permissions.reduce(
    (acc, perm) => {
      if (!acc[perm.resource_type]) {
        acc[perm.resource_type] = [];
      }
      acc[perm.resource_type]!.push(perm);
      return acc;
    },
    {} as Record<string, Permission[]>,
  );

  const handleCreateRole = async (data: {
    name: string;
    slug: string;
    description: string;
    parent_role_id?: number | null;
  }) => {
    if (!accessToken || !org?.id) return;

    try {
      const res = await fetch(`${getAPIUrl()}roles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          org_id: org.id,
          parent_role_id: data.parent_role_id || null,
        }),
      });

      if (res.ok) {
        const newRole = await res.json();
        setRoles([...roles, { ...newRole, permissions: [] }]);
        toast.success('Role created successfully');
        setIsEditDialogOpen(false);
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Failed to create role');
      }
    } catch (error) {
      console.error('Failed to create role:', error);
      toast.error('Failed to create role');
    }
  };

  const handleUpdateRole = async (
    roleId: number,
    data: { name: string; description: string; parent_role_id?: number | null },
  ) => {
    if (!accessToken) return;

    try {
      const res = await fetch(`${getAPIUrl()}roles/${roleId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const updatedRole = await res.json();
        setRoles(roles.map((r) => (r.id === roleId ? { ...r, ...updatedRole } : r)));
        toast.success('Role updated successfully');
        setIsEditDialogOpen(false);
        setSelectedRole(null);
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Failed to update role');
      }
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId: number) => {
    if (!accessToken) return;

    if (!confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`${getAPIUrl()}roles/${roleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        setRoles(roles.filter((r) => r.id !== roleId));
        toast.success('Role deleted successfully');
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Failed to delete role');
      }
    } catch (error) {
      console.error('Failed to delete role:', error);
      toast.error('Failed to delete role');
    }
  };

  const handleTogglePermission = async (roleId: number, permissionId: number, hasPermission: boolean) => {
    if (!accessToken) return;

    try {
      const endpoint = hasPermission
        ? `${getAPIUrl()}roles/${roleId}/permissions/${permissionId}`
        : `${getAPIUrl()}roles/${roleId}/permissions`;

      const res = await fetch(endpoint, {
        method: hasPermission ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        ...(hasPermission ? {} : { body: JSON.stringify({ permission_id: permissionId }) }),
      });

      if (res.ok) {
        // Refresh the role's permissions
        const roleRes = await fetch(`${getAPIUrl()}roles/${roleId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (roleRes.ok) {
          const updatedRole = await roleRes.json();
          setRoles(roles.map((r) => (r.id === roleId ? updatedRole : r)));
          setSelectedRole(updatedRole);
        }

        toast.success(hasPermission ? 'Permission removed' : 'Permission added');
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Failed to update permission');
      }
    } catch (error) {
      console.error('Failed to toggle permission:', error);
      toast.error('Failed to update permission');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Access Control</h1>
          <p className="text-muted-foreground">Manage roles and permissions for your organization</p>
        </div>
        <PermissionGuard
          action={Actions.CREATE}
          resource={ResourceTypes.ROLE}
        >
          <Dialog
            open={isEditDialogOpen && !selectedRole}
            onOpenChange={(open) => {
              setIsEditDialogOpen(open);
              if (!open) setSelectedRole(null);
            }}
          >
            <DialogTrigger
              render={
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Role
                </Button>
              }
            />
            <DialogContent>
              <RoleEditForm
                onSubmit={handleCreateRole}
                onCancel={() => setIsEditDialogOpen(false)}
                availableRoles={roles}
              />
            </DialogContent>
          </Dialog>
        </PermissionGuard>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
            <Shield className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
            <p className="text-muted-foreground text-xs">
              {roles.filter((r) => r.is_system).length} system, {roles.filter((r) => !r.is_system).length} custom
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Permissions</CardTitle>
            <Lock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{permissions.length}</div>
            <p className="text-muted-foreground text-xs">
              Across {Object.keys(permissionsByResource).length} resource types
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resource Types</CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(permissionsByResource).length}</div>
            <p className="text-muted-foreground text-xs">course, user, organization, ...</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        defaultValue="roles"
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        {/* Roles Tab */}
        <TabsContent
          value="roles"
          className="space-y-4"
        >
          <div className="flex items-center gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
              <Input
                placeholder="Search roles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{role.name}</div>
                        {role.description && <div className="text-muted-foreground text-sm">{role.description}</div>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted rounded px-1.5 py-0.5 text-sm">{role.slug}</code>
                    </TableCell>
                    <TableCell>
                      {role.is_system ? (
                        <Badge variant="secondary">System</Badge>
                      ) : (
                        <Badge variant="outline">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell>{role.priority}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedRole(role);
                          setIsPermissionsDialogOpen(true);
                        }}
                      >
                        {role.permissions?.length || 0} permissions
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <PermissionGuard
                          action={Actions.UPDATE}
                          resource={ResourceTypes.ROLE}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={role.is_system}
                            onClick={() => {
                              setSelectedRole(role);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard
                          action={Actions.DELETE}
                          resource={ResourceTypes.ROLE}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={role.is_system}
                            onClick={() => handleDeleteRole(role.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </PermissionGuard>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent
          value="permissions"
          className="space-y-4"
        >
          <Card>
            <CardHeader>
              <CardTitle>All Permissions</CardTitle>
              <CardDescription>These are the system permissions available to assign to roles.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(permissionsByResource).map(([resourceType, perms]) => (
                  <div key={resourceType}>
                    <h3 className="mb-2 flex items-center gap-2 font-semibold">
                      <Badge variant="outline">{resourceType}</Badge>
                      <span className="text-muted-foreground text-sm">({perms.length} permissions)</span>
                    </h3>
                    <div className="ml-4 grid gap-2">
                      {perms.map((perm) => (
                        <div
                          key={perm.id}
                          className="flex items-center justify-between rounded border p-2"
                        >
                          <div>
                            <code className="text-sm">{perm.name}</code>
                            {perm.description && <p className="text-muted-foreground text-xs">{perm.description}</p>}
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="secondary">{perm.action}</Badge>
                            <Badge variant="outline">{perm.scope}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Role Dialog */}
      {selectedRole && (
        <Dialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) setSelectedRole(null);
          }}
        >
          <DialogContent>
            <RoleEditForm
              role={selectedRole}
              onSubmit={(data) => handleUpdateRole(selectedRole.id, data)}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setSelectedRole(null);
              }}
              availableRoles={roles}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Permissions Assignment Dialog */}
      {selectedRole && (
        <Dialog
          open={isPermissionsDialogOpen}
          onOpenChange={(open) => {
            setIsPermissionsDialogOpen(open);
            if (!open) setSelectedRole(null);
          }}
        >
          <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Permissions - {selectedRole.name}</DialogTitle>
              <DialogDescription>Toggle permissions for this role. Changes are saved automatically.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {Object.entries(permissionsByResource).map(([resourceType, perms]) => (
                <div
                  key={resourceType}
                  className="space-y-2"
                >
                  <h4 className="flex items-center gap-2 font-medium">
                    <Badge variant="outline">{resourceType}</Badge>
                  </h4>
                  <div className="ml-4 grid gap-2">
                    {perms.map((perm) => {
                      const hasPermission = selectedRole.permissions?.some((p) => p.id === perm.id);
                      return (
                        <div
                          key={perm.id}
                          className="flex items-center justify-between rounded border p-2"
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={`perm-${perm.id}`}
                              checked={hasPermission}
                              disabled={selectedRole.is_system}
                              onCheckedChange={() =>
                                handleTogglePermission(selectedRole.id, perm.id, Boolean(hasPermission))
                              }
                            />
                            <label
                              htmlFor={`perm-${perm.id}`}
                              className="cursor-pointer text-sm"
                            >
                              {perm.name}
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <Badge
                              variant="secondary"
                              className="text-xs"
                            >
                              {perm.action}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-xs"
                            >
                              {perm.scope}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsPermissionsDialogOpen(false)}
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Role Edit Form Component
function RoleEditForm({
  role,
  onSubmit,
  onCancel,
  availableRoles,
}: {
  role?: Role;
  onSubmit: (data: { name: string; slug: string; description: string; parent_role_id?: number | null }) => void;
  onCancel: () => void;
  availableRoles?: Role[];
}) {
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [parentRoleId, setParentRoleId] = useState<number | null>(role?.parent_role_id || null);

  // Auto-generate slug from name (derived value)
  const autoSlug = role
    ? role.slug
    : name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
  const [slug, setSlug] = useState(autoSlug);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!role) {
      setSlug(
        value
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, ''),
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, slug, description, parent_role_id: parentRoleId });
  };

  // Filter out the current role and its descendants to prevent circular hierarchy
  const eligibleParentRoles =
    availableRoles?.filter((r) => {
      if (role && r.id === role.id) return false; // Can't be parent of itself
      if (r.is_system) return false; // System roles can't be children
      return true;
    }) || [];

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{role ? 'Edit Role' : 'Create Role'}</DialogTitle>
        <DialogDescription>
          {role ? 'Update the role details below.' : 'Create a new role for your organization.'}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g., Content Manager"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g., content_manager"
            disabled={Boolean(role)}
            required
          />
          <p className="text-muted-foreground text-xs">
            Used for programmatic access. Cannot be changed after creation.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Can manage course content"
          />
        </div>
        {eligibleParentRoles.length > 0 && (
          <div className="grid gap-2">
            <Label htmlFor="parent_role">Parent Role (Optional)</Label>
            <select
              id="parent_role"
              value={parentRoleId || ''}
              onChange={(e) => setParentRoleId(e.target.value ? Number.parseInt(e.target.value) : null)}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">No parent (root role)</option>
              {eligibleParentRoles.map((r) => (
                <option
                  key={r.id}
                  value={r.id}
                >
                  {r.name} ({r.slug})
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">This role will inherit all permissions from its parent.</p>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit">{role ? 'Update' : 'Create'}</Button>
      </DialogFooter>
    </form>
  );
}
