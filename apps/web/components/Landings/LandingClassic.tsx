import NewCollectionButton from '@components/Objects/StyledElements/Buttons/NewCollectionButton';
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle';
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper';
import NewCourseButton from '@components/Objects/StyledElements/Buttons/NewCourseButton';
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement';
import ContentPlaceHolderIfUserIsNotAdmin from '@components/Objects/ContentPlaceHolder';
import CollectionThumbnail from '@components/Objects/Thumbnails/CollectionThumbnail';
import { HeroSection } from '@/components/Dashboard/Gamification/hero-section';
import type { UserGamificationProfile } from '@/types/gamification';
import { getUriWithOrg } from '@services/config/config';
import CourseGridClient from './CourseGridClient';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface LandingClassicProps {
  courses: any[];
  collections: any[];
  orgslug: string;
  org_id: number;
  gamificationProfile?: UserGamificationProfile | null;
  userRank?: number | null;
}

const EmptyCollectionsState = ({ t }: { t: any }) => (
  <div className="col-span-full flex items-center justify-center py-12">
    <div className="max-w-md text-center">
      <div className="mb-6">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-purple-50 to-purple-100">
          <svg
            className="text-primary h-8 w-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
      </div>
      <h1 className="mb-3 text-xl font-bold text-gray-700">{t('Collections.noContent')}</h1>
      <p className="text-base text-gray-500">
        <ContentPlaceHolderIfUserIsNotAdmin text={t('Collections.noContentUserAdmin')} />
      </p>
    </div>
  </div>
);
const EmptyCoursesState = ({ t }: { t: any }) => (
  <div className="col-span-full flex items-center justify-center py-12">
    <div className="max-w-md text-center">
      <div className="mb-6">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-blue-50 to-blue-100">
          <svg
            className="text-primary h-8 w-8"
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
      <h1 className="mb-3 text-xl font-bold text-gray-700">{t('Courses.noContent')}</h1>
      <p className="text-base text-gray-500">
        <ContentPlaceHolderIfUserIsNotAdmin text={t('Courses.noContentUserAdmin')} />
      </p>
    </div>
  </div>
);

const CollectionGrid = ({ collections, orgslug, org_id }: { collections: any[]; orgslug: string; org_id: number }) => (
  <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
    {collections.map((collection: any) => (
      <div
        key={collection.collection_uuid}
        className="p-2 transition-transform duration-200 hover:scale-[1.02]"
      >
        <CollectionThumbnail
          collection={collection}
          orgslug={orgslug}
          org_id={org_id}
        />
      </div>
    ))}
  </div>
);

// CourseGrid component is now extracted to CourseGridClient.tsx

const LandingClassic = ({
  courses,
  collections,
  orgslug,
  org_id,
  gamificationProfile,
  userRank,
}: LandingClassicProps) => {
  const t = useTranslations('HomePage');

  return (
    <div className="w-full">
      <GeneralWrapperStyled>
        {/* Gamification Hero Section */}
        {gamificationProfile && (
          <section className="mb-8">
            <HeroSection
              profile={gamificationProfile}
              userRank={userRank}
            />
          </section>
        )}

        {/* Courses Section */}
        <section className="flex flex-col space-y-6">
          <div className="flex items-center justify-between">
            <TypeOfContentTitle
              title={t('Courses.title')}
              type="cou"
            />
            <AuthenticatedClientElement
              ressourceType="courses"
              action="create"
              checkMethod="roles"
              orgId={org_id}
            >
              <Link
                prefetch={false}
                href={getUriWithOrg(orgslug, '/courses?new=true')}
                className="transition-transform duration-200 hover:scale-105"
              >
                <NewCourseButton />
              </Link>
            </AuthenticatedClientElement>
          </div>

          {courses.length === 0 ? (
            <EmptyCoursesState t={t} />
          ) : (
            <CourseGridClient
              courses={courses}
              orgslug={orgslug}
            />
          )}
        </section>

        {/* Collections Section */}
        <section className="mb-12 flex flex-col space-y-6">
          <div className="flex items-center justify-between">
            <TypeOfContentTitle
              title={t('Collections.title')}
              type="col"
            />
            <AuthenticatedClientElement
              checkMethod="roles"
              ressourceType="collections"
              action="create"
              orgId={org_id}
            >
              <Link
                prefetch={false}
                href={getUriWithOrg(orgslug, '/collections/new')}
                className="transition-transform duration-200 hover:scale-105"
              >
                <NewCollectionButton />
              </Link>
            </AuthenticatedClientElement>
          </div>

          {collections.length === 0 ? (
            <EmptyCollectionsState t={t} />
          ) : (
            <CollectionGrid
              collections={collections}
              orgslug={orgslug}
              org_id={org_id}
            />
          )}
        </section>
      </GeneralWrapperStyled>
    </div>
  );
};

export default LandingClassic;
