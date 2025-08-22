'use client';

import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle';
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper';
import NewCourseButton from '@components/Objects/StyledElements/Buttons/NewCourseButton';
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement';
import CreateCourseModal from '@components/Objects/Modals/Course/Create/CreateCourse';
import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import useAdminStatus from '@components/Hooks/useAdminStatus';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface CourseProps {
  orgslug: string;
  courses: any;
  org_id: number;
}

const EmptyStateMessage = ({ isUserAdmin, t, newCourseButtonTrigger }: any) => (
  <div className="col-span-full flex items-center justify-center py-12">
    <div className="max-w-md text-center">
      <div className="mb-6">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <svg
            className="h-8 w-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        </div>
      </div>
      <h1 className="mb-3 text-2xl font-bold text-gray-700">{t('noCourses')}</h1>
      <p className="mb-6 text-lg text-gray-500">{isUserAdmin ? t('createACourse') : t('noCoursesAvailable')}</p>
      {isUserAdmin ? <div className="flex justify-center">{newCourseButtonTrigger}</div> : null}
    </div>
  </div>
);

const CourseGrid = ({ courses, orgslug }: { courses: any[]; orgslug: string }) => (
  <div className="grid w-full grid-cols-1 gap-6 pb-12 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
    {courses.map((course: any) => (
      <div
        key={course.course_uuid}
        className="mx-auto w-full max-w-[300px]"
      >
        <CourseThumbnail
          course={course}
          orgslug={orgslug}
        />
      </div>
    ))}
  </div>
);

const Courses = (props: CourseProps) => {
  const t = useTranslations('CoursesPage');
  const { orgslug, courses, org_id } = props;
  const searchParams = useSearchParams();
  const isCreatingCourse = Boolean(searchParams.get('new'));
  const [newCourseModal, setNewCourseModal] = useState(isCreatingCourse);
  const isUserAdmin = useAdminStatus() as any;

  async function closeNewCourseModal() {
    setNewCourseModal(false);
  }

  // Single trigger for opening the modal
  const newCourseButtonTrigger = (
    <AuthenticatedClientElement
      checkMethod="roles"
      action="create"
      ressourceType="courses"
      orgId={org_id}
    >
      <NewCourseButton
        onClick={() => {
          setNewCourseModal(true);
        }}
      />
    </AuthenticatedClientElement>
  );

  return (
    <div className="w-full">
      <GeneralWrapperStyled>
        <div className="mb-2 flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <TypeOfContentTitle
              title={t('title')}
              type="cou"
            />
            {newCourseButtonTrigger}
          </div>

          {/* Single Modal instance rendered here */}
          <Modal
            isDialogOpen={newCourseModal}
            onOpenChange={setNewCourseModal}
            minHeight="md"
            dialogContent={
              <CreateCourseModal
                closeModal={closeNewCourseModal}
                orgslug={orgslug}
              />
            }
            dialogTitle={t('createCourse')}
            dialogDescription={t('createCourseDescription')}
          />

          {courses.length === 0 ? (
            <EmptyStateMessage
              isUserAdmin={isUserAdmin}
              t={t}
              newCourseButtonTrigger={newCourseButtonTrigger}
            />
          ) : (
            <CourseGrid
              courses={courses}
              orgslug={orgslug}
            />
          )}
        </div>
      </GeneralWrapperStyled>
    </div>
  );
};

export default Courses;
