'use client';

import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail';
import { getOwnedCourses } from '@services/payments/payments';
import { Package2, ShoppingCart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { memo } from 'react';
import useSWR from 'swr';

const EmptyState = memo(({ t }: { t: any }) => (
  <div className="col-span-full flex items-center justify-center py-16">
    <div className="text-center max-w-md">
      <div className="mb-6">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <ShoppingCart className="h-10 w-10 text-primary" />
        </div>
      </div>
      <h2 className="mb-3 text-2xl font-bold text-gray-700">{t('noPurchasedCourses')}</h2>
      <p className="text-lg text-gray-500 leading-relaxed">{t('noPurchasedCoursesDesc')}</p>
    </div>
  </div>
));

EmptyState.displayName = 'EmptyState';

const CourseGrid = memo(({ ownedCourses, orgSlug }: { ownedCourses: any[]; orgSlug: string }) => (
  <div className="grid w-full grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6 pb-12">
    {ownedCourses.map((course: any) => (
      <div
        key={course.course_uuid}
        className="mx-auto w-full max-w-[300px] transform transition-transform duration-200 hover:scale-[1.02]"
      >
        <CourseThumbnail
          course={course}
          orgslug={orgSlug}
        />
      </div>
    ))}
  </div>
));

CourseGrid.displayName = 'CourseGrid';

function OwnedCoursesPage() {
  const t = useTranslations('DashPage.Courses');
  const org = useOrg() as any;
  const session = useLHSession() as any;
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
      dedupingInterval: 60000, // Cache for 1 minute
    },
  );

  if (isLoading) return <PageLoading />;
  if (error) {
    return (
      <div className="h-full w-full bg-[#f8f8f8] pl-10 pr-10 pt-5">
        <div className="soft-shadow mb-6 flex flex-col rounded-lg bg-white px-6 py-4 border border-red-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <Package2 className="h-6 w-6 text-red-500" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-red-700">{t('error')}</h1>
              <h2 className="text-sm text-red-500">Failed to load courses</h2>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#f8f8f8] pl-10 pr-10 pt-5">
      {/* Header Card */}
      <div className="soft-shadow mb-8 flex flex-col rounded-lg bg-white px-6 py-5 border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <Package2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-800">{t('myCourses')}</h1>
            <h2 className="text-sm text-gray-600">{t('purchasedCourses')}</h2>
          </div>
          {ownedCourses && ownedCourses.length > 0 && (
            <div className="ml-auto">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-primary">
                {ownedCourses.length} {ownedCourses.length === 1 ? 'course' : 'courses'}
              </span>
            </div>
          )}
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
}

export default memo(OwnedCoursesPage);
