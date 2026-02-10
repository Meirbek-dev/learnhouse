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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { AlertTriangle, Globe, Loader2, Pencil, Shield, X } from 'lucide-react';
import { Actions, Resources, Scopes, usePermissions } from '@/components/Security';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import EditRole from '@components/Objects/Modals/Dash/OrgRoles/EditRole';
import AddRole from '@components/Objects/Modals/Dash/OrgRoles/AddRole';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import type { Role } from '@/types/permissions';
import { useState, useTransition } from 'react';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { deleteRole } from '@/services/rbac';
import { useTranslations } from 'next-intl';
import useSWR, { mutate } from 'swr';
import type { FC } from 'react';
import { toast } from 'sonner';

interface DeleteRoleButtonProps {
  roleId: number | string;
  onDelete: (roleId: number | string) => Promise<void>;
  t: (key: string) => string;
  variant?: 'default' | 'compact';
}

function DeleteRoleButton({ roleId, onDelete, t, variant = 'default' }: DeleteRoleButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      await onDelete(roleId);
      setIsOpen(false);
    });
  };

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <AlertDialogTrigger
        nativeButton
        render={
          <Button
            variant="destructive"
            size="sm"
            className={variant === 'default' ? 'flex-1' : ''}
          >
            <X className="h-4 w-4" />
            {t('deleteRole')}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <AlertTriangle className="text-destructive size-6" />
          </AlertDialogMedia>
          <AlertDialogTitle>{t('deleteRoleTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('deleteRoleConfirmation')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} />
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('deleteRole')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const OrgRoles: FC = () => {
  const t = useTranslations('Components.OrgRoles');
  const org = useOrg();
  const session = usePlatformSession();
  const access_token = session?.data?.tokens?.access_token;
  const [createRoleModal, setCreateRoleModal] = useState(false);
  const [editRoleModal, setEditRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<{ id: number; name: string; description?: string } | null>(null);
  const { can } = usePermissions();
  const canUpdateRole = can(Actions.UPDATE, Resources.ROLE, Scopes.ORG);
  const canDeleteRole = can(Actions.DELETE, Resources.ROLE, Scopes.ORG);
  const canCreateRole = can(Actions.CREATE, Resources.ROLE, Scopes.ORG);

  const { data: roles } = useSWR<Role[]>(org ? `${getAPIUrl()}roles?org_id=${org.id}` : null, (url) =>
    swrFetcher(url, access_token),
  );

  const deleteRoleUI = async (role_id: number | string) => {
    const toastId = toast.loading(t('deleting'));
    try {
      await deleteRole(access_token ?? '', Number(role_id));
      mutate(`${getAPIUrl()}roles?org_id=${org?.id}`);
      toast.success(t('deletedRoleSuccess'), { id: toastId });
    } catch {
      toast.error(t('deleteRoleError'), { id: toastId });
    }
  };

  const handleEditRoleModal = (role: { id: number; name: string; description?: string }) => {
    setSelectedRole(role);
    setEditRoleModal(!editRoleModal);
  };

  const getRoleBadge = (role: { priority?: number }) => {
    const priority = role.priority ?? 0;

    // Use priority thresholds instead of slug matching.
    if (priority >= 900) return t('fullAccess');
    if (priority >= 800) return t('fullAccess');
    if (priority >= 700) return t('instructorAccess');
    return t('basicAccess');
  };

  // Check if a role is system-wide (is_system flag or well-known system role slugs)
  const isSystemRole = (role: { is_system?: boolean }) => {
    // Prefer the explicit `is_system` flag from the backend
    return role.is_system === true;
  };

  return (
    <Card className="mx-4 mt-6 sm:mx-6 lg:mx-10">
      <CardHeader className="bg-muted/50">
        <CardTitle className="text-lg sm:text-xl">{t('cardTitle')}</CardTitle>
        <CardDescription className="text-xs sm:text-sm">{t('cardDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        {/* Mobile view - Cards */}
        <div className="block space-y-3 sm:hidden">
          {roles?.map((role) => {
            const isSystem = isSystemRole(role);
            return (
              <Card key={role.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Shield className="text-muted-foreground h-4 w-4" />
                      <span className="text-sm font-medium">{role.name}</span>
                      {isSystem && (
                        <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                          <Globe className="mr-1 h-3 w-3" />
                          {t('systemWide')}
                        </span>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className="text-xs"
                    >
                      {getRoleBadge(role)}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">{role.description || t('noDescription')}</p>
                  <div className="flex space-x-2">
                    {!isSystem ? (
                      <>
                        {canUpdateRole && (
                          <Modal
                            isDialogOpen={editRoleModal && selectedRole?.id === role.id}
                            onOpenChange={() => handleEditRoleModal(role)}
                            minHeight="lg"
                            minWidth="xl"
                            customWidth="max-w-7xl"
                            dialogContent={
                              <EditRole
                                role={role}
                                setEditRoleModal={setEditRoleModal}
                              />
                            }
                            dialogTitle={t('editRoleTitle')}
                            dialogDescription={t('editRoleDescription')}
                            dialogTrigger={
                              <Button
                                variant="default"
                                size="sm"
                                className="flex-1"
                              >
                                <Pencil className="h-4 w-4" />
                                {t('edit')}
                              </Button>
                            }
                          />
                        )}
                        {canDeleteRole && (
                          <DeleteRoleButton
                            roleId={role.id}
                            onDelete={deleteRoleUI}
                            t={t}
                          />
                        )}
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Desktop view - Table */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow className="uppercase">
                <TableHead>{t('roleName')}</TableHead>
                <TableHead>{t('description')}</TableHead>
                <TableHead>{t('permissions')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles?.map((role) => {
                const isSystem = isSystemRole(role);
                return (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Shield className="text-muted-foreground h-4 w-4" />
                        <span className="font-medium">{role.name}</span>
                        {isSystem && (
                          <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                            <Globe className="mr-1 h-3 w-3" />
                            {t('systemWide')}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{role.description || t('noDescription')}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-xs"
                      >
                        {getRoleBadge(role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        {!isSystem ? (
                          <>
                            {canUpdateRole && (
                              <Modal
                                isDialogOpen={editRoleModal && selectedRole?.id === role.id}
                                onOpenChange={() => handleEditRoleModal(role)}
                                minHeight="lg"
                                minWidth="xl"
                                customWidth="max-w-7xl"
                                dialogContent={
                                  <EditRole
                                    role={role}
                                    setEditRoleModal={setEditRoleModal}
                                  />
                                }
                                dialogTitle={t('editRoleTitle')}
                                dialogDescription={t('editRoleDescription')}
                                dialogTrigger={
                                  <Button
                                    variant="default"
                                    size="sm"
                                  >
                                    <Pencil className="h-4 w-4" />
                                    {t('edit')}
                                  </Button>
                                }
                              />
                            )}
                            {canDeleteRole && (
                              <DeleteRoleButton
                                roleId={role.id}
                                onDelete={deleteRoleUI}
                                t={t}
                                variant="compact"
                              />
                            )}
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {canCreateRole && (
          <div className="mt-6 flex justify-end">
            <Modal
              isDialogOpen={createRoleModal}
              onOpenChange={() => setCreateRoleModal(!createRoleModal)}
              minHeight="no-min"
              minWidth="xl"
              customWidth="max-w-7xl"
              dialogContent={<AddRole setCreateRoleModal={setCreateRoleModal} />}
              dialogTitle={t('createRoleTitle')}
              dialogDescription={t('createRoleDescription')}
              dialogTrigger={
                <Button>
                  <Shield className="h-4 w-4" />
                  {t('createRole')}
                </Button>
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrgRoles;
