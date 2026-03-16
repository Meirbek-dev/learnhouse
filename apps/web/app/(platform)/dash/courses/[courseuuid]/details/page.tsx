import LegacyPage from '@/app/orgs/[orgslug]/dash/courses/[courseuuid]/details/page';

import { withPlatformParams } from '../../../../legacy-route';

export default function PlatformCourseDetailsPage(props: { params: Promise<{ courseuuid: string }> }) {
  return <LegacyPage params={withPlatformParams(props.params)} />;
}
