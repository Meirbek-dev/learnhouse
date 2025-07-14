'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Locale, locales } from '@/i18n/config';
import { setUserLocale } from '@/i18n/locale';
import { cn } from '@/lib/utils';
import { Languages } from 'lucide-react';

interface LocaleSwitcherProps {
  className?: string;
}

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const router = useRouter();
  const currentLocale = useLocale();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('Components.LocaleSwitcher');

  const handleLocaleChange = async (newLocale: Locale) => {
    startTransition(async () => {
      await setUserLocale(newLocale);
      router.refresh();
    });
  };

  return (
    <Select
      value={currentLocale}
      onValueChange={(value) => handleLocaleChange(value as Locale)}
      disabled={isPending}
    >
      <SelectTrigger
        className={cn('w-auto', className)}
        aria-label={t('selectLanguage')}
      >
        <Languages size={22} />
        <SelectValue placeholder={t('selectLanguage')}>{t(currentLocale)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {locales.map((locale) => (
          <SelectItem
            key={locale}
            value={locale}
          >
            {t(locale)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
