import LegacyPage from '@/app/orgs/[orgslug]/dash/courses/[courseuuid]/collaboration/page';

import { withPlatformParams } from '../../../../legacy-route';

export default function PlatformCourseCollaborationPage(props: { params: Promise<{ courseuuid: string }> }) {
  return <LegacyPage params={withPlatformParams(props.params)} />;
}
