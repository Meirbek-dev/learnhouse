import LegacyPage from '@/app/orgs/[orgslug]/dash/courses/[courseuuid]/page';

import { withPlatformParams } from '../../../legacy-route';

export default function PlatformCourseWorkspacePage(props: { params: Promise<{ courseuuid: string }> }) {
  return <LegacyPage params={withPlatformParams(props.params)} />;
}
