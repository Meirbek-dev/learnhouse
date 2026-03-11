'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { createActivity, createExternalVideoActivity, createFileActivity } from '@services/courses/activities';
import NewActivityModal from '@components/Objects/Modals/Activities/Create/NewActivity';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { useCourse } from '@components/Contexts/CourseContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { getAPIUrl } from '@services/config/config';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { Layers } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { mutate } from 'swr';

interface NewActivityButtonProps {
  chapterId: number;
  orgslug: string;
}

const NewActivityButton = (props: NewActivityButtonProps) => {
  const [newActivityModal, setNewActivityModal] = useState(false);
  const course = useCourse();
  const org = useOrg() as any;
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const withUnpublishedActivities = course ? course.withUnpublishedActivities : false;
  const t = useTranslations('CourseEdit.NewActivityModal');
  const tNotify = useTranslations('DashPage.Notifications');

  const closeNewActivityModal = async () => {
    setNewActivityModal(false);
  };

  // Submit new activity
  const submitActivity = async (activity: any) => {
    const toast_loading = toast.loading(tNotify('creatingActivity'));
    await createActivity(activity, props.chapterId, org.org_id, access_token, {
      courseUuid: course.courseStructure.course_uuid,
    });
    mutate(
      `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
    );
    toast.dismiss(toast_loading);
    toast.success(tNotify('activityCreatedSuccess'));
    setNewActivityModal(false);
  };

  // Submit File Upload
  const submitFileActivity = async (file: any, type: any, activity: any, chapterId: number) => {
    const toast_loading = toast.loading(tNotify('uploadingAndCreating'));

    try {
      await createFileActivity(file, type, activity, chapterId, access_token, (progress) => {
        toast.loading(`${tNotify('uploadingAndCreating')} ${progress.percentage}%`, {
          id: toast_loading,
        });
      });

      mutate(
        `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
      );
      setNewActivityModal(false);
      toast.dismiss(toast_loading);
      toast.success(tNotify('fileUploadSuccess'));
      toast.success(tNotify('activityCreatedSuccess'));
    } catch {
      toast.dismiss(toast_loading);
      toast.error(tNotify('uploadFailed'));
    }
  };

  // Submit YouTube Video Upload
  const submitExternalVideo = async (external_video_data: any, activity: any) => {
    const toast_loading = toast.loading(tNotify('creatingActivity'));
    await createExternalVideoActivity(external_video_data, activity, props.chapterId, access_token);
    mutate(
      `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
    );
    setNewActivityModal(false);
    toast.dismiss(toast_loading);
    toast.success(tNotify('activityCreatedSuccess'));
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
            orgslug={props.orgslug}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewActivityButton;
