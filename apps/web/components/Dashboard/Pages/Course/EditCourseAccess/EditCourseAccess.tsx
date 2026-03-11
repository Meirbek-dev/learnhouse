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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import LinkToUserGroup from '@components/Objects/Modals/Dash/EditCourseAccess/LinkToUserGroup';
import { AlertTriangle, Globe, Loader2, SquareUserRound, Users, X } from 'lucide-react';
import { unLinkResourcesToUserGroup } from '@services/usergroups/usergroups';
import { SectionHeader } from '@components/Dashboard/Courses/SectionHeader';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useCourse } from '@components/Contexts/CourseContext';
import { updateCourseAccess } from '@services/courses/courses';
import { useDirtySection } from '@/hooks/useDirtySection';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSaveSection } from '@/hooks/useSaveSection';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

interface EditCourseAccessProps {
  orgslug: string;
}

const EditCourseAccess = (props: EditCourseAccessProps) => {
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const course = useCourse();
  const { courseStructure, editorData } = course;
  const t = useTranslations('DashPage.Courses.Access');
  const [draftPublic, setDraftPublic] = useState<boolean | undefined>(() => courseStructure?.public);
  const usergroups = editorData.linkedUserGroups.data ?? [];
  const isUserGroupsLoading = course.isEditorDataLoading && editorData.linkedUserGroups.data === null;
  const initialRef = useRef<boolean | undefined>(courseStructure?.public);

  const { isDirty, isDirtyRef, markDirty, markClean } = useDirtySection('access');
  const { isSaving, saveWithEditorRefresh } = useSaveSection({ onSuccess: markClean });

  // Sync external updates to draft when not dirty
  useEffect(() => {
    if (isDirtyRef.current) return;
    setDraftPublic(courseStructure?.public);
    initialRef.current = courseStructure?.public;
    markClean();
  }, [courseStructure?.public, isDirtyRef, markClean]);

  // Compute dirty when draft changes
  useEffect(() => {
    const dirty = draftPublic !== undefined && draftPublic !== initialRef.current;
    if (dirty) markDirty();
    else markClean();
  }, [draftPublic, markDirty, markClean]);

  const handleDiscard = () => {
    setDraftPublic(initialRef.current);
    markClean();
  };

  const handleAccessSave = async () => {
    if (!(access_token && draftPublic !== undefined) || !isDirty) return;
    await saveWithEditorRefresh(async () => {
      const response = await updateCourseAccess(courseStructure.course_uuid, { public: draftPublic }, access_token, {
        lastKnownUpdateDate: courseStructure.update_date,
        orgSlug: props.orgslug,
      });
      if (response.success) {
        initialRef.current = draftPublic;
      }
      return response;
    });
  };

  if (!courseStructure) return null;

  return (
    <div className="mx-auto space-y-6 p-6">
      <SectionHeader
        title={t('accessToTheCourse')}
        description={t('accessDescription')}
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleAccessSave}
        onDiscard={handleDiscard}
      />

      {/* Access option RadioGroup */}
      <RadioGroup
        value={draftPublic === true ? 'public' : draftPublic === false ? 'private' : undefined}
        onValueChange={(val) => setDraftPublic(val === 'public')}
        disabled={isSaving}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <Label
          htmlFor="access-public"
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border p-6 text-center transition-colors ${
            draftPublic === true
              ? 'border-slate-950 bg-slate-950 text-white'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <RadioGroupItem
            value="public"
            id="access-public"
            className="sr-only"
          />
          <Globe className={`size-8 ${draftPublic === true ? 'text-white/80' : 'text-slate-400'}`} />
          <span className="text-xl font-bold">{t('publicLabel')}</span>
          <span className={`text-sm leading-5 ${draftPublic === true ? 'text-white/75' : 'text-slate-500'}`}>
            {t('publicDescription')}
          </span>
        </Label>

        <Label
          htmlFor="access-private"
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border p-6 text-center transition-colors ${
            draftPublic === false
              ? 'border-slate-950 bg-slate-950 text-white'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <RadioGroupItem
            value="private"
            id="access-private"
            className="sr-only"
          />
          <Users className={`size-8 ${draftPublic === false ? 'text-white/80' : 'text-slate-400'}`} />
          <span className="text-xl font-bold">{t('usersOnlyLabel')}</span>
          <span className={`text-sm leading-5 ${draftPublic === false ? 'text-white/75' : 'text-slate-500'}`}>
            {t('usersOnlyDescription')}
          </span>
        </Label>
      </RadioGroup>

      {/* User groups — only shown for private courses */}
      {draftPublic === false && (
        <UserGroupsSection
          usergroups={usergroups}
          isLoading={isUserGroupsLoading}
          orgslug={props.orgslug}
        />
      )}
    </div>
  );
};

const UserGroupsSection = ({
  usergroups,
  isLoading,
  orgslug,
}: {
  usergroups: any[];
  isLoading: boolean;
  orgslug: string;
}) => {
  const course = useCourse();
  const [userGroupModal, setUserGroupModal] = useState(false);
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.Courses.Access');

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800">{t('title')}</h2>
        <p className="text-sm text-slate-500">{t('description')}</p>
      </div>

      <ScrollArea className="max-h-72 rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader className="uppercase">
            <TableRow>
              <TableHead>{t('tableHeaderName')}</TableHead>
              <TableHead>{t('tableHeaderActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={2}>{t('loadingUserGroups', { default: 'Loading user groups...' })}</TableCell>
              </TableRow>
            ) : null}
            {usergroups?.map((usergroup: any) => (
              <UnlinkUserGroupRow
                key={usergroup.id}
                usergroup={usergroup}
                courseUuid={course.courseStructure.course_uuid}
                accessToken={access_token}
                orgslug={orgslug}
              />
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      <div className="flex justify-end">
        <Dialog
          open={userGroupModal}
          onOpenChange={setUserGroupModal}
        >
          <DialogTrigger
            render={
              <Button
                type="button"
                size="sm"
                className="bg-emerald-700 hover:bg-emerald-800"
              />
            }
          >
            <SquareUserRound className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>{t('linkToUserGroupButton')}</span>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('linkModalTitle')}</DialogTitle>
              <DialogDescription>{t('linkModalDescription')}</DialogDescription>
            </DialogHeader>
            <LinkToUserGroup setUserGroupModal={setUserGroupModal} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

// Separate component for unlink row with its own dialog state
const UnlinkUserGroupRow = ({
  usergroup,
  courseUuid,
  accessToken,
  orgslug,
}: {
  usergroup: any;
  courseUuid: string;
  accessToken: string;
  orgslug: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const course = useCourse();
  const t = useTranslations('DashPage.Courses.Access');

  const removeUserGroupLink = () => {
    startTransition(async () => {
      try {
        const res = await unLinkResourcesToUserGroup(usergroup.id, courseUuid, accessToken, {
          courseUuid,
          orgSlug: orgslug,
        });
        if (res.status === 200) {
          toast.success(t('unlinkUserGroupSuccess'));
          await course.refreshEditorData();
          setIsOpen(false);
        } else {
          toast.error(t('unlinkUserGroupErrorDetailed', { error: res.data.detail }));
        }
      } catch {
        toast.error(t('unlinkUserGroupErrorGeneric'));
      }
    });
  };

  return (
    <TableRow>
      <TableCell>{usergroup.name}</TableCell>
      <TableCell>
        <AlertDialog
          open={isOpen}
          onOpenChange={setIsOpen}
        >
          <AlertDialogTrigger>
            <Button
              variant="destructive"
              size="sm"
            >
              <X className="h-4 w-4" />
              <span>{t('deleteLinkButton')}</span>
            </Button>
          </AlertDialogTrigger>
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
