import { requireCourseWorkspaceStageAccess } from '@/lib/course-management-server';
import type { CourseWorkspaceStage } from '@/lib/course-management';
import CourseWorkspacePageShell from './CourseWorkspacePageShell';
import { getCourseMetadata } from '@services/courses/courses';
import type { ReactNode } from 'react';
import { auth } from '@/auth';

interface RenderCourseWorkspacePageOptions {
  orgslug: string;
  courseuuid: string;
  activeStage: CourseWorkspaceStage;
  children: ReactNode;
  capabilities?: Awaited<ReturnType<typeof requireCourseWorkspaceStageAccess>>;
}

export async function renderCourseWorkspacePage({
  orgslug,
  courseuuid,
  activeStage,
  children,
  capabilities,
}: RenderCourseWorkspacePageOptions) {
  const session = await auth();
  const accessToken = session?.tokens?.access_token;
  const [initialCourse, resolvedCapabilities] = await Promise.all([
    getCourseMetadata(courseuuid, null, accessToken, true),
    capabilities ? Promise.resolve(capabilities) : requireCourseWorkspaceStageAccess(orgslug, courseuuid, activeStage),
  ]);

  return (
    <CourseWorkspacePageShell
      orgslug={orgslug}
      courseuuid={courseuuid}
      activeStage={activeStage}
      initialCourse={initialCourse}
      capabilities={resolvedCapabilities}
    >
      {children}
    </CourseWorkspacePageShell>
  );
}
