'use client';

import { LevelIndicatorBadge } from '@components/Dashboard/Gamification';
import { useLevelIndicator } from '@/hooks/useLevelIndicator';
import { useOrg } from '@components/Contexts/OrgContext';

interface NavbarLevelIndicatorProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Small level indicator for navigation bars and headers
 */
export function NavbarLevelIndicator({ className = '' }: NavbarLevelIndicatorProps) {
  const org = useOrg() as any;
  const { profile, showLevelIndicator } = useLevelIndicator(org?.id);

  if (!(showLevelIndicator && profile)) {
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
