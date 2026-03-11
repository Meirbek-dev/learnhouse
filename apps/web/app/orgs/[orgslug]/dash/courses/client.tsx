'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buildCourseCreationPath, buildCourseWorkspacePath, getCourseContentStats, getCourseReadinessSummary } from '@/lib/course-management';
import { deleteCourseFromBackend, updateCourseAccess } from '@services/courses/courses';
import CourseThumbnail, { removeCoursePrefix, type Course } from '@components/Objects/Thumbnails/CourseThumbnail';
import { Actions, Resources, Scopes, usePermissions } from '@/components/Security';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import BreadCrumbs from '@components/Dashboard/Misc/BreadCrumbs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import DataTable from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import AppLink from '@/components/ui/AppLink';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, LayoutGrid, List, MoreHorizontal, Search, Sparkles, Trash2, Workflow, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

interface ManageableCourse extends Course {
  public?: boolean;
}

interface CourseProps {
  orgslug: string;
  courses: ManageableCourse[];
  org_id?: number;
  totalCourses: number;
  currentPage: number;
  searchQuery: string;
  sortBy: 'updated' | 'name';
  pageSize: number;
}

type BulkActionKind = 'publish' | 'private' | 'delete';

function isCourseRecent(dateString?: string) {
  if (!dateString) return false;
  const updatedAt = new Date(dateString).getTime();
  if (Number.isNaN(updatedAt)) return false;
  return Date.now() - updatedAt <= 1000 * 60 * 60 * 24 * 14;
}

function courseNeedsAttention(course: ManageableCourse) {
  const stats = getCourseContentStats(course);
  return !course.thumbnail_image || !course.description?.trim() || stats.activities === 0;
}

const CoursesHome = ({ orgslug, courses, totalCourses, currentPage, searchQuery, sortBy, pageSize }: CourseProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchQuery);
  const preset = searchParams.get('preset') ?? 'all';
  const viewMode = searchParams.get('view') === 'cards' ? 'cards' : 'table';
  const { can } = usePermissions();
  const session = usePlatformSession() as any;
  const accessToken = session?.data?.tokens?.access_token;
  const canCreateCourse = can(Actions.CREATE, Resources.COURSE, Scopes.ORG);
  const [selectedCourseUuids, setSelectedCourseUuids] = useState<string[]>([]);
  const [isBulkPending, startBulkTransition] = useTransition();
  const [pendingBulkAction, setPendingBulkAction] = useState<BulkActionKind | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCourses / pageSize));
  const hasPagination = totalPages > 1;
  const hasQuery = searchQuery.length > 0;

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

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const ready = getCourseReadinessSummary(course, null).readyToPublish;

      switch (preset) {
        case 'drafts':
          return !course.public || !ready;
        case 'published':
          return Boolean(course.public);
        case 'private':
          return !course.public;
        case 'recent':
          return isCourseRecent(course.update_date);
        case 'attention':
          return courseNeedsAttention(course) || !ready;
        default:
          return true;
      }
    });
  }, [courses, preset]);

  const summaryCards = useMemo(() => {
    const ready = filteredCourses.filter((course) => getCourseReadinessSummary(course, null).readyToPublish).length;
    const privateCount = filteredCourses.filter((course) => !course.public).length;
    const attention = filteredCourses.filter((course) => courseNeedsAttention(course)).length;

    return [
      { label: 'Visible now', value: filteredCourses.length, className: 'bg-slate-950 text-white' },
      { label: 'Publish-ready', value: ready, className: 'bg-emerald-50 text-emerald-900' },
      { label: 'Private', value: privateCount, className: 'bg-amber-50 text-amber-900' },
      { label: 'Needs attention', value: attention, className: 'bg-rose-50 text-rose-900' },
    ];
  }, [filteredCourses]);

  const canManageCourse = useCallback(
    (course: ManageableCourse) =>
      can(Actions.MANAGE, Resources.COURSE, Scopes.ORG) || Boolean(course.is_owner && can(Actions.MANAGE, Resources.COURSE, Scopes.OWN)),
    [can],
  );

  const canDeleteCourse = useCallback(
    (course: ManageableCourse) =>
      can(Actions.DELETE, Resources.COURSE, Scopes.ORG) || Boolean(course.is_owner && can(Actions.DELETE, Resources.COURSE, Scopes.OWN)),
    [can],
  );

  const visibleCourseUuids = useMemo(() => filteredCourses.map((course) => course.course_uuid), [filteredCourses]);

  useEffect(() => {
    setSelectedCourseUuids((current) => current.filter((courseUuid) => visibleCourseUuids.includes(courseUuid)));
  }, [visibleCourseUuids]);

  const selectedCourses = useMemo(
    () => filteredCourses.filter((course) => selectedCourseUuids.includes(course.course_uuid)),
    [filteredCourses, selectedCourseUuids],
  );

  const selectableVisibleCourses = useMemo(
    () => filteredCourses.filter((course) => canManageCourse(course) || canDeleteCourse(course)),
    [canDeleteCourse, canManageCourse, filteredCourses],
  );

  const allVisibleSelected = selectableVisibleCourses.length > 0 && selectableVisibleCourses.every((course) => selectedCourseUuids.includes(course.course_uuid));

  const toggleCourseSelection = (courseUuid: string, checked: boolean) => {
    setSelectedCourseUuids((current) => {
      if (checked) {
        return current.includes(courseUuid) ? current : [...current, courseUuid];
      }
      return current.filter((value) => value !== courseUuid);
    });
  };

  const toggleAllVisibleCourses = useCallback((checked: boolean) => {
    if (!checked) {
      setSelectedCourseUuids((current) => current.filter((courseUuid) => !visibleCourseUuids.includes(courseUuid)));
      return;
    }

    setSelectedCourseUuids((current) => {
      const next = new Set(current);
      selectableVisibleCourses.forEach((course) => next.add(course.course_uuid));
      return Array.from(next);
    });
  }, [selectableVisibleCourses, visibleCourseUuids]);

  const runBulkVisibility = (nextPublic: boolean) => {
    if (!(accessToken && selectedCourses.length > 0)) {
      return;
    }

    const targetCourses = selectedCourses.filter((course) => canManageCourse(course));
    if (targetCourses.length === 0) {
      toast.error('No selected courses can be updated.');
      return;
    }

    startBulkTransition(() => {
      void (async () => {
        const results = await Promise.allSettled(
          targetCourses.map((course) =>
            updateCourseAccess(course.course_uuid, { public: nextPublic }, accessToken, { orgSlug: orgslug }),
          ),
        );

        const successCount = results.filter(
          (result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled' && Boolean(result.value?.success),
        ).length;
        const failedCount = targetCourses.length - successCount;

        if (successCount > 0) {
          toast.success(nextPublic ? `Published ${successCount} course${successCount === 1 ? '' : 's'}.` : `Moved ${successCount} course${successCount === 1 ? '' : 's'} to private.`);
          setSelectedCourseUuids([]);
          router.refresh();
        }

        if (failedCount > 0) {
          toast.error(`${failedCount} selected course${failedCount === 1 ? '' : 's'} could not be updated.`);
        }
      })();
    });
  };

  const runBulkDelete = () => {
    if (!(accessToken && selectedCourses.length > 0)) {
      return;
    }

    const targetCourses = selectedCourses.filter((course) => canDeleteCourse(course));
    if (targetCourses.length === 0) {
      toast.error('No selected courses can be deleted.');
      return;
    }

    startBulkTransition(() => {
      void (async () => {
        const results = await Promise.allSettled(
          targetCourses.map((course) => deleteCourseFromBackend(course.course_uuid, accessToken, { orgSlug: orgslug })),
        );

        const successCount = results.filter((result) => result.status === 'fulfilled').length;
        const failedCount = targetCourses.length - successCount;

        if (successCount > 0) {
          toast.success(`Deleted ${successCount} course${successCount === 1 ? '' : 's'}.`);
          setSelectedCourseUuids([]);
          router.refresh();
        }

        if (failedCount > 0) {
          toast.error(`${failedCount} selected course${failedCount === 1 ? '' : 's'} could not be deleted.`);
        }
      })();
    });
  };

  const confirmBulkAction = () => {
    if (pendingBulkAction === 'publish') {
      setPendingBulkAction(null);
      runBulkVisibility(true);
      return;
    }

    if (pendingBulkAction === 'private') {
      setPendingBulkAction(null);
      runBulkVisibility(false);
      return;
    }

    if (pendingBulkAction === 'delete') {
      setPendingBulkAction(null);
      runBulkDelete();
    }
  };

  const bulkActionMeta =
    pendingBulkAction === 'publish'
      ? {
          title: 'Publish selected courses?',
          description: `This will make ${selectedCourses.length} selected course${selectedCourses.length === 1 ? '' : 's'} public wherever learners can access them.`,
          confirmLabel: 'Publish courses',
          variant: 'default' as const,
          mediaClassName: 'bg-emerald-50 text-emerald-700',
        }
      : pendingBulkAction === 'private'
        ? {
            title: 'Move selected courses to private?',
            description: `This will hide ${selectedCourses.length} selected course${selectedCourses.length === 1 ? '' : 's'} from public access until you publish them again.`,
            confirmLabel: 'Move to private',
            variant: 'default' as const,
            mediaClassName: 'bg-amber-50 text-amber-700',
          }
        : pendingBulkAction === 'delete'
          ? {
              title: 'Delete selected courses?',
              description: `This permanently deletes ${selectedCourses.length} selected course${selectedCourses.length === 1 ? '' : 's'}. This action cannot be undone.`,
              confirmLabel: 'Delete courses',
              variant: 'destructive' as const,
              mediaClassName: 'bg-red-50 text-red-700',
            }
          : null;

  const bulkToolbar =
    selectedCourses.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <Badge variant="outline">{selectedCourses.length} selected</Badge>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isBulkPending || !selectedCourses.some((course) => canManageCourse(course))}
          onClick={() => setPendingBulkAction('publish')}
        >
          Publish selected
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isBulkPending || !selectedCourses.some((course) => canManageCourse(course))}
          onClick={() => setPendingBulkAction('private')}
        >
          Move selected to private
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isBulkPending || !selectedCourses.some((course) => canDeleteCourse(course))}
          onClick={() => setSelectedCourseUuids([])}
        >
          Clear selection
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={isBulkPending || !selectedCourses.some((course) => canDeleteCourse(course))}
          onClick={() => setPendingBulkAction('delete')}
        >
          Delete selected
        </Button>
      </div>
    ) : null;

  const columns = useMemo<ColumnDef<ManageableCourse>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            checked={allVisibleSelected}
            onCheckedChange={(checked) => toggleAllVisibleCourses(Boolean(checked))}
            aria-label="Select visible courses"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        meta: { label: 'Select', exportable: false },
        cell: ({ row }) => {
          const course = row.original;
          const disabled = !(canManageCourse(course) || canDeleteCourse(course));
          return (
            <Checkbox
              checked={selectedCourseUuids.includes(course.course_uuid)}
              disabled={disabled}
              onCheckedChange={(checked) => toggleCourseSelection(course.course_uuid, Boolean(checked))}
              aria-label={`Select ${course.name}`}
            />
          );
        },
      },
      {
        accessorKey: 'name',
        header: 'Course',
        meta: { label: 'Course' },
        cell: ({ row }) => {
          const course = row.original;
          const stats = getCourseContentStats(course);

          return (
            <div className="space-y-1">
              <AppLink
                href={buildCourseWorkspacePath(orgslug, removeCoursePrefix(course.course_uuid))}
                className="font-semibold text-slate-950 hover:text-slate-700"
              >
                {course.name}
              </AppLink>
              <div className="line-clamp-2 text-sm text-slate-500">{course.description?.trim() || 'No description yet.'}</div>
              <div className="text-xs text-slate-400">{stats.chapters} chapters · {stats.activities} activities</div>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        meta: { label: 'Status' },
        cell: ({ row }) => {
          const course = row.original;
          const ready = getCourseReadinessSummary(course, null).readyToPublish;

          return (
            <div className="flex flex-wrap gap-2">
              <Badge variant={course.public ? 'success' : 'outline'}>{course.public ? 'Public' : 'Private'}</Badge>
              <Badge variant={ready ? 'success' : 'warning'}>{ready ? 'Ready' : 'Needs review'}</Badge>
              {courseNeedsAttention(course) ? <Badge variant="warning">Attention</Badge> : null}
            </div>
          );
        },
      },
      {
        id: 'updated',
        accessorFn: (course) => course.update_date,
        header: 'Updated',
        meta: { label: 'Updated' },
        cell: ({ row }) => (
          <div className="text-sm text-slate-600">{row.original.update_date ? new Date(row.original.update_date).toLocaleDateString() : 'Unknown'}</div>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { label: 'Actions', exportable: false },
        cell: ({ row }) => <CourseRowActions course={row.original} orgslug={orgslug} />,
      },
    ],
    [allVisibleSelected, canDeleteCourse, canManageCourse, orgslug, selectedCourseUuids, toggleAllVisibleCourses],
  );

  const presets = [
    { key: 'all', label: 'All' },
    { key: 'drafts', label: 'Drafts' },
    { key: 'published', label: 'Published' },
    { key: 'private', label: 'Private' },
    { key: 'recent', label: 'Recently updated' },
    { key: 'attention', label: 'Needs attention' },
  ];

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.06),_transparent_42%),linear-gradient(180deg,_#f7f5ef_0%,_#ffffff_22%,_#f8fafc_100%)] px-4 py-6 lg:px-8">
      <div className="mb-6">
        <BreadCrumbs type="courses" />

        <div className="mt-4 rounded-3xl border border-slate-200/80 bg-white/92 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Course management</div>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">Manage courses as a workspace</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                This view is built for triage and maintenance. Use presets to focus on private, publish-ready, recently updated, or problem courses, then jump directly into the new workspace stages.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => updateRoute({ view: viewMode === 'table' ? 'cards' : null })}
              >
                {viewMode === 'table' ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
                {viewMode === 'table' ? 'Card view' : 'Table view'}
              </Button>
              {canCreateCourse ? (
                <Button
                  nativeButton={false}
                  render={<AppLink href={buildCourseCreationPath(orgslug)} />}
                >
                  <Sparkles className="size-4" />
                  Guided setup
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className={`rounded-2xl px-4 py-5 ${card.className}`}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">{card.label}</div>
                <div className="mt-2 text-3xl font-semibold">{card.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {presets.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => updateRoute({ preset: item.key === 'all' ? null : item.key, page: '1' })}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${preset === item.key ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white/92 p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
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
                placeholder="Search courses across the org"
                className="pl-9"
              />
            </div>
            <Button type="submit">Search</Button>
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
                Clear
              </Button>
            ) : null}
          </form>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-600">Sort</label>
            <select
              value={sortBy}
              onChange={(event) => updateRoute({ sort: event.target.value, page: '1' })}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="updated">Recently updated</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        <div className="mt-3 text-sm text-gray-500">{filteredCourses.length} visible on this page, {totalCourses} total in the workspace.</div>
      </div>

      {filteredCourses.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 py-12 shadow-sm">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <h2 className="mb-2 text-2xl font-bold text-gray-600">No matching courses on this page</h2>
              <p className="text-lg text-gray-400">{hasQuery ? 'Adjust the search or preset.' : 'Create a course or widen the current preset.'}</p>
              {canCreateCourse ? (
                <div className="mt-6 flex justify-center">
                  <Button
                    nativeButton={false}
                    render={<AppLink href={buildCourseCreationPath(orgslug)} />}
                  >
                    <Sparkles className="size-4" />
                    Create with guided setup
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid w-full grid-cols-1 gap-6 pb-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredCourses.map((course) => (
            <div
              key={course.course_uuid}
              className="mx-auto w-full max-w-[320px]"
            >
              <CourseThumbnail
                customLink={buildCourseWorkspacePath(orgslug, removeCoursePrefix(course.course_uuid))}
                course={course}
                orgslug={orgslug}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200/80 bg-white/92 p-4 shadow-sm">
          <DataTable
            columns={columns}
            data={filteredCourses}
            enableColumnVisibility
            enableCsvExport
            csvFileName={`courses-${orgslug}-${new Date().toISOString().slice(0, 10)}.csv`}
            storageKey={`course-management-${orgslug}`}
            serverPaginated
            toolbarContent={bulkToolbar}
            labels={{
              searchPlaceholder: 'Filter current page results',
              emptyMessage: 'No courses match the current filters.',
            }}
          />
        </div>
      )}

      {hasPagination ? (
        <div className="flex items-center justify-between border-t border-gray-200 py-6">
          <div className="text-sm text-gray-500">Page {currentPage} of {totalPages}</div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={currentPage <= 1}
              onClick={() => updateRoute({ page: String(Math.max(1, currentPage - 1)) })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={currentPage >= totalPages}
              onClick={() => updateRoute({ page: String(Math.min(totalPages, currentPage + 1)) })}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <AlertDialog
        open={pendingBulkAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingBulkAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className={bulkActionMeta?.mediaClassName}>
              <AlertTriangle className="size-8" />
            </AlertDialogMedia>
            <AlertDialogTitle>{bulkActionMeta?.title}</AlertDialogTitle>
            <AlertDialogDescription>{bulkActionMeta?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkPending} />
            <AlertDialogAction
              variant={bulkActionMeta?.variant}
              disabled={isBulkPending || !bulkActionMeta}
              onClick={confirmBulkAction}
            >
              {bulkActionMeta?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function CourseRowActions({ course, orgslug }: { course: ManageableCourse; orgslug: string }) {
  const router = useRouter();
  const session = usePlatformSession() as any;
  const { can } = usePermissions();
  const accessToken = session?.data?.tokens?.access_token;
  const [isPending, startTransition] = useTransition();

  const canManageCourse = can(Actions.MANAGE, Resources.COURSE, Scopes.ORG) || Boolean(course.is_owner && can(Actions.MANAGE, Resources.COURSE, Scopes.OWN));
  const canDeleteCourse = can(Actions.DELETE, Resources.COURSE, Scopes.ORG) || Boolean(course.is_owner && can(Actions.DELETE, Resources.COURSE, Scopes.OWN));

  const handleDelete = () => {
    if (!(canDeleteCourse && accessToken)) return;

    startTransition(() => {
      void (async () => {
        try {
          await deleteCourseFromBackend(course.course_uuid, accessToken, { orgSlug: orgslug });
          toast.success('Course deleted.');
          router.refresh();
        } catch {
          toast.error('Unable to delete course.');
        }
      })();
    });
  };

  const handleToggleVisibility = () => {
    if (!(canManageCourse && accessToken)) return;

    startTransition(() => {
      void (async () => {
        try {
          await updateCourseAccess(course.course_uuid, { public: !course.public }, accessToken, { orgSlug: orgslug });
          toast.success(course.public ? 'Course moved to private.' : 'Course is now public.');
          router.refresh();
        } catch {
          toast.error('Unable to update course visibility.');
        }
      })();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            disabled={isPending}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(buildCourseWorkspacePath(orgslug, removeCoursePrefix(course.course_uuid)))}>
          <List className="size-4" />
          Open workspace
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(buildCourseWorkspacePath(orgslug, removeCoursePrefix(course.course_uuid), 'curriculum'))}>
          <Workflow className="size-4" />
          Open curriculum
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(buildCourseWorkspacePath(orgslug, removeCoursePrefix(course.course_uuid), 'review'))}>
          <Sparkles className="size-4" />
          Review & publish
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(buildCourseCreationPath(orgslug, course.course_uuid))}>
          <LayoutGrid className="size-4" />
          Use as template
        </DropdownMenuItem>
        {canManageCourse ? (
          <DropdownMenuItem onClick={handleToggleVisibility}>
            <Sparkles className="size-4" />
            {course.public ? 'Move to private' : 'Publish'}
          </DropdownMenuItem>
        ) : null}
        {canDeleteCourse ? (
          <DropdownMenuItem
            onClick={handleDelete}
            variant="destructive"
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default CoursesHome;
