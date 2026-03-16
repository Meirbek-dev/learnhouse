import LegacyPage from '@/app/orgs/[orgslug]/(withmenu)/certificates/[uuid]/verify/page';

import { withPlatformParams } from '../../../../legacy-route';

export default function PlatformCertificateVerifyPage(props: { params: Promise<{ uuid: string }> }) {
  return <LegacyPage params={withPlatformParams(props.params)} />;
}
