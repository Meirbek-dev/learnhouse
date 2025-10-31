'use client';

import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { getOwnedCourses } from '@services/payments/payments';
import { useOrg } from '@components/Contexts/OrgContext';
import { Package2, ShoppingCart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';

const EmptyState = ({ t }: { t: any }) => (
  <div className="col-span-full flex items-center justify-center py-16">
    <div className="max-w-md text-center">
      <div className="mb-6">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-blue-50 to-indigo-100">
          <ShoppingCart className="text-primary h-10 w-10" />
        </div>
      </div>
      <h2 className="mb-3 text-2xl font-bold text-gray-700">{t('noPurchasedCourses')}</h2>
      <p className="text-lg leading-relaxed text-gray-500">{t('noPurchasedCoursesDesc')}</p>
    </div>
  </div>
);

const CourseGrid = ({ ownedCourses, orgSlug }: { ownedCourses: any[]; orgSlug: string }) => (
  <div className="grid w-full grid-cols-1 gap-6 pb-12 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
    {ownedCourses.map((course: any) => (
      <div
        key={course.course_uuid}
        className="mx-auto w-full max-w-[300px] transition-transform duration-200 hover:scale-[1.02]"
      >
        <CourseThumbnail
          course={course}
          orgslug={orgSlug}
        />
      </div>
    ))}
  </div>
);

const OwnedCoursesPage = () => {
  const t = useTranslations('DashPage.Courses');
  const org = useOrg() as any;
  const session = useLHSession();
  const access_token = session?.data?.tokens?.access_token;

  const {
    data: ownedCourses,
    error,
    isLoading,
  } = useSWR(
    org && access_token ? [`/payments/${org.id}/courses/owned`, access_token] : null,
    ([_url, token]) => getOwnedCourses(org.id, token),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000, // Cache for 1 minute
    },
  );

  if (isLoading) return <PageLoading />;
  if (error) {
    return (
      <div className="h-full w-full bg-[#f8f8f8] pt-5 pr-10 pl-10">
        <div className="soft-shadow mb-6 flex flex-col rounded-lg border border-red-100 bg-white px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <Package2 className="h-6 w-6 text-red-500" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-red-700">{t('error')}</h1>
              <h2 className="text-sm text-red-500">{t('failedToLoadCourses')}</h2>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#f8f8f8] pt-5 pr-10 pl-10">
      {/* Header Card */}
      <div className="soft-shadow mb-8 flex flex-col rounded-lg border border-gray-100 bg-white px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-blue-50 to-indigo-100">
            <Package2 className="text-primary h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-800">{t('myCourses')}</h1>
            <h2 className="text-sm text-gray-600">{t('purchasedCourses')}</h2>
          </div>
          {ownedCourses && ownedCourses.length > 0 ? (
            <div className="ml-auto">
              <span className="text-primary inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium">
                {ownedCourses.length} {ownedCourses.length === 1 ? t('course') : t('courses')}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Course Grid or Empty State */}
      {!ownedCourses || ownedCourses.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <CourseGrid
          ownedCourses={ownedCourses}
          orgSlug={org.slug}
        />
      )}
    </div>
  );
};

export default OwnedCoursesPage;
