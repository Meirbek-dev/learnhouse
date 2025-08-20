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
  const session = await auth();
  const access_token = session?.tokens?.access_token;

  const [courses, org, collections] = await Promise.all([
    getOrgCourses(orgslug, { revalidate: 0, tags: ['courses'] }, access_token || null),
    getOrganizationContextInfo(orgslug, {
      revalidate: 0,
      tags: ['organizations'],
    }),
    getOrgCollections(
      (await getOrganizationContextInfo(orgslug, { revalidate: 0, tags: ['organizations'] })).id,
      access_token,
      { revalidate: 0, tags: ['courses'] },
    ),
  ]);

  // Check if custom landing is enabled
  const hasCustomLanding = org.config?.config?.landing?.enabled;
  const showEnhancedDashboard = session?.user && !hasCustomLanding;

  return hasCustomLanding ? (
    <LandingCustom
      landing={org.config.config.landing}
      orgslug={orgslug}
    />
  ) : (
    <LandingClassic
      courses={courses}
      collections={collections}
      orgslug={orgslug}
      org_id={org.id}
      showLearnerDashboard={showEnhancedDashboard}
    />
  );
}
