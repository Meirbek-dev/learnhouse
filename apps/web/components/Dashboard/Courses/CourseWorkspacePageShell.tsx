'use client';

import { getCourseReadinessSummary, buildCourseWorkspacePath, getCourseContentStats } from '@/lib/course-management';
import type { CourseWorkspaceStage } from '@/lib/course-management';
import type { CourseWorkspaceCapabilities } from '@/lib/course-management-server';
import { CourseProvider, useCourse } from '@components/Contexts/CourseContext';
import CourseConflictDialog from '@components/Dashboard/Pages/Course/CourseConflictDialog';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { getUriWithOrg } from '@services/config/config';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppLink from '@/components/ui/AppLink';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import {
  BookCopy,
  CheckCircle2,
  FileCog,
  FileStack,
  Globe,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

interface CourseWorkspacePageShellProps {
  orgslug: string;
  courseuuid: string;
  activeStage: CourseWorkspaceStage;
  initialCourse: any;
  capabilities: CourseWorkspaceCapabilities;
  children: ReactNode;
}

const stageConfig = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, capability: 'canViewWorkspace' },
  { key: 'details', label: 'Details', icon: FileCog, capability: 'canEditDetails' },
  { key: 'curriculum', label: 'Curriculum', icon: FileStack, capability: 'canEditCurriculum' },
  { key: 'access', label: 'Access', icon: Globe, capability: 'canManageAccess' },
  { key: 'collaboration', label: 'Collaboration', icon: Users, capability: 'canManageCollaboration' },
  { key: 'certificate', label: 'Certificate', icon: Sparkles, capability: 'canManageCertificate' },
  { key: 'review', label: 'Review & Publish', icon: CheckCircle2, capability: 'canReviewCourse' },
] as const;

function CourseWorkspaceChrome({
  orgslug,
  courseuuid,
  activeStage,
  capabilities,
  children,
}: Omit<CourseWorkspacePageShellProps, 'initialCourse'>) {
  const course = useCourse();
  const hasDirtySections = Object.values(course.dirtySections).some(Boolean);
  const readiness = getCourseReadinessSummary(course.courseStructure, course.editorData);
  const stats = getCourseContentStats(course.courseStructure);
  const visibleStages = stageConfig.filter((stage) => capabilities[stage.capability]);

  useUnsavedChangesGuard(hasDirtySections, {
    interceptInAppNavigation: true,
    message: 'You have unsaved course changes. Leave this workspace?',
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.06),_transparent_42%),linear-gradient(180deg,_#f7f5ef_0%,_#ffffff_22%,_#f8fafc_100%)]">
      <CourseConflictDialog />
      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6 lg:px-8">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-6 space-y-4 rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-sm backdrop-blur">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Course workspace</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{course.courseStructure.name || 'Untitled course'}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant={course.courseStructure.public ? 'success' : 'outline'}>
                  {course.courseStructure.public ? 'Public' : 'Private'}
                </Badge>
                <Badge variant={readiness.readyToPublish ? 'success' : 'warning'}>
                  {readiness.readyToPublish ? 'Ready' : `${readiness.issues.length} blocker${readiness.issues.length === 1 ? '' : 's'}`}
                </Badge>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-950 p-4 text-slate-50">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Workspace status</div>
              <div className="mt-3 text-3xl font-semibold">{readiness.completed}/{readiness.total}</div>
              <div className="text-sm text-slate-300">Readiness checks complete</div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl bg-white/10 p-3">
                  <div className="text-slate-300">Chapters</div>
                  <div className="text-xl font-semibold text-white">{stats.chapters}</div>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <div className="text-slate-300">Activities</div>
                  <div className="text-xl font-semibold text-white">{stats.activities}</div>
                </div>
              </div>
              <div className="mt-4 text-sm text-slate-300">
                {hasDirtySections ? 'Unsaved changes are active in this workspace.' : 'All visible section drafts are currently stable.'}
              </div>
            </div>

            <nav className="space-y-1">
              {visibleStages.map((stage) => {
                const Icon = stage.icon;
                const isActive = stage.key === activeStage;

                return (
                  <AppLink
                    key={stage.key}
                    href={buildCourseWorkspacePath(orgslug, courseuuid, stage.key)}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
                      isActive ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
                    )}
                  >
                    <Icon className="size-4" />
                    <span>{stage.label}</span>
                  </AppLink>
                );
              })}
            </nav>

            <div className="border-t border-slate-200 pt-4">
              <Button
                variant="outline"
                nativeButton={false}
                className="w-full justify-start gap-2"
                render={<AppLink href={`/orgs/${orgslug}/dash/courses`} />}
              >
                <BookCopy className="size-4" />
                All courses
              </Button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-6 rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Course workspace</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{course.courseStructure.name || 'Untitled course'}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  {course.courseStructure.description?.trim() || 'Use this workspace to shape the course, manage access, coordinate collaborators, and review publish readiness.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant={course.courseStructure.public ? 'success' : 'outline'}>
                    {course.courseStructure.public ? 'Public' : 'Private'}
                  </Badge>
                  <Badge variant={readiness.readyToPublish ? 'success' : 'warning'}>
                    {readiness.readyToPublish ? 'Publish-ready' : 'Needs review'}
                  </Badge>
                  {course.courseStructure.update_date ? <Badge variant="secondary">Updated {new Date(course.courseStructure.update_date).toLocaleDateString()}</Badge> : null}
                  {hasDirtySections ? <Badge variant="warning">Unsaved changes</Badge> : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<AppLink href={buildCourseWorkspacePath(orgslug, courseuuid, 'review')} />}
                >
                  <ShieldCheck className="size-4" />
                  Review
                </Button>
                <Button
                  nativeButton={false}
                  render={<a href={getUriWithOrg(orgslug, `/course/${courseuuid}`)} />}
                >
                  Preview course
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Curriculum</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{stats.activities}</div>
                <div className="text-sm text-slate-600">Activities across {stats.chapters} chapter{stats.chapters === 1 ? '' : 's'}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Readiness</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{readiness.completed}/{readiness.total}</div>
                <div className="text-sm text-slate-600">Checks completed before publish review</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Collaboration</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{course.editorData.contributors.data?.length ?? 0}</div>
                <div className="text-sm text-slate-600">Active contributor records loaded for this course</div>
              </div>
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {visibleStages.map((stage) => {
                const Icon = stage.icon;
                const isActive = stage.key === activeStage;

                return (
                  <AppLink
                    key={stage.key}
                    href={buildCourseWorkspacePath(orgslug, courseuuid, stage.key)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'border-slate-950 bg-slate-950 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-950',
                    )}
                  >
                    <Icon className="size-4" />
                    {stage.label}
                  </AppLink>
                );
              })}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200/80 bg-white/92 p-4 shadow-sm backdrop-blur lg:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function CourseWorkspacePageShell({
  orgslug,
  courseuuid,
  activeStage,
  initialCourse,
  capabilities,
  children,
}: CourseWorkspacePageShellProps) {
  return (
    <CourseProvider
      courseuuid={`course_${courseuuid}`}
      withUnpublishedActivities
      initialCourse={initialCourse}
    >
      <CourseWorkspaceChrome
        orgslug={orgslug}
        courseuuid={courseuuid}
        activeStage={activeStage}
        capabilities={capabilities}
      >
        {children}
      </CourseWorkspaceChrome>
    </CourseProvider>
  );
}
