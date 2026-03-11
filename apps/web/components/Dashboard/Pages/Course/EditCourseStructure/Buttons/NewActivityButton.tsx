'use client';

import { createActivity, createExternalVideoActivity, createFileActivity } from '@services/courses/activities';
import { getOrganizationContextInfoWithoutCredentials } from '@services/organizations/orgs';
import NewActivityModal from '@components/Objects/Modals/Activities/Create/NewActivity';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { useCourse } from '@components/Contexts/CourseContext';
import Modal from '@/components/Objects/Elements/Modal/Modal';
import { revalidateTags } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const course = useCourse();
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const withUnpublishedActivities = course ? course.withUnpublishedActivities : false;
  const t = useTranslations('CourseEdit.NewActivityModal');
  const tNotify = useTranslations('DashPage.Notifications');

  const openNewActivityModal = async (_chapterId: any) => {
    setNewActivityModal(true);
  };

  const closeNewActivityModal = async () => {
    setNewActivityModal(false);
  };

  // Submit new activity
  const submitActivity = async (activity: any) => {
    const org = await getOrganizationContextInfoWithoutCredentials(props.orgslug, {
      revalidate: 1800,
    });
    const toast_loading = toast.loading(tNotify('creatingActivity'));
    await createActivity(activity, props.chapterId, org.org_id, access_token);
    mutate(
      `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
    );
    toast.dismiss(toast_loading);
    toast.success(tNotify('activityCreatedSuccess'));
    setNewActivityModal(false);
    await revalidateTags(['courses'], props.orgslug);
  };

  // Submit File Upload
  const submitFileActivity = async (file: any, type: any, activity: any, chapterId: number) => {
    const toast_loading = toast.loading(tNotify('uploadingAndCreating'));

    try {
      await createFileActivity(file, type, activity, chapterId, access_token, (progress) => {
        // Update toast with progress
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
      await revalidateTags(['courses'], props.orgslug);
    } catch (error) {
      toast.dismiss(toast_loading);
      toast.error(tNotify('uploadFailed'));
      console.error('File upload error:', error);
    }
  };

  // Submit YouTube Video Upload
  const submitExternalVideo = async (external_video_data: any, activity: any, _chapterId: number) => {
    const toast_loading = toast.loading(tNotify('creatingActivity'));
    await createExternalVideoActivity(external_video_data, activity, props.chapterId, access_token);
    mutate(
      `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
    );
    setNewActivityModal(false);
    toast.dismiss(toast_loading);
    toast.success(tNotify('activityCreatedSuccess'));
    await revalidateTags(['courses'], props.orgslug);
  };

  return (
    <div className="flex justify-center">
      <Modal
        isDialogOpen={newActivityModal}
        onOpenChange={setNewActivityModal}
        minHeight="no-min"
        minWidth="lg"
        addDefCloseButton={false}
        dialogContent={
          <NewActivityModal
            closeModal={closeNewActivityModal}
            submitFileActivity={submitFileActivity}
            submitExternalVideo={submitExternalVideo}
            submitActivity={submitActivity}
            chapterId={props.chapterId}
            course={course}
            orgslug={props.orgslug}
          />
        }
        dialogTitle={t('title')}
        dialogDescription={t('description')}
        dialogTrigger={
          <div
            onClick={() => {
              openNewActivityModal(props.chapterId);
            }}
            className="max-w-auto bg-primary text-primary-foreground my-3 flex h-10 items-center justify-center rounded-xl px-4 py-2 hover:cursor-pointer"
          >
            <Layers size={17} />
            <div className="ml-2 text-sm font-semibold">{t('title')}</div>
          </div>
        }
      />
    </div>
  );
};

export default NewActivityButton;
