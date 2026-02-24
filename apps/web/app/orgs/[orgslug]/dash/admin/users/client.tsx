'use client';

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
import { assignRoleToUser, listOrgUsers, listRoles, listUserRoles, removeRoleFromUser } from '@/services/rbac';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Calendar, Plus, Search, Shield, Trash2, User } from 'lucide-react';
import { Actions, PermissionGuard, Resources, Scopes } from '@/components/Security';
import type { OrgUserBasic, Role, UserRoleAssignment } from '@/types/permissions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { getUserAvatarMediaDirectory } from '@/services/media/media';
import { useOrg } from '@components/Contexts/OrgContext';
import { useCallback, useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function UserRolesClient() {
  const org = useOrg();
  const session = usePlatformSession();
  const t = useTranslations('Components.OrgRoles');

  const [userRoles, setUserRoles] = useState<UserRoleAssignment[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<OrgUserBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [assignmentToRemove, setAssignmentToRemove] = useState<{
    userId: number;
    roleId: number;
    roleName?: string;
  } | null>(null);

  const accessToken = session?.data?.tokens?.access_token;

  const refreshSession = useCallback(async () => {
    const timeoutMs = 5000;
    try {
      await Promise.race([
        session.update(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
      ]);
    } catch {
      toast.warning(t('sessionRefreshWarning'));
    }
  }, [session, t]);

  // Fetch user roles
  const fetchUserRolesData = useCallback(async () => {
    if (!accessToken || !org?.id) return;
    try {
      const data = await listUserRoles(accessToken, org.id);
      setUserRoles(data);
    } catch (error) {
      console.error('Failed to fetch user roles:', error);
      toast.error(t('loadFailed'));
    }
  }, [accessToken, org?.id, t]);

  // Fetch available roles
  const fetchRoles = useCallback(async () => {
    if (!accessToken || !org?.id) return;
    try {
      const data = await listRoles(accessToken, org.id);
      setAvailableRoles(data);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  }, [accessToken, org?.id]);

  // Fetch users for search
  const fetchUsers = useCallback(async () => {
    if (!accessToken || !org?.id) return;
    try {
      const data = await listOrgUsers(accessToken, org.id);
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  }, [accessToken, org?.id]);
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([fetchUserRolesData(), fetchRoles(), fetchUsers()]);
      setLoading(false);
    };
    fetchAll();
  }, [fetchUserRolesData, fetchRoles, fetchUsers]);

  // Filter user roles by search
  const filteredUserRoles = userRoles.filter((ur) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      ur.user?.email?.toLowerCase().includes(searchLower) ||
      ur.user?.username?.toLowerCase().includes(searchLower) ||
      ur.user?.first_name?.toLowerCase().includes(searchLower) ||
      ur.user?.last_name?.toLowerCase().includes(searchLower) ||
      ur.role?.name?.toLowerCase().includes(searchLower)
    );
  });

  // Add role to user
  const handleAddUserRole = async () => {
    if (!accessToken || !selectedUserId || !selectedRoleId || !org?.id) return;

    try {
      await assignRoleToUser(accessToken, selectedUserId, selectedRoleId, org.id);
      toast.success(t('assignedRoleSuccess'));
      setIsAddDialogOpen(false);
      setSelectedUserId(null);
      setSelectedRoleId(null);
      await fetchUserRolesData();
      // Refresh session so permission changes take effect immediately
      await refreshSession();
    } catch (error) {
      console.error('Failed to assign role:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to assign role');
    }
  };

  // Open remove confirmation dialog
  const handleRemoveUserRole = (userId: number, roleId: number, roleName?: string) => {
    setAssignmentToRemove({ userId, roleId, roleName });
  };

  // Confirm remove role from user
  const confirmRemoveUserRole = async () => {
    if (!accessToken || !org?.id || !assignmentToRemove) return;

    const { userId, roleId } = assignmentToRemove;
    setAssignmentToRemove(null);

    try {
      await removeRoleFromUser(accessToken, userId, roleId, org.id);
      toast.success(t('removedRoleSuccess'));
      await fetchUserRolesData();
      // Refresh session so permission changes take effect immediately
      await refreshSession();
    } catch (error) {
      console.error('Failed to remove role:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove role');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('userRolesTitle')}</h1>
          <p className="text-muted-foreground">{t('userRolesDescription')}</p>
        </div>
        <PermissionGuard
          action={Actions.MANAGE}
          resource={Resources.ROLE}
          scope={Scopes.ORG}
        >
          <Dialog
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
          >
            <DialogTrigger
              render={
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('assignRole')}
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('assignRoleTitle')}</DialogTitle>
                <DialogDescription>{t('assignRoleDescription')}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="user">{t('userLabel')}</Label>
                  <Select
                    value={selectedUserId?.toString() || ''}
                    onValueChange={(v) => setSelectedUserId(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectUserPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter((user) => user.id !== null)
                        .map((user) => (
                          <SelectItem
                            key={user.id}
                            value={user.id.toString()}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={user.avatar_image} />
                                <AvatarFallback>
                                  {(user.first_name?.[0] || user.username?.[0] || 'U').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span>
                                {user.first_name || user.username} {`(${user.email})`}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">{t('roleLabel')}</Label>
                  <Select
                    value={selectedRoleId?.toString() || ''}
                    onValueChange={(v) => setSelectedRoleId(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectRolePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem
                          key={role.id}
                          value={role.id.toString()}
                        >
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  {t('AddRole.cancel')}
                </Button>
                <Button
                  onClick={handleAddUserRole}
                  disabled={!selectedUserId || !selectedRoleId}
                >
                  {t('assignRole')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PermissionGuard>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            placeholder={t('searchUsersOrRoles')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* User Roles Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('userLabel')}</TableHead>
              <TableHead>{t('roleLabel')}</TableHead>
              <TableHead>{t('assignedAt')}</TableHead>
              <TableHead className="text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUserRoles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground py-8 text-center"
                >
                  {t('noUserRoleAssignments')}
                </TableCell>
              </TableRow>
            ) : (
              filteredUserRoles.map((ur, idx) => (
                <TableRow key={`${ur.user_id}-${ur.role_id}-${idx}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage
                          src={
                            ur.user?.avatar_image
                              ? ur.user.avatar_image.startsWith('http')
                                ? ur.user.avatar_image
                                : ur.user.user_uuid
                                  ? getUserAvatarMediaDirectory(ur.user.user_uuid, ur.user.avatar_image)
                                  : undefined
                              : undefined
                          }
                        />
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {ur.user?.first_name ? `${ur.user.first_name} ${ur.user.last_name || ''}` : ur.user?.username}
                        </div>
                        <div className="text-muted-foreground text-sm">{ur.user?.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      <Shield className="mr-1 h-3 w-3" />
                      {ur.role?.name || `Role #${ur.role_id}`}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-muted-foreground flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3" />
                      {new Date(ur.assigned_at).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <PermissionGuard
                      action={Actions.DELETE}
                      resource={Resources.ROLE}
                      scope={Scopes.ORG}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveUserRole(ur.user_id, ur.role_id, ur.role?.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </PermissionGuard>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog
        open={assignmentToRemove !== null}
        onOpenChange={(open) => {
          if (!open) setAssignmentToRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20">
              <AlertTriangle />
            </AlertDialogMedia>
            <AlertDialogTitle>{t('removeRoleConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('removeRoleConfirmDescription', { roleName: assignmentToRemove?.roleName ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel />
            <AlertDialogAction
              variant="destructive"
              onClick={confirmRemoveUserRole}
            >
              {t('removeRoleConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
