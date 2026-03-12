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
import {
  AlertTriangle,
  BookCopy,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileCog,
  FileStack,
  Globe,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { buildCourseWorkspacePath } from '@/lib/course-management';
import CourseConflictDialog from '@components/Dashboard/Pages/Course/CourseConflictDialog';
import { CourseStatusBadge } from './courseWorkflowUi';
import type { CourseWorkspaceCapabilities } from '@/lib/course-management-server';
import { CourseProvider, useCourse } from '@components/Contexts/CourseContext';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import type { CourseWorkspaceStage } from '@/lib/course-management';
import { getUriWithOrg } from '@services/config/config';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import AppLink from '@/components/ui/AppLink';
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

function CourseWorkspaceChrome({
  orgslug,
  courseuuid,
  activeStage,
  capabilities,
  children,
}: Omit<CourseWorkspacePageShellProps, 'initialCourse'>) {
  const t = useTranslations('DashPage.CourseManagement.Workspace');
  const course = useCourse();
  const hasDirtySections = Object.values(course.dirtySections).some(Boolean);
  const readiness = course.readiness;
  const unsavedChangesGuard = useUnsavedChangesGuard(hasDirtySections, {
    interceptInAppNavigation: true,
    message: t('unsavedChangesWarning'),
  });
  const stageConfig = [
    { key: 'overview', label: t('tabs.overview'), icon: LayoutDashboard, capability: 'canViewWorkspace' },
    { key: 'details', label: t('tabs.details'), icon: FileCog, capability: 'canEditDetails' },
    { key: 'curriculum', label: t('tabs.curriculum'), icon: FileStack, capability: 'canEditCurriculum' },
    { key: 'access', label: t('tabs.access'), icon: Globe, capability: 'canManageAccess' },
    { key: 'collaboration', label: t('tabs.collaboration'), icon: Users, capability: 'canManageCollaboration' },
    { key: 'certificate', label: t('tabs.certificate'), icon: Sparkles, capability: 'canManageCertificate' },
    { key: 'review', label: t('tabs.reviewPublish'), icon: CheckCircle2, capability: 'canReviewCourse' },
  ] as const;
  const visibleStages = stageConfig.filter((stage) => capabilities[stage.capability]);

  return (
    <div className="flex min-h-screen min-w-0 flex-1 flex-col">
      <CourseConflictDialog />
      <AlertDialog
        open={unsavedChangesGuard.isPromptOpen}
        onOpenChange={(open) => {
          if (!open) {
            unsavedChangesGuard.cancelNavigation();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-muted text-foreground">
              <AlertTriangle className="size-8" />
            </AlertDialogMedia>
            <AlertDialogTitle>{t('unsavedDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{unsavedChangesGuard.promptMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={unsavedChangesGuard.cancelNavigation}>
              {t('unsavedDialogStay')}
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={unsavedChangesGuard.confirmNavigation}>
              {t('unsavedDialogLeave')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <header className="sticky top-0 z-20 border-b bg-background">
        {/* Title row */}
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          {/* Breadcrumb */}
          <AppLink
            href={`/orgs/${orgslug}/dash/courses`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <BookCopy className="size-4 shrink-0" />
            <span className="hidden sm:inline">{t('breadcrumb')}</span>
          </AppLink>

          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />

          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {course.courseStructure.name || t('untitledCourse')}
          </h1>

          <div className="flex shrink-0 items-center gap-1.5">
            <CourseStatusBadge
              status={course.courseStructure.public ? 'public' : 'private'}
              className="hidden sm:flex"
            />
            <CourseStatusBadge
              status={readiness.readyToPublish ? 'ready' : 'needs-review'}
              className="hidden sm:flex"
            />
            {hasDirtySections ? (
              <CourseStatusBadge status="unsaved" className="hidden sm:flex" />
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {activeStage !== 'review' ? (
              <Button
                size="sm"
                nativeButton={false}
                variant="ghost"
                render={<AppLink href={buildCourseWorkspacePath(orgslug, courseuuid, 'review')} />}
              >
                <ShieldCheck className="size-4" />
                <span className="hidden sm:inline">{t('reviewButton')}</span>
              </Button>
            ) : null}
            <Button
              size="sm"
              nativeButton={false}
              variant="outline"
              render={<a href={getUriWithOrg(orgslug, `/course/${courseuuid}`)} />}
            >
              <Eye className="size-4" />
              <span className="hidden sm:inline">{t('previewButton')}</span>
            </Button>
          </div>
        </div>

        {/* Tab nav row */}
        <div className="flex h-10 items-end gap-0 overflow-x-auto px-4 lg:px-6">
          {visibleStages.map((stage) => {
            const Icon = stage.icon;
            const isActive = stage.key === activeStage;
            return (
              <AppLink
                key={stage.key}
                href={buildCourseWorkspacePath(orgslug, courseuuid, stage.key)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex h-full shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm transition-colors',
                  isActive
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="whitespace-nowrap">{stage.label}</span>
                {stage.key === 'review' && !readiness.readyToPublish && readiness.issues.length > 0 ? (
                  <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-semibold text-foreground">
                    {readiness.issues.length}
                  </span>
                ) : null}
              </AppLink>
            );
          })}
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 lg:px-6">{children}</main>
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
