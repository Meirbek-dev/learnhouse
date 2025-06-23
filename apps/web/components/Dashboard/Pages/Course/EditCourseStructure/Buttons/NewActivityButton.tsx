'use client';
import { createActivity, createExternalVideoActivity, createFileActivity } from '@services/courses/activities';
import { getOrganizationContextInfoWithoutCredentials } from '@services/organizations/orgs';
import NewActivityModal from '@components/Objects/Modals/Activities/Create/NewActivity';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { useCourse } from '@components/Contexts/CourseContext';
import { revalidateTags } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { mutate } from 'swr';

type NewActivityButtonProps = {
  chapterId: string;
  orgslug: string;
};

function NewActivityButton(props: NewActivityButtonProps) {
  const [newActivityModal, setNewActivityModal] = useState(false);
  const router = useRouter();
  const course = useCourse() as any;
  const session = useLHSession() as any;
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
    router.refresh();
  };

  // Submit File Upload
  const submitFileActivity = async (file: any, type: any, activity: any, chapterId: string) => {
    const toast_loading = toast.loading(tNotify('uploadingAndCreating'));
    await createFileActivity(file, type, activity, chapterId, access_token);
    mutate(
      `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
    );
    setNewActivityModal(false);
    toast.dismiss(toast_loading);
    toast.success(tNotify('fileUploadSuccess'));
    toast.success(tNotify('activityCreatedSuccess'));
    await revalidateTags(['courses'], props.orgslug);
    router.refresh();
  };

  // Submit YouTube Video Upload
  const submitExternalVideo = async (external_video_data: any, activity: any, _chapterId: string) => {
    const toast_loading = toast.loading(tNotify('creatingActivity'));
    await createExternalVideoActivity(external_video_data, activity, props.chapterId, access_token);
    mutate(
      `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
    );
    setNewActivityModal(false);
    toast.dismiss(toast_loading);
    toast.success(tNotify('activityCreatedSuccess'));
    await revalidateTags(['courses'], props.orgslug);
    router.refresh();
  };

  useEffect(() => {}, [course]);

  return (
    <div className="flex justify-center">
      <Modal
        isDialogOpen={newActivityModal}
        onOpenChange={setNewActivityModal}
        minHeight="no-min"
        minWidth="md"
        addDefCloseButton={false}
        dialogContent={
          <NewActivityModal
            closeModal={closeNewActivityModal}
            submitFileActivity={submitFileActivity}
            submitExternalVideo={submitExternalVideo}
            submitActivity={submitActivity}
            chapterId={props.chapterId}
            course={course}
          />
        }
        dialogTitle={t('title')}
        dialogDescription={t('description')}
        dialogTrigger={
          <div
            onClick={() => {
              openNewActivityModal(props.chapterId);
            }}
            className="max-w-auto my-3 flex h-10 items-center justify-center rounded-xl bg-black px-4 py-2 text-white hover:cursor-pointer"
          >
            <Layers size={17} />
            <div className="ml-2 text-sm font-semibold">{t('title')}</div>
          </div>
        }
      />
    </div>
  );
}

export default NewActivityButton;
