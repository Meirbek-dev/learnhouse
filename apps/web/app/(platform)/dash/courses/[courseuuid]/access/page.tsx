import LegacyPage from '@/app/orgs/[orgslug]/dash/courses/[courseuuid]/access/page';

import { withPlatformParams } from '../../../../legacy-route';

export default function PlatformCourseAccessPage(props: { params: Promise<{ courseuuid: string }> }) {
  return <LegacyPage params={withPlatformParams(props.params)} />;
}
