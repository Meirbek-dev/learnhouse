import { getPlatformOrganizationContextInfo } from '@services/organizations/orgs';
import { getServerGamificationDashboard } from '@/services/gamification/server';
import { getOrgCollections } from '@services/courses/collections';
import LandingClassic from '@components/Landings/LandingClassic';
import { getOptionalSession } from '@/lib/get-optional-session';
import LandingCustom from '@components/Landings/LandingCustom';
import { PLATFORM_ORG_SLUG } from '@services/config/config';
import { getOrgCourses } from '@services/courses/courses';

export async function LandingContent() {
  try {
    const session = await getOptionalSession();
    const access_token = session?.tokens?.access_token;

    // Fetch organization info with detailed error handling
    let org;
    try {
      org = await getPlatformOrganizationContextInfo(access_token || undefined);
    } catch (error) {
      console.error('[LandingContent] Failed to fetch organization info:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        cause: error instanceof Error ? error.cause : undefined,
      });
      throw new Error('Unable to load the platform organization. Please check your network connection and try again.', {
        cause: error,
      });
    }

    // Only fetch gamification data if user is authenticated
    const gamificationPromise = access_token
      ? getServerGamificationDashboard(org.id).catch((error: unknown) => {
          console.error('[LandingContent] Gamification fetch failed:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            org_id: org.id,
          });
          return null;
        })
      : Promise.resolve(null);

    const [coursesData, collections, gamificationData] = await Promise.all([
      getOrgCourses(PLATFORM_ORG_SLUG, undefined, access_token || null).catch((error: unknown) => {
        console.error('[LandingContent] Courses fetch failed:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          org_id: org.id,
        });
        return { courses: [], total: 0 };
      }),
      getOrgCollections(org.id, access_token).catch((error: unknown) => {
        console.error('[LandingContent] Collections fetch failed:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          org_id: org.id,
        });
        return [];
      }),
      gamificationPromise,
    ]);

    const { courses } = coursesData;
    const totalCourses = coursesData.total;

    // Check if custom landing is enabled
    const hasCustomLanding = org.config?.config?.landing?.enabled;

    return hasCustomLanding ? (
      <LandingCustom
        landing={org.config.config.landing}
        org_id={org.id}
        gamificationData={gamificationData}
      />
    ) : (
      <LandingClassic
        courses={courses}
        totalCourses={totalCourses}
        collections={collections}
        org_id={org.id}
        gamificationData={gamificationData}
      />
    );
  } catch (error) {
    console.error('[LandingContent] Critical error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? error.cause : undefined,
    });
    throw error; // Re-throw to be caught by error boundary
  }
}
