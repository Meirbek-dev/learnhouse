'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import NewActivityModal from '@components/Objects/Modals/Activities/Create/NewActivity';
import { useActivityMutations } from '@/hooks/mutations/useActivityMutations';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { useCourse } from '@components/Contexts/CourseContext';
import { useCourseEditorStore } from '@/stores/courses';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { Layers } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface NewActivityButtonProps {
  chapterId: number;
}

const NewActivityButton = (props: NewActivityButtonProps) => {
  const [newActivityModal, setNewActivityModal] = useState(false);
  const course = useCourse();
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const setConflict = useCourseEditorStore((state) => state.setConflict);
  const activityMutations = useActivityMutations(course.courseStructure.course_uuid, true);
  const t = useTranslations('CourseEdit.NewActivityModal');
  const tNotify = useTranslations('DashPage.Notifications');

  const closeNewActivityModal = async () => {
    setNewActivityModal(false);
  };

  // Submit new activity
  const submitActivity = async (activity: any) => {
    const toast_loading = toast.loading(tNotify('creatingActivity'));
    try {
      await activityMutations.createActivity(activity, props.chapterId, {
        accessToken: access_token,
        lastKnownUpdateDate: course.courseStructure.update_date,
      });
      toast.success(tNotify('activityCreatedSuccess'));
      setNewActivityModal(false);
    } catch (error: any) {
      if (error?.status === 409) {
        setConflict({
          section: 'content',
          serverVersion: course.courseStructure,
          message: error?.detail || error?.message,
          pendingSave: async () => {
            await activityMutations.createActivity(activity, props.chapterId, {
              accessToken: access_token,
              lastKnownUpdateDate: course.courseStructure.update_date,
            });
          },
        });
        return;
      }
      toast.error(error?.message || tNotify('uploadFailed'));
    } finally {
      toast.dismiss(toast_loading);
    }
  };

  // Submit File Upload
  const submitFileActivity = async (file: any, type: any, activity: any, chapterId: number) => {
    const toast_loading = toast.loading(tNotify('uploadingAndCreating'));

    try {
      await activityMutations.createFileActivity(
        file,
        type,
        activity,
        chapterId,
        {
          accessToken: access_token,
          lastKnownUpdateDate: course.courseStructure.update_date,
        },
        (progress) => {
          toast.loading(`${tNotify('uploadingAndCreating')} ${progress.percentage}%`, {
            id: toast_loading,
          });
        },
      );

      setNewActivityModal(false);
      toast.dismiss(toast_loading);
      toast.success(tNotify('fileUploadSuccess'));
      toast.success(tNotify('activityCreatedSuccess'));
    } catch (error: any) {
      toast.dismiss(toast_loading);
      if (error?.status === 409) {
        setConflict({
          section: 'content',
          serverVersion: course.courseStructure,
          message: error?.detail || error?.message,
          pendingSave: async () => {
            await activityMutations.createFileActivity(file, type, activity, chapterId, {
              accessToken: access_token,
              lastKnownUpdateDate: course.courseStructure.update_date,
            });
          },
        });
        return;
      }
      toast.error(error?.message || tNotify('uploadFailed'));
    }
  };

  // Submit YouTube Video Upload
  const submitExternalVideo = async (external_video_data: any, activity: any) => {
    const toast_loading = toast.loading(tNotify('creatingActivity'));
    try {
      await activityMutations.createExternalVideo(external_video_data, activity, props.chapterId, {
        accessToken: access_token,
        lastKnownUpdateDate: course.courseStructure.update_date,
      });
      setNewActivityModal(false);
      toast.success(tNotify('activityCreatedSuccess'));
    } catch (error: any) {
      if (error?.status === 409) {
        setConflict({
          section: 'content',
          serverVersion: course.courseStructure,
          message: error?.detail || error?.message,
          pendingSave: async () => {
            await activityMutations.createExternalVideo(external_video_data, activity, props.chapterId, {
              accessToken: access_token,
              lastKnownUpdateDate: course.courseStructure.update_date,
            });
          },
        });
        return;
      }
      toast.error(error?.message || tNotify('uploadFailed'));
    } finally {
      toast.dismiss(toast_loading);
    }
  };

  return (
    <div className="flex justify-center">
      <Dialog
        open={newActivityModal}
        onOpenChange={setNewActivityModal}
      >
        <DialogTrigger render={<Button className="my-3 h-10 rounded-xl px-4 py-2" />}>
          <Layers size={17} />
          <span className="ml-2 text-sm font-semibold">{t('title')}</span>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>
          <NewActivityModal
            closeModal={closeNewActivityModal}
            submitFileActivity={submitFileActivity}
            submitExternalVideo={submitExternalVideo}
            submitActivity={submitActivity}
            chapterId={props.chapterId}
            course={course}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewActivityButton;
