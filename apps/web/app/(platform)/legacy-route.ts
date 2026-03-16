import { PLATFORM_ORG_SLUG } from '@/services/config/config';

export function withPlatformParams<T extends Record<string, string>>(
  params: T | Promise<T>,
): Promise<T & { orgslug: string }> {
  return Promise.resolve(params).then((resolved) => ({
    ...resolved,
    orgslug: PLATFORM_ORG_SLUG,
  }));
}
