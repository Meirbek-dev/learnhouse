'use client';
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import EditRole from '@components/Objects/Modals/Dash/OrgRoles/EditRole';
import AddRole from '@components/Objects/Modals/Dash/OrgRoles/AddRole';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { Pencil, Shield, Users, X, Globe } from 'lucide-react';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { deleteRole } from '@services/roles/roles';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import useSWR, { mutate } from 'swr';
import toast from 'react-hot-toast';
import React from 'react';

function OrgRoles() {
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const [createRoleModal, setCreateRoleModal] = React.useState(false);
  const [editRoleModal, setEditRoleModal] = React.useState(false);
  const [selectedRole, setSelectedRole] = React.useState(null) as any;

  const { data: roles } = useSWR(org ? `${getAPIUrl()}roles/org/${org.id}` : null, (url) =>
    swrFetcher(url, access_token),
  );

  const deleteRoleUI = async (role_id: any) => {
    const toastId = toast.loading('Deleting...');
    const res = await deleteRole(role_id, org.id, access_token);
    if (res.status === 200) {
      mutate(`${getAPIUrl()}roles/org/${org.id}`);
      toast.success('Deleted role', { id: toastId });
    } else {
      toast.error('Error deleting role', { id: toastId });
    }
  };

  const handleEditRoleModal = (role: any) => {
    setSelectedRole(role);
    setEditRoleModal(!editRoleModal);
  };

  const getRightsSummary = (rights: any) => {
    if (!rights) return 'No permissions';

    const totalPermissions = Object.keys(rights).reduce((acc, key) => {
      if (typeof rights[key] === 'object') {
        return acc + Object.keys(rights[key]).filter((k) => rights[key][k] === true).length;
      }
      return acc;
    }, 0);

    return `${totalPermissions} permissions`;
  };

  // Check if a role is system-wide (TYPE_GLOBAL or role_uuid starts with role_global_)
  const isSystemRole = (role: any) => {
    // Check for role_type field first
    if (role.role_type === 'TYPE_GLOBAL') {
      return true;
    }

    // Check for role_uuid starting with role_global_
    if (role.role_uuid && role.role_uuid.startsWith('role_global_')) {
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
    <>
      <Card className="mt-6 mx-4 sm:mx-6 lg:mx-10">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-lg sm:text-xl">Manage Roles & Permissions</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Roles define what users can do within your organization. Create custom roles with specific permissions for
            different user types.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          {/* Mobile view - Cards */}
          <div className="block sm:hidden space-y-3">
            {roles?.map((role: any) => {
              const isSystem = isSystemRole(role);
              return (
                <Card key={role.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{role.name}</span>
                        {isSystem && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <Globe className="w-3 h-3 mr-1" />
                            System-wide
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
                    <p className="text-muted-foreground text-sm">{role.description || 'No description'}</p>
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
                            dialogTitle="Edit Role"
                            dialogDescription={'Edit the role permissions and details'}
                            dialogTrigger={
                              <Button
                                variant="default"
                                size="sm"
                                className="flex-1"
                              >
                                <Pencil className="w-4 h-4" />
                                Edit
                              </Button>
                            }
                          />
                          <ConfirmationModal
                            confirmationButtonText="Delete Role"
                            confirmationMessage="This action cannot be undone. All users with this role will lose their permissions. Are you sure you want to delete this role?"
                            dialogTitle={'Delete Role ?'}
                            dialogTrigger={
                              <Button
                                variant="destructive"
                                size="sm"
                                className="flex-1"
                              >
                                <X className="w-4 h-4" />
                                Delete
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
                  <TableHead>Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles?.map((role: any) => {
                  const isSystem = isSystemRole(role);
                  return (
                    <TableRow key={role.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Shield className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{role.name}</span>
                          {isSystem && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              <Globe className="w-3 h-3 mr-1" />
                              System-wide
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{role.description || 'No description'}</TableCell>
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
                                dialogTitle="Edit Role"
                                dialogDescription={'Edit the role permissions and details'}
                                dialogTrigger={
                                  <Button
                                    variant="default"
                                    size="sm"
                                  >
                                    <Pencil className="w-4 h-4" />
                                    Edit
                                  </Button>
                                }
                              />
                              <ConfirmationModal
                                confirmationButtonText="Delete Role"
                                confirmationMessage="This action cannot be undone. All users with this role will lose their permissions. Are you sure you want to delete this role?"
                                dialogTitle={'Delete Role ?'}
                                dialogTrigger={
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                  >
                                    <X className="w-4 h-4" />
                                    Delete
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

          <div className="flex justify-end mt-6">
            <Modal
              isDialogOpen={createRoleModal}
              onOpenChange={() => setCreateRoleModal(!createRoleModal)}
              minHeight="no-min"
              minWidth="xl"
              customWidth="max-w-7xl"
              dialogContent={<AddRole setCreateRoleModal={setCreateRoleModal} />}
              dialogTitle="Create a Role"
              dialogDescription={'Create a new role with specific permissions'}
              dialogTrigger={
                <Button>
                  <Shield className="w-4 h-4" />
                  Create a Role
                </Button>
              }
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default OrgRoles;
