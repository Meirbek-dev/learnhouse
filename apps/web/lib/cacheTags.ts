/**
 * Centralized cache tag helpers
 * Keep tag naming consistent across server fetchers and route revalidators
 *
 * With cacheComponents enabled, use these with cacheTag() function inside `use cache` blocks
 */

// Gamification cache tags
export const gamificationTag = {
  profile: (orgId: number) => `gamification:profile:${orgId}`,
  dashboard: (orgId: number) => `gamification:dashboard:${orgId}`,
  leaderboard: (orgId: number) => `gamification:leaderboard:${orgId}`,
} as const;

export function gamificationTags(orgId: number): string[] {
  return [gamificationTag.profile(orgId), gamificationTag.dashboard(orgId), gamificationTag.leaderboard(orgId)];
}

// General cache tags
export const tags = {
  organizations: 'organizations',
  courses: 'courses',
  editableCourses: 'editable_courses',
  collections: 'collections',
  activities: 'activities',
  users: 'users',
} as const;

export const courseTag = {
  detail: (courseUuid: string) => `course:${courseUuid}:detail`,
  access: (courseUuid: string) => `course:${courseUuid}:access`,
  contributors: (courseUuid: string) => `course:${courseUuid}:contributors`,
  certifications: (courseUuid: string) => `course:${courseUuid}:certifications`,
  editableList: (orgSlug: string) => `courses:${orgSlug}:editable`,
} as const;

export async function revalidateGamification(orgId: number) {
  // Dynamically import to keep this file usable on both server and client
  const { revalidateTag } = await import('next/cache');
  for (const tag of gamificationTags(orgId)) revalidateTag(tag, 'max');
}

export async function revalidateTags(...tagList: string[]) {
  const { revalidateTag } = await import('next/cache');
  for (const tag of tagList) revalidateTag(tag, 'max');
}
