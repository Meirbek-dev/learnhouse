import LegacyPage from '@/app/orgs/[orgslug]/dash/analytics/assessments/[assessmentType]/[assessmentId]/page';

import type { AssessmentType } from '@/types/analytics';
import { withPlatformParams } from '../../../../../legacy-route';

export default function PlatformAnalyticsAssessmentDetailPage(props: {
  params: Promise<{ assessmentType: AssessmentType; assessmentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LegacyPage params={withPlatformParams(props.params)} searchParams={props.searchParams} />;
}
