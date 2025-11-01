'use client';

import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import RolesUpdate from '@components/Objects/Modals/Dash/OrgUsers/RolesUpdate';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import Toast from '@components/Objects/StyledElements/Toast/Toast';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { removeUserFromOrg } from '@services/organizations/orgs';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { KeyRound, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import useSWR, { mutate } from 'swr';
import { useState } from 'react';

const OrgUsers = () => {
  const org = useOrg() as any;
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.UserSettings.usersSection');

  const {
    data: orgUsers,
    error,
    isLoading,
  } = useSWR(org ? `${getAPIUrl()}orgs/${org?.id}/users` : null, (url) => swrFetcher(url, access_token));
  const [rolesModal, setRolesModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  const handleRolesModal = (user: any) => {
    setSelectedUser(user);
    setRolesModal(true);
  };

  const handleCloseRolesModal = () => {
    setSelectedUser(null);
    setRolesModal(false);
  };

  const handleRemoveUser = async (user_id: number) => {
    const toastId = toast.loading(t('removingUser'));
    try {
      const res = await removeUserFromOrg(org.id, user_id, access_token);
      if (res.status === 200) {
        await mutate(`${getAPIUrl()}orgs/${org.id}/users`);
        toast.success(t('userRemovedSuccess'), { id: toastId });
      } else {
        toast.error(t('errors.removeUserFailed'), { id: toastId });
      }
    } catch {
      toast.error(t('errors.removeUserFailed'), { id: toastId });
    }
  };

  return (
    <div>
      {isLoading ? (
        <div>
          <PageLoading />
        </div>
      ) : (
        <>
          <Toast />
          <div className="h-6" />
          <div className="mx-auto mr-10 ml-10 rounded-xl bg-white px-4 py-4 shadow-xs">
            <div className="mb-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
              <h1 className="text-xl font-bold text-gray-800">{t('activeUsersTitle')}</h1>
              <h2 className="text-base text-gray-500"> {t('description')}</h2>
            </div>
            <div className="overflow-x-auto">
              <Table className="overflow-hidden">
                <TableHeader className="uppercase">
                  <TableRow>
                    <TableHead>{t('userHeader')}</TableHead>
                    <TableHead>{t('roleHeader')}</TableHead>
                    <TableHead>{t('actionsHeader')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgUsers?.map((user: any) => (
                    <TableRow key={user.user.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span>{`${user.user.first_name} ${user.user.last_name}`}</span>
                          <span className="rounded-full bg-neutral-100 p-1 px-2 text-xs font-semibold text-neutral-400">
                            @{user.user.username}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{user.role.name}</TableCell>
                      <TableCell>
                        <div className="flex items-end space-x-2">
                          {user.role.name !== 'Admin' ? (
                            <>
                              <Modal
                                isDialogOpen={
                                  rolesModal ? selectedUser?.user?.user_uuid === user.user.user_uuid : false
                                }
                                onOpenChange={(isOpen) => {
                                  if (!isOpen) handleCloseRolesModal();
                                }}
                                minHeight="no-min"
                                dialogContent={
                                  selectedUser ? (
                                    <RolesUpdate
                                      alreadyAssignedRole={selectedUser.role.role_uuid}
                                      setRolesModal={setRolesModal}
                                      user={selectedUser}
                                    />
                                  ) : null
                                }
                                dialogTitle={t('updateRoleModalTitle')}
                                dialogDescription={t('updateRoleModalDescription', {
                                  username: user.user.username,
                                })}
                                dialogTrigger={
                                  <span>
                                    <button
                                      className="flex items-center space-x-2 rounded-md bg-yellow-700 p-1 px-3 text-sm font-bold text-yellow-100 hover:cursor-pointer"
                                      onClick={() => {
                                        handleRolesModal(user);
                                      }}
                                    >
                                      <KeyRound className="h-4 w-4" />
                                      <span>{t('editRoleButton')}</span>
                                    </button>
                                  </span>
                                }
                              />

                              <ConfirmationModal
                                confirmationButtonText={t('removeUserButton')}
                                confirmationMessage={t('removeUserModalMessage')}
                                dialogTitle={t('removeUserModalTitle', {
                                  username: user.user.username,
                                })}
                                dialogTrigger={
                                  <span>
                                    <button
                                      className="mr-2 flex items-center space-x-2 rounded-md bg-rose-700 p-1 px-3 text-sm font-bold text-rose-100 hover:cursor-pointer"
                                      onClick={() => handleRemoveUser(user.user.id)}
                                    >
                                      <LogOut className="h-4 w-4" />
                                      <span>{t('removeFromOrgButton')}</span>
                                    </button>
                                  </span>
                                }
                                functionToExecute={() => {
                                  handleRemoveUser(user.user.id);
                                }}
                                status="warning"
                              />
                            </>
                          ) : (
                            <div className="text-neutral-500">{t('noActionsForAdministrators')}</div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!orgUsers || orgUsers.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="py-4 text-center text-gray-500"
                      >
                        {t('noUsersFound')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OrgUsers;
