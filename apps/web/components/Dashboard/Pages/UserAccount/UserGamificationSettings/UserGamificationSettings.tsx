'use client';

import {
  Activity,
  AlertTriangle,
  Bell,
  BellOff,
  Crown,
  Eye,
  EyeOff,
  Palette,
  RotateCcw,
  Settings,
  Shield,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GamificationProfileSection } from '@/components/Dashboard/Gamification/GamificationProfileSection';
import { AvatarCustomization } from '@/components/Dashboard/Gamification/AvatarCustomization';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useOrg } from '@/components/Contexts/OrgContext';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';

// Types for gamification preferences
interface GamificationPreferences {
  notifications: {
    levelUp: boolean;
    xpGain: boolean;
    streakReminder: boolean;
    weeklyReport: boolean;
  };
  privacy: {
    showOnLeaderboard: boolean;
    publicProfileStats: boolean;
    shareProgress: boolean;
  };
  display: {
    animatedEffects: boolean;
    compactMode: boolean;
    showLevelIndicator: boolean;
    autoHideToasts: boolean;
  };
}

interface OrgParams {
  orgslug: string;
}

// Default preferences
const DEFAULT_PREFERENCES: GamificationPreferences = {
  notifications: {
    levelUp: true,
    xpGain: true,
    streakReminder: false,
    weeklyReport: true,
  },
  privacy: {
    showOnLeaderboard: true,
    publicProfileStats: true,
    shareProgress: false,
  },
  display: {
    animatedEffects: true,
    compactMode: false,
    showLevelIndicator: true,
    autoHideToasts: false,
  },
};

// Storage key for preferences
const getPreferencesKey = (userId: string, orgId: number) => `gamification_preferences_${userId}_${orgId}`;

// SSR-safe localStorage utilities
const isLocalStorageAvailable = (): boolean => {
  try {
    return typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null;
  } catch {
    return false;
  }
};

const loadPreferences = (userId: string, orgId: number): GamificationPreferences => {
  if (!isLocalStorageAvailable()) return DEFAULT_PREFERENCES;

  try {
    const stored = localStorage.getItem(getPreferencesKey(userId, orgId));
    return stored ? { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

const savePreferences = (userId: string, orgId: number, preferences: GamificationPreferences): void => {
  if (!isLocalStorageAvailable()) return;

  try {
    localStorage.setItem(getPreferencesKey(userId, orgId), JSON.stringify(preferences));
  } catch (error) {
    console.error('Failed to save gamification preferences:', error);
  }
};

export default function UserGamificationSettings() {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const org = useOrg() as any;
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [preferences, setPreferences] = useState<GamificationPreferences>(DEFAULT_PREFERENCES);

  // Get org ID with proper fallback
  const orgId = useMemo(() => org?.id || 1, [org?.id]);

  // Load preferences on mount
  useEffect(() => {
    if (org?.id) {
      const userId = org.user?.id || 'anonymous';
      const loadedPreferences = loadPreferences(String(userId), orgId);
      setPreferences(loadedPreferences);
    }
  }, [org?.id, orgId]);

  // Save preferences handler
  const handleSavePreferences = useCallback(async () => {
    if (!org?.user?.id) {
      toast.error(t('toast.userNotAuthenticated'));
      return;
    }

    setIsLoading(true);
    try {
      savePreferences(String(org.user.id), orgId, preferences);
      toast.success(t('toast.preferencesSaved'));
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast.error(t('toast.preferencesError'));
    } finally {
      setIsLoading(false);
    }
  }, [org?.user?.id, orgId, preferences, t]);

  // Reset preferences handler
  const handleResetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    setShowResetDialog(false);
    toast.success(t('toast.preferencesReset'));
  }, [t]);

  // Preference update helpers
  const updateNotificationPreference = useCallback(
    (key: keyof GamificationPreferences['notifications'], value: boolean) => {
      setPreferences((prev) => ({
        ...prev,
        notifications: { ...prev.notifications, [key]: value },
      }));
    },
    [],
  );

  const updatePrivacyPreference = useCallback((key: keyof GamificationPreferences['privacy'], value: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      privacy: { ...prev.privacy, [key]: value },
    }));
  }, []);

  const updateDisplayPreference = useCallback((key: keyof GamificationPreferences['display'], value: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      display: { ...prev.display, [key]: value },
    }));
  }, []);

  // Error boundary for org data
  if (!orgId) {
    return (
      <div className="soft-shadow mx-0 rounded-xl bg-white sm:mx-10">
        <div className="flex flex-col">
          <div className="mx-3 my-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
            <h1 className="text-xl font-bold text-gray-800">Gamification Settings</h1>
            <h2 className="text-md text-gray-500">Organization not available</h2>
          </div>
          <div className="px-8 py-6">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{t('errors.orgNotAvailable')}</AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="soft-shadow mx-0 rounded-xl bg-white sm:mx-10">
      <div className="flex flex-col">
        {/* Header */}
        <div className="mx-3 my-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
          <h1 className="text-xl font-bold text-gray-800">Gamification Settings</h1>
          <h2 className="text-md text-gray-500">Customize your gamification experience and preferences</h2>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {/* Tabs Navigation */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger
                value="overview"
                className="flex items-center gap-2"
              >
                <Activity className="h-4 w-4" />
                {t('tabs.overview')}
              </TabsTrigger>
              <TabsTrigger
                value="customization"
                className="flex items-center gap-2"
              >
                <Palette className="h-4 w-4" />
                {t('tabs.avatar')}
              </TabsTrigger>
              <TabsTrigger
                value="preferences"
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                {t('tabs.preferences')}
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent
              value="overview"
              className="space-y-6"
            >
              <GamificationProfileSection
                orgId={orgId}
                variant="full"
                showUnlocks
                showAchievements
              />
            </TabsContent>

            {/* Avatar Customization Tab */}
            <TabsContent
              value="customization"
              className="space-y-6"
            >
              <AvatarCustomization
                orgId={orgId}
                onUpdate={() => {
                  toast.success(t('avatarUpdated'));
                }}
              />
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent
              value="preferences"
              className="space-y-6"
            >
              <div className="grid gap-6">
                {/* Notifications Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      {t('notifications.title')}
                    </CardTitle>
                    <p className="text-muted-foreground text-sm">{t('notifications.description')}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4">
                      <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-medium">{t('notifications.levelUp')}</span>
                          </div>
                          <p className="text-muted-foreground text-xs">{t('notifications.levelUpDescription')}</p>
                        </div>
                        <Switch
                          checked={preferences.notifications.levelUp}
                          onCheckedChange={(checked) => updateNotificationPreference('levelUp', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium">{t('notifications.xpGain')}</span>
                          </div>
                          <p className="text-muted-foreground text-xs">{t('notifications.xpGainDescription')}</p>
                        </div>
                        <Switch
                          checked={preferences.notifications.xpGain}
                          onCheckedChange={(checked) => updateNotificationPreference('xpGain', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <BellOff className="h-4 w-4 text-orange-500" />
                            <span className="text-sm font-medium">{t('notifications.streakReminder')}</span>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {t('notifications.streakReminderDescription')}
                          </p>
                        </div>
                        <Switch
                          checked={preferences.notifications.streakReminder}
                          onCheckedChange={(checked) => updateNotificationPreference('streakReminder', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-green-500" />
                            <span className="text-sm font-medium">{t('notifications.weeklyReport')}</span>
                          </div>
                          <p className="text-muted-foreground text-xs">{t('notifications.weeklyReportDescription')}</p>
                        </div>
                        <Switch
                          checked={preferences.notifications.weeklyReport}
                          onCheckedChange={(checked) => updateNotificationPreference('weeklyReport', checked)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Privacy Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      {t('privacy.title')}
                    </CardTitle>
                    <p className="text-muted-foreground text-sm">{t('privacy.description')}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4">
                      <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-medium">{t('privacy.showOnLeaderboard')}</span>
                          </div>
                          <p className="text-muted-foreground text-xs">{t('privacy.showOnLeaderboardDescription')}</p>
                        </div>
                        <Switch
                          checked={preferences.privacy.showOnLeaderboard}
                          onCheckedChange={(checked) => updatePrivacyPreference('showOnLeaderboard', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium">{t('privacy.publicProfileStats')}</span>
                          </div>
                          <p className="text-muted-foreground text-xs">{t('privacy.publicProfileStatsDescription')}</p>
                        </div>
                        <Switch
                          checked={preferences.privacy.publicProfileStats}
                          onCheckedChange={(checked) => updatePrivacyPreference('publicProfileStats', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <EyeOff className="h-4 w-4 text-green-500" />
                            <span className="text-sm font-medium">{t('privacy.shareProgress')}</span>
                          </div>
                          <p className="text-muted-foreground text-xs">{t('privacy.shareProgressDescription')}</p>
                        </div>
                        <Switch
                          checked={preferences.privacy.shareProgress}
                          onCheckedChange={(checked) => updatePrivacyPreference('shareProgress', checked)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Display Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      {t('display.title')}
                    </CardTitle>
                    <p className="text-muted-foreground text-sm">{t('display.description')}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4">
                      <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-purple-500" />
                            <span className="text-sm font-medium">{t('display.animatedEffects')}</span>
                          </div>
                          <p className="text-muted-foreground text-xs">{t('display.animatedEffectsDescription')}</p>
                        </div>
                        <Switch
                          checked={preferences.display.animatedEffects}
                          onCheckedChange={(checked) => updateDisplayPreference('animatedEffects', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium">{t('display.compactMode')}</span>
                          </div>
                          <p className="text-muted-foreground text-xs">{t('display.compactModeDescription')}</p>
                        </div>
                        <Switch
                          checked={preferences.display.compactMode}
                          onCheckedChange={(checked) => updateDisplayPreference('compactMode', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-medium">{t('display.showLevelIndicator')}</span>
                          </div>
                          <p className="text-muted-foreground text-xs">{t('display.showLevelIndicatorDescription')}</p>
                        </div>
                        <Switch
                          checked={preferences.display.showLevelIndicator}
                          onCheckedChange={(checked) => updateDisplayPreference('showLevelIndicator', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium">{t('display.autoHideToasts')}</span>
                          </div>
                          <p className="text-muted-foreground text-xs">{t('display.autoHideToastsDescription')}</p>
                        </div>
                        <Switch
                          checked={preferences.display.autoHideToasts}
                          onCheckedChange={(checked) => updateDisplayPreference('autoHideToasts', checked)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Danger Zone */}
                <Card className="border-destructive/20">
                  <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      {t('dangerZone.title')}
                    </CardTitle>
                    <p className="text-muted-foreground text-sm">{t('dangerZone.description')}</p>
                  </CardHeader>
                  <CardContent>
                    <Alert className="mb-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{t('dangerZone.resetWarning')}</AlertDescription>
                    </Alert>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setPreferences(DEFAULT_PREFERENCES)}
                        className="flex items-center gap-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        {t('dangerZone.resetPreferences')}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setShowResetDialog(true)}
                        className="flex items-center gap-2"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        {t('dangerZone.resetAllData')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button
                    onClick={handleSavePreferences}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        {t('saving')}
                      </>
                    ) : (
                      <>
                        <Settings className="h-4 w-4" />
                        {t('savePreferences')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Reset Confirmation Dialog */}
          <Dialog
            open={showResetDialog}
            onOpenChange={setShowResetDialog}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  {t('dangerZone.resetConfirmTitle')}
                </DialogTitle>
                <DialogDescription>{t('dangerZone.resetConfirmDescription')}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowResetDialog(false)}
                >
                  {t('cancel')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleResetPreferences}
                  className="flex items-center gap-2"
                >
                  <AlertTriangle className="h-4 w-4" />
                  {t('dangerZone.resetAllData')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
