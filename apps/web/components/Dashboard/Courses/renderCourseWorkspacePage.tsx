import { getCourseWorkspaceCapabilitiesForOrg } from '@/lib/course-management-server';
import { getCourseMetadata } from '@services/courses/courses';
import CourseWorkspacePageShell from './CourseWorkspacePageShell';
import { auth } from '@/auth';
import type { ReactNode } from 'react';
import type { CourseWorkspaceStage } from '@/lib/course-management';

interface RenderCourseWorkspacePageOptions {
  orgslug: string;
  courseuuid: string;
  activeStage: CourseWorkspaceStage;
  children: ReactNode;
  capabilities?: Awaited<ReturnType<typeof getCourseWorkspaceCapabilitiesForOrg>>;
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
    capabilities ? Promise.resolve(capabilities) : getCourseWorkspaceCapabilitiesForOrg(orgslug),
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
