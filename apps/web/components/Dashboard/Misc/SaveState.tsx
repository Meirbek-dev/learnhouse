'use client';

import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { updateCourseOrderStructure } from '@services/courses/chapters';
import { updateCertification } from '@services/courses/certifications';
import { Check, Loader2, SaveAllIcon, Timer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { revalidateTags } from '@services/utils/ts/requests';
import { updateCourse } from '@services/courses/courses';
import { getAPIUrl } from '@services/config/config';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { mutate } from 'swr';

const SaveState = (props: { orgslug: string }) => {
  const [isLoading, setIsLoading] = useState(false);
  const course = useCourse();
  const session = usePlatformSession() as any;
  const router = useRouter();
  const saved = course ? course.isSaved : false;
  const dispatchCourse = useCourseDispatch();
  const course_structure = course.courseStructure;
  const t = useTranslations('Common');
  const isInitialized = useRef(false);

  const withUnpublishedActivities = course ? course.withUnpublishedActivities : false;
  const saveCourseState = async () => {
    if (saved || isLoading) return;
    setIsLoading(true);
    try {
      // Course  order
      await changeOrderBackend();
      mutate(
        `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
      );
      // Course metadata
      await changeMetadataBackend();
      mutate(
        `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
      );
      // Certification data (if present)
      await saveCertificationData();
      await revalidateTags(['courses'], props.orgslug);
      dispatchCourse({ type: 'setIsSaved' });
    } finally {
      setIsLoading(false);
    }
  };

  // Course Order
  const changeOrderBackend = async () => {
    mutate(
      `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
    );
    await updateCourseOrderStructure(
      course.courseStructure.course_uuid,
      course.courseOrder,
      session.data?.tokens?.access_token,
    );
    await revalidateTags(['courses'], props.orgslug);
    router.refresh();
    dispatchCourse({ type: 'setIsSaved' });
  };

  // Course metadata
  const changeMetadataBackend = async () => {
    mutate(
      `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
    );
    await updateCourse(course.courseStructure.course_uuid, course.courseStructure, session.data?.tokens?.access_token);
    await revalidateTags(['courses'], props.orgslug);
    router.refresh();
    dispatchCourse({ type: 'setIsSaved' });
  };

  // Certification data
  const saveCertificationData = async () => {
    if (course.courseStructure._certificationData) {
      const certData = course.courseStructure._certificationData;
      try {
        await updateCertification(certData.certification_uuid, certData.config, session.data?.tokens?.access_token);
        console.log('Certification data saved successfully');
      } catch (error) {
        console.error('Failed to save certification data:', error);
        // Don't throw error to prevent breaking the main save flow
      }
    }
  };

  useEffect(() => {
    if (!course_structure?.chapters) return;

    const { chapters } = course_structure;
    const chapter_order_by_ids = chapters.map((chapter: any) => ({
      chapter_id: chapter.id,
      activities_order_by_ids: chapter.activities.map((activity: any) => ({ activity_id: activity.id })),
    }));

    // Initialize order payload once
    if (!isInitialized.current) {
      dispatchCourse({ type: 'setCourseOrder', payload: { chapter_order_by_ids } });
      dispatchCourse({ type: 'setIsNotSaved' });
      isInitialized.current = true;
      return;
    }

    // If there are updates and course is not saved, update order payload
    if (!saved) {
      dispatchCourse({ type: 'setCourseOrder', payload: { chapter_order_by_ids } });
      dispatchCourse({ type: 'setIsNotSaved' });
    }
  }, [course_structure, saved, dispatchCourse]);

  return (
    <div className="flex space-x-4">
      {!saved && (
        <div className="flex items-center space-x-2 text-gray-600 antialiased">
          <Timer size={15} />
          <div>{t('unsavedChanges')}</div>
        </div>
      )}
      <div
        className={`flex cursor-pointer items-center space-x-2 rounded-lg px-4 py-2 font-semibold antialiased drop-shadow-md transition-all ease-linear ${
          saved ? 'bg-gray-600 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90 border shadow-xs'
        }${isLoading ? 'cursor-not-allowed opacity-50' : ''}`}
        onClick={saveCourseState}
      >
        {isLoading ? (
          <>
            <Loader2
              size={20}
              className="animate-spin"
            />
            <div>{t('saving')}</div>
          </>
        ) : saved ? (
          <>
            <Check size={20} />
            <div>{t('saved')}</div>
          </>
        ) : (
          <>
            <SaveAllIcon size={20} />
            <div>{t('save')}</div>
          </>
        )}
      </div>
    </div>
  );
};

export default SaveState;
