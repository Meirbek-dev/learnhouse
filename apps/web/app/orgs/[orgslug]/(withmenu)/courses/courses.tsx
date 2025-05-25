'use client'
import CreateCourseModal from '@components/Objects/Modals/Course/Create/CreateCourse'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail'
import NewCourseButton from '@components/Objects/StyledElements/Buttons/NewCourseButton'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useTranslations } from 'next-intl'

interface CourseProps {
  orgslug: string
  courses: any
  org_id: string
}

function Courses(props: CourseProps) {
  const t = useTranslations('CoursesPage')
  const orgslug = props.orgslug
  const courses = props.courses
  const searchParams = useSearchParams()
  const isCreatingCourse = searchParams.get('new') ? true : false
  const [newCourseModal, setNewCourseModal] = useState(isCreatingCourse)
  const isUserAdmin = useAdminStatus() as any

  async function closeNewCourseModal() {
    setNewCourseModal(false)
  }

  return (
    <div className="w-full">
      <GeneralWrapperStyled>
        <div className="mb-2 flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <TypeOfContentTitle title={t('title')} type="cou" />
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
              <div key={course.course_uuid} className="p-3">
                <CourseThumbnail course={course} orgslug={orgslug} />
              </div>
            ))}
            {courses.length === 0 && (
              <div className="col-span-full flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="mb-4">
                    <svg
                      width="50"
                      height="50"
                      viewBox="0 0 295 295"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="mx-auto"
                    >
                      <rect
                        opacity="0.51"
                        x="10"
                        y="10"
                        width="275"
                        height="275"
                        rx="75"
                        stroke="#4B5564"
                        strokeOpacity="0.15"
                        strokeWidth="20"
                      />
                      <path
                        d="M135.8 200.8V130L122.2 114.6L135.8 110.4V102.8L122.2 87.4L159.8 76V200.8L174.6 218H121L135.8 200.8Z"
                        fill="#4B5564"
                        fillOpacity="0.08"
                      />
                    </svg>
                  </div>
                  <h1 className="mb-2 text-xl font-bold text-gray-600">
                    {t('noCourses')}
                  </h1>
                  <p className="text-md text-gray-400">
                    {isUserAdmin ? t('createACourse') : t('noCoursesAvailable')}
                  </p>
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
                          dialogTitle={"t('createCourse')"}
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
  )
}

export default Courses
