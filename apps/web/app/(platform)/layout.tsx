import { getPlatformOrganizationContextInfo } from '@services/organizations/orgs';
import PlatformClientProviders from './platform-client-providers';
import '@styles/globals.css';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  let initialOrg = null;

  try {
    initialOrg = await getPlatformOrganizationContextInfo();
  } catch {
    initialOrg = null;
  }

  return <PlatformClientProviders initialOrg={initialOrg}>{children}</PlatformClientProviders>;
}
