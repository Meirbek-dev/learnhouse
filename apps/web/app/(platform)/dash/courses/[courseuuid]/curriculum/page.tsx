import LegacyPage from '@/app/orgs/[orgslug]/dash/courses/[courseuuid]/curriculum/page';

import { withPlatformParams } from '../../../../legacy-route';

export default function PlatformCourseCurriculumPage(props: { params: Promise<{ courseuuid: string }> }) {
  return <LegacyPage params={withPlatformParams(props.params)} />;
}
