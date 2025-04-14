'use client'

import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import RolesUpdate from '@components/Objects/Modals/Dash/OrgUsers/RolesUpdate'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import Toast from '@components/Objects/StyledElements/Toast/Toast'
import { getAPIUrl } from '@services/config/config'
import { removeUserFromOrg } from '@services/organizations/orgs'
import { swrFetcher } from '@services/utils/ts/requests'
import { KeyRound, LogOut } from 'lucide-react'
import React, { useEffect } from 'react'
import toast from 'react-hot-toast'
import useSWR, { mutate } from 'swr'
import { useTranslations } from 'next-intl'

function OrgUsers() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.UserSettings.usersSection');
  const tNotify = useTranslations('Notifications');
  const tGeneral = useTranslations('General');

  const { data: orgUsers, error, isLoading } = useSWR(
    org ? `${getAPIUrl()}orgs/${org?.id}/users` : null,
    (url) => swrFetcher(url, access_token)
  )
  const [rolesModal, setRolesModal] = React.useState(false)
  const [selectedUser, setSelectedUser] = React.useState<any | null>(null)

  const handleRolesModal = (user: any) => {
    setSelectedUser(user)
    setRolesModal(true)
  }

  const handleCloseRolesModal = () => {
    setSelectedUser(null)
    setRolesModal(false)
  }

  const handleRemoveUser = async (user_id: any) => {
    const toastId = toast.loading(tNotify("removingUser"));
    try {
      const res = await removeUserFromOrg(org.id, user_id, access_token)
      if (res.status === 200) {
        await mutate(`${getAPIUrl()}orgs/${org.id}/users`)
        toast.success(tNotify("userRemovedSuccess"), {id:toastId});
      } else {
        toast.error(tNotify('errors.removeUserFailed'), {id:toastId});
      }
    } catch (error) {
       toast.error(tNotify('errors.removeUserFailed'), {id:toastId});
    }
  }

  return (
    <div>
      {isLoading ? (
        <div>
          <PageLoading />
        </div>
      ) : (
        <>
          <Toast></Toast>
          <div className="h-6"></div>
          <div className="ml-10 mr-10 mx-auto bg-white rounded-xl shadow-xs px-4 py-4  ">
            <div className="flex flex-col bg-gray-50 -space-y-1  px-5 py-3 rounded-md mb-3 ">
              <h1 className="font-bold text-xl text-gray-800">{t('activeUsersTitle')}</h1>
              <h2 className="text-gray-500  text-md">
                {' '}
                {t('description')}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="table-auto w-full text-left whitespace-nowrap rounded-md overflow-hidden">
                <thead className="bg-gray-100 text-gray-500 rounded-xl uppercase">
                  <tr className="font-bolder text-sm">
                    <th className="py-3 px-4">{t('userHeader')}</th>
                    <th className="py-3 px-4">{t('roleHeader')}</th>
                    <th className="py-3 px-4">{t('actionsHeader')}</th>
                  </tr>
                </thead>
                <tbody className="mt-5 bg-white rounded-md">
                  {orgUsers?.map((user: any) => (
                    <tr
                      key={user.user.id}
                      className="border-b border-gray-200 border-dashed"
                    >
                      <td className="py-3 px-4 flex space-x-2 items-center">
                        <span>
                          {user.user.first_name + ' ' + user.user.last_name}
                        </span>
                        <span className="text-xs bg-neutral-100 p-1 px-2 rounded-full text-neutral-400 font-semibold">
                          @{user.user.username}
                        </span>
                      </td>
                      <td className="py-3 px-4">{user.role.name}</td>
                      <td className="py-3 px-4 flex space-x-2 items-end">
                        <Modal
                          isDialogOpen={
                            rolesModal && selectedUser?.user?.user_uuid === user.user.user_uuid
                          }
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
                          dialogDescription={t('updateRoleModalDescription', { username: user.user.username })}
                          dialogTrigger={
                            <button className="flex space-x-2 hover:cursor-pointer p-1 px-3 bg-yellow-700 rounded-md font-bold items-center text-sm text-yellow-100">
                              <KeyRound className="w-4 h-4" />
                              <span>{t('editRoleButton')}</span>
                            </button>
                          }
                        />

                        <ConfirmationModal
                          confirmationButtonText={t('removeUserButton')}
                          confirmationMessage={t('removeUserModalMessage')}
                          dialogTitle={t('removeUserModalTitle', { username: user.user.username })}
                          dialogTrigger={
                            <button className="mr-2 flex space-x-2 hover:cursor-pointer p-1 px-3 bg-rose-700 rounded-md font-bold items-center text-sm text-rose-100">
                              <LogOut className="w-4 h-4" />
                              <span>{t('removeFromOrgButton')}</span>
                            </button>
                          }
                          functionToExecute={() => {
                            handleRemoveUser(user.user.id)
                          }}
                          status="warning"
                        ></ConfirmationModal>
                      </td>
                    </tr>
                  ))}
                  {(!orgUsers || orgUsers.length === 0) && (
                    <tr>
                      <td colSpan={3} className="text-center py-4 text-gray-500">
                        No users found in this organization.
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
  )
}

export default OrgUsers
