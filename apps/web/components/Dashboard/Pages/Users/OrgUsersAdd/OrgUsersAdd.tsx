'use client';
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import Toast from '@components/Objects/StyledElements/Toast/Toast'
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip'
import { getAPIUrl } from '@services/config/config'
import { inviteBatchUsers } from '@services/organizations/invites'
import { swrFetcher } from '@services/utils/ts/requests'
import { Info, UserPlus } from 'lucide-react'
import React, { useEffect } from 'react'
import toast from 'react-hot-toast'
import useSWR, { mutate } from 'swr'
import { useTranslations } from 'next-intl'

function OrgUsersAdd() {
    const org = useOrg() as any
    const session = useLHSession() as any
    const access_token = session?.data?.tokens?.access_token;
    const t = useTranslations('DashPage.UserSettings.addSection');
    const tNotify = useTranslations('Notifications');
    const tGeneral = useTranslations('General');
    const [invitedUsers, setInvitedUsers] = React.useState('');
    const [selectedInviteCode, setSelectedInviteCode] = React.useState<string | undefined>(undefined);

    async function sendInvites() {
        if (!selectedInviteCode) {
            toast.error('Please select an invite code.');
            return;
        }
        if (!invitedUsers.trim()) {
            toast.error('Please enter at least one email address.');
            return;
        }

        const toastId = toast.loading(tNotify("sendingInvite"));
        try {
            let res = await inviteBatchUsers(org.id, invitedUsers, selectedInviteCode, access_token);
            if (res.status == 200) {
                mutate(`${getAPIUrl()}orgs/${org?.id}/invites/users`);
                toast.success(tNotify("inviteSentSuccess"), {id:toastId});
                setInvitedUsers('');
            } else {
                toast.error(tNotify('errors.sendInviteFailed'), {id:toastId});
            }
        } catch (error) {
            toast.error(tNotify('errors.sendInviteFailed'), {id:toastId});
        }
    }

    const { data: invites, isLoading: invitesLoading } = useSWR(
        org ? `${getAPIUrl()}orgs/${org?.id}/invites` : null,
        (url) => swrFetcher(url, access_token)
    )
    const { data: invited_users, isLoading: invitedUsersLoading } = useSWR(
        org ? `${getAPIUrl()}orgs/${org?.id}/invites/users` : null,
        (url) => swrFetcher(url, access_token)
    )

    useEffect(() => {
        if (invites && invites.length > 0 && selectedInviteCode === undefined) {
            setSelectedInviteCode(invites[0]?.invite_code_uuid);
        }
    }, [invites, selectedInviteCode]);

    const isLoading = invitesLoading || invitedUsersLoading;

    return (
        <>
            <Toast></Toast>
            {isLoading ? (
                <PageLoading />
            ) : (
                <>
                    <div className="h-6"></div>
                    <div className="ml-10 mr-10 mx-auto bg-white rounded-xl shadow-xs px-4 py-4">
                        <div className="flex flex-col bg-gray-50 -space-y-1 px-5 py-3 rounded-md mb-3 ">
                            <h1 className="font-bold text-xl text-gray-800">{t('title')}</h1>
                            <h2 className="text-gray-500 text-md">
                                {t('description')}
                            </h2>
                        </div>
                        <div className="flex space-x-2 mx-auto">
                            <textarea
                                value={invitedUsers}
                                onChange={(e) => setInvitedUsers(e.target.value)}
                                className='w-full h-[200px] rounded-md border px-3 py-2 bg-gray-100/40 placeholder:italic placeholder:text-slate-300'
                                placeholder={t('textAreaPlaceholder')}
                                name="invitedUsers"
                                id="invitedUsersTextArea"
                            />
                        </div>
                        <div className="flex mx-auto my-5 ml-2 items-center space-x-4 justify-between">
                            <div className='flex space-x-2 items-center'>
                                <label htmlFor="inviteCodeSelect" className='flex items-center'>{t('inviteCodeLabel')}</label>
                                <select
                                    id="inviteCodeSelect"
                                    onChange={(e) => setSelectedInviteCode(e.target.value)}
                                    value={selectedInviteCode || ''}
                                    className='text-gray-400 border rounded-md px-3 py-1'
                                    disabled={!invites || invites.length === 0}
                                >
                                    {invites?.length === 0 && <option value="">No invite codes available</option>}
                                    {invites?.map((invite: any) => (
                                        <option key={invite.invite_code_uuid} value={invite.invite_code_uuid}>{invite.invite_code}</option>
                                    ))}
                                </select>
                                <ToolTip content={t('inviteCodeTooltip')} sideOffset={8} side="right">
                                    <Info className='text-gray-400' size={14} />
                                </ToolTip>
                            </div>
                            <div className='flex flex-row-reverse '>
                                <button
                                    onClick={sendInvites}
                                    className="flex space-x-2 hover:cursor-pointer p-1 px-3 bg-green-700 rounded-md font-bold items-center text-sm text-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={!selectedInviteCode || !invitedUsers.trim()}
                                >
                                    <UserPlus className="w-4 h-4" />
                                    <span>{t('sendInvitesButton')}</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col bg-gray-50 -space-y-1 px-5 py-3 rounded-md mt-3 mb-3 ">
                            <h1 className="font-bold text-xl text-gray-800">
                                {t('invitedUsersTitle')}
                            </h1>
                            <h2 className="text-gray-500 text-md">
                                {t('invitedUsersDescription')}
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="table-auto w-full text-left whitespace-nowrap rounded-md overflow-hidden">
                                <thead className="bg-gray-100 text-gray-500 rounded-xl uppercase">
                                    <tr className="font-bolder text-sm">
                                        <th className="py-3 px-4">{t('emailHeader')}</th>
                                        <th className="py-3 px-4">{t('signupStatusHeader')}</th>
                                        <th className="py-3 px-4">{t('emailSentHeader')}</th>
                                    </tr>
                                </thead>
                                <tbody className="mt-5 bg-white rounded-md">
                                    {invited_users?.map((invited_user: any) => (
                                        <tr
                                            key={invited_user.email}
                                            className="border-b border-gray-100 text-sm"
                                        >
                                            <td className="py-3 px-4">{invited_user.email}</td>
                                            <td className="py-3 px-4">{invited_user.pending
                                                ? <div className='bg-orange-400 text-orange-100 w-fit px-2 py1 rounded-md'>{t('statusPending')}</div>
                                                : <div className='bg-green-400 text-green-100 w-fit px-2 py1 rounded-md'>{t('statusSigned')}</div>}
                                            </td>
                                            <td className="py-3 px-4">{invited_user.email_sent
                                                ? <div className='bg-green-600 text-green-100 w-fit px-2 py1 rounded-md'>{t('emailSentYes')}</div>
                                                : <div className='bg-red-400 text-red-100 w-fit px-2 py1 rounded-md'>{t('emailSentNo')}</div>}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!invited_users || invited_users.length === 0) && (
                                        <tr>
                                            <td colSpan={3} className="text-center py-4 text-gray-500">
                                                No users have been invited yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}

export default OrgUsersAdd
