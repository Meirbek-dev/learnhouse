import type { CourseEditorBundle } from '@services/courses/editor';

export type CourseWorkspaceStage =
  | 'overview'
  | 'details'
  | 'curriculum'
  | 'access'
  | 'collaboration'
  | 'certificate'
  | 'review';

export interface CourseChecklistItem {
  id: string;
  title: string;
  description: string;
  complete: boolean;
  href?: string;
}

export function cleanCourseUuid(courseUuid: string): string {
  return courseUuid.replace(/^course_/, '');
}

export function prefixedCourseUuid(courseUuid: string): string {
  return courseUuid.startsWith('course_') ? courseUuid : `course_${courseUuid}`;
}

export function buildCourseWorkspacePath(
  orgslug: string,
  courseUuid: string,
  stage: CourseWorkspaceStage = 'overview',
): string {
  const cleanUuid = cleanCourseUuid(courseUuid);
  return stage === 'overview'
    ? `/orgs/${orgslug}/dash/courses/${cleanUuid}`
    : `/orgs/${orgslug}/dash/courses/${cleanUuid}/${stage}`;
}

export function buildCourseCreationPath(orgslug: string, sourceCourseUuid?: string): string {
  const query = sourceCourseUuid ? `?template=outline&source=${cleanCourseUuid(sourceCourseUuid)}` : '';
  return `/orgs/${orgslug}/dash/courses/new${query}`;
}

export function getCourseContentStats(course: any): { chapters: number; activities: number } {
  const chapters = Array.isArray(course?.chapters) ? course.chapters.length : 0;
  const activities = Array.isArray(course?.chapters)
    ? course.chapters.reduce(
        (total: number, chapter: any) => total + (Array.isArray(chapter.activities) ? chapter.activities.length : 0),
        0,
      )
    : 0;

  return { chapters, activities };
}

export function getCourseReadinessChecklist(
  course: any,
  editorData?: CourseEditorBundle | null,
): CourseChecklistItem[] {
  const stats = getCourseContentStats(course);
  const contributors = editorData?.contributors?.data ?? course?.authors ?? [];
  const certifications = editorData?.certifications?.data ?? [];

  return [
    {
      id: 'details',
      title: 'Details are complete',
      description: 'Title and description should clearly explain what this course offers.',
      complete: Boolean(course?.name?.trim() && course?.description?.trim()),
      href: 'details',
    },
    {
      id: 'media',
      title: 'Cover media is set',
      description: 'A thumbnail helps the course look intentional in lists and previews.',
      complete: Boolean(course?.thumbnail_image),
      href: 'details',
    },
    {
      id: 'curriculum',
      title: 'Curriculum has structure',
      description: 'Add at least one chapter and one activity before publishing.',
      complete: stats.chapters > 0 && stats.activities > 0,
      href: 'curriculum',
    },
    {
      id: 'collaboration',
      title: 'Ownership is clear',
      description: 'Keep at least one active owner or maintainer assigned to the course.',
      complete: Array.isArray(contributors) && contributors.length > 0,
      href: 'collaboration',
    },
    {
      id: 'access',
      title: 'Access rules are reviewed',
      description: 'Confirm who should be able to discover and enroll in the course.',
      complete: typeof course?.public === 'boolean',
      href: 'access',
    },
    {
      id: 'certificate',
      title: 'Certification is intentional',
      description: 'Either configure certification or explicitly leave it disabled.',
      complete: Array.isArray(certifications),
      href: 'certificate',
    },
  ];
}

export function getCourseReadinessSummary(course: any, editorData?: CourseEditorBundle | null) {
  const checklist = getCourseReadinessChecklist(course, editorData);
  const completed = checklist.filter((item) => item.complete).length;
  const issues = checklist.filter((item) => !item.complete);

  return {
    checklist,
    completed,
    total: checklist.length,
    readyToPublish: issues.length === 0,
    issues,
  };
}

export function getCourseManagementBadges(course: any, editorData?: CourseEditorBundle | null): string[] {
  const summary = getCourseReadinessSummary(course, editorData);
  const stats = getCourseContentStats(course);
  const badges: string[] = [];

  badges.push(course?.public ? 'Public' : 'Private');

  if (summary.readyToPublish) {
    badges.push('Ready to publish');
  } else if (summary.issues.length > 0) {
    badges.push('Needs attention');
  }

  if (stats.activities === 0) {
    badges.push('No activities yet');
  }

  return badges;
}

export function courseNeedsAttention(course: any): boolean {
  const stats = getCourseContentStats(course);
  return !course.thumbnail_image || !course.description?.trim() || stats.activities === 0;
}
