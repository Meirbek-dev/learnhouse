import { useTranslations } from 'next-intl'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle'
import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail'
import CollectionThumbnail from '@components/Objects/Thumbnails/CollectionThumbnail'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import NewCourseButton from '@components/Objects/StyledElements/Buttons/NewCourseButton'
import NewCollectionButton from '@components/Objects/StyledElements/Buttons/NewCollectionButton'
import ContentPlaceHolderIfUserIsNotAdmin from '@components/Objects/ContentPlaceHolder'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'

interface LandingClassicProps {
  courses: any[]
  collections: any[]
  orgslug: string
  org_id: string
}

function LandingClassic({
  courses,
  collections,
  orgslug,
  org_id,
}: LandingClassicProps) {
  const t = useTranslations('HomePage')

  return (
    <div className="w-full">
      <GeneralWrapperStyled>
        {/* Collections */}
        <div className="mb-8 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <TypeOfContentTitle title={t('Collections.title')} type="col" />
            <AuthenticatedClientElement
              checkMethod="roles"
              ressourceType="collections"
              action="create"
              orgId={org_id}
            >
              <Link href={getUriWithOrg(orgslug, '/collections/new')}>
                <NewCollectionButton />
              </Link>
            </AuthenticatedClientElement>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {collections.map((collection: any) => (
              <div
                key={collection.collection_uuid}
                className="flex flex-col p-3"
              >
                <CollectionThumbnail
                  collection={collection}
                  orgslug={orgslug}
                  org_id={org_id}
                />
              </div>
            ))}
            {collections.length === 0 && (
              <div className="col-span-full flex items-center justify-center py-8">
                <div className="text-center">
                  <h1 className="mb-2 text-xl font-bold text-gray-600">
                    {t('Collections.noContent')}
                  </h1>
                  <p className="text-md text-gray-400">
                    <ContentPlaceHolderIfUserIsNotAdmin
                      text={t('Collections.noContentUserAdmin')}
                    />
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Courses */}
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <TypeOfContentTitle title={t('Courses.title')} type="cou" />
            <AuthenticatedClientElement
              ressourceType="courses"
              action="create"
              checkMethod="roles"
              orgId={org_id}
            >
              <Link href={getUriWithOrg(orgslug, '/courses?new=true')}>
                <NewCourseButton />
              </Link>
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
                  <h1 className="mb-2 text-xl font-bold text-gray-600">
                    {t('Courses.noContent')}
                  </h1>
                  <p className="text-md text-gray-400">
                    <ContentPlaceHolderIfUserIsNotAdmin
                      text={t('Courses.noContentUserAdmin')}
                    />
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </GeneralWrapperStyled>
    </div>
  )
}

export default LandingClassic
