import { PlatformContextProvider } from '@/components/Contexts/PlatformContext';
import { getPlatform } from '@/services/platform/platform';
import '@styles/globals.css';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const initialPlatform = await getPlatform();

  return <PlatformContextProvider initialPlatform={initialPlatform}>{children}</PlatformContextProvider>;
}
