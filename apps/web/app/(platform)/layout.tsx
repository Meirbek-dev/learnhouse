import { getPlatformOrganizationContextInfo } from '@services/organizations/orgs';
import PlatformClientProviders from './platform-client-providers';
import '@styles/globals.css';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const initialOrg = await getPlatformOrganizationContextInfo();

  return <PlatformClientProviders initialOrg={initialOrg}>{children}</PlatformClientProviders>;
}
