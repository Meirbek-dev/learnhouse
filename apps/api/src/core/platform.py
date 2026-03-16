PLATFORM_ORG_SLUG = "openu"
PLATFORM_BRAND_NAME = "Ashyq Bilim"
PLATFORM_CHAT_KEY_PREFIX = f"{PLATFORM_ORG_SLUG}_chat:"


def is_platform_org_slug(org_slug: str | None) -> bool:
	return org_slug == PLATFORM_ORG_SLUG
