import { getOrganizationContextInfo } from '@services/organizations/orgs';
import OrgClientProviders from './org-client-providers';
import '@styles/globals.css';

export default async function RootLayout(props: { children: React.ReactNode; params: Promise<any> }) {
  const params = await props.params;
  const { children } = props;

  // Fetch org data server-side so the client OrgProvider can use it as fallback
  // and avoid a duplicate client-side fetch
  let initialOrg = null;
  try {
    initialOrg = await getOrganizationContextInfo(params.orgslug);
  } catch {
    // If SSR fetch fails, OrgProvider will fetch client-side as fallback
  }

  return (
    <div>
      <OrgClientProviders
        orgslug={params.orgslug}
        initialOrg={initialOrg}
      >
        {children}
      </OrgClientProviders>
    </div>
  );
}
