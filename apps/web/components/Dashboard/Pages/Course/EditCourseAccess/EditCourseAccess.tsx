'use client';

import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import LinkToUserGroup from '@components/Objects/Modals/Dash/EditCourseAccess/LinkToUserGroup';
import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext';
import { unLinkResourcesToUserGroup } from '@services/usergroups/usergroups';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { Globe, SquareUserRound, Users, X } from 'lucide-react';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import useSWR, { mutate } from 'swr';

interface EditCourseAccessProps {
  orgslug: string;
  course_uuid?: string;
}

const EditCourseAccess = (_props: EditCourseAccessProps) => {
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const course = useCourse() as any;
  const { isLoading, courseStructure } = course;
  const dispatchCourse = useCourseDispatch() as any;
  const t = useTranslations('DashPage.Courses.Access');

  const { data: usergroups } = useSWR(
    courseStructure ? `${getAPIUrl()}usergroups/resource/${courseStructure.course_uuid}` : null,
    (url) => swrFetcher(url, access_token),
  );
  const [isClientPublic, setIsClientPublic] = useState<boolean | undefined>();

  useEffect(() => {
    if (!isLoading && courseStructure?.public !== undefined) {
      setIsClientPublic(courseStructure.public);
    }
  }, [isLoading, courseStructure]);

  useEffect(() => {
    if (
      !isLoading &&
      courseStructure?.public !== undefined &&
      isClientPublic !== undefined &&
      isClientPublic !== courseStructure.public
    ) {
      dispatchCourse({ type: 'setIsNotSaved' });
      const updatedCourse = {
        ...courseStructure,
        public: isClientPublic,
      };
      dispatchCourse({ type: 'setCourseStructure', payload: updatedCourse });
    }
  }, [isLoading, isClientPublic, courseStructure, dispatchCourse]);

  return (
    <div>
      {courseStructure ? (
        <div>
          <div className="h-6" />
          <div className="mx-4 rounded-xl bg-white px-4 py-4 shadow-xs sm:mx-10">
            <div className="mb-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-3 py-3 sm:px-5">
              <h1 className="text-lg font-bold text-gray-800 sm:text-xl">{t('accessToTheCourse')}</h1>
              <h2 className="text-xs text-gray-500 sm:text-sm">{t('accessDescription')}</h2>
            </div>
            <div className="mx-auto mb-3 flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
              <ConfirmationModal
                confirmationButtonText={t('changeToPublicButton')}
                confirmationMessage={t('changeToPublicConfirmMsg')}
                dialogTitle={t('changeToPublicConfirmTitle')}
                dialogTrigger={
                  <div className="h-[200px] w-full cursor-pointer rounded-lg bg-slate-100 transition-all hover:bg-slate-200">
                    {isClientPublic ? (
                      <div className="absolute mx-3 my-3 w-fit rounded-lg bg-green-200 px-3 py-1 text-sm font-bold text-green-600">
                        {t('activeBadge')}
                      </div>
                    ) : null}
                    <div className="flex h-full flex-col items-center justify-center space-y-1 p-2 sm:p-4">
                      <Globe
                        className="text-slate-400"
                        size={32}
                      />
                      <div className="text-xl font-bold text-slate-700 sm:text-2xl">{t('publicLabel')}</div>
                      <div className="sm:text-md w-full text-center text-sm leading-5 tracking-tight text-gray-400 sm:w-[500px]">
                        {t('publicDescription')}
                      </div>
                    </div>
                  </div>
                }
                functionToExecute={() => {
                  setIsClientPublic(true);
                }}
                status="info"
              />
              <ConfirmationModal
                confirmationButtonText={t('changeToUsersOnlyButton')}
                confirmationMessage={t('changeToUsersOnlyConfirmMsg')}
                dialogTitle={t('changeToUsersOnlyConfirmTitle')}
                dialogTrigger={
                  <div className="h-[200px] w-full cursor-pointer rounded-lg bg-slate-100 transition-all hover:bg-slate-200">
                    {!isClientPublic && (
                      <div className="absolute mx-3 my-3 w-fit rounded-lg bg-green-200 px-3 py-1 text-sm font-bold text-green-600">
                        {t('activeBadge')}
                      </div>
                    )}
                    <div className="flex h-full flex-col items-center justify-center space-y-1 p-2 sm:p-4">
                      <Users
                        className="text-slate-400"
                        size={32}
                      />
                      <div className="text-xl font-bold text-slate-700 sm:text-2xl">{t('usersOnlyLabel')}</div>
                      <div className="sm:text-md w-full text-center text-sm leading-5 tracking-tight text-gray-400 sm:w-[500px]">
                        {t('usersOnlyDescription')}
                      </div>
                    </div>
                  </div>
                }
                functionToExecute={() => {
                  setIsClientPublic(false);
                }}
                status="info"
              />
            </div>
            {!isClientPublic && <UserGroupsSection usergroups={usergroups} />}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const UserGroupsSection = ({ usergroups }: { usergroups: any[] }) => {
  const course = useCourse() as any;
  const [userGroupModal, setUserGroupModal] = useState(false);
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.Courses.Access');

  // "unlinkUserGroupErrorDetailed": "Failed to unlink user group: {error}",
  // "unlinkUserGroupErrorGeneric": "Failed to unlink user group",
  // "unlinkUserGroupSuccess": "Successfully unlinked user group",

  const removeUserGroupLink = async (usergroup_id: number) => {
    try {
      const res = await unLinkResourcesToUserGroup(usergroup_id, course.courseStructure.course_uuid, access_token);
      if (res.status === 200) {
        toast.success(t('unlinkUserGroupSuccess'));
        mutate(`${getAPIUrl()}usergroups/resource/${course.courseStructure.course_uuid}`);
      } else {
        toast.error(t('unlinkUserGroupErrorDetailed', { error: res.data.detail }));
      }
    } catch {
      toast.error(t('unlinkUserGroupErrorGeneric'));
    }
  };

  return (
    <>
      <div className="mb-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-3 py-3 sm:px-5">
        <h1 className="text-lg font-bold text-gray-800 sm:text-xl">{t('title')}</h1>
        <h2 className="text-xs text-gray-500 sm:text-sm">{t('description')}</h2>
      </div>
      <div className="overflow-x-auto">
        <Table className="overflow-hidden">
          <TableHeader className="uppercase">
            <TableRow>
              <TableHead>{t('tableHeaderName')}</TableHead>
              <TableHead>{t('tableHeaderActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usergroups?.map((usergroup: any) => (
              <TableRow key={usergroup.id}>
                <TableCell>{usergroup.name}</TableCell>
                <TableCell>
                  <ConfirmationModal
                    confirmationButtonText={t('deleteLinkButton')}
                    confirmationMessage={t('unlinkConfirmMsg')}
                    dialogTitle={t('unlinkConfirmTitle')}
                    dialogTrigger={
                      <span>
                        <button className="mr-2 flex items-center space-x-2 rounded-md bg-rose-700 p-1 px-3 text-sm font-bold text-rose-100 hover:cursor-pointer">
                          <X className="h-4 w-4" />
                          <span>{t('deleteLinkButton')}</span>
                        </button>
                      </span>
                    }
                    functionToExecute={() => removeUserGroupLink(usergroup.id)}
                    status="warning"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 mr-2 flex flex-row-reverse">
        <Modal
          isDialogOpen={userGroupModal}
          onOpenChange={() => {
            setUserGroupModal(!userGroupModal);
          }}
          minHeight="no-min"
          minWidth="md"
          dialogContent={<LinkToUserGroup setUserGroupModal={setUserGroupModal} />}
          dialogTitle={t('linkModalTitle')}
          dialogDescription={t('linkModalDescription')}
          dialogTrigger={
            <span>
              <button className="flex items-center space-x-2 rounded-md bg-green-700 p-1 px-3 text-xs font-bold text-green-100 hover:cursor-pointer sm:text-sm">
                <SquareUserRound className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>{t('linkToUserGroupButton')}</span>
              </button>
            </span>
          }
        />
      </div>
    </>
  );
};

export default EditCourseAccess;
