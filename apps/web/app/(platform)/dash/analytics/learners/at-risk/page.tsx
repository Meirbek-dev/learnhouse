import LegacyPage from '@/app/orgs/[orgslug]/dash/analytics/learners/at-risk/page';

import { withPlatformParams } from '../../../../legacy-route';

export default function PlatformAnalyticsAtRiskPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LegacyPage params={withPlatformParams({})} searchParams={props.searchParams} />;
}
