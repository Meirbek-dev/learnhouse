'use client';

import { Select, SelectContent, SelectItem, SelectPositioner, SelectTrigger, SelectValue } from '@components/ui/select';
import { createInviteCode, createInviteCodeWithUserGroup } from '@services/organizations/invites';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { getOrgInvitesSwrKey } from '@services/organizations/keys';
import { getAPIUrl, getUriWithOrg } from '@services/config/config';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';
import { Ticket } from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { useState } from 'react';
import { toast } from 'sonner';

interface OrgInviteCodeGenerateProps {
  setInvitesModal: any;
}

const OrgInviteCodeGenerate = (props: OrgInviteCodeGenerateProps) => {
  const t = useTranslations('Components.OrgInviteCodeGenerate');
  const org = useOrg() as any;
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;

  const { data: usergroups } = useSWR(org ? `${getAPIUrl()}usergroups/org/${org.id}` : null, (url) =>
    swrFetcher(url, access_token),
  );

  // Use controlled state with default fallback to first usergroup
  const [usergroup_id, setUsergroup_id] = useState<number | null>(null);

  const usergroupItems = (usergroups || []).map((usergroup: any) => ({
    value: String(usergroup.id),
    label: usergroup.name,
  }));

  // Use first usergroup as default if not explicitly set
  const effectiveUsergroupId = usergroup_id ?? usergroups?.[0]?.id ?? 0;

  async function createInviteWithUserGroup() {
    const res = await createInviteCodeWithUserGroup(org.id, effectiveUsergroupId, session.data?.tokens?.access_token);
    if (res.status === 200) {
      mutate([getOrgInvitesSwrKey(org.id), access_token] as any);
      props.setInvitesModal(false);
    } else {
      toast.error(
        t('createInviteError', {
          error: res.data?.detail || t('unknownError'),
        }),
      );
    }
  }

  async function createInvite() {
    const res = await createInviteCode(org.id, session.data?.tokens?.access_token);
    if (res.status === 200) {
      mutate([getOrgInvitesSwrKey(org.id), access_token] as any);
      props.setInvitesModal(false);
    } else {
      toast.error(
        t('createInviteError', {
          error: res.data?.detail || t('unknownError'),
        }),
      );
    }
  }

  return (
    <div className="flex space-x-2 pt-2">
      <div className="flex h-[140px] w-full rounded-lg bg-slate-100">
        <div className="mx-auto flex flex-col">
          <h1 className="mx-auto pt-4 font-medium text-gray-600">{t('linkedTitle')}</h1>
          <h2 className="mx-auto text-xs font-medium text-gray-600">{t('linkedDescription')}</h2>
          <div className="mx-auto flex items-center space-x-4 pt-3">
            {usergroups?.length >= 1 && (
              <div className="flex items-center space-x-4">
                <Select
                  value={String(usergroup_id)}
                  onValueChange={(value) => {
                    setUsergroup_id(Number(value));
                  }}
                  items={usergroupItems}
                >
                  <SelectTrigger className="w-fit min-w-32">
                    <SelectValue placeholder={t('selectUserGroup')} />
                  </SelectTrigger>
                  <SelectPositioner>
                    <SelectContent>
                      {usergroupItems.map((usergroup) => (
                        <SelectItem
                          key={usergroup.value}
                          value={usergroup.value}
                        >
                          {usergroup.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectPositioner>
                </Select>

                <div className="">
                  <button
                    onClick={createInviteWithUserGroup}
                    className="flex w-fit items-center space-x-2 rounded-md bg-green-700 p-1 px-3 text-sm font-semibold text-green-100 hover:cursor-pointer"
                  >
                    <Ticket className="size-4" />
                    <span>{t('generateButton')}</span>
                  </button>
                </div>
              </div>
            )}
            {usergroups?.length === 0 && (
              <div className="flex items-center space-x-3 pt-3 text-xs">
                <span className="mx-3 rounded-full px-3 py-1 font-bold text-yellow-700">
                  {t('noUserGroupsAvailable')}
                </span>
                <Link
                  className="mx-1 rounded-full bg-blue-100 px-3 py-1 font-bold text-blue-700"
                  target="_blank"
                  href={getUriWithOrg(org.slug, '/dash/users/settings/usergroups')}
                >
                  {t('createUserGroupLink')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex h-[140px] w-full rounded-lg bg-slate-100">
        <div className="mx-auto flex flex-col">
          <h1 className="mx-auto pt-4 font-medium text-gray-600">{t('normalTitle')}</h1>
          <h2 className="mx-auto text-xs font-medium text-gray-600">{t('normalDescription')}</h2>
          <div className="mx-auto pt-4">
            <button
              onClick={createInvite}
              className="flex w-fit items-center space-x-2 rounded-md bg-green-700 p-1 px-3 text-sm font-bold text-green-100 hover:cursor-pointer"
            >
              <Ticket className="h-4 w-4" />
              <span>{t('generateButton')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrgInviteCodeGenerate;
