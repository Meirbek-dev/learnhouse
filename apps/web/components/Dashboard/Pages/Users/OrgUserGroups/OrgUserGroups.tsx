'use client'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import AddUserGroup from '@components/Objects/Modals/Dash/OrgUserGroups/AddUserGroup'
import EditUserGroup from '@components/Objects/Modals/Dash/OrgUserGroups/EditUserGroup'
import ManageUsers from '@components/Objects/Modals/Dash/OrgUserGroups/ManageUsers'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { getAPIUrl } from '@services/config/config'
import { deleteUserGroup } from '@services/usergroups/usergroups'
import { swrFetcher } from '@services/utils/ts/requests'
import { Pencil, SquareUserRound, Users, X } from 'lucide-react'
import React from 'react'
import toast from 'react-hot-toast'
import useSWR, { mutate } from 'swr'
import { useTranslations } from 'next-intl'

function OrgUserGroups() {
    const org = useOrg() as any
    const session = useLHSession() as any
    const access_token = session?.data?.tokens?.access_token;
    const t = useTranslations('DashPage.UserSettings.usergroupsSection');
    const tNotify = useTranslations('Notifications');
    const tGeneral = useTranslations('General');
    const [userGroupManagementModal, setUserGroupManagementModal] = React.useState(false)
    const [createUserGroupModal, setCreateUserGroupModal] = React.useState(false)
    const [editUserGroupModal, setEditUserGroupModal] = React.useState(false)
    const [selectedUserGroup, setSelectedUserGroup] = React.useState<any | null>(null)
    const [selectedUserGroupIdForEdit, setSelectedUserGroupIdForEdit] = React.useState<string | null>(null)
    const [selectedUserGroupIdForManage, setSelectedUserGroupIdForManage] = React.useState<string | null>(null)

    const { data: usergroups, error, isLoading } = useSWR(
        org ? `${getAPIUrl()}usergroups/org/${org.id}` : null,
        (url) => swrFetcher(url, access_token)
    )

    const deleteUserGroupUI = async (usergroup_id: any) => {
        const toastId = toast.loading(tNotify("deletingUserGroup"));
        try {
            const res = await deleteUserGroup(usergroup_id, access_token)
            if (res.status == 200) {
                mutate(`${getAPIUrl()}usergroups/org/${org.id}`)
                toast.success(tNotify("userGroupDeletedSuccess"), {id:toastId})
            }
            else {
                toast.error(tNotify('errors.deleteUserGroupFailed'), {id:toastId})
            }
        } catch (error) {
            toast.error(tNotify('errors.deleteUserGroupFailed'), {id:toastId})
        }
    }

    const handleOpenModal = (modalType: 'manage' | 'edit', userGroup: any) => {
        setSelectedUserGroup(userGroup)
        if (modalType === 'manage') {
            setSelectedUserGroupIdForManage(userGroup.id)
            setUserGroupManagementModal(true)
        } else if (modalType === 'edit') {
            setSelectedUserGroupIdForEdit(userGroup.id)
            setEditUserGroupModal(true)
        }
    }

    const handleCloseModal = (modalType: 'manage' | 'edit' | 'create') => {
        setSelectedUserGroup(null)
        if (modalType === 'manage') {
            setSelectedUserGroupIdForManage(null)
            setUserGroupManagementModal(false)
        } else if (modalType === 'edit') {
            setSelectedUserGroupIdForEdit(null)
            setEditUserGroupModal(false)
        } else if (modalType === 'create') {
            setCreateUserGroupModal(false)
        }
    }

    if (isLoading) return <div>{tGeneral('loading')}</div>
    if (error) return <div>Error loading user groups.</div>

    return (
        <>
            <div className="h-6"></div>
            <div className="ml-10 mr-10 mx-auto bg-white rounded-xl shadow-xs px-4 py-4">
                <div className="flex flex-col bg-gray-50 -space-y-1  px-5 py-3 rounded-md mb-3 ">
                    <h1 className="font-bold text-xl text-gray-800">{t('title')}</h1>
                    <h2 className="text-gray-500 text-sm">
                        {t('description')}
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="table-auto w-full text-left whitespace-nowrap rounded-md overflow-hidden">
                        <thead className="bg-gray-100 text-gray-500 rounded-xl uppercase">
                            <tr className="font-bolder text-sm">
                                <th className="py-3 px-4">{t('userGroupHeader')}</th>
                                <th className="py-3 px-4">{t('descriptionHeader')}</th>
                                <th className="py-3 px-4">{t('manageUsersHeader')}</th>
                                <th className="py-3 px-4">{t('actionsHeader')}</th>
                            </tr>
                        </thead>
                        <tbody className="mt-5 bg-white rounded-md">
                            {usergroups?.map((usergroup: any) => (
                                <tr key={usergroup.id} className="border-b border-gray-100 text-sm">
                                    <td className="py-3 px-4">{usergroup.name}</td>
                                    <td className="py-3 px-4 ">{usergroup.description}</td>
                                    <td className="py-3 px-4 ">
                                        <Modal
                                            isDialogOpen={
                                                userGroupManagementModal &&
                                                selectedUserGroupIdForManage === usergroup.id
                                            }
                                            onOpenChange={(isOpen) => {
                                                if (!isOpen) handleCloseModal('manage')
                                            }}
                                            minHeight="lg"
                                            minWidth='lg'
                                            dialogContent={
                                                selectedUserGroup && (
                                                    <ManageUsers
                                                        usergroup_id={selectedUserGroup.id}
                                                    />
                                                )
                                            }
                                            dialogTitle={t('manageUsersModalTitle')}
                                            dialogDescription={t('manageUsersModalDescription')}
                                            dialogTrigger={
                                                <button className="flex space-x-2 hover:cursor-pointer p-1 px-3 bg-yellow-700 rounded-md font-bold items-center text-sm text-yellow-100">
                                                    <Users className="w-4 h-4" />
                                                    <span>{t('manageUsersButton')}</span>
                                                </button>
                                            }
                                        />
                                    </td>
                                    <td className="py-3 px-4 flex space-x-2">
                                        <Modal
                                            isDialogOpen={
                                                editUserGroupModal &&
                                                selectedUserGroupIdForEdit === usergroup.id
                                            }
                                            onOpenChange={(isOpen) => {
                                                if (!isOpen) handleCloseModal('edit')
                                            }}
                                            dialogTrigger={
                                                <button className="flex space-x-2 hover:cursor-pointer p-1 px-3 bg-sky-700 rounded-md font-bold items-center text-sm text-sky-100">
                                                    <Pencil className="size-4" />
                                                    <span>{t('editButton')}</span>
                                                </button>
                                            }
                                            minHeight='sm'
                                            minWidth='sm'
                                            dialogContent={
                                                selectedUserGroup && (
                                                    <EditUserGroup
                                                        usergroup={selectedUserGroup}
                                                    />
                                                )
                                            }
                                        />
                                        <ConfirmationModal
                                            confirmationButtonText={t('deleteModalConfirmButton')}
                                            confirmationMessage={t('deleteModalMessage')}
                                            dialogTitle={t('deleteModalTitle')}
                                            dialogTrigger={
                                                <button className="flex space-x-2 hover:cursor-pointer p-1 px-3 bg-rose-700 rounded-md font-bold items-center text-sm text-rose-100">
                                                    <X className="w-4 h-4" />
                                                    <span>{t('deleteButton')}</span>
                                                </button>
                                            }
                                            functionToExecute={() => {
                                                deleteUserGroupUI(usergroup.id)
                                            }}
                                            status="warning"
                                        ></ConfirmationModal>
                                    </td>
                                </tr>
                            ))}
                            {(!usergroups || usergroups.length === 0) && (
                                <tr>
                                    <td colSpan={4} className="text-center py-4 text-gray-500">
                                        No user groups found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className='flex justify-end mt-3 mr-2'>
                    <Modal
                        isDialogOpen={
                            createUserGroupModal
                        }
                        onOpenChange={(isOpen) => {
                            if (!isOpen) handleCloseModal('create')
                            else setCreateUserGroupModal(true)
                        }}
                        minHeight="no-min"
                        dialogContent={
                            <AddUserGroup
                                setCreateUserGroupModal={setCreateUserGroupModal}
                            />
                        }
                        dialogTitle={t('createUserGroupModalTitle')}
                        dialogDescription={t('createUserGroupModalDescription')}
                        dialogTrigger={
                            <button
                                className=" flex space-x-2 hover:cursor-pointer p-1 px-3 bg-green-700 rounded-md font-bold items-center text-sm text-green-100"
                            >
                                <SquareUserRound className="w-4 h-4" />
                                <span>{t('createUserGroupButton')}</span>
                            </button>
                        }
                    />
                </div>
            </div>
        </>
    )
}

export default OrgUserGroups
