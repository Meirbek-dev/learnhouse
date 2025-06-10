export type Locale = (typeof locales)[number]

export const locales = ['ru-RU', 'kz-KZ', 'en-US'] as const
export const defaultLocale: Locale = 'ru-RU'
