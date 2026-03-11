'use client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { bulkAddContributors, bulkRemoveContributors, editContributor, updateCourseAccess } from '@services/courses/courses';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, ChevronDown, Search, UserPen, Users } from 'lucide-react';
import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { getUserAvatarMediaDirectory } from '@services/media/media';
import { searchOrgContent } from '@services/search/search';
import { useEffect, useRef, useState } from 'react';
import { useOrg } from '@components/Contexts/OrgContext';
import UserAvatar from '@components/Objects/UserAvatar';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useLocale, useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Locale } from '@/i18n/config';
import { toast } from 'sonner';

interface EditCourseContributorsProps {
  orgslug: string;
  course_uuid?: string;
}

type ContributorRole = 'CREATOR' | 'CONTRIBUTOR' | 'MAINTAINER' | 'REPORTER';
type ContributorStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';

interface SearchUser {
  username: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  avatar_image: string;
  avatar_url?: string;
  id: number;
  user_uuid: string;
}

interface Contributor {
  id: number;
  user_id: number;
  authorship: ContributorRole;
  authorship_status: ContributorStatus;
  creation_date: string;
  user: {
    username: string;
    first_name: string;
    middle_name?: string;
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
    <DropdownMenuTrigger
      render={
        <Button
          variant="outline"
          className="w-[200px] justify-between"
          disabled={contributor.authorship === 'CREATOR' || contributor.authorship_status !== 'ACTIVE'}
        />
      }
    >
      {t(contributor.authorship.toLowerCase()) || contributor.authorship}
      <ChevronDown className="text-muted-foreground ml-2 h-4 w-4" />
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
          {t(role.toLowerCase())}
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
    <DropdownMenuTrigger
      render={
        <Button
          variant="outline"
          className={`w-[200px] justify-between ${getStatusStyle(contributor.authorship_status)}`}
          disabled={contributor.authorship === 'CREATOR'}
        />
      }
    >
      {t(contributor.authorship_status.toLowerCase()) || contributor.authorship_status}
      <ChevronDown className="ml-2 h-4 w-4" />
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
          {t(status.toLowerCase())}
          {contributor.authorship_status === status && <Check className="ml-2 h-4 w-4" />}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

interface ContributorOptionCardProps {
  isActive: boolean;
  title: string;
  description: string;
  icon: React.ReactNode;
  onSelect: () => void;
  activeLabel?: string;
  disabled?: boolean;
}

function ContributorOptionCard({
  isActive,
  title,
  description,
  icon,
  onSelect,
  activeLabel,
  disabled = false,
}: ContributorOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`relative h-[200px] w-full rounded-lg border p-4 text-left transition-all ${
        isActive
          ? 'border-slate-950 bg-slate-950 text-white shadow-sm'
          : 'border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      {isActive ? (
        <div className="absolute left-3 top-3 w-fit rounded-lg bg-white/15 px-3 py-1 text-sm font-bold text-white">
          {activeLabel}
        </div>
      ) : null}
      <div className="flex h-full flex-col items-center justify-center space-y-1 p-2 text-center sm:p-4">
        {icon}
        <div className={`text-xl font-bold sm:text-2xl ${isActive ? 'text-white' : 'text-slate-700'}`}>{title}</div>
        <div className={`w-full text-sm leading-5 tracking-tight sm:w-[500px] sm:text-base ${isActive ? 'text-white/75' : 'text-gray-400'}`}>
          {description}
        </div>
      </div>
    </button>
  );
}

const EditCourseContributors = (_props: EditCourseContributorsProps) => {
  const t = useTranslations('DashPage.EditCourseContributors');
  const locale = useLocale() as Locale;
  const session = usePlatformSession();
  const access_token = session?.data?.tokens?.access_token;
  const course = useCourse();
  const { courseStructure, editorData, refreshCourseEditor, showConflict } = course;
  const dispatchCourse = useCourseDispatch();
  const org = useOrg() as any;
  const tCommon = useTranslations('Common');
  const contributors = (editorData.contributors.data ?? []) as Contributor[];
  const isContributorsLoading = course.isEditorDataLoading && editorData.contributors.data === null;

  // Initialize from courseStructure.open_to_contributors with lazy initialization
  const [isOpenToContributors, setIsOpenToContributors] = useState<boolean | undefined>(
    () => courseStructure?.open_to_contributors,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [selectedContributors, setSelectedContributors] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const initialRef = useRef<boolean | undefined>(courseStructure?.open_to_contributors);
  const isDirtyRef = useRef(false);

  useUnsavedChangesGuard(isDirty);

  useEffect(() => {
    if (isDirtyRef.current) {
      return;
    }

    setIsOpenToContributors(courseStructure?.open_to_contributors);
    initialRef.current = courseStructure?.open_to_contributors;
    setIsDirty(false);
    dispatchCourse({ type: 'setSectionDirty', payload: { section: 'contributors', dirty: false } });
  }, [courseStructure?.open_to_contributors, dispatchCourse]);

  useEffect(() => {
    const dirty = isOpenToContributors !== undefined && isOpenToContributors !== initialRef.current;
    isDirtyRef.current = dirty;
    setIsDirty(dirty);
    dispatchCourse({ type: 'setSectionDirty', payload: { section: 'contributors', dirty } });
  }, [dispatchCourse, isOpenToContributors]);

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
          const users = response.data.users.map((user: SearchUser) =>
            Object.assign(user, {
              avatar_url: user.avatar_image ? getUserAvatarMediaDirectory(user.user_uuid, user.avatar_image) : '',
            }),
          );
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

  // Derive master checkbox state from contributors and selected contributors
  const masterCheckboxChecked = (() => {
    if (!contributors) return false;
    const nonCreatorContributors = contributors.filter((c) => c.authorship !== 'CREATOR');
    return nonCreatorContributors.length > 0 && selectedContributors.length === nonCreatorContributors.length;
  })();

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
      const response = await bulkAddContributors(courseStructure.course_uuid, selectedUsers, access_token, {
        orgSlug: org.slug,
      });
      if (response.status === 409) {
        showConflict(response.data?.detail);
        return;
      }
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
        await refreshCourseEditor();
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
    contributorId: number,
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
        { orgSlug: org.slug },
      );
      if (res.status === 409) {
        showConflict(res.data?.detail);
        return;
      }
      if (res.status === 200 && res.data?.status === 'success') {
        toast.success(res.data.detail || t('successfullyUpdatedContributor'));
        await refreshCourseEditor();
      } else {
        toast.error(res.data?.detail || t('failedToUpdateContributor'));
      }
    } catch {
      toast.error(t('errorUpdatingContributor'));
    }
  };

  const getStatusStyle = (status: ContributorStatus) => {
    switch (status) {
      case 'ACTIVE': {
        return 'bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800';
      }
      case 'INACTIVE': {
        return 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-gray-800';
      }
      case 'PENDING': {
        return 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 hover:text-yellow-800';
      }
      default: {
        return 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-gray-800';
      }
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

  const handleContributorSelect = (userId: number) => {
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

      const response = await bulkRemoveContributors(courseStructure.course_uuid, selectedUsernames, access_token, {
        orgSlug: org.slug,
      });
      if (response.status === 409) {
        showConflict(response.data?.detail);
        return;
      }

      if (response.status === 200) {
        toast.success(
          t('successfullyRemovedContributors', {
            count: selectedContributors.length,
          }),
        );
        await refreshCourseEditor();
        // Clear selection
        setSelectedContributors([]);
      }
    } catch (error) {
      console.error(t('errorRemovingContributors'), error);
      toast.error(t('failedToRemoveContributorsGeneral'));
    }
  };

  const handleDiscard = () => {
    setIsOpenToContributors(initialRef.current);
    isDirtyRef.current = false;
    setIsDirty(false);
    dispatchCourse({ type: 'setSectionDirty', payload: { section: 'contributors', dirty: false } });
  };

  const handleContributorAccessSave = async () => {
    if (!(access_token && isOpenToContributors !== undefined) || !isDirty) return;

    setIsSaving(true);
    try {
      const response = await updateCourseAccess(
        courseStructure.course_uuid,
        { open_to_contributors: isOpenToContributors },
        access_token,
        {
          lastKnownUpdateDate: courseStructure.update_date,
          orgSlug: org.slug,
        },
      );

      if (!response.success) {
        if (response.status === 409) {
          showConflict(response.data?.detail);
          return;
        }
        toast.error(response.data?.detail || tCommon('errorGeneric'));
        return;
      }

      dispatchCourse({
        type: 'setCourseStructure',
        payload: {
          ...courseStructure,
          ...response.data,
        },
      });
      initialRef.current = isOpenToContributors;
      isDirtyRef.current = false;
      setIsDirty(false);
      dispatchCourse({ type: 'setSectionDirty', payload: { section: 'contributors', dirty: false } });
      await refreshCourseEditor();
      toast.success(tCommon('saved'));
    } catch (error: any) {
      if (error?.status === 409) {
        showConflict(error?.detail || error?.message);
        return;
      }
      toast.error(error?.message || tCommon('errorGeneric'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      {courseStructure ? (
        <div>
          <div className="h-6" />
          <div className="mx-4 rounded-xl bg-white px-4 py-4 shadow-xs sm:mx-10">
            <div className="mb-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-3 py-3 sm:px-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-lg font-bold text-gray-800 sm:text-xl">{t('courseContributorsTitle')}</h1>
                  <h2 className="text-xs text-gray-500 sm:text-sm">{t('courseContributorsSubtitle')}</h2>
                  <p className="mt-1 text-sm text-slate-500">Changes stay in draft until you save this stage.</p>
                </div>
                <div className="flex items-center gap-3">
                  {isDirty ? <span className="text-sm text-gray-500">Draft not saved</span> : null}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!isDirty || isSaving}
                    onClick={handleDiscard}
                  >
                    Discard draft
                  </Button>
                  <Button
                    type="button"
                    disabled={!isDirty || isSaving}
                    onClick={handleContributorAccessSave}
                  >
                    {isSaving ? tCommon('saving') : 'Save changes'}
                  </Button>
                </div>
              </div>
            </div>
            <div className="mx-auto mb-3 flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
              <ContributorOptionCard
                isActive={isOpenToContributors ?? false}
                title={t('openToContributorsTitle')}
                description={t('openToContributorsDescription')}
                icon={
                  <UserPen
                    className={isOpenToContributors ? 'text-white/80' : 'text-slate-400'}
                    size={32}
                  />
                }
                onSelect={() => setIsOpenToContributors(true)}
                activeLabel={t('activeBadge')}
                disabled={isSaving}
              />
              <ContributorOptionCard
                isActive={!isOpenToContributors}
                title={t('closeToContributorsTitle')}
                description={t('closeToContributorsDescription')}
                icon={
                  <Users
                    className={!isOpenToContributors ? 'text-white/80' : 'text-slate-400'}
                    size={32}
                  />
                }
                onSelect={() => setIsOpenToContributors(false)}
                activeLabel={t('activeBadge')}
                disabled={isSaving}
              />
            </div>
            {isContributorsLoading ? <div className="px-1 py-3 text-sm text-gray-500">{t('loadingContributors')}</div> : null}
            <div className="space-y-4">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
                <Input
                  placeholder={t('searchUsersPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                  }}
                  className="pl-8"
                />
              </div>
              {searchQuery ? (
                <div className="soft-shadow divide-y rounded-xl bg-white">
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
                                onClick={() => {
                                  setSelectedUsers([]);
                                }}
                                variant="outline"
                                className="text-sm"
                              >
                                {t('clearButton')}
                              </Button>
                              <Button onClick={handleAddContributors}>{t('addSelectedButton')}</Button>
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
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => !isExistingContributor && handleUserSelect(user.username)}
                                  disabled={isExistingContributor}
                                />
                              </div>
                              <UserAvatar
                                size="md"
                                avatar_url={user.avatar_url}
                                predefined_avatar={user.avatar_image ? undefined : 'empty'}
                                userId={user.id}
                                showProfilePopup
                              />
                              <div>
                                <div className="font-medium text-gray-900">
                                  {[user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ')}
                                </div>
                                <div className="text-sm text-gray-500">@{user.username}</div>
                              </div>
                            </div>
                            {isExistingContributor ? (
                              <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                                {t('alreadyContributorMessage')}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="p-4 text-center text-sm text-gray-500">{t('noUsersFoundMessage')}</div>
                  )}
                </div>
              ) : null}
              <div className="soft-shadow rounded-xl bg-white">
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
                          onClick={() => {
                            setSelectedContributors([]);
                          }}
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
                          <Checkbox
                            checked={masterCheckboxChecked}
                            onCheckedChange={(checked) => {
                              if (contributors) {
                                if (checked) {
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
                          <TableCell
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <Checkbox
                              checked={selectedContributors.includes(contributor.user_id)}
                              onCheckedChange={() => {
                                handleContributorSelect(contributor.user_id);
                              }}
                              disabled={contributor.authorship === 'CREATOR'}
                            />
                          </TableCell>
                          <TableCell>
                            <UserAvatar
                              size="sm"
                              variant="outline"
                              avatar_url={
                                contributor.user.avatar_image
                                  ? getUserAvatarMediaDirectory(
                                      contributor.user.user_uuid,
                                      contributor.user.avatar_image,
                                    )
                                  : ''
                              }
                              predefined_avatar={contributor.user.avatar_image === '' ? 'empty' : undefined}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {[contributor.user.first_name, contributor.user.middle_name, contributor.user.last_name]
                              .filter(Boolean)
                              .join(' ')}
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
      ) : null}
    </div>
  );
};

export default EditCourseContributors;
