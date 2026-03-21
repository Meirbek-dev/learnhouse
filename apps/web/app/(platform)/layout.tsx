import PlatformClientProviders from './platform-client-providers';
import '@styles/globals.css';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <PlatformClientProviders>{children}</PlatformClientProviders>;
}
