'use client';

import { AVATAR_UNLOCKS, LevelIndicator, getLevelInfo } from '@/components/Objects/GamificationLevel';
import type { GamificationProfile } from '@/services/gamification/gamification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Crown, Lock, Palette, Settings, User } from 'lucide-react';
import GamifiedUserAvatar from '@/components/Objects/GamifiedUserAvatar';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useGamificationProfile } from '@/hooks/useGamificationProfile';

interface AvatarCustomizationProps {
  orgId: number;
  className?: string;
  onUpdate?: () => void;
}

interface AvatarCustomization {
  selectedFrame: string | null;
  selectedAccessory: string | null;
  showLevelBadge: boolean;
  showFrame: boolean;
  showAccessories: boolean;
}

export function AvatarCustomization({ orgId, className, onUpdate }: AvatarCustomizationProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const { profile, isLoading, error } = useGamificationProfile({ orgId, enabled: true });
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isMobile = useIsMobile();

  // Local customization state
  const [customization, setCustomization] = useState<AvatarCustomization>({
    selectedFrame: null,
    selectedAccessory: null,
    showLevelBadge: true,
    showFrame: true,
    showAccessories: true,
  });

  useEffect(() => {
    if (profile?.preferences?.avatar_customization) {
      setCustomization(profile.preferences.avatar_customization as any);
    }
  }, [profile]);

  const handleSaveCustomization = async () => {
    if (!profile) return;

    startTransition(() => setIsSaving(true));
    try {
      // TODO: call an API to save customization
      // For now, we'll just show a success message and update local state
      toast.success(t('avatarCustomization.saved'));
      onUpdate?.();
    } catch (error) {
      console.error('Error saving customization:', error);
      toast.error(t('avatarCustomization.failedToSave'));
    } finally {
      startTransition(() => setIsSaving(false));
    }
  };

  const { unlockedFrames, unlockedAccessories, levelInfo } = useMemo(() => {
    if (!profile) {
      return { unlockedFrames: [], unlockedAccessories: [], levelInfo: null };
    }
    return {
      unlockedFrames: AVATAR_UNLOCKS.frames.filter((f) => profile.current_level >= f.level),
      unlockedAccessories: AVATAR_UNLOCKS.accessories.filter((a) => profile.current_level >= a.level),
      levelInfo: getLevelInfo(profile.current_level, t),
    };
  }, [profile, t]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            {t('avatarCustomization.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-muted h-20 animate-pulse rounded" />
            <div className="bg-muted h-32 animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            {t('avatarCustomization.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-8 text-center">{t('avatarCustomization.noDataMessage')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          {t('avatarCustomization.title')}
        </CardTitle>
        <p className="text-muted-foreground text-sm">{t('avatarCustomization.description')}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Level Status */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">{t('avatarCustomization.currentStatus')}</h4>
          <div className="bg-muted/30 flex items-center gap-4 rounded-lg p-4">
            <GamifiedUserAvatar
              size="xl"
              gamificationProfile={profile}
              showLevelBadge={customization.showLevelBadge}
              showAvatarFrame={customization.showFrame}
              showAvatarAccessories={customization.showAccessories}
              use_with_session
            />
            <div className="flex-1 pt-4 pl-4">
              <LevelIndicator
                profile={profile}
                showXP
                variant={isMobile ? 'compact' : 'full'}
              />
              <p className="text-muted-foreground mt-1 text-sm">
                {levelInfo?.title} •{' '}
                {t('avatarCustomization.unlockedItems', { count: unlockedFrames.length + unlockedAccessories.length })}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Display Options */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">{t('avatarCustomization.displayOptions')}</h4>
          <div className="grid grid-cols-1 gap-3">
            <label className="flex cursor-pointer items-center space-x-3">
              <input
                type="checkbox"
                checked={customization.showLevelBadge}
                onChange={(e) =>
                  setCustomization((prev) => ({
                    ...prev,
                    showLevelBadge: e.target.checked,
                  }))
                }
                className="text-primary focus:ring-primary rounded border-gray-300"
              />
              <span className="text-sm">{t('avatarCustomization.showLevelBadge')}</span>
            </label>

            <label className="flex cursor-pointer items-center space-x-3">
              <input
                type="checkbox"
                checked={customization.showFrame}
                onChange={(e) =>
                  setCustomization((prev) => ({
                    ...prev,
                    showFrame: e.target.checked,
                  }))
                }
                className="text-primary focus:ring-primary rounded border-gray-300"
                disabled={unlockedFrames.length === 0}
              />
              <span className={cn('text-sm', unlockedFrames.length === 0 && 'text-muted-foreground')}>
                {t('avatarCustomization.showFrame')}
              </span>
              {unlockedFrames.length === 0 && <Lock className="text-muted-foreground h-3 w-3" />}
            </label>

            <label className="flex cursor-pointer items-center space-x-3">
              <input
                type="checkbox"
                checked={customization.showAccessories}
                onChange={(e) =>
                  setCustomization((prev) => ({
                    ...prev,
                    showAccessories: e.target.checked,
                  }))
                }
                className="text-primary focus:ring-primary rounded border-gray-300"
                disabled={unlockedAccessories.length === 0}
              />
              <span className={cn('text-sm', unlockedAccessories.length === 0 && 'text-muted-foreground')}>
                {t('avatarCustomization.showAccessories')}
              </span>
              {unlockedAccessories.length === 0 && <Lock className="text-muted-foreground h-3 w-3" />}
            </label>
          </div>
        </div>

        {/* Avatar Frames */}
        {unlockedFrames.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">{t('avatarCustomization.avatarFrames')}</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {/* None option */}
              <button
                onClick={() => setCustomization((prev) => ({ ...prev, selectedFrame: null }))}
                className={cn(
                  'rounded-lg border-2 p-3 text-center transition-colors',
                  customization.selectedFrame === null
                    ? 'border-primary bg-primary/10'
                    : 'border-muted hover:border-border',
                )}
              >
                <User className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                <p className="text-xs font-medium">{t('common.none')}</p>
              </button>

              {unlockedFrames.map((frame) => (
                <button
                  key={frame.id}
                  onClick={() => setCustomization((prev) => ({ ...prev, selectedFrame: frame.id }))}
                  className={cn(
                    'rounded-lg border-2 p-3 text-center transition-colors',
                    customization.selectedFrame === frame.id
                      ? 'border-primary bg-primary/10'
                      : 'border-muted hover:border-border',
                  )}
                >
                  <div
                    className={cn(
                      'mx-auto mb-2 h-8 w-8 rounded-full border-2',
                      frame.color,
                      'flex items-center justify-center',
                    )}
                  >
                    <Crown className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-medium">{frame.name}</p>
                  <Badge
                    variant="outline"
                    className="mt-1 text-[10px]"
                  >
                    {t('levelIndicators.levelAbbrev')}
                    {frame.level}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Avatar Accessories */}
        {unlockedAccessories.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">{t('avatarCustomization.avatarAccessories')}</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {/* None option */}
              <button
                onClick={() => setCustomization((prev) => ({ ...prev, selectedAccessory: null }))}
                className={cn(
                  'rounded-lg border-2 p-3 text-center transition-colors',
                  customization.selectedAccessory === null
                    ? 'border-primary bg-primary/10'
                    : 'border-muted hover:border-border',
                )}
              >
                <User className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                <p className="text-xs font-medium">{t('common.none')}</p>
              </button>

              {unlockedAccessories.map((accessory) => (
                <button
                  key={accessory.id}
                  onClick={() => setCustomization((prev) => ({ ...prev, selectedAccessory: accessory.id }))}
                  className={cn(
                    'rounded-lg border-2 p-3 text-center transition-colors',
                    customization.selectedAccessory === accessory.id
                      ? 'border-primary bg-primary/10'
                      : 'border-muted hover:border-border',
                  )}
                >
                  <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center text-2xl">{accessory.icon}</div>
                  <p className="text-xs font-medium">{accessory.name}</p>
                  <Badge
                    variant="outline"
                    className="mt-1 text-[10px]"
                  >
                    {t('levelIndicators.levelAbbrev')}
                    {accessory.level}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Locked Items Preview */}
        <div className="space-y-3">
          <h4 className="flex items-center gap-2 text-sm font-medium">
            <Lock className="h-4 w-4" />
            {t('avatarCustomization.comingSoon')}
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {AVATAR_UNLOCKS.frames
              .filter((f) => profile.current_level < f.level)
              .slice(0, 3)
              .map((frame) => (
                <div
                  key={frame.id}
                  className="border-muted rounded-lg border-2 border-dashed p-3 text-center opacity-60"
                >
                  <div className="border-muted mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full border-2">
                    <Lock className="text-muted-foreground h-4 w-4" />
                  </div>
                  <p className="text-muted-foreground text-xs font-medium">{frame.name}</p>
                  <Badge
                    variant="outline"
                    className="mt-1 text-[10px]"
                  >
                    {t('levelIndicators.levelAbbrev')}
                    {frame.level}
                  </Badge>
                </div>
              ))}
          </div>
        </div>

        <Separator />

        {/* Save Button */}
        <Button
          onClick={handleSaveCustomization}
          disabled={isSaving || isPending}
          className="w-full"
        >
          {isSaving || isPending ? (
            <>
              <Settings className="mr-2 h-4 w-4 animate-spin" />
              {t('avatarCustomization.saving')}
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              {t('avatarCustomization.saveCustomization')}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
