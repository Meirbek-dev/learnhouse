'use client';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import useAdminStatus from '@components/Hooks/useAdminStatus';
import CreateCourseModal from '@components/Objects/Modals/Course/Create/CreateCourse';
import NewCourseButton from '@components/Objects/StyledElements/Buttons/NewCourseButton';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle';
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper';
import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail';
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement';

interface CourseProps {
  orgslug: string;
  courses: any;
  org_id: string;
}

function Courses(props: CourseProps) {
  const t = useTranslations('CoursesPage');
  const { orgslug } = props;
  const { courses } = props;
  const searchParams = useSearchParams();
  const isCreatingCourse = !!searchParams.get('new');
  const [newCourseModal, setNewCourseModal] = useState(isCreatingCourse);
  const isUserAdmin = useAdminStatus() as any;

  async function closeNewCourseModal() {
    setNewCourseModal(false);
  }

  return (
    <div className="w-full">
      <GeneralWrapperStyled>
        <div className="mb-2 flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <TypeOfContentTitle
              title={t('title')}
              type="cou"
            />
            <AuthenticatedClientElement
              checkMethod="roles"
              action="create"
              ressourceType="courses"
              orgId={props.org_id}
            >
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
                dialogTrigger={<NewCourseButton />}
              />
            </AuthenticatedClientElement>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {courses.map((course: any) => (
              <div
                key={course.course_uuid}
                className="p-3"
              >
                <CourseThumbnail
                  course={course}
                  orgslug={orgslug}
                />
              </div>
            ))}
            {courses.length === 0 && (
              <div className="col-span-full flex items-center justify-center py-8">
                <div className="text-center">
                  <h1 className="mb-2 text-xl font-bold text-gray-600">{t('noCourses')}</h1>
                  <p className="text-md text-gray-400">{isUserAdmin ? t('createACourse') : t('noCoursesAvailable')}</p>
                  {isUserAdmin && (
                    <div className="mt-4 flex justify-center">
                      <AuthenticatedClientElement
                        action="create"
                        ressourceType="courses"
                        checkMethod="roles"
                        orgId={props.org_id}
                      >
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
                          dialogTrigger={<NewCourseButton />}
                        />
                      </AuthenticatedClientElement>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </GeneralWrapperStyled>
    </div>
  );
}

export default Courses;
