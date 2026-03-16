import LegacyPage from '@/app/orgs/[orgslug]/(withmenu)/course/[courseuuid]/activity/[activityid]/editor/page';

import { withPlatformParams } from '../../../../../../legacy-route';

export default function PlatformActivityEditorPage(props: {
  params: Promise<{ courseuuid: string; activityid: string }>;
}) {
  return <LegacyPage params={withPlatformParams(props.params)} />;
}
