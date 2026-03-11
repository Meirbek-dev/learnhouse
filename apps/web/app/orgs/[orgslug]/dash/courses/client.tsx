'use client';

import CourseThumbnail, { removeCoursePrefix } from '@components/Objects/Thumbnails/CourseThumbnail';
import { Actions, PermissionGuard, Resources, Scopes, usePermissions } from '@/components/Security';
import CreateCourseModal from '@components/Objects/Modals/Course/Create/CreateCourse';
import NewCourseButton from '@/components/Objects/Elements/Buttons/NewCourseButton';
import type { Course } from '@components/Objects/Thumbnails/CourseThumbnail';
import BreadCrumbs from '@components/Dashboard/Misc/BreadCrumbs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Modal from '@/components/Objects/Elements/Modal/Modal';
import { revalidateTags } from '@services/utils/ts/requests';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

interface CourseProps {
  orgslug: string;
  courses: Course[];
  org_id?: number;
  totalCourses: number;
  currentPage: number;
  searchQuery: string;
  sortBy: 'updated' | 'name';
  pageSize: number;
}

const CoursesHome = (params: CourseProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isCreatingCourse = Boolean(searchParams.get('new'));
  const [newCourseModal, setNewCourseModal] = useState(isCreatingCourse);
  const [searchInput, setSearchInput] = useState(params.searchQuery);
  const { orgslug, courses, totalCourses, currentPage, sortBy, pageSize } = params;
  const { can } = usePermissions();
  const canManageOrg = can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN) || can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.ORG);
  const t = useTranslations('DashPage.Courses.HomePageClient');

  const totalPages = Math.max(1, Math.ceil(totalCourses / pageSize));
  const hasPagination = totalPages > 1;
  const hasQuery = params.searchQuery.length > 0;

  const resultsLabel = useMemo(() => {
    if (totalCourses === 0) {
      return hasQuery ? t('emptySearchResults') : t('emptyPageDescription');
    }
    return t('resultsCount', { count: totalCourses });
  }, [hasQuery, t, totalCourses]);

  const updateRoute = (updates: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    });

    const nextQuery = nextParams.toString();
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

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
        <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <form
            className="flex w-full max-w-2xl items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              updateRoute({ q: searchInput.trim() || null, page: '1' });
            }}
          >
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t('searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <Button type="submit">{t('searchButton')}</Button>
            {hasQuery ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchInput('');
                  updateRoute({ q: null, page: '1' });
                }}
              >
                <X className="mr-2 h-4 w-4" />
                {t('clearSearch')}
              </Button>
            ) : null}
          </form>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-600">{t('sortLabel')}</label>
            <select
              value={sortBy}
              onChange={(event) => updateRoute({ sort: event.target.value, page: '1' })}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="updated">{t('sortUpdated')}</option>
              <option value="name">{t('sortName')}</option>
            </select>
          </div>
        </div>
        <div className="mt-3 text-sm text-gray-500">{resultsLabel}</div>
      </div>

      <div className="grid w-full grid-cols-1 gap-6 pb-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
        {courses.map((course) => (
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
              <p className="text-lg text-gray-400">
                {hasQuery ? t('emptySearchResults') : canManageOrg ? t('createACourse') : t('noCoursesAvailable')}
              </p>
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
      {hasPagination ? (
        <div className="flex items-center justify-between border-t border-gray-200 py-6">
          <div className="text-sm text-gray-500">{t('pageStatus', { current: currentPage, total: totalPages })}</div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={currentPage <= 1}
              onClick={() => updateRoute({ page: String(Math.max(1, currentPage - 1)) })}
            >
              {t('previousPage')}
            </Button>
            <Button
              variant="outline"
              disabled={currentPage >= totalPages}
              onClick={() => updateRoute({ page: String(Math.min(totalPages, currentPage + 1)) })}
            >
              {t('nextPage')}
            </Button>
          </div>
        </div>
      ) : null}
      {modal}
    </div>
  );
};

export default CoursesHome;
