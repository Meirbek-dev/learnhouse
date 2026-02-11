/**
 * Organization types - matches the backend OrganizationRead schema.
 *
 * Source: apps/api/src/db/organizations.py (OrganizationBase + OrganizationRead)
 */

// ============================================================================
// Feature flags
// ============================================================================

export interface FeatureFlag {
  enabled: boolean;
  limit: number;
}

export interface AIFeatureFlag extends FeatureFlag {
  model: string;
  streaming_enabled: boolean;
  response_cache_enabled: boolean;
  semantic_cache_enabled: boolean;
  max_tokens_per_request: number;
  max_chat_history: number;
  rate_limit_per_user: number;
}

export interface MembersFeatureFlag extends FeatureFlag {
  admin_limit: number;
}

export interface OrgFeatures {
  courses: FeatureFlag;
  members: MembersFeatureFlag;
  usergroups: FeatureFlag;
  storage: FeatureFlag;
  ai: AIFeatureFlag;
  assignments: FeatureFlag;
  exams: FeatureFlag;
  payments: { enabled: boolean };
  discussions: FeatureFlag;
  analytics: FeatureFlag;
  collaboration: FeatureFlag;
  api: FeatureFlag;
}

// ============================================================================
// Org config
// ============================================================================

export interface OrgConfigData {
  config_version: string;
  general: { enabled: boolean; color: string };
  features: OrgFeatures;
  cloud: { plan: 'free' | 'standard' | 'pro'; custom_domain: boolean };
  landing: Record<string, unknown>;
}

export interface OrgConfig {
  id: number;
  org_id: number;
  config: OrgConfigData;
  creation_date: string | null;
  update_date: string | null;
}

// ============================================================================
// Organization
// ============================================================================

export interface OrgScript {
  content: string;
  name: string;
}

export interface Org {
  id: number;
  org_uuid: string;
  name: string;
  description: string | null;
  about: string | null;
  slug: string;
  email: string;
  socials: Record<string, string> | null;
  links: Record<string, string> | null;
  scripts: { scripts: OrgScript[] } | null;
  logo_image: string | null;
  thumbnail_image: string | null;
  previews: Record<string, unknown> | null;
  label: string | null;
  config: OrgConfig | null;
  creation_date: string;
  update_date: string;
}
