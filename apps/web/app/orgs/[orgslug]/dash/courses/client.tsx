'use client';

import CourseThumbnail, { removeCoursePrefix } from '@components/Objects/Thumbnails/CourseThumbnail';
import NewCourseButton from '@components/Objects/StyledElements/Buttons/NewCourseButton';
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement';
import CreateCourseModal from '@components/Objects/Modals/Course/Create/CreateCourse';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import BreadCrumbs from '@components/Dashboard/Misc/BreadCrumbs';
import useAdminStatus from '@components/Hooks/useAdminStatus';
import { useOrg } from '@components/Contexts/OrgContext';
import { getUriWithOrg } from '@services/config/config';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BookOpen } from 'lucide-react';
import { useState } from 'react';
import Link from '@components/ui/AppLink';

interface CourseProps {
  orgslug: string;
  courses: any;
  org_id: number;
}

const CoursesHome = (params: CourseProps) => {
  const searchParams = useSearchParams();
  const isCreatingCourse = Boolean(searchParams.get('new'));
  const [newCourseModal, setNewCourseModal] = useState(isCreatingCourse);
  const { orgslug } = params;
  const { courses } = params;
  const isUserAdmin = useAdminStatus();
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
          orgslug={orgslug}
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
            <Link
              href={getUriWithOrg(org?.slug, '/dash/documentation/rights')}
              className="bg-primary text-primary-foreground flex items-center space-x-2 rounded-md p-2 px-4 text-xs font-bold antialiased drop-shadow-lg transition-all duration-100 ease-linear hover:scale-105"
            >
              <BookOpen className="h-4 w-4" />
              <span>{t('rightsGuide')}</span>
            </Link>
          </div>
          <AuthenticatedClientElement
            checkMethod="roles"
            action="create"
            ressourceType="courses"
            orgId={params.org_id}
          >
            <NewCourseButton
              onClick={() => {
                setNewCourseModal(true);
              }}
            />
          </AuthenticatedClientElement>
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
              <p className="text-lg text-gray-400">{isUserAdmin ? t('createACourse') : t('noCoursesAvailable')}</p>
              {isUserAdmin ? (
                <div className="mt-6 flex justify-center">
                  <AuthenticatedClientElement
                    action="create"
                    ressourceType="courses"
                    checkMethod="roles"
                    orgId={params.org_id}
                  >
                    <NewCourseButton
                      onClick={() => {
                        setNewCourseModal(true);
                      }}
                    />
                  </AuthenticatedClientElement>
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
