import { ArrowRight, BookOpenCheck, Check, FileText, Folder, Layers, Square, Video } from 'lucide-react';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { getUriWithOrg } from '@services/config/config';
import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { FC } from 'react';
import Link from 'next/link';

interface CourseProgressProps {
  course: any;
  orgslug: string;
  isOpen: boolean;
  onClose: () => void;
  trailData: any;
}

const CourseProgress: FC<CourseProgressProps> = ({ course, orgslug, isOpen, onClose, trailData }) => {
  const t = useTranslations('Courses.CoursesActions');

  const isActivityDone = useCallback(
    (activity: any) => {
      const cleanCourseUuid = course.course_uuid?.replace('course_', '');
      const run = trailData?.runs?.find((run: any) => {
        const cleanRunCourseUuid = run.course?.course_uuid?.replace('course_', '');
        return cleanRunCourseUuid === cleanCourseUuid;
      });
      if (run) {
        return run.steps.find((step: any) => step.activity_id === activity.id && step.complete === true);
      }
      return false;
    },
    [course.course_uuid, trailData?.runs],
  );

  const { completedActivities, totalActivities } = useMemo(() => {
    let total = 0;
    let completed = 0;

    course.chapters.forEach((chapter: any) => {
      chapter.activities.forEach((activity: any) => {
        total += 1;
        if (isActivityDone(activity)) {
          completed += 1;
        }
      });
    });

    return { completedActivities: completed, totalActivities: total };
  }, [course.chapters, isActivityDone]);

  const getActivityTypeIcon = (activityType: string) => {
    switch (activityType) {
      case 'TYPE_VIDEO': {
        return (
          <Video
            size={16}
            className="text-gray-400"
          />
        );
      }
      case 'TYPE_DOCUMENT': {
        return (
          <FileText
            size={16}
            className="text-gray-400"
          />
        );
      }
      case 'TYPE_DYNAMIC': {
        return (
          <Layers
            size={16}
            className="text-gray-400"
          />
        );
      }
      case 'TYPE_ASSIGNMENT': {
        return (
          <BookOpenCheck
            size={16}
            className="text-gray-400"
          />
        );
      }
      default: {
        return (
          <FileText
            size={16}
            className="text-gray-400"
          />
        );
      }
    }
  };

  const dialogContent = (
    <div className="space-y-4">
      {course.chapters.map((chapter: any) => (
        <div
          key={chapter.chapter_uuid}
          className="overflow-hidden rounded-lg bg-gray-50"
        >
          <div className="flex items-center space-x-2 bg-gray-100 px-4 py-3 font-semibold text-gray-700">
            <Folder
              size={16}
              className="text-gray-400"
            />
            <span>{chapter.name}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {chapter.activities.map((activity: any) => {
              const activityId = activity.activity_uuid.replace('activity_', '');
              const courseId = course.course_uuid.replace('course_', '');
              return (
                <Link
                  key={activity.activity_uuid}
                  href={`${getUriWithOrg(orgslug, '')}/course/${courseId}/activity/${activityId}`}
                >
                  <div className="group flex items-center px-4 py-3 transition-colors hover:bg-gray-100">
                    <div className="flex flex-1 items-center space-x-3">
                      {isActivityDone(activity) ? (
                        <div className="relative">
                          <Square
                            size={18}
                            className="stroke-2 text-teal-600"
                          />
                          <Check
                            size={18}
                            className="absolute top-0 left-0 stroke-[2.5] text-teal-600"
                          />
                        </div>
                      ) : (
                        <Square
                          size={18}
                          className="stroke-2 text-gray-300"
                        />
                      )}
                      <div className="flex items-center space-x-2">
                        {getActivityTypeIcon(activity.activity_type)}
                        <span className="text-gray-700 group-hover:text-gray-900">{activity.name}</span>
                      </div>
                    </div>
                    <ArrowRight
                      size={16}
                      className="text-gray-400 group-hover:text-gray-600"
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <Modal
      isDialogOpen={isOpen}
      onOpenChange={onClose}
      dialogContent={dialogContent}
      dialogTitle={t('courseProgress')}
      dialogDescription={t('activitiesCompleted', { completed: completedActivities, total: totalActivities })}
      minWidth="md"
    />
  );
};

export default CourseProgress;
