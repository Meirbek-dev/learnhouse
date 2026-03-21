/**
 * Platform types - matches the backend PlatformRead schema.
 *
 * Source: apps/api/src/db/platform.py (PlatformBase + PlatformRead storage model)
 */

export interface Platform {
  name: string;
  description: string | null;
  about: string | null;
  email: string;
  socials: Record<string, string> | null;
  links: Record<string, string> | null;
  logo_image: string | null;
  thumbnail_image: string | null;
  previews: Record<string, unknown> | null;
  label: string | null;
  landing: Record<string, unknown> | null;
  creation_date: string;
  update_date: string;
}
