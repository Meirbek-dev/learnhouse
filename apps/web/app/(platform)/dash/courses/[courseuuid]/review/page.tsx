import LegacyPage from '@/app/orgs/[orgslug]/dash/courses/[courseuuid]/review/page';

import { withPlatformParams } from '../../../../legacy-route';

export default function PlatformCourseReviewPage(props: { params: Promise<{ courseuuid: string }> }) {
  return <LegacyPage params={withPlatformParams(props.params)} />;
}
