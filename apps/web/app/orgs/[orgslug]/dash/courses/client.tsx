'use client';

import NewCourseButton from '@components/Objects/StyledElements/Buttons/NewCourseButton';
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement';
import CreateCourseModal from '@components/Objects/Modals/Course/Create/CreateCourse';
import { removeCoursePrefix } from '@components/Objects/Thumbnails/CourseThumbnail';
import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import BreadCrumbs from '@components/Dashboard/Misc/BreadCrumbs';
import useAdminStatus from '@components/Hooks/useAdminStatus';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface CourseProps {
  orgslug: string;
  courses: any;
  org_id: number;
}

function CoursesHome(params: CourseProps) {
  const searchParams = useSearchParams();
  const isCreatingCourse = !!searchParams.get('new');
  const [newCourseModal, setNewCourseModal] = useState(isCreatingCourse);
  const { orgslug } = params;
  const { courses } = params;
  const isUserAdmin = useAdminStatus() as any;
  const t = useTranslations('DashPage.Courses.HomePageClient');

  async function closeNewCourseModal() {
    setNewCourseModal(false);
  }

  // Single modal instance, trigger can be used in multiple places
  const modal = (
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
  );

  return (
    <div className="h-full w-full bg-[#f8f8f8] pl-10 pr-10">
      <div className="mb-6">
        <BreadCrumbs type="courses" />
        <div className="mt-4 flex flex-col items-start justify-between sm:flex-row sm:items-center">
          <h1 className="mb-4 text-3xl font-bold sm:mb-0">{t('courses')}</h1>
          <AuthenticatedClientElement
            checkMethod="roles"
            action="create"
            ressourceType="courses"
            orgId={params.org_id}
          >
            <NewCourseButton onClick={() => setNewCourseModal(true)} />
          </AuthenticatedClientElement>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6 pb-8">
        {courses.map((course: any) => (
          <div
            key={course.course_uuid}
            className="mx-auto w-full max-w-[300px]"
          >
            <CourseThumbnail
              customLink={`/dash/courses/course/${removeCoursePrefix(course.course_uuid)}/general`}
              course={course}
              orgslug={orgslug}
            />
          </div>
        ))}
        {courses.length === 0 && (
          <div className="col-span-full flex items-center justify-center py-8">
            <div className="text-center">
              <h2 className="mb-2 text-2xl font-bold text-gray-600">{t('noCourses')}</h2>
              <p className="text-lg text-gray-400">{isUserAdmin ? t('createACourse') : t('noCoursesAvailable')}</p>
              {isUserAdmin && (
                <div className="mt-6 flex justify-center">
                  <AuthenticatedClientElement
                    action="create"
                    ressourceType="courses"
                    checkMethod="roles"
                    orgId={params.org_id}
                  >
                    <NewCourseButton onClick={() => setNewCourseModal(true)} />
                  </AuthenticatedClientElement>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {modal}
    </div>
  );
}

export default CoursesHome;
