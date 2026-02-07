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
import { Actions, PermissionGuard, Resources, Scopes, usePermissions } from '@/components/Security';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, Edit, Lock, Plus, Search, Shield, Trash2, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import type { RoleWithPermissions, Permission } from '@/types/permissions';
import { useOrg } from '@components/Contexts/OrgContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  listRoles,
  listAllPermissions,
  createRole as apiCreateRole,
  updateRole as apiUpdateRole,
  deleteRole as apiDeleteRole,
  addPermissionToRole,
  removePermissionFromRole,
  getRole as apiGetRole,
} from '@/services/rbac';

export default function RBACAdminClient() {
  const org = useOrg();
  const session = usePlatformSession();
  const { can } = usePermissions();

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
        const [rolesData, permsData] = await Promise.all([
          listRoles(accessToken, org.id),
          listAllPermissions(accessToken),
        ]);
        setRoles(rolesData);
        setPermissions(permsData);
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

  const handleCreateRole = async (data: { name: string; slug: string; description: string }) => {
    if (!accessToken || !org?.id) return;

    try {
      const newRole = await apiCreateRole(accessToken, org.id, data);
      setRoles([...roles, { ...newRole, permissions: [] }]);
      toast.success('Role created successfully');
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Failed to create role:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create role');
    }
  };

  const handleUpdateRole = async (roleId: number, data: { name: string; description: string }) => {
    if (!accessToken) return;

    try {
      const updatedRole = await apiUpdateRole(accessToken, roleId, data);
      setRoles(roles.map((r) => (r.id === roleId ? { ...r, ...updatedRole } : r)));
      toast.success('Role updated successfully');
      setIsEditDialogOpen(false);
      setSelectedRole(null);
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId: number) => {
    if (!accessToken) return;

    if (!confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
      return;
    }

    try {
      await apiDeleteRole(accessToken, roleId);
      setRoles(roles.filter((r) => r.id !== roleId));
      toast.success('Role deleted successfully');
      // Refresh session so permission changes take effect immediately
      session.update();
    } catch (error) {
      console.error('Failed to delete role:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete role');
    }
  };

  const handleTogglePermission = async (roleId: number, permissionId: number, hasPermission: boolean) => {
    if (!accessToken) return;

    try {
      if (hasPermission) {
        await removePermissionFromRole(accessToken, roleId, permissionId);
      } else {
        await addPermissionToRole(accessToken, roleId, permissionId);
      }

      // Refresh the role's permissions
      const updatedRole = await apiGetRole(accessToken, roleId);
      setRoles(roles.map((r) => (r.id === roleId ? updatedRole : r)));
      setSelectedRole(updatedRole);

      toast.success(hasPermission ? 'Permission removed' : 'Permission added');
      // Refresh session so permission changes take effect immediately
      session.update();
    } catch (error) {
      console.error('Failed to toggle permission:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update permission');
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
          resource={Resources.ROLE}
          scope={Scopes.ORG}
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
                          resource={Resources.ROLE}
                          scope={Scopes.ORG}
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
                          resource={Resources.ROLE}
                          scope={Scopes.ORG}
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
}: {
  role?: RoleWithPermissions;
  onSubmit: (data: { name: string; slug: string; description: string }) => void;
  onCancel: () => void;
  availableRoles?: RoleWithPermissions[];
}) {
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');

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
    onSubmit({ name, slug, description });
  };

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
