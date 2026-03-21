import PlatformClientProviders from './platform-client-providers';
import { getPlatform } from '@/services/platform/platform';
import '@styles/globals.css';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const initialPlatform = await getPlatform();

  return <PlatformClientProviders initialPlatform={initialPlatform}>{children}</PlatformClientProviders>;
}
