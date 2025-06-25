'use client';
import { Info, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import useSWR, { mutate } from 'swr';

import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import Toast from '@components/Objects/StyledElements/Toast/Toast';
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip';
import { getAPIUrl } from '@services/config/config';
import { inviteBatchUsers } from '@services/organizations/invites';
import { swrFetcher } from '@services/utils/ts/requests';

function OrgUsersAdd() {
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.UserSettings.addSection');
  const [invitedUsers, setInvitedUsers] = useState('');
  const [selectedInviteCode, setSelectedInviteCode] = useState<string | undefined>();

  async function sendInvites() {
    if (!selectedInviteCode) {
      toast.error(t('selectInviteCode'));
      return;
    }
    if (!invitedUsers.trim()) {
      toast.error(t('enterEmailAddress'));
      return;
    }

    const toastId = toast.loading(t('sendingInvite'));
    try {
      const res = await inviteBatchUsers(org.id, invitedUsers, selectedInviteCode, access_token);
      if (res.status === 200) {
        mutate(`${getAPIUrl()}orgs/${org?.id}/invites/users`);
        toast.success(t('inviteSentSuccess'), { id: toastId });
        setInvitedUsers('');
      } else {
        toast.error(t('errors.sendInviteFailed'), { id: toastId });
      }
    } catch {
      toast.error(t('errors.sendInviteFailed'), { id: toastId });
    }
  }

  const { data: invites, isLoading: invitesLoading } = useSWR(
    org ? `${getAPIUrl()}orgs/${org?.id}/invites` : null,
    (url) => swrFetcher(url, access_token),
  );
  const { data: invited_users, isLoading: invitedUsersLoading } = useSWR(
    org ? `${getAPIUrl()}orgs/${org?.id}/invites/users` : null,
    (url) => swrFetcher(url, access_token),
  );

  useEffect(() => {
    if (invites && invites.length > 0 && selectedInviteCode === undefined) {
      setSelectedInviteCode(invites[0]?.invite_code_uuid);
    }
  }, [invites, selectedInviteCode]);

  const isLoading = invitesLoading || invitedUsersLoading;

  return (
    <>
      <Toast />
      {isLoading ? (
        <PageLoading />
      ) : (
        <>
          <div className="h-6" />
          <div className="shadow-xs mx-auto ml-10 mr-10 rounded-xl bg-white px-4 py-4">
            <div className="mb-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
              <h1 className="text-xl font-bold text-gray-800">{t('title')}</h1>
              <h2 className="text-md text-gray-500">{t('description')}</h2>
            </div>
            <div className="mx-auto flex space-x-2">
              <textarea
                value={invitedUsers}
                onChange={(e) => setInvitedUsers(e.target.value)}
                className="h-[200px] w-full rounded-md border bg-gray-100/40 px-3 py-2 placeholder:italic placeholder:text-slate-300"
                placeholder={t('textAreaPlaceholder')}
                name="invitedUsers"
                id="invitedUsersTextArea"
              />
            </div>
            <div className="mx-auto my-5 ml-2 flex items-center justify-between space-x-4">
              <div className="flex items-center space-x-2">
                <label
                  htmlFor="inviteCodeSelect"
                  className="flex items-center"
                >
                  {t('inviteCodeLabel')}
                </label>
                <select
                  id="inviteCodeSelect"
                  onChange={(e) => setSelectedInviteCode(e.target.value)}
                  value={selectedInviteCode || ''}
                  className="rounded-md border px-3 py-1 text-gray-400"
                  disabled={!invites || invites.length === 0}
                >
                  {invites?.length === 0 && <option value="">{t('noInviteCodesAvailable')}</option>}
                  {invites?.map((invite: any) => (
                    <option
                      key={invite.invite_code_uuid}
                      value={invite.invite_code_uuid}
                    >
                      {invite.invite_code}
                    </option>
                  ))}
                </select>
                <ToolTip
                  content={t('inviteCodeTooltip')}
                  sideOffset={8}
                  side="right"
                >
                  <Info
                    className="text-gray-400"
                    size={14}
                  />
                </ToolTip>
              </div>
              <div className="flex flex-row-reverse">
                <button
                  onClick={sendInvites}
                  className="flex items-center space-x-2 rounded-md bg-green-700 p-1 px-3 text-sm font-bold text-green-100 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!(selectedInviteCode && invitedUsers.trim())}
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{t('sendInvitesButton')}</span>
                </button>
              </div>
            </div>

            <div className="mb-3 mt-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
              <h1 className="text-xl font-bold text-gray-800">{t('invitedUsersTitle')}</h1>
              <h2 className="text-md text-gray-500">{t('invitedUsersDescription')}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-auto overflow-hidden whitespace-nowrap rounded-md text-left">
                <thead className="rounded-xl bg-gray-100 uppercase text-gray-500">
                  <tr className="font-bolder text-sm">
                    <th className="px-4 py-3">{t('emailHeader')}</th>
                    <th className="px-4 py-3">{t('signupStatusHeader')}</th>
                    <th className="px-4 py-3">{t('emailSentHeader')}</th>
                  </tr>
                </thead>
                <tbody className="mt-5 rounded-md bg-white">
                  {invited_users?.map((invited_user: any) => (
                    <tr
                      key={invited_user.email}
                      className="border-b border-gray-100 text-sm"
                    >
                      <td className="px-4 py-3">{invited_user.email}</td>
                      <td className="px-4 py-3">
                        {invited_user.pending ? (
                          <div className="py1 w-fit rounded-md bg-orange-400 px-2 text-orange-100">
                            {t('statusPending')}
                          </div>
                        ) : (
                          <div className="py1 w-fit rounded-md bg-green-400 px-2 text-green-100">
                            {t('statusSigned')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {invited_user.email_sent ? (
                          <div className="py1 w-fit rounded-md bg-green-600 px-2 text-green-100">
                            {t('emailSentYes')}
                          </div>
                        ) : (
                          <div className="py1 w-fit rounded-md bg-red-400 px-2 text-red-100">{t('emailSentNo')}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!invited_users || invited_users.length === 0) && (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-4 text-center text-gray-500"
                      >
                        {t('noInvitedUsers')}
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
  );
}

export default OrgUsersAdd;
