import LegacyPage from '@/app/orgs/[orgslug]/dash/analytics/assessments/page';

import { withPlatformParams } from '../../../legacy-route';

export default function PlatformAnalyticsAssessmentsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LegacyPage params={withPlatformParams({})} searchParams={props.searchParams} />;
}
