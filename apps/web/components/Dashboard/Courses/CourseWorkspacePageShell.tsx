'use client';

import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
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
import { getCourseReadinessSummary, buildCourseWorkspacePath, getCourseContentStats } from '@/lib/course-management';
import CourseConflictDialog from '@components/Dashboard/Pages/Course/CourseConflictDialog';
import { CourseStatusBadge, CourseWorkflowBadge } from './courseWorkflowUi';
import type { CourseWorkspaceCapabilities } from '@/lib/course-management-server';
import { CourseProvider, useCourse } from '@components/Contexts/CourseContext';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import type { CourseWorkspaceStage } from '@/lib/course-management';
import { getUriWithOrg } from '@services/config/config';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import AppLink from '@/components/ui/AppLink';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

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

  const workspaceNavClassName = (isActive: boolean) =>
    cn(
      'flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
      isActive
        ? 'border-sidebar-accent-foreground/20 bg-sidebar-accent text-sidebar-accent-foreground'
        : 'border-sidebar-border/60 text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
    );

  return (
    <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-background xl:flex-row">
      <CourseConflictDialog />

      <aside className="border-b bg-sidebar text-sidebar-foreground xl:sticky xl:top-0 xl:h-svh xl:w-80 xl:shrink-0 xl:border-r xl:border-b-0">
        <div className="flex h-full flex-col">
          <SidebarHeader className="p-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/50">
                Course workspace
              </div>
              <div className="mt-2 text-xl font-semibold tracking-tight text-sidebar-foreground line-clamp-2">
                {course.courseStructure.name || 'Untitled course'}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <CourseStatusBadge status={course.courseStructure.public ? 'public' : 'private'} className="text-xs" />
                <CourseStatusBadge
                  status={readiness.readyToPublish ? 'ready' : 'needs-review'}
                  className="text-xs"
                />
                {hasDirtySections ? <CourseStatusBadge status="unsaved" className="text-xs" /> : null}
              </div>
            </div>
          </SidebarHeader>

          <Separator className="bg-sidebar-border" />

          <div className="mx-3 my-3 rounded-xl bg-sidebar-accent p-3">
            <div className="text-xs font-medium uppercase tracking-widest text-sidebar-foreground/50">Status</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-sidebar-foreground">{readiness.completed}</span>
              <span className="text-sm text-sidebar-foreground/60">/ {readiness.total} checks</span>
            </div>
            <Progress
              value={readiness.total > 0 ? Math.round((readiness.completed / readiness.total) * 100) : 0}
              className="mt-2 h-1.5"
            />
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-sidebar-foreground/50">Chapters</div>
                <div className="text-base font-semibold text-sidebar-foreground">{stats.chapters}</div>
              </div>
              <div>
                <div className="text-sidebar-foreground/50">Activities</div>
                <div className="text-base font-semibold text-sidebar-foreground">{stats.activities}</div>
              </div>
            </div>
          </div>

          <SidebarContent className="px-3 pb-3 xl:flex-1">
            <SidebarMenu className="flex-row gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible">
              {visibleStages.map((stage) => {
                const Icon = stage.icon;
                const isActive = stage.key === activeStage;
                return (
                  <SidebarMenuItem
                    key={stage.key}
                    className="min-w-44 shrink-0 xl:min-w-0"
                  >
                    <AppLink
                      href={buildCourseWorkspacePath(orgslug, courseuuid, stage.key)}
                      aria-current={isActive ? 'page' : undefined}
                      className={workspaceNavClassName(isActive)}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{stage.label}</span>
                      {stage.key === 'review' && !readiness.readyToPublish && readiness.issues.length > 0 ? (
                        <SidebarMenuBadge className="static ml-auto h-6 min-w-6 rounded-full bg-sidebar text-sidebar-foreground">
                          {readiness.issues.length}
                        </SidebarMenuBadge>
                      ) : null}
                    </AppLink>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <Separator className="bg-sidebar-border" />

          <SidebarFooter className="p-3">
            <Button
              nativeButton={false}
              variant="outline"
              className="w-full justify-start gap-2"
              render={<AppLink href={`/orgs/${orgslug}/dash/courses`} />}
            >
              <BookCopy className="size-4" />
              All courses
            </Button>
          </SidebarFooter>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-background">
        {/* Top header card */}
        <div className="mx-4 mt-4 rounded-xl border bg-card p-5 shadow-sm lg:mx-6 lg:mt-6">
          <div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Course workspace
                  </div>
                  <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    {course.courseStructure.name || 'Untitled course'}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {course.courseStructure.description?.trim() ||
                      'Use this workspace to shape the course, manage access, coordinate collaborators, and review publish readiness.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <CourseStatusBadge status={course.courseStructure.public ? 'public' : 'private'} />
                    <CourseStatusBadge status={readiness.readyToPublish ? 'ready' : 'needs-review'} />
                    {course.courseStructure.update_date ? (
                      <CourseWorkflowBadge tone="info">
                        Updated {new Date(course.courseStructure.update_date).toLocaleDateString()}
                      </CourseWorkflowBadge>
                    ) : null}
                    {hasDirtySections ? <CourseStatusBadge status="unsaved" /> : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-3">
                  <Button
                    nativeButton={false}
                    variant="outline"
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
            </div>
          </div>

          {/* Stats grid */}
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Curriculum</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{stats.activities}</div>
              <div className="text-sm text-muted-foreground">
                Activities across {stats.chapters} chapter{stats.chapters === 1 ? '' : 's'}
              </div>
            </div>
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Readiness</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {readiness.completed}/{readiness.total}
              </div>
              <Progress
                value={readiness.total > 0 ? Math.round((readiness.completed / readiness.total) * 100) : 0}
                className="mt-2 h-1.5"
              />
              <div className="mt-1 text-sm text-muted-foreground">Checks completed before publish review</div>
            </div>
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Collaboration</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {course.editorData.contributors.data?.length ?? 0}
              </div>
              <div className="text-sm text-muted-foreground">Active contributor records loaded for this course</div>
            </div>
          </div>
        </div>

        <div className="mx-4 my-4 rounded-xl border bg-card p-4 shadow-sm lg:mx-6 lg:my-6 lg:p-6">{children}</div>
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
