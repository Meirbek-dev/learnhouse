'use client';
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal';
import EditUserGroup from '@components/Objects/Modals/Dash/OrgUserGroups/EditUserGroup';
import AddUserGroup from '@components/Objects/Modals/Dash/OrgUserGroups/AddUserGroup';
import ManageUsers from '@components/Objects/Modals/Dash/OrgUserGroups/ManageUsers';
import { Loader, Pencil, SquareUserRound, Users, X } from 'lucide-react';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { deleteUserGroup } from '@services/usergroups/usergroups';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { useTranslations } from 'next-intl';
import useSWR, { mutate } from 'swr';
import { toast } from 'react-hot-toast';
import { useState } from 'react';

function OrgUserGroups() {
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.UserSettings.usergroupsSection');
  const [userGroupManagementModal, setUserGroupManagementModal] = useState(false);
  const [createUserGroupModal, setCreateUserGroupModal] = useState(false);
  const [editUserGroupModal, setEditUserGroupModal] = useState(false);
  const [selectedUserGroup, setSelectedUserGroup] = useState<any | null>(null);
  const [selectedUserGroupIdForEdit, setSelectedUserGroupIdForEdit] = useState<string | null>(null);
  const [selectedUserGroupIdForManage, setSelectedUserGroupIdForManage] = useState<string | null>(null);

  const {
    data: usergroups,
    error,
    isLoading,
  } = useSWR(org ? `${getAPIUrl()}usergroups/org/${org.id}` : null, (url) => swrFetcher(url, access_token));

  const deleteUserGroupUI = async (usergroup_id: any) => {
    const toastId = toast.loading(t('deletingUserGroup'));
    try {
      const res = await deleteUserGroup(usergroup_id, access_token);
      if (res.status == 200) {
        mutate(`${getAPIUrl()}usergroups/org/${org.id}`);
        toast.success(t('userGroupDeletedSuccess'), { id: toastId });
      } else {
        toast.error(t('errors.deleteUserGroupFailed'), { id: toastId });
      }
    } catch {
      toast.error(t('errors.deleteUserGroupFailed'), { id: toastId });
    }
  };

  const handleOpenModal = (modalType: 'manage' | 'edit', userGroup: any) => {
    setSelectedUserGroup(userGroup);
    if (modalType === 'manage') {
      setSelectedUserGroupIdForManage(userGroup.id);
      setUserGroupManagementModal(true);
    } else if (modalType === 'edit') {
      setSelectedUserGroupIdForEdit(userGroup.id);
      setEditUserGroupModal(true);
    }
  };

  const handleCloseModal = (modalType: 'manage' | 'edit' | 'create') => {
    setSelectedUserGroup(null);
    if (modalType === 'manage') {
      setSelectedUserGroupIdForManage(null);
      setUserGroupManagementModal(false);
    } else if (modalType === 'edit') {
      setSelectedUserGroupIdForEdit(null);
      setEditUserGroupModal(false);
    } else if (modalType === 'create') {
      setCreateUserGroupModal(false);
    }
  };

  if (isLoading)
    return (
      <Loader
        size={16}
        className="mr-2 animate-spin"
      />
    );
  if (error) return <div>{t('errorLoadingUserGroups')}</div>;

  return (
    <>
      <div className="h-6" />
      <div className="mx-auto mr-10 ml-10 rounded-xl bg-white px-4 py-4 shadow-xs">
        <div className="mb-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
          <h1 className="text-xl font-bold text-gray-800">{t('title')}</h1>
          <h2 className="text-sm text-gray-500">{t('description')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-auto overflow-hidden rounded-md text-left whitespace-nowrap">
            <thead className="rounded-xl bg-gray-100 text-gray-500 uppercase">
              <tr className="font-bolder text-sm">
                <th className="px-4 py-3">{t('userGroupHeader')}</th>
                <th className="px-4 py-3">{t('descriptionHeader')}</th>
                <th className="px-4 py-3">{t('manageUsersHeader')}</th>
                <th className="px-4 py-3">{t('actionsHeader')}</th>
              </tr>
            </thead>
            <tbody className="mt-5 rounded-md bg-white">
              {usergroups?.map((usergroup: any) => (
                <tr
                  key={usergroup.id}
                  className="border-b border-gray-100 text-sm"
                >
                  <td className="px-4 py-3">{usergroup.name}</td>
                  <td className="px-4 py-3">{usergroup.description}</td>
                  <td className="px-4 py-3">
                    <Modal
                      isDialogOpen={userGroupManagementModal && selectedUserGroupIdForManage === usergroup.id}
                      onOpenChange={(isOpen) => {
                        if (!isOpen) handleCloseModal('manage');
                      }}
                      minHeight="lg"
                      minWidth="lg"
                      dialogContent={selectedUserGroup && <ManageUsers usergroup_id={selectedUserGroup.id} />}
                      dialogTitle={t('manageUsersModalTitle')}
                      dialogDescription={t('manageUsersModalDescription')}
                      dialogTrigger={
                        <button
                          className="flex items-center space-x-2 rounded-md bg-yellow-700 p-1 px-3 text-sm font-bold text-yellow-100 hover:cursor-pointer"
                          onClick={() => handleOpenModal('manage', usergroup)}
                          type="button"
                        >
                          <Users className="h-4 w-4" />
                          <span>{t('manageUsersButton')}</span>
                        </button>
                      }
                    />
                  </td>
                  <td className="flex space-x-2 px-4 py-3">
                    <Modal
                      isDialogOpen={editUserGroupModal && selectedUserGroupIdForEdit === usergroup.id}
                      onOpenChange={(isOpen) => {
                        if (!isOpen) handleCloseModal('edit');
                      }}
                      dialogTrigger={
                        <button
                          className="flex items-center space-x-2 rounded-md bg-sky-700 p-1 px-3 text-sm font-bold text-sky-100 hover:cursor-pointer"
                          onClick={() => handleOpenModal('edit', usergroup)}
                          type="button"
                        >
                          <Pencil className="size-4" />
                          <span>{t('editButton')}</span>
                        </button>
                      }
                      minHeight="sm"
                      minWidth="sm"
                      dialogContent={selectedUserGroup && <EditUserGroup usergroup={selectedUserGroup} />}
                    />
                    <ConfirmationModal
                      confirmationButtonText={t('deleteModalConfirmButton')}
                      confirmationMessage={t('deleteModalMessage')}
                      dialogTitle={t('deleteModalTitle')}
                      dialogTrigger={
                        <button className="flex items-center space-x-2 rounded-md bg-rose-700 p-1 px-3 text-sm font-bold text-rose-100 hover:cursor-pointer">
                          <X className="h-4 w-4" />
                          <span>{t('deleteButton')}</span>
                        </button>
                      }
                      functionToExecute={() => {
                        deleteUserGroupUI(usergroup.id);
                      }}
                      status="warning"
                    />
                  </td>
                </tr>
              ))}
              {(!usergroups || usergroups.length === 0) && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-4 text-center text-gray-500"
                  >
                    {t('noUserGroupsFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 mr-2 flex justify-end">
          <Modal
            isDialogOpen={createUserGroupModal}
            onOpenChange={(isOpen) => {
              if (!isOpen) handleCloseModal('create');
              else setCreateUserGroupModal(true);
            }}
            minHeight="no-min"
            dialogContent={<AddUserGroup setCreateUserGroupModal={setCreateUserGroupModal} />}
            dialogTitle={t('createUserGroupModalTitle')}
            dialogDescription={t('createUserGroupModalDescription')}
            dialogTrigger={
              <button className="flex items-center space-x-2 rounded-md bg-green-700 p-1 px-3 text-sm font-bold text-green-100 hover:cursor-pointer">
                <SquareUserRound className="h-4 w-4" />
                <span>{t('createUserGroupButton')}</span>
              </button>
            }
          />
        </div>
      </div>
    </>
  );
}

export default OrgUserGroups;
