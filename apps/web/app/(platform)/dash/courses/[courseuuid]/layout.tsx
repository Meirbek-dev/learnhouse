import { getCourseWorkspaceCapabilitiesForCourse } from '@/lib/course-management-server';
import { PLATFORM_ORG_SLUG } from '@/services/config/config';
import type { ReactNode } from 'react';

export default async function PlatformCourseWorkspaceLayout(props: {
  children: ReactNode;
  params: Promise<{ courseuuid: string }>;
}) {
  const { courseuuid } = await props.params;

  await getCourseWorkspaceCapabilitiesForCourse(PLATFORM_ORG_SLUG, courseuuid);

  return <>{props.children}</>;
}
