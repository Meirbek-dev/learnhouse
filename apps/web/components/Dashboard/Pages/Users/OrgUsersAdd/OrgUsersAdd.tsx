'use client';

import { Select, SelectContent, SelectGroup, SelectItem, SelectPositioner, SelectTrigger, SelectValue } from '@components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip';

import { inviteBatchUsers } from '@services/organizations/invites';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { Textarea } from '@components/ui/textarea';
import { Info, UserPlus } from 'lucide-react';
import { Label } from '@components/ui/label';
import { useTranslations } from 'next-intl';
import useSWR, { mutate } from 'swr';
import { useState } from 'react';
import { toast } from 'sonner';

const OrgUsersAdd = () => {
  const org = useOrg() as any;
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.UserSettings.addSection');
  const [invitedUsers, setInvitedUsers] = useState('');
  const [selectedInviteCode, setSelectedInviteCode] = useState<string | null>(null);

  const { data: invites, isLoading: invitesLoading } = useSWR(
    org ? `${getAPIUrl()}orgs/${org?.id}/invites` : null,
    (url) => swrFetcher(url, access_token),
  );
  const { data: invited_users, isLoading: invitedUsersLoading } = useSWR(
    org ? `${getAPIUrl()}orgs/${org?.id}/invites/users` : null,
    (url) => swrFetcher(url, access_token),
  );

  // Use first invite code as default if not explicitly set
  const effectiveInviteCode = selectedInviteCode ?? invites?.[0]?.invite_code_uuid;

  const inviteItems = (invites || []).map((invite: any) => ({
    value: invite.invite_code_uuid,
    label: invite.invite_code,
  }));

  async function sendInvites() {
    if (!effectiveInviteCode) {
      toast.error(t('selectInviteCode'));
      return;
    }
    if (!invitedUsers.trim()) {
      toast.error(t('enterEmailAddress'));
      return;
    }

    const toastId = toast.loading(t('sendingInvite'));
    try {
      const res = await inviteBatchUsers(org.id, invitedUsers, effectiveInviteCode, access_token);
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

  const isLoading = invitesLoading || invitedUsersLoading;

  return (
    <>
      {isLoading ? (
        <PageLoading />
      ) : (
        <>
          <div className="h-6" />
          <div className="mx-auto mr-10 ml-10 rounded-xl bg-white px-4 py-4 shadow-xs">
            <div className="mb-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
              <h1 className="text-xl font-bold text-gray-800">{t('title')}</h1>
              <h2 className="text-base text-gray-500">{t('description')}</h2>
            </div>
            <div className="mx-auto flex space-x-2">
              <Textarea
                value={invitedUsers}
                onChange={(e) => {
                  setInvitedUsers(e.target.value);
                }}
                className="h-[200px] w-full italic"
                placeholder={t('textAreaPlaceholder')}
                name="invitedUsers"
                id="invitedUsersTextArea"
              />
            </div>
            <div className="mx-auto my-5 ml-2 flex items-center justify-between space-x-4">
              <div className="flex items-center space-x-2">
                <Label
                  htmlFor="inviteCodeSelect"
                  className="flex items-center"
                >
                  {t('inviteCodeLabel')}
                </Label>
                <Select
                  value={effectiveInviteCode || ''}
                  onValueChange={(value) => setSelectedInviteCode(value)}
                  items={inviteItems}
                >
                  <SelectTrigger
                    id="inviteCodeSelect"
                    disabled={!invites || invites.length === 0}
                    className="w-fit min-w-32"
                  >
                    <SelectValue
                      placeholder={
                        !invites || invites.length === 0 ? t('noInviteCodesAvailable') : t('selectInviteCode')
                      }
                    />
                  </SelectTrigger>
                  <SelectPositioner>
                    <SelectContent>
                      <SelectGroup>
                        {inviteItems.map((invite: any) => (
                          <SelectItem
                            key={invite.value}
                            value={invite.value}
                          >
                            {invite.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </SelectPositioner>
                </Select>
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
                  className="flex items-center space-x-2 rounded-md bg-green-700 p-1 px-3 text-sm font-semibold text-green-100 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!(selectedInviteCode && invitedUsers.trim())}
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{t('sendInvitesButton')}</span>
                </button>
              </div>
            </div>

            <div className="mt-3 mb-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
              <h1 className="text-xl font-bold text-gray-800">{t('invitedUsersTitle')}</h1>
              <h2 className="text-base text-gray-500">{t('invitedUsersDescription')}</h2>
            </div>
            <div className="overflow-x-auto">
              <Table className="overflow-hidden">
                <TableHeader className="uppercase">
                  <TableRow>
                    <TableHead>{t('emailHeader')}</TableHead>
                    <TableHead>{t('signupStatusHeader')}</TableHead>
                    <TableHead>{t('emailSentHeader')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invited_users?.map((invited_user: any) => (
                    <TableRow key={invited_user.email}>
                      <TableCell>{invited_user.email}</TableCell>
                      <TableCell>
                        {invited_user.pending ? (
                          <div className="py1 w-fit rounded-md bg-orange-400 px-2 text-orange-100">
                            {t('statusPending')}
                          </div>
                        ) : (
                          <div className="py1 w-fit rounded-md bg-green-400 px-2 text-green-100">
                            {t('statusSigned')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {invited_user.email_sent ? (
                          <div className="py1 w-fit rounded-md bg-green-600 px-2 text-green-100">
                            {t('emailSentYes')}
                          </div>
                        ) : (
                          <div className="py1 w-fit rounded-md bg-red-400 px-2 text-red-100">{t('emailSentNo')}</div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!invited_users || invited_users.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="py-4 text-center text-gray-500"
                      >
                        {t('noInvitedUsers')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default OrgUsersAdd;
