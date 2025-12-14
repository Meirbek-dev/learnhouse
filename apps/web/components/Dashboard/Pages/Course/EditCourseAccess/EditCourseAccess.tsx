'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import LinkToUserGroup from '@components/Objects/Modals/Dash/EditCourseAccess/LinkToUserGroup';
import { AlertTriangle, Globe, Info, Loader2, SquareUserRound, Users, X } from 'lucide-react';
import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext';
import { unLinkResourcesToUserGroup } from '@services/usergroups/usergroups';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { useCallback, useEffect, useState, useTransition } from 'react';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { useTranslations } from 'next-intl';
import useSWR, { mutate } from 'swr';
import { toast } from 'sonner';

// Reusable component for access option cards with AlertDialog
interface AccessOptionCardProps {
  isActive: boolean;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  title: string;
  description: string;
  dialogTitle: string;
  dialogDescription: string;
  confirmButtonText: string;
  activeBadgeText: string;
  status: 'info' | 'warning';
  onConfirm: () => void;
}

const AccessOptionCard = ({
  isActive,
  icon: Icon,
  title,
  description,
  dialogTitle,
  dialogDescription,
  confirmButtonText,
  activeBadgeText,
  status,
  onConfirm,
}: AccessOptionCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('Components.ConfirmationModal');

  const handleConfirm = useCallback(() => {
    startTransition(() => {
      onConfirm();
      setIsOpen(false);
    });
  }, [onConfirm]);

  const isInfo = status === 'info';
  const IconComponent = isInfo ? Info : AlertTriangle;
  const iconBgClass = isInfo
    ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400'
    : 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400';

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <AlertDialogTrigger
        render={
          <div className="h-[200px] w-full cursor-pointer rounded-lg bg-slate-100 transition-all hover:bg-slate-200">
            {isActive && (
              <div className="absolute mx-3 my-3 w-fit rounded-lg bg-green-200 px-3 py-1 text-sm font-bold text-green-600">
                {activeBadgeText}
              </div>
            )}
            <div className="flex h-full flex-col items-center justify-center space-y-1 p-2 sm:p-4">
              <Icon
                className="text-slate-400"
                size={32}
              />
              <div className="text-xl font-bold text-slate-700 sm:text-2xl">{title}</div>
              <div className="w-full text-center text-sm leading-5 tracking-tight text-gray-400 sm:w-[500px] sm:text-base">
                {description}
              </div>
            </div>
          </div>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className={iconBgClass}>
            <IconComponent className="size-8" />
          </AlertDialogMedia>
          <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel />
          <AlertDialogAction
            variant={isInfo ? 'default' : 'destructive'}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {t('loading')}
              </div>
            ) : (
              confirmButtonText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

interface EditCourseAccessProps {
  orgslug: string;
  course_uuid?: string;
}

const EditCourseAccess = (_props: EditCourseAccessProps) => {
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const course = useCourse();
  const { isLoading, courseStructure } = course;
  const dispatchCourse = useCourseDispatch();
  const t = useTranslations('DashPage.Courses.Access');

  const { data: usergroups } = useSWR(
    courseStructure ? `${getAPIUrl()}usergroups/resource/${courseStructure.course_uuid}` : null,
    (url) => swrFetcher(url, access_token),
  );
  // Initialize from courseStructure.public with lazy initialization
  const [isClientPublic, setIsClientPublic] = useState<boolean | undefined>(() => courseStructure?.public);

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
              <AccessOptionCard
                isActive={isClientPublic === true}
                icon={Globe}
                title={t('publicLabel')}
                description={t('publicDescription')}
                dialogTitle={t('changeToPublicConfirmTitle')}
                dialogDescription={t('changeToPublicConfirmMsg')}
                confirmButtonText={t('changeToPublicButton')}
                activeBadgeText={t('activeBadge')}
                status="info"
                onConfirm={() => setIsClientPublic(true)}
              />
              <AccessOptionCard
                isActive={isClientPublic === false}
                icon={Users}
                title={t('usersOnlyLabel')}
                description={t('usersOnlyDescription')}
                dialogTitle={t('changeToUsersOnlyConfirmTitle')}
                dialogDescription={t('changeToUsersOnlyConfirmMsg')}
                confirmButtonText={t('changeToUsersOnlyButton')}
                activeBadgeText={t('activeBadge')}
                status="info"
                onConfirm={() => setIsClientPublic(false)}
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
  const course = useCourse();
  const [userGroupModal, setUserGroupModal] = useState(false);
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.Courses.Access');

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
              <UnlinkUserGroupRow
                key={usergroup.id}
                usergroup={usergroup}
                courseUuid={course.courseStructure.course_uuid}
                accessToken={access_token}
              />
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

// Separate component for unlink row with its own dialog state
const UnlinkUserGroupRow = ({
  usergroup,
  courseUuid,
  accessToken,
}: {
  usergroup: any;
  courseUuid: string;
  accessToken: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('DashPage.Courses.Access');

  const removeUserGroupLink = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await unLinkResourcesToUserGroup(usergroup.id, courseUuid, accessToken);
        if (res.status === 200) {
          toast.success(t('unlinkUserGroupSuccess'));
          mutate(`${getAPIUrl()}usergroups/resource/${courseUuid}`);
          setIsOpen(false);
        } else {
          toast.error(t('unlinkUserGroupErrorDetailed', { error: res.data.detail }));
        }
      } catch {
        toast.error(t('unlinkUserGroupErrorGeneric'));
      }
    });
  }, [usergroup.id, courseUuid, accessToken, t]);

  return (
    <TableRow>
      <TableCell>{usergroup.name}</TableCell>
      <TableCell>
        <AlertDialog
          open={isOpen}
          onOpenChange={setIsOpen}
        >
          <AlertDialogTrigger
            render={
              <button className="mr-2 flex items-center space-x-2 rounded-md bg-rose-700 p-1 px-3 text-sm font-bold text-rose-100 hover:cursor-pointer">
                <X className="h-4 w-4" />
                <span>{t('deleteLinkButton')}</span>
              </button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400">
                <AlertTriangle className="size-8" />
              </AlertDialogMedia>
              <AlertDialogTitle>{t('unlinkConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('unlinkConfirmMsg')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel />
              <AlertDialogAction
                variant="destructive"
                onClick={removeUserGroupLink}
                disabled={isPending}
              >
                {isPending ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    {t('deleting')}
                  </div>
                ) : (
                  t('deleteLinkButton')
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
};

export default EditCourseAccess;
