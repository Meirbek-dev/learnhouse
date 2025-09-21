// Centralized cache tag helpers for gamification
// Keep tag naming consistent across server fetchers and route revalidators

export const gamificationTag = {
  profile: (orgId: number) => `gamification:profile:${orgId}`,
  dashboard: (orgId: number) => `gamification:dashboard:${orgId}`,
  leaderboard: (orgId: number) => `gamification:leaderboard:${orgId}`,
} as const;

export function gamificationTags(orgId: number): string[] {
  return [
    gamificationTag.profile(orgId),
    gamificationTag.dashboard(orgId),
    gamificationTag.leaderboard(orgId),
  ];
}

export async function revalidateGamification(orgId: number) {
  // Dynamically import to keep this file usable on both server and client
  const { revalidateTag } = await import('next/cache');
  for (const tag of gamificationTags(orgId)) revalidateTag(tag);
}
