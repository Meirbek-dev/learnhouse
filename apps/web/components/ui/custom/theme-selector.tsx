'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/components/providers/theme-provider';
import { getThemePreviewColors } from '@/lib/theme-color-utils';
import { useCallback, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { themes } from '@/lib/themes';
import { cn } from '@/lib/utils';

interface ThemeSelectorProps {
  className?: string;
}

export function ThemeSelector({ className }: ThemeSelectorProps) {
  const { theme: currentTheme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations('DashPage.UserAccountSettings.generalSection.themeSelector');
  const tThemes = useTranslations('Themes');

  // Memoize theme list to prevent re-renders
  const themeList = useMemo(() => themes, []);

  // Memoize current theme colors for preview
  const currentColors = useMemo(() => getThemePreviewColors(currentTheme), [currentTheme]);

  const handleValueChange = useCallback(
    async (value: string) => {
      setIsLoading(true);
      try {
        await setTheme(value);
      } catch (error) {
        console.error('Failed to change theme:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [setTheme],
  );

  return (
    <div className={cn('space-y-4', className)}>
      <Label className="text-base font-medium">{t('title')}</Label>

      <div className="space-y-3">
        <Select
          value={currentTheme.name}
          onValueChange={handleValueChange}
        >
          <SelectTrigger
            className="w-full sm:w-[300px]"
            disabled={isLoading}
          >
            <SelectValue>
              <div className="flex items-center gap-3">
                {/* Theme color preview - using OKLCH colors */}
                <div className="flex gap-1">
                  <div
                    className="h-4 w-4 shrink-0 rounded border border-border"
                    style={{ backgroundColor: currentColors.primary }}
                    title="Primary color"
                  />
                  <div
                    className="h-4 w-4 shrink-0 rounded border border-border"
                    style={{ backgroundColor: currentColors.secondary }}
                    title="Secondary color"
                  />
                  <div
                    className="h-4 w-4 shrink-0 rounded border border-border"
                    style={{ backgroundColor: currentColors.accent }}
                    title="Accent color"
                  />
                </div>
                <span className="font-medium">{tThemes(`${currentTheme.name}.name`)}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {themeList.map((theme) => {
              const colors = getThemePreviewColors(theme);
              return (
                <SelectItem
                  key={theme.name}
                  value={theme.name}
                >
                  <div className="flex items-center gap-3">
                    {/* Theme color preview - using OKLCH colors */}
                    <div className="flex gap-1">
                      <div
                        className="h-4 w-4 shrink-0 rounded border border-border"
                        style={{ backgroundColor: colors.primary }}
                        title="Primary"
                      />
                      <div
                        className="h-4 w-4 shrink-0 rounded border border-border"
                        style={{ backgroundColor: colors.secondary }}
                        title="Secondary"
                      />
                      <div
                        className="h-4 w-4 shrink-0 rounded border border-border"
                        style={{ backgroundColor: colors.accent }}
                        title="Accent"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{tThemes(`${theme.name}.name`)}</span>
                      <span className="text-muted-foreground text-xs">{tThemes(`${theme.name}.description`)}</span>
                    </div>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Optional: Show current theme description */}
        <p className="text-muted-foreground text-xs">{tThemes(`${currentTheme.name}.description`)}</p>
      </div>
    </div>
  );
}
