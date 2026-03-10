import * as v from 'valibot';

const NonEmptyStringSchema = v.pipe(v.string(), v.trim(), v.minLength(1));
const UrlSchema = v.pipe(NonEmptyStringSchema, v.url());
const UrlWithTrailingSlashSchema = v.pipe(UrlSchema, v.regex(/\/$/));
const BooleanStringSchema = v.picklist(['true', 'false']);

const getOptionalEnvValue = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const PublicEnvSchema = v.object({
  NEXT_PUBLIC_PLATFORM_API_URL: UrlWithTrailingSlashSchema,
  NEXT_PUBLIC_PLATFORM_BACKEND_URL: UrlWithTrailingSlashSchema,
  NEXT_PUBLIC_PLATFORM_DOMAIN: NonEmptyStringSchema,
  NEXT_PUBLIC_PLATFORM_TOP_DOMAIN: NonEmptyStringSchema,
  NEXT_PUBLIC_PLATFORM_HTTPS: BooleanStringSchema,
  NEXT_PUBLIC_PLATFORM_MEDIA_URL: v.optional(UrlWithTrailingSlashSchema),
});

const ServerEnvSchema = v.object({
  PLATFORM_INTERNAL_API_URL: v.optional(UrlWithTrailingSlashSchema),
  PLATFORM_SSL: v.optional(BooleanStringSchema),
  NEXTAUTH_SECRET: NonEmptyStringSchema,
  NEXTAUTH_URL: UrlSchema,
  PLATFORM_GOOGLE_CLIENT_ID: NonEmptyStringSchema,
  PLATFORM_GOOGLE_CLIENT_SECRET: NonEmptyStringSchema,
});

export const publicEnv = v.parse(PublicEnvSchema, {
  NEXT_PUBLIC_PLATFORM_API_URL: process.env.NEXT_PUBLIC_PLATFORM_API_URL,
  NEXT_PUBLIC_PLATFORM_BACKEND_URL: process.env.NEXT_PUBLIC_PLATFORM_BACKEND_URL,
  NEXT_PUBLIC_PLATFORM_DOMAIN: process.env.NEXT_PUBLIC_PLATFORM_DOMAIN,
  NEXT_PUBLIC_PLATFORM_TOP_DOMAIN: process.env.NEXT_PUBLIC_PLATFORM_TOP_DOMAIN,
  NEXT_PUBLIC_PLATFORM_HTTPS: process.env.NEXT_PUBLIC_PLATFORM_HTTPS,
  NEXT_PUBLIC_PLATFORM_MEDIA_URL: getOptionalEnvValue(process.env.NEXT_PUBLIC_PLATFORM_MEDIA_URL),
});

let serverEnvCache: v.InferOutput<typeof ServerEnvSchema> | null = null;

export const getServerEnv = (): v.InferOutput<typeof ServerEnvSchema> => {
  if (serverEnvCache) return serverEnvCache;

  serverEnvCache = v.parse(ServerEnvSchema, {
    PLATFORM_INTERNAL_API_URL: getOptionalEnvValue(process.env.PLATFORM_INTERNAL_API_URL),
    PLATFORM_SSL: getOptionalEnvValue(process.env.PLATFORM_SSL),
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    PLATFORM_GOOGLE_CLIENT_ID: process.env.PLATFORM_GOOGLE_CLIENT_ID,
    PLATFORM_GOOGLE_CLIENT_SECRET: process.env.PLATFORM_GOOGLE_CLIENT_SECRET,
  });

  return serverEnvCache;
};
