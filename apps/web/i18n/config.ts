export type Locale = (typeof locales)[number]

export const locales = ['ru', 'kz', 'en'] as const
export const defaultLocale: Locale = 'ru'
