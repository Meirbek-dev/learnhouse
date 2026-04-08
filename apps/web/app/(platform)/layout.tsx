import { PlatformContextProvider } from '@/components/Contexts/PlatformContext';
import { getSession } from '@/lib/auth/session';
import { getPlatform } from '@/services/platform/platform';
import PlatformSessionProviders from './platform-session-providers';
import '@styles/globals.css';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const [initialPlatform, initialSession] = await Promise.all([getPlatform(), getSession()]);

  return (
    <PlatformContextProvider initialPlatform={initialPlatform}>
      <PlatformSessionProviders initialSession={initialSession}>{children}</PlatformSessionProviders>
    </PlatformContextProvider>
  );
}
