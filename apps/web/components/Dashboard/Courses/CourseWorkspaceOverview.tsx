'use client';

import { buildCourseWorkspacePath, getCourseContentStats, getCourseReadinessSummary } from '@/lib/course-management';
import { AlertTriangle, ArrowRight, CheckCircle2, FileStack, Globe, Users } from 'lucide-react';
import type { CourseWorkspaceCapabilities } from '@/lib/course-management-server';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCourse } from '@components/Contexts/CourseContext';
import { Button } from '@/components/ui/button';
import AppLink from '@/components/ui/AppLink';
import { Badge } from '@/components/ui/badge';

export default function CourseWorkspaceOverview({
  orgslug,
  courseuuid,
  capabilities,
}: {
  orgslug: string;
  courseuuid: string;
  capabilities: CourseWorkspaceCapabilities;
}) {
  const course = useCourse();
  const stats = getCourseContentStats(course.courseStructure);
  const readiness = getCourseReadinessSummary(course.courseStructure, course.editorData);
  const contributors = course.editorData.contributors.data ?? [];
  const certifications = course.editorData.certifications.data ?? [];
  const linkedUserGroups = course.editorData.linkedUserGroups.data ?? [];
  const isPrivateWithNoGroups = !course.courseStructure.public && linkedUserGroups.length === 0;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ready to move</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {readiness.readyToPublish ? 'Course is ready for review' : 'Course still needs setup work'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {readiness.readyToPublish
                  ? 'Core setup, structure, and access checks are in place. Use review to confirm discoverability and launch state.'
                  : 'This workspace is now organized around lifecycle stages. Use the checklist to finish missing course setup without guessing which tab owns which task.'}
              </p>
            </div>
            <Badge variant={readiness.readyToPublish ? 'success' : 'warning'}>
              {readiness.readyToPublish ? 'Ready' : `${readiness.issues.length} open`}
            </Badge>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {capabilities.canEditCurriculum ? (
              <Button
                nativeButton={false}
                render={<AppLink href={buildCourseWorkspacePath(orgslug, courseuuid, 'curriculum')} />}
              >
                Open curriculum
              </Button>
            ) : null}
            {capabilities.canReviewCourse ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<AppLink href={buildCourseWorkspacePath(orgslug, courseuuid, 'review')} />}
              >
                Review publish readiness
              </Button>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border bg-foreground p-6 text-background">
          <div className="text-xs font-semibold uppercase tracking-wider text-background/60">Workspace pulse</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-lg bg-background/10 p-4">
              <div className="text-background/70">Chapters</div>
              <div className="mt-1 text-3xl font-semibold">{stats.chapters}</div>
            </div>
            <div className="rounded-lg bg-background/10 p-4">
              <div className="text-background/70">Activities</div>
              <div className="mt-1 text-3xl font-semibold">{stats.activities}</div>
            </div>
            <div className="rounded-lg bg-background/10 p-4">
              <div className="text-background/70">Contributors</div>
              <div className="mt-1 text-3xl font-semibold">{contributors.length}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 className="size-4" />
            Readiness checklist
          </div>
          <div className="mt-4 space-y-3">
            {readiness.checklist.map((item) => (
              <AppLink
                key={item.id}
                href={buildCourseWorkspacePath(orgslug, courseuuid, (item.href as any) || 'overview')}
                className="flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <Badge variant={item.complete ? 'success' : 'warning'}>{item.complete ? 'Done' : 'Open'}</Badge>
                <div className="min-w-0">
                  <div className="font-medium text-foreground">{item.title}</div>
                  <div className="text-sm text-muted-foreground">{item.description}</div>
                </div>
              </AppLink>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileStack className="size-4" />
            Curriculum snapshot
          </div>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg bg-muted p-4">
              <div className="font-medium text-foreground">
                {stats.chapters} chapter{stats.chapters === 1 ? '' : 's'}
              </div>
              <div className="mt-1">
                {stats.activities} activit{stats.activities === 1 ? 'y' : 'ies'} are currently in the course structure.
              </div>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <div className="font-medium text-foreground">Next step</div>
              <div className="mt-1">
                Use curriculum for high-speed structure work. This stage keeps immediate operations visible and
                recoverable.
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            nativeButton={false}
            className="mt-4 w-full justify-between"
            render={<AppLink href={buildCourseWorkspacePath(orgslug, courseuuid, 'curriculum')} />}
          >
            Open curriculum
            <ArrowRight className="size-4" />
          </Button>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="size-4" />
            Governance snapshot
          </div>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg bg-muted p-4">
              <div className="font-medium text-foreground">Access</div>
              <div className="mt-1 flex items-center gap-2">
                <Globe className="size-4 text-muted-foreground" />
                {course.courseStructure.public
                  ? 'This course is currently public.'
                  : 'This course is currently private.'}
              </div>
              {isPrivateWithNoGroups && capabilities.canManageAccess ? (
                <Alert className="mt-2 border-amber-300 bg-amber-50 py-2 text-amber-800">
                  <AlertTriangle className="size-3.5" />
                  <AlertDescription className="text-xs text-amber-800">
                    Private course with no linked user groups — learners cannot access it. Add user groups in{' '}
                    <AppLink
                      href={buildCourseWorkspacePath(orgslug, courseuuid, 'access')}
                      className="font-semibold underline underline-offset-2"
                    >
                      Access
                    </AppLink>
                    .
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
            <div className="rounded-lg bg-muted p-4">
              <div className="font-medium text-foreground">Collaboration</div>
              <div className="mt-1">
                {contributors.length} contributor record{contributors.length === 1 ? '' : 's'} loaded.
              </div>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <div className="font-medium text-foreground">Certificate</div>
              <div className="mt-1">
                {certifications.length > 0
                  ? 'Certificate configuration exists for this course.'
                  : 'No certificate configuration has been created yet.'}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
