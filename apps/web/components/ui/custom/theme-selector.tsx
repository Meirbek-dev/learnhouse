'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/components/providers/theme-provider';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { themes } from '@/lib/themes';
import { cn } from '@/lib/utils';
import { Badge } from '../badge';
import { useState } from 'react';

interface ThemeSelectorProps {
  className?: string;
}

export function ThemeSelector({ className }: ThemeSelectorProps) {
  const { theme: currentTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const t = useTranslations('DashPage.UserAccountSettings.generalSection.themeSelector');
  const tThemes = useTranslations('Themes');

  const handleValueChange = (value: string) => {
    setTheme(value);
    // Force the dropdown to stay open after theme change
    setTimeout(() => setOpen(true), 0);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <Label className="text-base font-medium">
        {t('title')}{' '}
        <Badge
          className="text-xs"
          variant={'secondary'}
        >
          {t('beta')}
        </Badge>
      </Label>

      <div className="space-y-3">
        <Select
          value={currentTheme.name}
          onValueChange={handleValueChange}
          open={open}
          onOpenChange={setOpen}
        >
          <SelectTrigger className="w-full sm:w-[300px]">
            <SelectValue>
              <div className="flex items-center gap-3">
                {/* Theme color preview */}
                <div className="flex gap-1">
                  <div
                    className="h-4 w-4 rounded border"
                    style={{ backgroundColor: currentTheme.colors.primary }}
                  />
                  <div
                    className="h-4 w-4 rounded border"
                    style={{ backgroundColor: currentTheme.colors.secondary }}
                  />
                  <div
                    className="h-4 w-4 rounded border"
                    style={{ backgroundColor: currentTheme.colors.accent }}
                  />
                </div>
                <span className="font-medium">{tThemes(`${currentTheme.name}.name`)}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {themes.map((theme) => (
              <SelectItem
                key={theme.name}
                value={theme.name}
              >
                <div className="flex items-center gap-3">
                  {/* Theme color preview */}
                  <div className="flex gap-1">
                    <div
                      className="h-4 w-4 rounded border"
                      style={{ backgroundColor: theme.colors.primary }}
                    />
                    <div
                      className="h-4 w-4 rounded border"
                      style={{ backgroundColor: theme.colors.secondary }}
                    />
                    <div
                      className="h-4 w-4 rounded border"
                      style={{ backgroundColor: theme.colors.accent }}
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">{tThemes(`${theme.name}.name`)}</span>
                    <span className="text-muted-foreground text-xs">{tThemes(`${theme.name}.description`)}</span>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Optional: Show current theme description */}
        <p className="text-muted-foreground text-xs">{tThemes(`${currentTheme.name}.description`)}</p>
      </div>
    </div>
  );
}
