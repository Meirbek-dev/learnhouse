import { getCourseWorkspaceCapabilitiesForCourse } from '@/lib/course-management-server';
import type { ReactNode } from 'react';

interface CourseWorkspaceLayoutProps {
  children: ReactNode;
  params: Promise<{ orgslug: string; courseuuid: string }>;
}

async function CourseWorkspaceLayout({ children, params }: CourseWorkspaceLayoutProps) {
  const { orgslug, courseuuid } = await params;

  await getCourseWorkspaceCapabilitiesForCourse(orgslug, courseuuid);

  return <>{children}</>;
}

export default CourseWorkspaceLayout;
