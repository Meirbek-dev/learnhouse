import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { bulkAddContributors, bulkRemoveContributors, editContributor } from '@services/courses/courses';
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext';
import { Check, ChevronDown, Search, UserPen, Users } from 'lucide-react';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { getUserAvatarMediaDirectory } from '@services/media/media';
import { searchOrgContent } from '@services/search/search';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import UserAvatar from '@components/Objects/UserAvatar';
import { useLocale, useTranslations } from 'next-intl';
import { getAPIUrl } from '@services/config/config';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Locale } from '@/i18n/config';
import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import toast from 'react-hot-toast';

type EditCourseContributorsProps = {
  orgslug: string;
  course_uuid?: string;
};

type ContributorRole = 'CREATOR' | 'CONTRIBUTOR' | 'MAINTAINER' | 'REPORTER';
type ContributorStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';

interface SearchUser {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_image: string;
  avatar_url?: string;
  id: number;
  user_uuid: string;
}

interface Contributor {
  id: string;
  user_id: string;
  authorship: ContributorRole;
  authorship_status: ContributorStatus;
  creation_date: string;
  user: {
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_image: string;
    user_uuid: string;
  };
}

interface BulkAddResponse {
  successful: string[];
  failed: {
    username: string;
    reason: string;
  }[];
}

// Helper function for date formatting
const formatDate = (dateString: string, locale: Locale) => {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const RoleDropdown = ({
  contributor,
  updateContributor,
  t,
}: {
  contributor: Contributor;
  updateContributor: any;
  t: any;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="outline"
        className="w-[200px] justify-between"
        disabled={contributor.authorship === 'CREATOR'}
      >
        {t(contributor.authorship.toLowerCase() as any) || contributor.authorship}
        <ChevronDown className="text-muted-foreground ml-2 h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      className="w-[200px]"
    >
      {['CONTRIBUTOR', 'MAINTAINER', 'REPORTER'].map((role) => (
        <DropdownMenuItem
          key={role}
          onClick={() =>
            updateContributor(contributor.user_id, {
              authorship: role as ContributorRole,
            })
          }
          className="justify-between"
        >
          {t(role.toLowerCase() as any)}
          {contributor.authorship === role && <Check className="ml-2 h-4 w-4" />}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

const StatusDropdown = ({
  contributor,
  updateContributor,
  t,
  getStatusStyle,
}: {
  contributor: Contributor;
  updateContributor: any;
  t: any;
  getStatusStyle: any;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="outline"
        className={`w-[200px] justify-between ${getStatusStyle(contributor.authorship_status)}`}
        disabled={contributor.authorship === 'CREATOR'}
      >
        {t(contributor.authorship_status.toLowerCase() as any) || contributor.authorship_status}
        <ChevronDown className="ml-2 h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      className="w-[200px]"
    >
      {['ACTIVE', 'INACTIVE', 'PENDING'].map((status) => (
        <DropdownMenuItem
          key={status}
          onClick={() =>
            updateContributor(contributor.user_id, {
              authorship_status: status as ContributorStatus,
            })
          }
          className="justify-between"
        >
          {t(status.toLowerCase() as any)}
          {contributor.authorship_status === status && <Check className="ml-2 h-4 w-4" />}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

function EditCourseContributors(props: EditCourseContributorsProps) {
  const t = useTranslations('DashPage.EditCourseContributors');
  const locale = useLocale() as Locale;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const course = useCourse() as any;
  const { isLoading, courseStructure } = course as any;
  const dispatchCourse = useCourseDispatch() as any;
  const org = useOrg() as any;

  const { data: contributors } = useSWR<Contributor[]>(
    courseStructure ? `${getAPIUrl()}courses/${courseStructure.course_uuid}/contributors` : null,
    (url: string) => swrFetcher(url, access_token),
  );

  const [isOpenToContributors, setIsOpenToContributors] = useState<boolean | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedContributors, setSelectedContributors] = useState<string[]>([]);
  const [masterCheckboxChecked, setMasterCheckboxChecked] = useState(false);

  useEffect(() => {
    if (!isLoading && courseStructure?.open_to_contributors !== undefined) {
      setIsOpenToContributors(courseStructure.open_to_contributors);
    }
  }, [isLoading, courseStructure]);

  useEffect(() => {
    if (!isLoading && courseStructure?.open_to_contributors !== undefined && isOpenToContributors !== undefined) {
      if (isOpenToContributors !== courseStructure.open_to_contributors) {
        dispatchCourse({ type: 'setIsNotSaved' });
        const updatedCourse = {
          ...courseStructure,
          open_to_contributors: isOpenToContributors,
        };
        dispatchCourse({ type: 'setCourseStructure', payload: updatedCourse });
      }
    }
  }, [isLoading, isOpenToContributors, courseStructure, dispatchCourse]);

  useEffect(() => {
    const searchUsers = async () => {
      if (debouncedSearch.trim().length === 0) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const response = await searchOrgContent(org?.slug, debouncedSearch, 1, 5, null, access_token);

        if (response.success && response.data?.users) {
          const users = response.data.users.map((user: SearchUser) => ({
            ...user,
            avatar_url: user.avatar_image ? getUserAvatarMediaDirectory(user.user_uuid, user.avatar_image) : '',
          }));
          setSearchResults(users);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error(t('errorSearchingUsers'), error);
        setSearchResults([]);
      }
      setIsSearching(false);
    };

    if (org?.slug && access_token) {
      searchUsers();
    }
  }, [debouncedSearch, org?.slug, access_token, t]);

  useEffect(() => {
    if (contributors) {
      const nonCreatorContributors = contributors.filter((c) => c.authorship !== 'CREATOR');
      setMasterCheckboxChecked(
        nonCreatorContributors.length > 0 && selectedContributors.length === nonCreatorContributors.length,
      );
    }
  }, [contributors, selectedContributors]);

  const handleUserSelect = (username: string) => {
    setSelectedUsers((prev) => {
      if (prev.includes(username)) {
        return prev.filter((u) => u !== username);
      }
      return [...prev, username];
    });
  };

  const handleAddContributors = async () => {
    if (selectedUsers.length === 0) return;

    try {
      const response = await bulkAddContributors(courseStructure.course_uuid, selectedUsers, access_token);
      if (response.status === 200) {
        const result = response.data as BulkAddResponse;

        // Show success message for successful adds
        if (result.successful.length > 0) {
          toast.success(
            t('successfullyAddedContributors', {
              count: result.successful.length,
            }),
          );
        }

        // Show error messages for failed adds
        result.failed.forEach((failure) => {
          toast.error(
            t('failedToAddContributor', {
              username: failure.username,
              reason: failure.reason,
            }),
          );
        });

        // Refresh contributors list
        mutate(`${getAPIUrl()}courses/${courseStructure.course_uuid}/contributors`);
        // Clear selection and search
        setSelectedUsers([]);
        setSearchQuery('');
      }
    } catch (error) {
      console.error(t('errorAddingContributors'), error);
      toast.error(t('failedToAddContributorsGeneral'));
    }
  };

  const updateContributor = async (
    contributorId: string,
    data: {
      authorship?: ContributorRole;
      authorship_status?: ContributorStatus;
    },
  ) => {
    try {
      // Find the current contributor to get their current values
      const currentContributor = contributors?.find((c) => c.user_id === contributorId);
      if (!currentContributor) return;

      // Don't allow editing if the user is a CREATOR
      if (currentContributor.authorship === 'CREATOR') {
        toast.error(t('cannotModifyCreator'));
        return;
      }

      // Always send both values in the request
      const updatedData = {
        authorship: data.authorship || currentContributor.authorship,
        authorship_status: data.authorship_status || currentContributor.authorship_status,
      };

      const res = await editContributor(
        courseStructure.course_uuid,
        contributorId,
        updatedData.authorship,
        updatedData.authorship_status,
        access_token,
      );
      if (res.status === 200 && res.data?.status === 'success') {
        toast.success(res.data.detail || t('successfullyUpdatedContributor'));
        mutate(`${getAPIUrl()}courses/${courseStructure.course_uuid}/contributors`);
      } else {
        toast.error(res.data?.detail || t('failedToUpdateContributor'));
      }
    } catch (error) {
      toast.error(t('errorUpdatingContributor'));
    }
  };

  const getStatusStyle = (status: ContributorStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800';
      case 'INACTIVE':
        return 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-gray-800';
      case 'PENDING':
        return 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 hover:text-yellow-800';
      default:
        return 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-gray-800';
    }
  };

  const sortContributors = (contributors: Contributor[] | undefined) => {
    if (!contributors) return [];

    // Find the creator and other contributors
    const creator = contributors.find((c) => c.authorship === 'CREATOR');
    const otherContributors = contributors.filter((c) => c.authorship !== 'CREATOR');

    // Return array with creator at the top, followed by other contributors in their original order
    return creator ? [creator, ...otherContributors] : otherContributors;
  };

  const handleContributorSelect = (userId: string) => {
    setSelectedContributors((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      return [...prev, userId];
    });
  };

  const handleBulkRemove = async () => {
    if (selectedContributors.length === 0) return;

    try {
      // Get the usernames from the selected contributors
      const selectedUsernames =
        contributors?.filter((c) => selectedContributors.includes(c.user_id)).map((c) => c.user.username) || [];

      console.log('Sending usernames:', selectedUsernames);

      const response = await bulkRemoveContributors(courseStructure.course_uuid, selectedUsernames, access_token);

      if (response.status === 200) {
        toast.success(
          t('successfullyRemovedContributors', {
            count: selectedContributors.length,
          }),
        );
        // Refresh contributors list
        mutate(`${getAPIUrl()}courses/${courseStructure.course_uuid}/contributors`);
        // Clear selection
        setSelectedContributors([]);
      }
    } catch (error) {
      console.error(t('errorRemovingContributors'), error);
      toast.error(t('failedToRemoveContributorsGeneral'));
    }
  };

  return (
    <div>
      {courseStructure && (
        <div>
          <div className="h-6" />
          <div className="shadow-xs mx-4 rounded-xl bg-white px-4 py-4 sm:mx-10">
            <div className="mb-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-3 py-3 sm:px-5">
              <h1 className="text-lg font-bold text-gray-800 sm:text-xl">{t('courseContributorsTitle')}</h1>
              <h2 className="text-xs text-gray-500 sm:text-sm">{t('courseContributorsSubtitle')}</h2>
            </div>
            <div className="mx-auto mb-3 flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
              <ConfirmationModal
                confirmationButtonText={t('openToContributorsButton')}
                confirmationMessage={t('openToContributorsMessage')}
                dialogTitle={t('openToContributorsTitle')}
                dialogTrigger={
                  <div className="h-[200px] w-full cursor-pointer rounded-lg bg-slate-100 transition-all hover:bg-slate-200">
                    {isOpenToContributors && (
                      <div className="absolute mx-3 my-3 w-fit rounded-lg bg-green-200 px-3 py-1 text-sm font-bold text-green-600">
                        {t('activeStatus')}
                      </div>
                    )}
                    <div className="flex h-full flex-col items-center justify-center space-y-1 p-2 sm:p-4">
                      <UserPen
                        className="text-slate-400"
                        size={32}
                      />
                      <div className="text-xl font-bold text-slate-700 sm:text-2xl">{t('openToContributorsTitle')}</div>
                      <div className="sm:text-md w-full text-center text-sm leading-5 tracking-tight text-gray-400 sm:w-[500px]">
                        {t('openToContributorsDescription')}
                      </div>
                    </div>
                  </div>
                }
                functionToExecute={() => setIsOpenToContributors(true)}
                status="info"
              />
              <ConfirmationModal
                confirmationButtonText={t('closeToContributorsButton')}
                confirmationMessage={t('closeToContributorsMessage')}
                dialogTitle={t('closeToContributorsTitle')}
                dialogTrigger={
                  <div className="h-[200px] w-full cursor-pointer rounded-lg bg-slate-100 transition-all hover:bg-slate-200">
                    {!isOpenToContributors && (
                      <div className="absolute mx-3 my-3 w-fit rounded-lg bg-green-200 px-3 py-1 text-sm font-bold text-green-600">
                        {t('activeStatus')}
                      </div>
                    )}
                    <div className="flex h-full flex-col items-center justify-center space-y-1 p-2 sm:p-4">
                      <Users
                        className="text-slate-400"
                        size={32}
                      />
                      <div className="text-xl font-bold text-slate-700 sm:text-2xl">
                        {t('closeToContributorsTitle')}
                      </div>
                      <div className="sm:text-md w-full text-center text-sm leading-5 tracking-tight text-gray-400 sm:w-[500px]">
                        {t('closeToContributorsDescription')}
                      </div>
                    </div>
                  </div>
                }
                functionToExecute={() => setIsOpenToContributors(false)}
                status="info"
              />
            </div>
            <div className="space-y-4">
              <div className="relative">
                <Search className="text-muted-foreground absolute left-2 top-2.5 h-4 w-4" />
                <Input
                  placeholder={t('searchUsersPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              {searchQuery && (
                <div className="nice-shadow divide-y rounded-xl bg-white">
                  {isSearching ? (
                    <div className="p-4 text-center text-sm text-gray-500">{t('searchingMessage')}</div>
                  ) : searchResults && searchResults.length > 0 ? (
                    <>
                      {selectedUsers.length > 0 && (
                        <div className="bg-gray-100 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">
                              {t('usersSelectedMessage', {
                                count: selectedUsers.length,
                              })}
                            </span>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => setSelectedUsers([])}
                                variant="outline"
                                className="text-sm"
                              >
                                {t('clearButton')}
                              </Button>
                              <Button
                                onClick={handleAddContributors}
                                className="bg-gray-900 text-sm text-white hover:bg-gray-800"
                              >
                                {t('addSelectedButton')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                      {searchResults.map((user) => {
                        const isSelected = selectedUsers.includes(user.username);
                        const isExistingContributor = contributors?.some((c) => c.user.username === user.username);

                        return (
                          <div
                            key={user.username}
                            className={`flex items-center justify-between p-4 ${
                              isSelected ? 'bg-gray-100' : ''
                            } ${!isExistingContributor ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors`}
                            onClick={(e) => {
                              // Don't handle click if it's on a checkbox
                              if (e.target instanceof HTMLElement && e.target.closest('input[type="checkbox"]')) {
                                return;
                              }
                              if (!isExistingContributor) {
                                handleUserSelect(user.username);
                              }
                            }}
                          >
                            <div className="flex items-center space-x-3">
                              <div onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => !isExistingContributor && handleUserSelect(user.username)}
                                  disabled={isExistingContributor}
                                  className="h-4 w-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500 disabled:opacity-50"
                                />
                              </div>
                              <UserAvatar
                                width={40}
                                avatar_url={user.avatar_url}
                                predefined_avatar={user.avatar_image ? undefined : 'empty'}
                                userId={user.id.toString()}
                                showProfilePopup
                                rounded="rounded-full"
                                backgroundColor="bg-gray-100"
                              />
                              <div>
                                <div className="font-medium text-gray-900">
                                  {user.first_name} {user.last_name}
                                </div>
                                <div className="text-sm text-gray-500">@{user.username}</div>
                              </div>
                            </div>
                            {isExistingContributor && (
                              <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                                {t('alreadyContributorMessage')}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="p-4 text-center text-sm text-gray-500">{t('noUsersFoundMessage')}</div>
                  )}
                </div>
              )}
              <div className="nice-shadow rounded-xl bg-white">
                {selectedContributors.length > 0 && (
                  <div className="rounded-t-xl border-b bg-gray-100 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">
                        {t('contributorsSelectedMessage', {
                          count: selectedContributors.length,
                        })}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setSelectedContributors([])}
                          variant="outline"
                          className="text-sm"
                        >
                          {t('clearButton')}
                        </Button>
                        <Button
                          onClick={handleBulkRemove}
                          className="bg-red-600 text-sm text-white hover:bg-red-700"
                        >
                          {t('removeSelectedButton')}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30px]">
                          <input
                            type="checkbox"
                            checked={masterCheckboxChecked}
                            onChange={(e) => {
                              setMasterCheckboxChecked(e.target.checked);
                              if (contributors) {
                                if (e.target.checked) {
                                  // Select all non-creator contributors
                                  const nonCreatorContributors = contributors
                                    .filter((c) => c.authorship !== 'CREATOR')
                                    .map((c) => c.user_id);
                                  setSelectedContributors(nonCreatorContributors);
                                } else {
                                  setSelectedContributors([]);
                                }
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500"
                          />
                        </TableHead>
                        <TableHead className="w-[50px]" />
                        <TableHead>{t('nameColumn')}</TableHead>
                        <TableHead>{t('usernameColumn')}</TableHead>
                        <TableHead>{t('emailColumn')}</TableHead>
                        <TableHead>{t('roleColumn')}</TableHead>
                        <TableHead>{t('statusColumn')}</TableHead>
                        <TableHead>{t('addedOnColumn')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortContributors(contributors)?.map((contributor) => (
                        <TableRow
                          key={`${contributor.user_id}-${contributor.id}`}
                          className={`${selectedContributors.includes(contributor.user_id) ? 'bg-gray-50' : ''} ${contributor.authorship !== 'CREATOR' ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                          onClick={(e) => {
                            // Don't handle click if it's on a dropdown or checkbox
                            if (
                              e.target instanceof HTMLElement &&
                              (e.target.closest('button') || e.target.closest('input[type="checkbox"]'))
                            ) {
                              return;
                            }
                            if (contributor.authorship !== 'CREATOR') {
                              handleContributorSelect(contributor.user_id);
                            }
                          }}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedContributors.includes(contributor.user_id)}
                              onChange={() => handleContributorSelect(contributor.user_id)}
                              disabled={contributor.authorship === 'CREATOR'}
                              className="h-4 w-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500 disabled:opacity-50"
                            />
                          </TableCell>
                          <TableCell>
                            <UserAvatar
                              width={30}
                              border="border-2"
                              avatar_url={
                                contributor.user.avatar_image
                                  ? getUserAvatarMediaDirectory(
                                      contributor.user.user_uuid,
                                      contributor.user.avatar_image,
                                    )
                                  : ''
                              }
                              rounded="rounded"
                              predefined_avatar={contributor.user.avatar_image === '' ? 'empty' : undefined}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {contributor.user.first_name} {contributor.user.last_name}
                          </TableCell>
                          <TableCell className="text-gray-500">@{contributor.user.username}</TableCell>
                          <TableCell className="text-gray-500">{contributor.user.email}</TableCell>
                          <TableCell>
                            <RoleDropdown
                              contributor={contributor}
                              updateContributor={updateContributor}
                              t={t}
                            />
                          </TableCell>
                          <TableCell>
                            <StatusDropdown
                              contributor={contributor}
                              updateContributor={updateContributor}
                              t={t}
                              getStatusStyle={getStatusStyle}
                            />
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {formatDate(contributor.creation_date, locale)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EditCourseContributors;
