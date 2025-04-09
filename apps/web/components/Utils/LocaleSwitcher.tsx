'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { useTranslations } from 'next-intl'

import { Locale, locales } from '@/i18n/config'
import { setUserLocale } from '@/i18n/locale'
import { cn } from '@/lib/utils'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface LanguageSwitcherProps {
  currentLocale: Locale
  className?: string
}

export function LanguageSwitcher({
  currentLocale,
  className,
}: LanguageSwitcherProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const t = useTranslations('Components.LanguageSwitcher')

  const onSelectChange = async (newLocale: Locale) => {
    startTransition(async () => {
      await setUserLocale(newLocale)
      router.refresh()
    })
  }

  return (
    <Select
      value={currentLocale}
      onValueChange={(value) => onSelectChange(value as Locale)}
      disabled={isPending}
    >
      <SelectTrigger
        className={cn('w-[180px]', className)}
        aria-label={t('selectLanguage')}
      >
        <SelectValue placeholder={t('selectLanguage')}>
          {t(currentLocale)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {locales.map((locale) => (
          <SelectItem key={locale} value={locale}>
            {t(locale)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default LanguageSwitcher
