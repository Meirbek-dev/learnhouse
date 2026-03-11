'use client';

import { buildCourseWorkspacePath, getCourseReadinessSummary } from '@/lib/course-management';
import { CourseStatusBadge, courseWorkflowMutedPanelClass, courseWorkflowSummaryCardClass } from './courseWorkflowUi';
import type { CourseWorkspaceCapabilities } from '@/lib/course-management-server';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { useCourse } from '@components/Contexts/CourseContext';
import { updateCourseAccess } from '@services/courses/courses';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useTransition } from 'react';
import AppLink from '@/components/ui/AppLink';
import { toast } from 'sonner';

export default function CourseReviewPublish({
  orgslug,
  courseuuid,
  capabilities,
}: {
  orgslug: string;
  courseuuid: string;
  capabilities: CourseWorkspaceCapabilities;
}) {
  const session = usePlatformSession() as any;
  const accessToken = session?.data?.tokens?.access_token;
  const course = useCourse();
  const readiness = getCourseReadinessSummary(course.courseStructure, course.editorData);
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const toggleVisibility = () => {
    if (!(capabilities.canManageAccess && accessToken)) {
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          setIsRefreshing(true);
          const response = await updateCourseAccess(
            course.courseStructure.course_uuid,
            { public: !course.courseStructure.public },
            accessToken,
            {
              lastKnownUpdateDate: course.courseStructure.update_date,
              orgSlug: orgslug,
            },
          );

          if (!response.success) {
            throw new Error(response.data?.detail || response.HTTPmessage || 'Unable to update course access.');
          }

          await course.refreshCourseMeta();
          toast.success(course.courseStructure.public ? 'Course moved back to private.' : 'Course is now public.');
        } catch (error: any) {
          toast.error(error?.message || 'Failed to update course visibility.');
        } finally {
          setIsRefreshing(false);
        }
      })();
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Review & publish</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {readiness.readyToPublish
                ? 'This course is structurally ready.'
                : 'Finish the remaining blockers before publishing.'}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              This page centralizes the last-mile checks that used to be scattered across tabs. Use it to confirm
              content quality, visibility, and launch state without hunting through the editor.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={`/orgs/${orgslug}/course/${courseuuid}`} />}
            >
              <ExternalLink className="size-4" />
              Preview public page
            </Button>
            {capabilities.canManageAccess ? (
              <Button
                onClick={toggleVisibility}
                disabled={isPending || isRefreshing || !readiness.readyToPublish}
              >
                {isPending || isRefreshing ? <Loader2 className="size-4 animate-spin" /> : null}
                {course.courseStructure.public ? 'Move back to private' : 'Publish course'}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-xl border bg-card p-5">
          <div className="text-sm font-semibold text-foreground">Readiness checklist</div>
          <div className="mt-4 space-y-3">
            {readiness.checklist.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-4 rounded-lg border bg-muted/40 p-4"
              >
                <div>
                  <div className="font-medium text-foreground">{item.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{item.description}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <CourseStatusBadge status={item.complete ? 'ready' : 'needs-review'} />
                  {item.href ? (
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<AppLink href={buildCourseWorkspacePath(orgslug, courseuuid, item.href as any)} />}
                    >
                      Open
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className={courseWorkflowSummaryCardClass}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Launch state</div>
              <CourseStatusBadge status={course.courseStructure.public ? 'live' : 'private'} />
            </div>
            <div className="mt-3 text-3xl font-semibold text-foreground">{course.courseStructure.public ? 'Live' : 'Private'}</div>
            <div className="mt-2 text-sm text-muted-foreground">
              {course.courseStructure.public
                ? 'Learners can discover this course according to its current access rules.'
                : 'Learners cannot access this course publicly until you publish it.'}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="text-sm font-semibold text-foreground">Publishing notes</div>
            <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
              <div className={courseWorkflowMutedPanelClass}>Publishing uses the course visibility flag already supported by the backend.</div>
              <div className={courseWorkflowMutedPanelClass}>Curriculum edits remain immediate, so confirm chapter and activity structure before launching.</div>
              <div className={courseWorkflowMutedPanelClass}>Details, access, collaboration, and certificate work should be reviewed for clarity before making the course public.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
