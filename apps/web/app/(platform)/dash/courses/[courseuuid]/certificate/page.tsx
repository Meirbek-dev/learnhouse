import LegacyPage from '@/app/orgs/[orgslug]/dash/courses/[courseuuid]/certificate/page';

import { withPlatformParams } from '../../../../legacy-route';

export default function PlatformCourseCertificatePage(props: { params: Promise<{ courseuuid: string }> }) {
  return <LegacyPage params={withPlatformParams(props.params)} />;
}
