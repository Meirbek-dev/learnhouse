'use client';

import { useCourse } from '@components/Contexts/CourseContext';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { getAPIUrl, getUriWithOrg } from '@services/config/config';
import { linkResourcesToUserGroup } from '@services/usergroups/usergroups';
import { swrFetcher } from '@services/utils/ts/requests';
import { Info } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import useSWR, { mutate } from 'swr';

interface LinkToUserGroupProps {
  // React function, todo: fix types
  setUserGroupModal: any;
}

function LinkToUserGroup(props: LinkToUserGroupProps) {
  const t = useTranslations('Components.LinkToUserGroup');
  const course = useCourse() as any;
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const { courseStructure } = course;

  const { data: usergroups } = useSWR(courseStructure && org ? `${getAPIUrl()}usergroups/org/${org.id}` : null, (url) =>
    swrFetcher(url, access_token),
  );
  const [selectedUserGroup, setSelectedUserGroup] = useState(null) as any;

  const handleLink = async () => {
    const res = await linkResourcesToUserGroup(selectedUserGroup, courseStructure.course_uuid, access_token);
    if (res.status === 200) {
      props.setUserGroupModal(false);
      toast.success(t('linkSuccess'));
      mutate(`${getAPIUrl()}usergroups/resource/${courseStructure.course_uuid}`);
    } else {
      toast.error(t('linkError', { error: res.data?.detail || t('unknownError') }));
    }
  };

  useEffect(() => {
    if (usergroups && usergroups.length > 0) {
      setSelectedUserGroup(usergroups[0].id);
    }
  }, [usergroups, setSelectedUserGroup]);

  return (
    <div className="flex flex-col space-y-1">
      <div className="mx-auto mt-3 flex w-fit items-center space-x-2 rounded-full bg-yellow-100 px-4 py-2 text-sm text-yellow-900">
        <Info size={19} />
        <h1 className="font-medium">{t('infoMessage')}</h1>
      </div>
      <div className="flex flex-row items-center justify-between p-4">
        {usergroups?.length >= 1 && (
          <div className="py-1">
            <span className="mx-3 rounded-full bg-gray-100 px-3 py-1 font-bold text-gray-400">
              {t('userGroupNameLabel')}
            </span>

            <Select
              onValueChange={setSelectedUserGroup}
              defaultValue={selectedUserGroup}
            >
              <SelectTrigger className="w-fit min-w-32">
                <SelectValue placeholder={t('selectUserGroup')} />
              </SelectTrigger>
              <SelectContent>
                {usergroups?.map((group: any) => (
                  <SelectItem
                    key={group.id}
                    value={group.id}
                  >
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {usergroups?.length == 0 && (
          <div className="flex items-center space-x-3">
            <span className="mx-3 rounded-full px-3 py-1 font-semibold text-yellow-700">{t('noUserGroupsAvailable')}</span>
            <Link
              className="mx-1 rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-700"
              target="_blank"
              href={getUriWithOrg(org.slug, '/dash/users/settings/usergroups')}
            >
              {t('createUserGroupLink')}
            </Link>
          </div>
        )}
        <div className="py-3">
          <button
            onClick={() => {
              handleLink();
            }}
            className="rounded-md bg-green-700 px-4 py-2 font-bold text-white shadow-sm"
          >
            {t('linkButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LinkToUserGroup;
