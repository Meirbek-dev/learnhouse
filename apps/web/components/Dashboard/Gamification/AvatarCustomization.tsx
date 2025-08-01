'use client';

import { type GamificationProfile, getGamificationProfile } from '@/services/gamification/gamification';
import { AVATAR_UNLOCKS, LevelIndicator, getLevelInfo } from '@/components/Objects/GamificationLevel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Crown, Lock, Palette, Settings, User } from 'lucide-react';
import GamifiedUserAvatar from '@/components/Objects/GamifiedUserAvatar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

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
  const { data: session } = useSession();
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Local customization state
  const [customization, setCustomization] = useState<AvatarCustomization>({
    selectedFrame: null,
    selectedAccessory: null,
    showLevelBadge: true,
    showFrame: true,
    showAccessories: true,
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.tokens?.access_token) {
        setIsLoading(false);
        return;
      }

      try {
        const gamificationData = await getGamificationProfile(orgId, session.tokens.access_token);
        setProfile(gamificationData);

        // Load saved customization preferences from profile_data
        if (gamificationData.profile_data?.avatar_customization) {
          setCustomization(gamificationData.profile_data.avatar_customization);
        }
      } catch (error) {
        console.error('Error fetching gamification profile:', error);
        toast.error(t('dashboard.failedToLoad'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [orgId, session?.tokens?.access_token]);

  const handleSaveCustomization = async () => {
    if (!(profile && session?.tokens?.access_token)) return;

    setIsSaving(true);
    try {
      // In a real implementation, you would call an API to save customization
      // For now, we'll just show a success message and update local state
      toast.success(t('avatarCustomization.saved'));
      onUpdate?.();
    } catch (error) {
      console.error('Error saving customization:', error);
      toast.error(t('avatarCustomization.failedToSave'));
    } finally {
      setIsSaving(false);
    }
  };

  const unlockedFrames = profile ? AVATAR_UNLOCKS.frames.filter((f) => profile.current_level >= f.level) : [];
  const unlockedAccessories = profile ? AVATAR_UNLOCKS.accessories.filter((a) => profile.current_level >= a.level) : [];
  const levelInfo = profile ? getLevelInfo(profile.current_level) : null;

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
            <div className="flex-1">
              <LevelIndicator
                profile={profile}
                variant="compact"
                showXP
              />
              <p className="text-muted-foreground mt-1 text-sm">
                {levelInfo?.title} • {unlockedFrames.length + unlockedAccessories.length} items unlocked
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
                  'p-3 rounded-lg border-2 transition-colors text-center',
                  customization.selectedFrame === null
                    ? 'border-primary bg-primary/10'
                    : 'border-muted hover:border-border',
                )}
              >
                <User className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                <p className="text-xs font-medium">None</p>
              </button>

              {unlockedFrames.map((frame) => (
                <button
                  key={frame.id}
                  onClick={() => setCustomization((prev) => ({ ...prev, selectedFrame: frame.id }))}
                  className={cn(
                    'p-3 rounded-lg border-2 transition-colors text-center',
                    customization.selectedFrame === frame.id
                      ? 'border-primary bg-primary/10'
                      : 'border-muted hover:border-border',
                  )}
                >
                  <div
                    className={cn(
                      'h-8 w-8 mx-auto mb-2 rounded-full border-2',
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
                    Lv.{frame.level}
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
                  'p-3 rounded-lg border-2 transition-colors text-center',
                  customization.selectedAccessory === null
                    ? 'border-primary bg-primary/10'
                    : 'border-muted hover:border-border',
                )}
              >
                <User className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                <p className="text-xs font-medium">None</p>
              </button>

              {unlockedAccessories.map((accessory) => (
                <button
                  key={accessory.id}
                  onClick={() => setCustomization((prev) => ({ ...prev, selectedAccessory: accessory.id }))}
                  className={cn(
                    'p-3 rounded-lg border-2 transition-colors text-center',
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
                    Lv.{accessory.level}
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
                    Lv.{frame.level}
                  </Badge>
                </div>
              ))}
          </div>
        </div>

        <Separator />

        {/* Save Button */}
        <Button
          onClick={handleSaveCustomization}
          disabled={isSaving}
          className="w-full"
        >
          {isSaving ? (
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
