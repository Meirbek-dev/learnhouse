'use client';
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import EditRole from '@components/Objects/Modals/Dash/OrgRoles/EditRole';
import AddRole from '@components/Objects/Modals/Dash/OrgRoles/AddRole';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { Globe, Pencil, Shield, X } from 'lucide-react';
import { getAPIUrl } from '@services/config/config';
import { deleteRole } from '@services/roles/roles';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { useTranslations } from 'next-intl';
import useSWR, { mutate } from 'swr';
import { toast } from "sonner"
import { useState } from 'react';
import type { FC } from 'react';

const OrgRoles: FC = () => {
  const t = useTranslations('Components.OrgRoles');
  const org = useOrg() as any;
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const [createRoleModal, setCreateRoleModal] = useState(false);
  const [editRoleModal, setEditRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);

  const { data: roles } = useSWR(org ? `${getAPIUrl()}roles/org/${org.id}` : null, (url) =>
    swrFetcher(url, access_token),
  );

  const deleteRoleUI = async (role_id: any) => {
    const toastId = toast.loading(t('deleting'));
    const res = await deleteRole(role_id, org.id, access_token);
    if (res.status === 200) {
      mutate(`${getAPIUrl()}roles/org/${org.id}`);
      toast.success(t('deletedRoleSuccess'), { id: toastId });
    } else {
      toast.error(t('deleteRoleError'), { id: toastId });
    }
  };

  const handleEditRoleModal = (role: any) => {
    setSelectedRole(role);
    setEditRoleModal(!editRoleModal);
  };

  const getRightsSummary = (rights: any) => {
    if (!rights) return t('noPermissions');

    const totalPermissions = Object.keys(rights).reduce((acc, key) => {
      if (typeof rights[key] === 'object') {
        return acc + Object.keys(rights[key]).filter((k) => rights[key][k] === true).length;
      }
      return acc;
    }, 0);

    return t('permissionsCount', { count: totalPermissions });
  };

  // Check if a role is system-wide (TYPE_GLOBAL or role_uuid starts with role_global_)
  const isSystemRole = (role: any) => {
    // Check for role_type field first
    if (role.role_type === 'TYPE_GLOBAL') {
      return true;
    }

    // Check for role_uuid starting with role_global_
    if (role.role_uuid?.startsWith('role_global_')) {
      return true;
    }

    // Check for common system role IDs (1-4 are typically system roles)
    if (role.id && [1, 2, 3, 4].includes(role.id)) {
      return true;
    }

    // Check if the role name indicates it's a system role
    if (role.name && ['Admin', 'Maintainer', 'Instructor', 'User'].includes(role.name)) {
      return true;
    }

    return false;
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
          {roles?.map((role: any) => {
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
                      {getRightsSummary(role.rights)}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">{role.description || t('noDescription')}</p>
                  <div className="flex space-x-2">
                    {!isSystem ? (
                      <>
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
                        <ConfirmationModal
                          confirmationButtonText={t('deleteRole')}
                          confirmationMessage={t('deleteRoleConfirmation')}
                          dialogTitle={t('deleteRoleTitle')}
                          dialogTrigger={
                            <Button
                              variant="destructive"
                              size="sm"
                              className="flex-1"
                            >
                              <X className="h-4 w-4" />
                              {t('deleteRole')}
                            </Button>
                          }
                          functionToExecute={() => {
                            deleteRoleUI(role.id);
                          }}
                          status="warning"
                        />
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
              {roles?.map((role: any) => {
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
                        {getRightsSummary(role.rights)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        {!isSystem ? (
                          <>
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
                            <ConfirmationModal
                              confirmationButtonText={t('deleteRole')}
                              confirmationMessage={t('deleteRoleConfirmation')}
                              dialogTitle={t('deleteRoleTitle')}
                              dialogTrigger={
                                <Button
                                  variant="destructive"
                                  size="sm"
                                >
                                  <X className="h-4 w-4" />
                                  {t('deleteRole')}
                                </Button>
                              }
                              functionToExecute={() => {
                                deleteRoleUI(role.id);
                              }}
                              status="warning"
                            />
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
      </CardContent>
    </Card>
  );
};

export default OrgRoles;
