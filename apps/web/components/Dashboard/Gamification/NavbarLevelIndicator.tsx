'use client';

import { LevelIndicatorBadge } from '@components/Dashboard/Gamification';
import { useUnifiedGamification } from '@/hooks/useUnifiedGamification';
import { useOrg } from '@components/Contexts/OrgContext';
import { useSession } from 'next-auth/react';

interface NavbarLevelIndicatorProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Small level indicator for navigation bars and headers
 */
export function NavbarLevelIndicator({ className = '' }: NavbarLevelIndicatorProps) {
  const org = useOrg() as any;
  const { data: session } = useSession();
  const accessToken: string | undefined = (session as any)?.tokens?.access_token;
  const { profile } = useUnifiedGamification({ orgId: org?.id, accessToken, enabled: !!org?.id });

  if (!profile) {
    return null;
  }

  return (
    <div className={`flex items-center ${className}`}>
      <LevelIndicatorBadge
        level={profile.current_level}
        className="h-8 w-8 text-xs font-semibold shadow-sm"
      />
    </div>
  );
}

export default NavbarLevelIndicator;
