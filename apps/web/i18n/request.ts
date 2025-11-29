import { getRequestConfig } from 'next-intl/server';
import { getUserLocale } from './locale';

// Use the request-scoped cookie store when available. `getRequestConfig`
// provides a small context object with `cookies`/`headers` during a
// real request; passing `cookies` into `getUserLocale` avoids calling
// `cookies()` at module/runtime build time and prevents dynamic server
// usage errors during static generation.
export default getRequestConfig(async (ctx: any) => {
  // `getRequestConfig`'s param typing in this project/version doesn't
  // expose `cookies` on the declared type. Use `any` for the context
  // and read `cookies` at runtime to avoid type errors during build.
  const cookies = ctx?.cookies;
  const locale = await getUserLocale(cookies);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
