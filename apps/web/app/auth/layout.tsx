import { PlatformContextProvider } from '@/components/Contexts/PlatformContext';
import { Spinner } from '@components/ui/spinner';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';

function AuthContent({ children }: { children: React.ReactNode }) {
  useTranslations('Auth.Layout');
  return <PlatformContextProvider>{children}</PlatformContextProvider>;
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <AuthContent>{children}</AuthContent>
    </Suspense>
  );
}
