'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarInset,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
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
import type { CourseWorkspaceCapabilities } from '@/lib/course-management-server';
import { CourseProvider, useCourse } from '@components/Contexts/CourseContext';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import type { CourseWorkspaceStage } from '@/lib/course-management';
import { getUriWithOrg } from '@services/config/config';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import AppLink from '@/components/ui/AppLink';
import { Badge } from '@/components/ui/badge';
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

  return (
    <SidebarProvider>
      <CourseConflictDialog />

      {/* Left sidebar */}
      <Sidebar
        collapsible="offcanvas"
        className="border-r-0"
      >
        <SidebarHeader className="p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/50">
              Course workspace
            </div>
            <div className="mt-2 text-xl font-semibold tracking-tight text-sidebar-foreground line-clamp-2">
              {course.courseStructure.name || 'Untitled course'}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge
                variant={course.courseStructure.public ? 'success' : 'outline'}
                className="text-xs"
              >
                {course.courseStructure.public ? 'Public' : 'Private'}
              </Badge>
              <Badge
                variant={readiness.readyToPublish ? 'success' : 'warning'}
                className="text-xs"
              >
                {readiness.readyToPublish
                  ? 'Ready'
                  : `${readiness.issues.length} blocker${readiness.issues.length === 1 ? '' : 's'}`}
              </Badge>
              {hasDirtySections && (
                <Badge
                  variant="warning"
                  className="text-xs"
                >
                  Unsaved
                </Badge>
              )}
            </div>
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        {/* Stats mini-card */}
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

        <SidebarContent>
          <SidebarMenu>
            {visibleStages.map((stage) => {
              const Icon = stage.icon;
              const isActive = stage.key === activeStage;
              return (
                <SidebarMenuItem key={stage.key}>
                  <SidebarMenuButton
                    render={<AppLink href={buildCourseWorkspacePath(orgslug, courseuuid, stage.key)} />}
                    isActive={isActive}
                    tooltip={stage.label}
                  >
                    <Icon />
                    <span>{stage.label}</span>
                  </SidebarMenuButton>
                  {stage.key === 'review' && !readiness.readyToPublish && readiness.issues.length > 0 && (
                    <SidebarMenuBadge>{readiness.issues.length}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarSeparator />

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
      </Sidebar>

      {/* Main content */}
      <SidebarInset className="flex min-h-screen min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.06),_transparent_42%),linear-gradient(180deg,_#f7f5ef_0%,_#ffffff_22%,_#f8fafc_100%)]">
        {/* Top header card */}
        <div className="mx-4 mt-4 rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur lg:mx-6 lg:mt-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Course workspace
                  </div>
                  <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                    {course.courseStructure.name || 'Untitled course'}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    {course.courseStructure.description?.trim() ||
                      'Use this workspace to shape the course, manage access, coordinate collaborators, and review publish readiness.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={course.courseStructure.public ? 'success' : 'outline'}>
                      {course.courseStructure.public ? 'Public' : 'Private'}
                    </Badge>
                    <Badge variant={readiness.readyToPublish ? 'success' : 'warning'}>
                      {readiness.readyToPublish ? 'Publish-ready' : 'Needs review'}
                    </Badge>
                    {course.courseStructure.update_date ? (
                      <Badge variant="secondary">
                        Updated {new Date(course.courseStructure.update_date).toLocaleDateString()}
                      </Badge>
                    ) : null}
                    {hasDirtySections ? <Badge variant="warning">Unsaved changes</Badge> : null}
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
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Curriculum</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{stats.activities}</div>
              <div className="text-sm text-slate-600">
                Activities across {stats.chapters} chapter{stats.chapters === 1 ? '' : 's'}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Readiness</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {readiness.completed}/{readiness.total}
              </div>
              <Progress
                value={readiness.total > 0 ? Math.round((readiness.completed / readiness.total) * 100) : 0}
                className="mt-2 h-1.5"
              />
              <div className="mt-1 text-sm text-slate-600">Checks completed before publish review</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Collaboration</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {course.editorData.contributors.data?.length ?? 0}
              </div>
              <div className="text-sm text-slate-600">Active contributor records loaded for this course</div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="mx-4 my-4 rounded-[32px] border border-slate-200/80 bg-white/92 p-4 shadow-sm backdrop-blur lg:mx-6 lg:my-6 lg:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
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
