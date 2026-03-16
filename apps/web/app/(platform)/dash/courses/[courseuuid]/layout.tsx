import LegacyLayout from '@/app/orgs/[orgslug]/dash/courses/[courseuuid]/layout';

import { withPlatformParams } from '../../../legacy-route';

export default function PlatformCourseWorkspaceLayout(
  props: { children: React.ReactNode; params: Promise<{ courseuuid: string }> },
) {
  return <LegacyLayout params={withPlatformParams(props.params)}>{props.children}</LegacyLayout>;
}
