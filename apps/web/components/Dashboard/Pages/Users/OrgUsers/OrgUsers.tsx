'use client';

import { KeyRound, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import useSWR, { mutate } from 'swr';

import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import RolesUpdate from '@components/Objects/Modals/Dash/OrgUsers/RolesUpdate';
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import Toast from '@components/Objects/StyledElements/Toast/Toast';
import { getAPIUrl } from '@services/config/config';
import { removeUserFromOrg } from '@services/organizations/orgs';
import { swrFetcher } from '@services/utils/ts/requests';

function OrgUsers() {
  const org = useOrg() as any;
  const session = useLHSession() as any;
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

  const handleRemoveUser = async (user_id: any) => {
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
          <div className="shadow-xs mx-auto ml-10 mr-10 rounded-xl bg-white px-4 py-4">
            <div className="mb-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
              <h1 className="text-xl font-bold text-gray-800">{t('activeUsersTitle')}</h1>
              <h2 className="text-md text-gray-500"> {t('description')}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-auto overflow-hidden whitespace-nowrap rounded-md text-left">
                <thead className="rounded-xl bg-gray-100 uppercase text-gray-500">
                  <tr className="font-bolder text-sm">
                    <th className="px-4 py-3">{t('userHeader')}</th>
                    <th className="px-4 py-3">{t('roleHeader')}</th>
                    <th className="px-4 py-3">{t('actionsHeader')}</th>
                  </tr>
                </thead>
                <tbody className="mt-5 rounded-md bg-white">
                  {orgUsers?.map((user: any) => (
                    <tr
                      key={user.user.id}
                      className="border-b border-dashed border-gray-200"
                    >
                      <td className="flex items-center space-x-2 px-4 py-3">
                        <span>{`${user.user.first_name} ${user.user.last_name}`}</span>
                        <span className="rounded-full bg-neutral-100 p-1 px-2 text-xs font-semibold text-neutral-400">
                          @{user.user.username}
                        </span>
                      </td>
                      <td className="px-4 py-3">{user.role.name}</td>
                      <td className="flex items-end space-x-2 px-4 py-3">
                        {user.role.name === 'admin' ? (
                          <>
                            <Modal
                              isDialogOpen={rolesModal && selectedUser?.user?.user_uuid === user.user.user_uuid}
                              onOpenChange={(isOpen) => {
                                if (!isOpen) handleCloseRolesModal();
                              }}
                              minHeight="no-min"
                              dialogContent={
                                selectedUser && (
                                  <RolesUpdate
                                    alreadyAssignedRole={selectedUser.role.role_uuid}
                                    setRolesModal={setRolesModal}
                                    user={selectedUser}
                                  />
                                )
                              }
                              dialogTitle={t('updateRoleModalTitle')}
                              dialogDescription={t('updateRoleModalDescription', {
                                username: user.user.username,
                              })}
                              dialogTrigger={
                                <button
                                  className="flex items-center space-x-2 rounded-md bg-yellow-700 p-1 px-3 text-sm font-bold text-yellow-100 hover:cursor-pointer"
                                  onClick={() => handleRolesModal(user)}
                                >
                                  <KeyRound className="h-4 w-4" />
                                  <span>{t('editRoleButton')}</span>
                                </button>
                              }
                            />

                            <ConfirmationModal
                              confirmationButtonText={t('removeUserButton')}
                              confirmationMessage={t('removeUserModalMessage')}
                              dialogTitle={t('removeUserModalTitle', {
                                username: user.user.username,
                              })}
                              dialogTrigger={
                                <button
                                  className="mr-2 flex items-center space-x-2 rounded-md bg-rose-700 p-1 px-3 text-sm font-bold text-rose-100 hover:cursor-pointer"
                                  onClick={() => handleRemoveUser(user.user.id)}
                                >
                                  <LogOut className="h-4 w-4" />
                                  <span>{t('removeFromOrgButton')}</span>
                                </button>
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
                      </td>
                    </tr>
                  ))}
                  {(!orgUsers || orgUsers.length === 0) && (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-4 text-center text-gray-500"
                      >
                        {t('noUsersFound')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default OrgUsers;
