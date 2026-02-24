'use client';

import {
  addPermissionToRole,
  createRole as apiCreateRole,
  deleteRole as apiDeleteRole,
  getRole as apiGetRole,
  getRolePermissions,
  listAllPermissions,
  listRoleAuditLog,
  listRoles,
  removePermissionFromRole,
  updateRole as apiUpdateRole,
} from '@/services/rbac';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  ChevronRight,
  Copy,
  Edit,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Actions, PermissionGuard, Resources, Scopes, usePermissions } from '@/components/Security';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Permission, RoleAuditEvent, RoleWithPermissions } from '@/types/permissions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOrg } from '@components/Contexts/OrgContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import useSWR from 'swr';

type RoleDialogMode = 'create' | 'edit' | 'clone';

export default function RBACAdminClient() {
  const org = useOrg();
  const session = usePlatformSession();
  const { can } = usePermissions();
  const t = useTranslations('Components.OrgRoles');

  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('roles');

  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [roleDialogMode, setRoleDialogMode] = useState<RoleDialogMode>('create');
  const [roleDialogRole, setRoleDialogRole] = useState<RoleWithPermissions | null>(null);

  const [permissionsRole, setPermissionsRole] = useState<RoleWithPermissions | null>(null);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [isPermissionsDialogLoading, setIsPermissionsDialogLoading] = useState(false);
  const [permissionSearchQuery, setPermissionSearchQuery] = useState('');
  const [permissionResourceFilter, setPermissionResourceFilter] = useState('all');
  const [pendingPermissionIds, setPendingPermissionIds] = useState<number[]>([]);
  const [pendingResourceToggles, setPendingResourceToggles] = useState<string[]>([]);

  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<RoleWithPermissions | null>(null);

  const [auditPage, setAuditPage] = useState(1);
  const [auditData, setAuditData] = useState<{ items: RoleAuditEvent[]; total: number; page_size: number } | null>(
    null,
  );
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  const accessToken = session?.data?.tokens?.access_token;
  const isSuperAdmin = can(Resources.ROLE, Actions.MANAGE, Scopes.ALL);
  const currentUserMaxPriority = useMemo(() => {
    const sessionRoles = session?.data?.roles ?? [];
    const orgRoles = sessionRoles.filter((assignment) => assignment.org?.id === org?.id);
    return orgRoles.reduce((maxPriority, assignment) => Math.max(maxPriority, assignment.role?.priority ?? 0), 0);
  }, [org?.id, session?.data?.roles]);

  const {
    data: permissions = [],
    isLoading: permissionsLoading,
    error: permissionsError,
  } = useSWR(
    accessToken && org?.id ? ['rbac-permissions', accessToken, org.id] : null,
    ([, token, orgId]) => listAllPermissions(token, orgId),
    {
      dedupingInterval: 3_600_000,
      revalidateOnFocus: false,
    },
  );

  const fetchRoles = useCallback(async () => {
    if (!accessToken || !org?.id) return;

    setLoadingRoles(true);
    try {
      const rolesData = await listRoles(accessToken, org.id);
      const sortedRoles = rolesData
        .toSorted((a, b) => {
          const aSystem = a.is_system ? 0 : 1;
          const bSystem = b.is_system ? 0 : 1;
          if (aSystem !== bSystem) return aSystem - bSystem;
          return (b.priority ?? 0) - (a.priority ?? 0);
        })
        .map((role) => Object.assign(role, { permissions: [] }));
      setRoles(sortedRoles);
    } catch (error) {
      console.error('Failed to fetch RBAC roles:', error);
      toast.error(t('loadFailed'));
    } finally {
      setLoadingRoles(false);
    }
  }, [accessToken, org?.id, t]);

  const refreshSession = async () => {
    const timeoutMs = 5000;
    try {
      await Promise.race([
        session.update(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
      ]);
    } catch {
      toast.warning(t('sessionRefreshWarning'));
    }
  };

  const loadRoleWithPermissions = async (roleId: number): Promise<RoleWithPermissions> => {
    if (!accessToken || !org?.id) {
      throw new Error('Missing credentials');
    }

    const [role, rolePermissions] = await Promise.all([
      apiGetRole(accessToken, roleId),
      getRolePermissions(accessToken, roleId, org.id),
    ]);

    return {
      ...role,
      permissions: rolePermissions,
      permissions_count: rolePermissions.length,
    };
  };

  const mergeRole = (updated: RoleWithPermissions) => {
    setRoles((prev) =>
      prev.map((role) =>
        role.id === updated.id
          ? {
              ...role,
              ...updated,
              permissions: updated.permissions,
              permissions_count: updated.permissions.length,
            }
          : role,
      ),
    );
  };

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    if (permissionsError) {
      toast.error(t('loadFailed'));
    }
  }, [permissionsError, t]);

  useEffect(() => {
    const fetchAudit = async () => {
      if (!accessToken || !org?.id || activeTab !== 'audit') return;
      setIsAuditLoading(true);
      try {
        const data = await listRoleAuditLog(accessToken, org.id, auditPage, 20);
        setAuditData({
          items: Array.isArray(data.items) ? data.items : [],
          total: typeof data.total === 'number' ? data.total : 0,
          page_size: typeof data.page_size === 'number' && data.page_size > 0 ? data.page_size : 20,
        });
      } catch (error) {
        console.error('Failed to fetch audit log:', error);
        toast.error(t('auditLogLoadFailed'));
      } finally {
        setIsAuditLoading(false);
      }
    };

    fetchAudit();
  }, [accessToken, org?.id, activeTab, auditPage, t]);

  const filteredRoles = roles.filter(
    (role) =>
      role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      role.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      role.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const permissionsByResource = permissions.reduce<Record<string, Permission[]>>((acc, permission) => {
    if (!acc[permission.resource_type]) {
      acc[permission.resource_type] = [];
    }
    acc[permission.resource_type]!.push(permission);
    return acc;
  }, {});

  const resourceOptions = Object.keys(permissionsByResource).toSorted((a, b) => a.localeCompare(b));

  const filteredDialogPermissions = useMemo(() => {
    return permissions.filter((permission) => {
      const matchesSearch =
        permission.name.toLowerCase().includes(permissionSearchQuery.toLowerCase()) ||
        permission.resource_type.toLowerCase().includes(permissionSearchQuery.toLowerCase()) ||
        (permission.description ?? '').toLowerCase().includes(permissionSearchQuery.toLowerCase());
      const matchesResource =
        permissionResourceFilter === 'all' || permission.resource_type === permissionResourceFilter;
      return matchesSearch && matchesResource;
    });
  }, [permissionSearchQuery, permissionResourceFilter, permissions]);

  const filteredDialogPermissionsByResource = filteredDialogPermissions.reduce<Record<string, Permission[]>>(
    (acc, perm) => {
      if (!acc[perm.resource_type]) {
        acc[perm.resource_type] = [];
      }
      acc[perm.resource_type]!.push(perm);
      return acc;
    },
    {},
  );

  const openCreateDialog = () => {
    setRoleDialogMode('create');
    setRoleDialogRole(null);
    setIsRoleDialogOpen(true);
  };

  const openEditDialog = (role: RoleWithPermissions) => {
    setRoleDialogMode('edit');
    setRoleDialogRole(role);
    setIsRoleDialogOpen(true);
  };

  const openCloneDialog = async (role: RoleWithPermissions) => {
    try {
      const source = await loadRoleWithPermissions(role.id);
      setRoleDialogMode('clone');
      setRoleDialogRole({
        ...source,
        id: source.id,
        name: `${source.name} — Copy`,
        slug: `${source.slug}_copy`,
      });
      setIsRoleDialogOpen(true);
    } catch (error) {
      console.error('Failed to load role for cloning:', error);
      toast.error(t('cloneLoadFailed'));
    }
  };

  const handleCreateOrCloneRole = async (data: {
    name: string;
    slug: string;
    description: string;
    priority: number;
  }) => {
    if (!accessToken || !org?.id) return;

    const sourceRole = roleDialogMode === 'clone' ? roleDialogRole : null;

    try {
      const newRole = await apiCreateRole(accessToken, org.id, data);

      if (sourceRole?.permissions?.length) {
        for (const permission of sourceRole.permissions) {
          await addPermissionToRole(accessToken, newRole.id, permission.id);
        }
      }

      await fetchRoles();
      await refreshSession();
      toast.success(roleDialogMode === 'clone' ? t('cloneSuccess') : t('AddRole.createdNewRole'));
      setIsRoleDialogOpen(false);
      setRoleDialogRole(null);
    } catch (error) {
      console.error('Failed to create role:', error);
      toast.error(error instanceof Error ? error.message : t('AddRole.couldntCreateNewRole'));
    }
  };

  const handleUpdateRole = async (
    roleId: number,
    data: { name: string; slug: string; description: string; priority: number },
  ) => {
    if (!accessToken) return;

    try {
      await apiUpdateRole(accessToken, roleId, {
        name: data.name,
        description: data.description,
        priority: data.priority,
      });
      await fetchRoles();
      await refreshSession();
      toast.success(t('updatedRole'));
      setIsRoleDialogOpen(false);
      setRoleDialogRole(null);
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error(error instanceof Error ? error.message : t('EditRole.couldntUpdateRole'));
    }
  };

  const handleDeleteRole = (role: RoleWithPermissions) => {
    setRoleToDelete(role);
  };

  const confirmDeleteRole = async () => {
    if (!accessToken || !roleToDelete) return;

    setDeletingRoleId(roleToDelete.id);
    setRoleToDelete(null);
    try {
      await apiDeleteRole(accessToken, roleToDelete.id);
      await fetchRoles();
      await refreshSession();
      toast.success(t('deletedRoleSuccess'));
    } catch (error) {
      console.error('Failed to delete role:', error);
      toast.error(error instanceof Error ? error.message : t('deleteRoleError'));
    } finally {
      setDeletingRoleId(null);
    }
  };

  const optimisticTogglePermission = (permission: Permission, grant: boolean) => {
    if (!permissionsRole) return;

    const currentPermissions = permissionsRole.permissions ?? [];
    const updatedPermissions = grant
      ? [...currentPermissions, permission].filter(
          (perm, index, arr) => arr.findIndex((p) => p.id === perm.id) === index,
        )
      : currentPermissions.filter((perm) => perm.id !== permission.id);

    const updatedRole: RoleWithPermissions = {
      ...permissionsRole,
      permissions: updatedPermissions,
      permissions_count: updatedPermissions.length,
    };

    setPermissionsRole(updatedRole);
    mergeRole(updatedRole);
  };

  const refreshPermissionsRole = async (roleId: number) => {
    const refreshed = await loadRoleWithPermissions(roleId);
    setPermissionsRole(refreshed);
    mergeRole(refreshed);
  };

  const handleTogglePermission = async (permission: Permission, hasPermission: boolean) => {
    if (!accessToken || !permissionsRole) return;

    setPendingPermissionIds((prev) => [...prev, permission.id]);
    optimisticTogglePermission(permission, !hasPermission);

    try {
      if (hasPermission) {
        await removePermissionFromRole(accessToken, permissionsRole.id, permission.id);
      } else {
        await addPermissionToRole(accessToken, permissionsRole.id, permission.id);
      }

      await refreshPermissionsRole(permissionsRole.id);
      await refreshSession();
      toast.success(hasPermission ? t('permissionRemoved') : t('permissionAdded'));
    } catch (error) {
      console.error('Failed to toggle permission:', error);
      await refreshPermissionsRole(permissionsRole.id);
      toast.error(error instanceof Error ? error.message : t('failedToUpdatePermission'));
    } finally {
      setPendingPermissionIds((prev) => prev.filter((id) => id !== permission.id));
    }
  };

  const handleToggleResourcePermissions = async (resourceType: string, resourcePermissions: Permission[]) => {
    if (!accessToken || !permissionsRole) return;

    setPendingResourceToggles((prev) => [...prev, resourceType]);

    const currentPermissionIds = new Set((permissionsRole.permissions ?? []).map((permission) => permission.id));
    const shouldGrantAll = !resourcePermissions.every((permission) => currentPermissionIds.has(permission.id));

    const nextPermissions = shouldGrantAll
      ? [
          ...(permissionsRole.permissions ?? []),
          ...resourcePermissions.filter((permission) => !currentPermissionIds.has(permission.id)),
        ]
      : (permissionsRole.permissions ?? []).filter(
          (existingPermission) => !resourcePermissions.some((permission) => permission.id === existingPermission.id),
        );

    const optimisticRole = {
      ...permissionsRole,
      permissions: nextPermissions,
      permissions_count: nextPermissions.length,
    };
    setPermissionsRole(optimisticRole);
    mergeRole(optimisticRole);

    try {
      for (const permission of resourcePermissions) {
        const hasPermission = currentPermissionIds.has(permission.id);
        if (shouldGrantAll && !hasPermission) {
          await addPermissionToRole(accessToken, permissionsRole.id, permission.id);
        }
        if (!shouldGrantAll && hasPermission) {
          await removePermissionFromRole(accessToken, permissionsRole.id, permission.id);
        }
      }

      await refreshPermissionsRole(permissionsRole.id);
      await refreshSession();
      toast.success(
        shouldGrantAll
          ? t('resourcePermissionsAdded', { resourceType })
          : t('resourcePermissionsRemoved', { resourceType }),
      );
    } catch (error) {
      console.error('Failed to update resource permissions:', error);
      await refreshPermissionsRole(permissionsRole.id);
      toast.error(error instanceof Error ? error.message : t('failedToUpdatePermission'));
    } finally {
      setPendingResourceToggles((prev) => prev.filter((resource) => resource !== resourceType));
    }
  };

  const openPermissionsDialog = async (role: RoleWithPermissions) => {
    setIsPermissionsDialogOpen(true);
    setIsPermissionsDialogLoading(true);
    setPermissionsRole({ ...role, permissions: [] });

    try {
      const detailedRole = await loadRoleWithPermissions(role.id);
      setPermissionsRole(detailedRole);
      mergeRole(detailedRole);
    } catch (error) {
      console.error('Failed to load role permissions:', error);
      toast.error(t('permissionLoadFailed'));
    } finally {
      setIsPermissionsDialogLoading(false);
    }
  };

  const resetPermissionsDialogState = () => {
    setIsPermissionsDialogOpen(false);
    setPermissionsRole(null);
    setPermissionSearchQuery('');
    setPermissionResourceFilter('all');
    setPendingPermissionIds([]);
    setPendingResourceToggles([]);
  };

  const loading = loadingRoles || permissionsLoading;

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

  const totalAuditPages = auditData ? Math.max(1, Math.ceil(auditData.total / auditData.page_size)) : 1;

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('cardDescription')}</p>
        </div>
        <PermissionGuard
          action={Actions.CREATE}
          resource={Resources.ROLE}
          scope={Scopes.ORG}
        >
          <Dialog
            open={isRoleDialogOpen}
            onOpenChange={(open) => {
              setIsRoleDialogOpen(open);
              if (!open) {
                setRoleDialogRole(null);
                setRoleDialogMode('create');
              }
            }}
          >
            <DialogTrigger
              render={
                <Button onClick={openCreateDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('createRole')}
                </Button>
              }
            />
            <DialogContent>
              <RoleEditForm
                mode={roleDialogMode}
                role={roleDialogRole ?? undefined}
                maxPriority={currentUserMaxPriority}
                isSuperAdmin={isSuperAdmin}
                onSubmit={(data) => {
                  if (roleDialogMode === 'edit' && roleDialogRole) {
                    return handleUpdateRole(roleDialogRole.id, data);
                  }
                  return handleCreateOrCloneRole(data);
                }}
                onCancel={() => {
                  setIsRoleDialogOpen(false);
                  setRoleDialogRole(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </PermissionGuard>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalRoles')}</CardTitle>
            <Shield className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
            <p className="text-muted-foreground text-xs">
              {roles.filter((r) => r.is_system).length} {t('system')}, {roles.filter((r) => !r.is_system).length}{' '}
              {t('custom')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('permissions')}</CardTitle>
            <Lock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{permissions.length}</div>
            <p className="text-muted-foreground text-xs">
              {t('acrossResourceTypes', { count: Object.keys(permissionsByResource).length })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('resourceTypes')}</CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(permissionsByResource).length}</div>
            <p className="text-muted-foreground text-xs">{t('resourceTypesHint')}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="roles">{t('rolesTab')}</TabsTrigger>
          <TabsTrigger value="permissions">{t('permissionsTab')}</TabsTrigger>
          <TabsTrigger value="audit">{t('auditLogTab')}</TabsTrigger>
        </TabsList>

        <TabsContent
          value="roles"
          className="space-y-4"
        >
          <div className="flex items-center gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
              <Input
                placeholder={t('searchRolesPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <Card className="p-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tableHead.role')}</TableHead>
                  <TableHead>{t('tableHead.slug')}</TableHead>
                  <TableHead>{t('tableHead.type')}</TableHead>
                  <TableHead>{t('tableHead.priority')}</TableHead>
                  <TableHead>{t('tableHead.permissions')}</TableHead>
                  <TableHead>{t('tableHead.users')}</TableHead>
                  <TableHead className="text-right">{t('tableHead.actions')}</TableHead>
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
                        <Badge
                          variant="secondary"
                          className="gap-1"
                        >
                          <Lock className="h-3 w-3" />
                          {t('system')}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1"
                        >
                          <Pencil className="h-3 w-3" />
                          {t('custom')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{role.priority}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('permissionsAria', { roleName: role.name })}
                        onClick={() => openPermissionsDialog(role)}
                      >
                        {t('permissionsCount', { count: role.permissions_count ?? 0 })}
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell>{role.users_count ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <PermissionGuard
                          action={Actions.CREATE}
                          resource={Resources.ROLE}
                          scope={Scopes.ORG}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('cloneRoleAria', { roleName: role.name })}
                            onClick={() => openCloneDialog(role)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard
                          action={Actions.UPDATE}
                          resource={Resources.ROLE}
                          scope={Scopes.ORG}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={role.is_system && !isSuperAdmin}
                            aria-label={t('editRoleAria', { roleName: role.name })}
                            onClick={() => openEditDialog(role)}
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
                            disabled={(role.is_system && !isSuperAdmin) || deletingRoleId === role.id}
                            aria-label={t('deleteRoleAria', { roleName: role.name })}
                            onClick={() => handleDeleteRole(role)}
                          >
                            {deletingRoleId === role.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
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

        <TabsContent
          value="permissions"
          className="space-y-4"
        >
          <Card>
            <CardHeader>
              <CardTitle>{t('allPermissionsTitle')}</CardTitle>
              <CardDescription>{t('allPermissionsDescription')}</CardDescription>
              <div className="bg-muted text-muted-foreground rounded-md border p-3 text-sm">
                {t('scopeHierarchy')}: <span className="font-medium">all → org → assigned → own</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(permissionsByResource).map(([resourceType, perms]) => (
                  <div key={resourceType}>
                    <h3 className="mb-2 flex items-center gap-2 font-semibold">
                      <Badge variant="outline">{resourceType}</Badge>
                      <span className="text-muted-foreground text-sm">
                        ({t('permissionsCount', { count: perms.length })})
                      </span>
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

        <TabsContent
          value="audit"
          className="space-y-4"
        >
          <Card>
            <CardHeader>
              <CardTitle>{t('auditLogTitle')}</CardTitle>
              <CardDescription>{t('auditLogDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAuditLoading ? (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('loadingAuditLog')}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('audit.timestamp')}</TableHead>
                        <TableHead>{t('audit.actor')}</TableHead>
                        <TableHead>{t('audit.action')}</TableHead>
                        <TableHead>{t('audit.role')}</TableHead>
                        <TableHead>{t('audit.summary')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(auditData?.items ?? []).map((entry, index) => (
                        <TableRow key={`${entry.timestamp}-${entry.action}-${index}`}>
                          <TableCell>{new Date(entry.timestamp).toLocaleString()}</TableCell>
                          <TableCell>{entry.actor_id ?? '—'}</TableCell>
                          <TableCell>{entry.action}</TableCell>
                          <TableCell>{entry.target_role_slug ?? entry.target_role_id ?? '—'}</TableCell>
                          <TableCell>{entry.diff_summary ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {(auditData?.items?.length ?? 0) === 0 && (
                    <div className="text-muted-foreground text-sm">{t('audit.empty')}</div>
                  )}

                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-sm">
                      {t('audit.pagination', { page: auditPage, totalPages: totalAuditPages })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={auditPage <= 1}
                        onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
                      >
                        {t('previous')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={auditPage >= totalAuditPages}
                        onClick={() => setAuditPage((prev) => Math.min(totalAuditPages, prev + 1))}
                      >
                        {t('next')}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {permissionsRole && (
        <Dialog
          open={isPermissionsDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              resetPermissionsDialogState();
            }
          }}
        >
          <DialogContent className="max-h-[80vh] lg:min-w-2xl w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('managePermissionsTitle', { roleName: permissionsRole.name })}</DialogTitle>
              <DialogDescription>{t('managePermissionsDescription')}</DialogDescription>
            </DialogHeader>

            {permissionsRole.is_system && !isSuperAdmin && (
              <div className="rounded-md border bg-muted p-3 text-sm">{t('systemRoleReadOnlyBanner')}</div>
            )}

            <div className="flex flex-col gap-3 py-2 md:flex-row">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
                <Input
                  placeholder={t('permissionSearchPlaceholder')}
                  value={permissionSearchQuery}
                  onChange={(e) => setPermissionSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select
                value={permissionResourceFilter}
                onValueChange={(value) => setPermissionResourceFilter(value ?? 'all')}
              >
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allResources')}</SelectItem>
                  {resourceOptions.map((resource) => (
                    <SelectItem
                      key={resource}
                      value={resource}
                    >
                      {resource}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-6 py-2">
              {isPermissionsDialogLoading ? (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('loadingPermissions')}
                </div>
              ) : (
                Object.entries(filteredDialogPermissionsByResource).map(([resourceType, perms]) => {
                  const rolePermissionIds = new Set((permissionsRole.permissions ?? []).map((p) => p.id));
                  const allSelected = perms.length > 0 && perms.every((perm) => rolePermissionIds.has(perm.id));
                  const isResourcePending = pendingResourceToggles.includes(resourceType);

                  return (
                    <div
                      key={resourceType}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="flex items-center gap-2 font-medium">
                          <Badge variant="outline">{resourceType}</Badge>
                        </h4>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`resource-toggle-${resourceType}`}
                            checked={allSelected}
                            disabled={(permissionsRole.is_system && !isSuperAdmin) || isResourcePending}
                            onCheckedChange={() => handleToggleResourcePermissions(resourceType, perms)}
                          />
                          <label
                            htmlFor={`resource-toggle-${resourceType}`}
                            className="text-sm"
                          >
                            {isResourcePending ? t('updating') : t('selectAllResource')}
                          </label>
                        </div>
                      </div>

                      <div className="ml-4 grid gap-2">
                        {perms.map((perm) => {
                          const hasPermission = rolePermissionIds.has(perm.id);
                          const pending = pendingPermissionIds.includes(perm.id);

                          return (
                            <div
                              key={perm.id}
                              className="flex items-center justify-between rounded border p-2"
                            >
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  id={`perm-${perm.id}`}
                                  checked={hasPermission}
                                  disabled={(permissionsRole.is_system && !isSuperAdmin) || pending}
                                  onCheckedChange={() => handleTogglePermission(perm, hasPermission)}
                                />
                                <label
                                  htmlFor={`perm-${perm.id}`}
                                  className="cursor-pointer text-sm"
                                >
                                  <span className="block">{perm.name}</span>
                                  {perm.description && (
                                    <span className="text-muted-foreground block text-xs">{perm.description}</span>
                                  )}
                                </label>
                              </div>
                              <div className="flex items-center gap-2">
                                {pending && <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />}
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
                  );
                })
              )}

              {!isPermissionsDialogLoading && Object.keys(filteredDialogPermissionsByResource).length === 0 && (
                <p className="text-muted-foreground text-sm">{t('noPermissionsFound')}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={resetPermissionsDialogState}
              >
                {t('done')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog
        open={roleToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setRoleToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20">
              <AlertTriangle />
            </AlertDialogMedia>
            <AlertDialogTitle>{t('deleteRoleAria', { roleName: roleToDelete?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteRoleConfirmationWithUsers', { count: roleToDelete?.users_count ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel />
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDeleteRole}
            >
              {t('deleteRoleConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RoleEditForm({
  mode,
  role,
  maxPriority,
  isSuperAdmin,
  onSubmit,
  onCancel,
}: {
  mode: RoleDialogMode;
  role?: RoleWithPermissions;
  maxPriority: number;
  isSuperAdmin: boolean;
  onSubmit: (data: { name: string; slug: string; description: string; priority: number }) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations('Components.OrgRoles');
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [priority, setPriority] = useState(role?.priority ?? 0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = mode === 'edit';

  const autoSlug = isEditMode
    ? (role?.slug ?? '')
    : name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');

  const [slug, setSlug] = useState(role?.slug ?? autoSlug);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!isEditMode) {
      setSlug(
        value
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, ''),
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({ name, slug, description, priority });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>
          {mode === 'edit' ? t('editRoleTitle') : mode === 'clone' ? t('cloneRoleTitle') : t('createRoleTitle')}
        </DialogTitle>
        <DialogDescription>
          {mode === 'edit'
            ? t('editRoleDescription')
            : mode === 'clone'
              ? t('cloneRoleDescription')
              : t('createRoleDescription')}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="name">{t('fieldName')}</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={t('namePlaceholder')}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="slug">{t('fieldSlug')}</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder={t('slugPlaceholder')}
            disabled={isEditMode}
            required
          />
          <p className="text-muted-foreground text-xs">{isEditMode ? t('slugImmutableHelp') : t('slugCreateHelp')}</p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="priority">{t('tableHead.priority')}</Label>
          <Input
            id="priority"
            type="number"
            min={0}
            max={isSuperAdmin ? undefined : maxPriority}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value || 0))}
            required
          />
          {!isSuperAdmin && (
            <p className="text-muted-foreground text-xs">{t('priorityMaxHelp', { max: maxPriority })}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">{t('fieldDescription')}</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('descriptionPlaceholder')}
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {t('AddRole.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'edit' ? t('updateRole') : mode === 'clone' ? t('cloneRole') : t('createRole')}
        </Button>
      </DialogFooter>
    </form>
  );
}
