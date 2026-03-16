import LegacyPage from '@/app/orgs/[orgslug]/dash/payments/[subpage]/page';

import { withPlatformParams } from '../../../legacy-route';

export default function PlatformPaymentsPage(props: { params: Promise<{ subpage: string }> }) {
  return <LegacyPage params={withPlatformParams(props.params)} />;
}
