export type Locale = (typeof locales)[number]

export const locales = ['en-US', 'ru-RU', 'kz-KZ'] as const
export const defaultLocale: Locale = 'en-US'
