'use client';

import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { updateUserLocale } from '@services/users/users';
import { useLocale, useTranslations } from 'next-intl';
import { SelectValue } from '@radix-ui/react-select';
import { setUserLocale } from '@/i18n/locale';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { Languages } from 'lucide-react';
import { locales } from '@/i18n/config';
import { useTransition } from 'react';
import { cn } from '@/lib/utils';

interface LocaleSwitcherProps {
  className?: string;
  isMobile?: boolean;
}

export const LocaleSwitcher = ({ className, isMobile }: LocaleSwitcherProps) => {
  const router = useRouter();
  const currentLocale = useLocale();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('Components.LocaleSwitcher');
  const session = useLHSession() as any;

  const handleLocaleChange = async (newLocale: Locale) => {
    startTransition(async () => {
      await setUserLocale(newLocale);

      // Sync to database if user is logged in
      if (session?.data?.user?.id && session?.data?.tokens?.access_token) {
        try {
          await updateUserLocale(session.data.user.id, newLocale, session.data.tokens.access_token);
        } catch (error) {
          console.error('Failed to sync locale to server:', error);
        }
      }

      router.refresh();
    });
  };

  return (
    <Select
      value={currentLocale}
      onValueChange={(value) => handleLocaleChange(value as Locale)}
      disabled={isPending}
    >
      {isMobile ? (
        <SelectTrigger
          className={cn('w-auto touch-manipulation', isMobile && 'w-full', className)}
          aria-label={t('selectLanguage')}
        >
          <Languages size={22} />
          {isMobile ? <SelectValue placeholder={t('selectLanguage')}>{t(currentLocale)}</SelectValue> : null}
        </SelectTrigger>
      ) : (
        <SelectTrigger
          className={cn('w-auto touch-manipulation', isMobile && 'w-full', className)}
          aria-label={t('selectLanguage')}
          withChevron={false}
        >
          <Languages size={22} />
          {isMobile ? <SelectValue placeholder={t('selectLanguage')}>{t(currentLocale)}</SelectValue> : null}
        </SelectTrigger>
      )}
      <SelectContent
        className={cn(isMobile && 'z-[80]')}
        position={isMobile ? 'popper' : 'popper'}
        sideOffset={4}
        side={isMobile ? 'bottom' : 'bottom'}
      >
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
};
