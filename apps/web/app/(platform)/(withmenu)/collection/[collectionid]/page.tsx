import LegacyPage from '@/app/orgs/[orgslug]/(withmenu)/collection/[collectionid]/page';

import { withPlatformParams } from '../../../legacy-route';

export default function PlatformCollectionPage(props: {
  params: Promise<{ collectionid: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LegacyPage params={withPlatformParams(props.params)} searchParams={props.searchParams} />;
}
