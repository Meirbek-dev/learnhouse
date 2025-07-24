'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import { linkUserToUserGroup, unLinkUserToUserGroup } from '@services/usergroups/usergroups';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { Check, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import useSWR, { mutate } from 'swr';

interface ManageUsersProps {
  usergroup_id: number;
}

const ManageUsers = (props: ManageUsersProps) => {
  const t = useTranslations('Components.ManageUsers');
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const { data: OrgUsers } = useSWR(org ? `${getAPIUrl()}orgs/${org.id}/users` : null, (url) =>
    swrFetcher(url, access_token),
  );
  const { data: UGusers } = useSWR(org ? `${getAPIUrl()}usergroups/${props.usergroup_id}/users` : null, (url) =>
    swrFetcher(url, access_token),
  );

  const isUserPartOfGroup = (user_id: number) => {
    if (UGusers) {
      return UGusers.some((user: any) => user.id === user_id);
    }
    return false;
  };

  const handleLinkUser = async (user_id: number) => {
    const res = await linkUserToUserGroup(props.usergroup_id, user_id, access_token);
    if (res.status === 200) {
      toast.success(t('linkSuccess'));
      mutate(`${getAPIUrl()}usergroups/${props.usergroup_id}/users`);
    } else {
      toast.error(t('linkError', { error: res.data?.detail || t('unknownError') }));
    }
  };

  const handleUnlinkUser = async (user_id: number) => {
    const res = await unLinkUserToUserGroup(props.usergroup_id, user_id, access_token);
    if (res.status === 200) {
      toast.success(t('unlinkSuccess'));
      mutate(`${getAPIUrl()}usergroups/${props.usergroup_id}/users`);
    } else {
      toast.error(t('unlinkError', { error: res.data?.detail || t('unknownError') }));
    }
  };

  return (
    <div className="py-3">
      <Table className="overflow-hidden rounded-md">
        <TableHeader className="rounded-md bg-gray-100 uppercase">
          <TableRow>
            <TableHead>{t('userHeader')}</TableHead>
            <TableHead>{t('linkedHeader')}</TableHead>
            <TableHead>{t('actionsHeader')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {OrgUsers?.map((user: any) => (
            <TableRow key={user.user.id}>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <span>{`${user.user.first_name} ${user.user.last_name}`}</span>
                  <span className="rounded-full bg-neutral-100 p-1 px-2 text-xs font-semibold text-neutral-400">
                    @{user.user.username}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                {isUserPartOfGroup(user.user.id) ? (
                  <div className="flex w-fit items-center space-x-1 rounded-full bg-cyan-100 px-4 py-1 text-cyan-800">
                    <Check size={16} />
                    <span>{t('linkedStatus')}</span>
                  </div>
                ) : (
                  <div className="flex w-fit items-center space-x-1 rounded-full bg-gray-100 px-4 py-1 text-gray-800">
                    <X size={16} />
                    <span>{t('notLinkedStatus')}</span>
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-end space-x-2">
                  <button
                    onClick={() => handleLinkUser(user.user.id)}
                    className="flex items-center space-x-2 rounded-md bg-cyan-700 p-1 px-3 text-sm font-bold text-cyan-100 hover:cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('linkButton')}</span>
                  </button>
                  <button
                    onClick={() => handleUnlinkUser(user.user.id)}
                    className="flex items-center space-x-2 rounded-md bg-gray-700 p-1 px-3 text-sm font-bold text-gray-100 hover:cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                    <span>{t('unlinkButton')}</span>
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ManageUsers;
