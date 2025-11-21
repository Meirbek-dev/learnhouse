import { getServerGamificationDashboard } from '@/services/gamification/server';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { getOrgCollections } from '@services/courses/collections';
import LandingClassic from '@components/Landings/LandingClassic';
import LandingCustom from '@components/Landings/LandingCustom';
import { getOrgCourses } from '@services/courses/courses';
import { auth } from '@/auth';

interface LandingContentProps {
  orgslug: string;
}

export async function LandingContent({ orgslug }: LandingContentProps) {
  try {
    const session = await auth();
    const access_token = session?.tokens?.access_token;

    // Fetch organization info with detailed error handling
    let org;
    try {
      org = await getOrganizationContextInfo(orgslug, {
        cache: 'no-store',
        tags: ['organizations'],
      });
    } catch (error) {
      console.error('[LandingContent] Failed to fetch organization info:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        cause: error instanceof Error ? error.cause : undefined,
        orgslug,
      });
      throw new Error(`Unable to load organization "${orgslug}". Please check your network connection and try again.`, {
        cause: error,
      });
    }

    // Only fetch gamification data if user is authenticated
    const gamificationPromise = access_token
      ? getServerGamificationDashboard(org.id, {
          revalidate: 30,
          tags: [`gamification:dashboard:${org.id}`],
        }).catch((error) => {
          console.error('[LandingContent] Gamification fetch failed:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            org_id: org.id,
          });
          return null;
        })
      : Promise.resolve(null);

    const [courses, collections, gamificationData] = await Promise.all([
      getOrgCourses(orgslug, { cache: 'no-store', tags: ['courses'] }, access_token || null).catch((error) => {
        console.error('[LandingContent] Courses fetch failed:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          orgslug,
        });
        return [];
      }),
      getOrgCollections(org.id, access_token, { cache: 'no-store', tags: ['courses'] }).catch((error) => {
        console.error('[LandingContent] Collections fetch failed:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          org_id: org.id,
        });
        return [];
      }),
      gamificationPromise,
    ]);

    // Check if custom landing is enabled
    const hasCustomLanding = org.config?.config?.landing?.enabled;

    return hasCustomLanding ? (
      <LandingCustom
        landing={org.config.config.landing}
        orgslug={orgslug}
        org_id={org.id}
        gamificationData={gamificationData}
      />
    ) : (
      <LandingClassic
        courses={courses}
        collections={collections}
        orgslug={orgslug}
        org_id={org.id}
        gamificationData={gamificationData}
      />
    );
  } catch (error) {
    console.error('[LandingContent] Critical error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? error.cause : undefined,
      orgslug,
    });
    throw error; // Re-throw to be caught by error boundary
  }
}
