import * as v from 'valibot';

const UrlWithTrailingSlashSchema = v.pipe(v.string(), v.url(), v.regex(/\/$/));

const PublicEnvSchema = v.object({
  NEXT_PUBLIC_PLATFORM_API_URL: UrlWithTrailingSlashSchema,
  NEXT_PUBLIC_PLATFORM_BACKEND_URL: UrlWithTrailingSlashSchema,
  NEXT_PUBLIC_PLATFORM_DOMAIN: v.pipe(v.string(), v.minLength(1)),
  NEXT_PUBLIC_PLATFORM_TOP_DOMAIN: v.pipe(v.string(), v.minLength(1)),
  NEXT_PUBLIC_PLATFORM_HTTPS: v.picklist(['true', 'false']),
});

const ServerEnvSchema = v.object({
  NEXTAUTH_SECRET: v.pipe(v.string(), v.minLength(1)),
  NEXTAUTH_URL: v.pipe(v.string(), v.url()),
  PLATFORM_INTERNAL_API_URL: v.optional(UrlWithTrailingSlashSchema),
  PLATFORM_SSL: v.optional(v.picklist(['true', 'false'])),
});

export const publicEnv = v.parse(PublicEnvSchema, {
  NEXT_PUBLIC_PLATFORM_API_URL: process.env.NEXT_PUBLIC_PLATFORM_API_URL,
  NEXT_PUBLIC_PLATFORM_BACKEND_URL: process.env.NEXT_PUBLIC_PLATFORM_BACKEND_URL,
  NEXT_PUBLIC_PLATFORM_DOMAIN: process.env.NEXT_PUBLIC_PLATFORM_DOMAIN,
  NEXT_PUBLIC_PLATFORM_TOP_DOMAIN: process.env.NEXT_PUBLIC_PLATFORM_TOP_DOMAIN,
  NEXT_PUBLIC_PLATFORM_HTTPS: process.env.NEXT_PUBLIC_PLATFORM_HTTPS,
});

let serverEnvCache: v.InferOutput<typeof ServerEnvSchema> | null = null;

export const getServerEnv = (): v.InferOutput<typeof ServerEnvSchema> => {
  if (serverEnvCache) return serverEnvCache;

  serverEnvCache = v.parse(ServerEnvSchema, {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    PLATFORM_INTERNAL_API_URL: process.env.PLATFORM_INTERNAL_API_URL,
    PLATFORM_SSL: process.env.PLATFORM_SSL,
  });

  return serverEnvCache;
};
