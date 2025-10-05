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
    getOrgCourses(orgslug, { cache: 'no-store', tags: ['courses'] }, access_token || null),
    getOrganizationContextInfo(orgslug, {
      cache: 'no-store',
      tags: ['organizations'],
    }),
    getOrgCollections(
      (await getOrganizationContextInfo(orgslug, { cache: 'no-store', tags: ['organizations'] })).id,
      access_token,
      { cache: 'no-store', tags: ['courses'] },
    ),
  ]);

  // Check if custom landing is enabled
  const hasCustomLanding = org.config?.config?.landing?.enabled;
  const showDashboard = session?.user && !hasCustomLanding;

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
      showLearnerDashboard={showDashboard}
    />
  );
}
