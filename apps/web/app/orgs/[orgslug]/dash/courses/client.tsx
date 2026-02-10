'use client';

import CourseThumbnail, { removeCoursePrefix } from '@components/Objects/Thumbnails/CourseThumbnail';
import { Actions, PermissionGuard, Resources, Scopes, usePermissions } from '@/components/Security';
import NewCourseButton from '@components/Objects/StyledElements/Buttons/NewCourseButton';
import CreateCourseModal from '@components/Objects/Modals/Course/Create/CreateCourse';
import { revalidateTags } from '@services/utils/ts/requests';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import BreadCrumbs from '@components/Dashboard/Misc/BreadCrumbs';
import { useOrg } from '@components/Contexts/OrgContext';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface CourseProps {
  orgslug: string;
  courses: any;
  org_id: number;
  totalCourses: number;
}

const CoursesHome = (params: CourseProps) => {
  const searchParams = useSearchParams();
  const isCreatingCourse = Boolean(searchParams.get('new'));
  const [newCourseModal, setNewCourseModal] = useState(isCreatingCourse);
  const { orgslug, courses, totalCourses } = params;
  const { can } = usePermissions();
  const canManageOrg = can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN);
  const t = useTranslations('DashPage.Courses.HomePageClient');
  const org = useOrg() as any;

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
          org_id={params.org_id}
          onCreated={async () => {
            await revalidateTags(['courses'], orgslug);
          }}
        />
      }
      dialogTitle={t('createCourse')}
      dialogDescription={t('createCourseDescription')}
    />
  );

  return (
    <div className="h-full w-full bg-[#f8f8f8] pr-10 pl-10">
      <div className="mb-6">
        <BreadCrumbs type="courses" />
        <div className="mt-4 flex flex-col items-start justify-between sm:flex-row sm:items-center">
          <div className="flex items-center space-x-4">
            <h1 className="mb-4 text-3xl font-bold sm:mb-0">{t('courses')}</h1>
          </div>
          <PermissionGuard
            action={Actions.CREATE}
            resource={Resources.COURSE}
            scope={Scopes.ORG}
            fallback={null}
          >
            <NewCourseButton
              onClick={() => {
                setNewCourseModal(true);
              }}
            />
          </PermissionGuard>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-6 pb-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
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
              <p className="text-lg text-gray-400">{canManageOrg ? t('createACourse') : t('noCoursesAvailable')}</p>
              {canManageOrg ? (
                <div className="mt-6 flex justify-center">
                  <PermissionGuard
                    action={Actions.CREATE}
                    resource={Resources.COURSE}
                    scope={Scopes.ORG}
                    fallback={null}
                  >
                    <NewCourseButton
                      onClick={() => {
                        setNewCourseModal(true);
                      }}
                    />
                  </PermissionGuard>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
      {modal}
    </div>
  );
};

export default CoursesHome;
