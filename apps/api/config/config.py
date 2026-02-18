import ipaddress
import os
from functools import lru_cache
from typing import Literal

import yaml  # PyYAML types not available
from dotenv import load_dotenv

from src.db.strict_base_model import PydanticStrictBaseModel


class CookieConfig(PydanticStrictBaseModel):
    domain: str | None = None


class GeneralConfig(PydanticStrictBaseModel):
    development_mode: bool
    logfire_enabled: bool
    timezone: str = "UTC"


class SecurityConfig(PydanticStrictBaseModel):
    auth_jwt_secret_key: str


class RBACConfig(PydanticStrictBaseModel):
    """RBAC configuration."""

    audit_logging_enabled: bool = True
    cache_enabled: bool = True
    cache_ttl_seconds: int = 300  # 5 minutes


class ChromaDBConfig(PydanticStrictBaseModel):
    isSeparateDatabaseEnabled: bool | None = None
    db_host: str | None = None
    db_port: int = 8000  # Default to 8000 (Docker internal port)


class AIPerformanceConfig(PydanticStrictBaseModel):
    streaming_enabled: bool = True
    cache_enabled: bool = True
    max_concurrent_requests: int = 50
    request_timeout: int = 60


class AICacheConfig(PydanticStrictBaseModel):
    vector_store_ttl: int = 3600
    response_cache_ttl: int = 1800
    embedding_cache_ttl: int = 7200
    semantic_similarity_threshold: float = 0.95


class AIVectorStoreConfig(PydanticStrictBaseModel):
    chromadb_pool_size: int = 10
    collection_retention: int = 86400  # 24 hours
    embedding_batch_size: int = 8191  # OpenAI max for text-embedding-3-small


class AIChatConfig(PydanticStrictBaseModel):
    history_window_size: int = 10
    max_history_length: int = 100
    message_retention: int = 86400  # 24 hours


class AIConfig(PydanticStrictBaseModel):
    openai_api_key: str | None = None
    chromadb_config: ChromaDBConfig | None = None
    performance: AIPerformanceConfig = AIPerformanceConfig()
    cache: AICacheConfig = AICacheConfig()
    vector_store: AIVectorStoreConfig = AIVectorStoreConfig()
    chat: AIChatConfig = AIChatConfig()


class HostingConfig(PydanticStrictBaseModel):
    domain: str
    ssl: bool
    port: int
    use_default_org: bool
    allowed_origins: list
    allowed_regexp: str
    self_hosted: bool
    cookie_config: CookieConfig


class MailingConfig(PydanticStrictBaseModel):
    resend_api_key: str
    system_email_address: str


class DatabaseConfig(PydanticStrictBaseModel):
    sql_connection_string: str | None = None


class RedisConfig(PydanticStrictBaseModel):
    redis_connection_string: str | None = None


class InternalStripeConfig(PydanticStrictBaseModel):
    stripe_secret_key: str | None = None
    stripe_publishable_key: str | None = None
    stripe_webhook_standard_secret: str | None = None
    stripe_webhook_connect_secret: str | None = None
    stripe_client_id: str | None = None


class InternalPaymentsConfig(PydanticStrictBaseModel):
    stripe: InternalStripeConfig


class PlatformConfig(PydanticStrictBaseModel):
    site_description: str
    contact_email: str
    general_config: GeneralConfig
    hosting_config: HostingConfig
    database_config: DatabaseConfig
    redis_config: RedisConfig
    security_config: SecurityConfig
    rbac_config: RBACConfig
    ai_config: AIConfig
    mailing_config: MailingConfig
    payments_config: InternalPaymentsConfig


def _normalize_cookie_domain(raw_domain: str | None) -> str | None:
    if not raw_domain:
        return None

    cleaned = raw_domain.strip()
    if not cleaned:
        return None

    cleaned = cleaned.lstrip(".")
    if not cleaned:
        return None

    lowered = cleaned.lower()
    if lowered == "localhost":
        return None

    try:
        ipaddress.ip_address(cleaned)
        return None
    except ValueError:
        pass

    if ":" in cleaned:
        # Basic guard for IPv6-like strings that ip_address might not catch when abbreviated improperly
        return None

    return cleaned


@lru_cache(maxsize=1)
def get_platform_config() -> PlatformConfig:
    load_dotenv()

    # Get the YAML file
    yaml_path = os.path.join(os.path.dirname(__file__), "config.yaml")

    # Load the YAML file
    with open(yaml_path) as f:
        yaml_config = yaml.safe_load(f)

    # General Config

    # Development Mode
    env_development_mode = eval(os.environ.get("PLATFORM_DEVELOPMENT_MODE", "None"))
    development_mode = (
        env_development_mode
        if env_development_mode is not None
        else yaml_config.get("general", {}).get("development_mode")
    )

    # Logfire config
    env_logfire_enabled = os.environ.get("PLATFORM_LOGFIRE_ENABLED", "None")
    logfire_enabled = (
        env_logfire_enabled.lower() == "true"
        if env_logfire_enabled != "None"
        else yaml_config.get("general", {}).get("logfire_enabled", False)
    )
    # Timezone
    env_timezone = os.environ.get("PLATFORM_TIMEZONE")
    timezone = env_timezone or yaml_config.get("general", {}).get("timezone", "UTC")

    # Security Config
    env_auth_jwt_secret_key = os.environ.get("PLATFORM_AUTH_JWT_SECRET_KEY")
    auth_jwt_secret_key = env_auth_jwt_secret_key or yaml_config.get(
        "security", {}
    ).get("auth_jwt_secret_key")

    # RBAC Config
    env_audit_logging_enabled = os.environ.get("PLATFORM_RBAC_AUDIT_LOGGING_ENABLED")
    env_cache_enabled = os.environ.get("PLATFORM_RBAC_CACHE_ENABLED")
    env_cache_ttl_seconds = os.environ.get("PLATFORM_RBAC_CACHE_TTL_SECONDS")

    audit_logging_enabled = (
        env_audit_logging_enabled.lower() == "true"
        if env_audit_logging_enabled
        else yaml_config.get("rbac", {}).get("audit_logging_enabled", True)
    )
    cache_enabled = (
        env_cache_enabled.lower() == "true"
        if env_cache_enabled
        else yaml_config.get("rbac", {}).get("cache_enabled", True)
    )
    cache_ttl_seconds = (
        int(env_cache_ttl_seconds)
        if env_cache_ttl_seconds
        else yaml_config.get("rbac", {}).get("cache_ttl_seconds", 300)
    )

    # Check if environment variables are defined
    env_site_description = os.environ.get("PLATFORM_SITE_DESCRIPTION")
    env_contact_email = os.environ.get("PLATFORM_CONTACT_EMAIL")
    env_domain = os.environ.get("PLATFORM_DOMAIN")
    env_ssl = os.environ.get("PLATFORM_SSL")
    env_port = os.environ.get("PLATFORM_PORT")
    env_use_default_org = os.environ.get("PLATFORM_USE_DEFAULT_ORG")
    env_allowed_origins = os.environ.get("PLATFORM_ALLOWED_ORIGINS")
    env_cookie_domain = os.environ.get("PLATFORM_COOKIE_DOMAIN")

    # Allowed origins should be a comma separated string
    if env_allowed_origins:
        env_allowed_origins = env_allowed_origins.split(",")
    env_allowed_regexp = os.environ.get("PLATFORM_ALLOWED_REGEXP")
    env_self_hosted = os.environ.get("PLATFORM_SELF_HOSTED")
    env_sql_connection_string = os.environ.get("PLATFORM_SQL_CONNECTION_STRING")

    # Fill in values with YAML file if they are not provided
    site_description = env_site_description or yaml_config.get("site_description")
    contact_email = env_contact_email or yaml_config.get("contact_email")

    domain = env_domain or yaml_config.get("hosting_config", {}).get("domain")
    ssl = env_ssl or yaml_config.get("hosting_config", {}).get("ssl")
    port = env_port or yaml_config.get("hosting_config", {}).get("port")
    use_default_org = env_use_default_org or yaml_config.get("hosting_config", {}).get(
        "use_default_org"
    )
    allowed_origins = env_allowed_origins or yaml_config.get("hosting_config", {}).get(
        "allowed_origins"
    )
    allowed_regexp = env_allowed_regexp or yaml_config.get("hosting_config", {}).get(
        "allowed_regexp"
    )
    self_hosted = env_self_hosted or yaml_config.get("hosting_config", {}).get(
        "self_hosted"
    )

    cookies_domain = env_cookie_domain or yaml_config.get("hosting_config", {}).get(
        "cookies_config", {}
    ).get("domain")
    cookie_config = CookieConfig(domain=_normalize_cookie_domain(cookies_domain))

    # Database config
    sql_connection_string = env_sql_connection_string or yaml_config.get(
        "database_config", {}
    ).get("sql_connection_string")

    # AI Config
    env_openai_api_key = os.environ.get("PLATFORM_OPENAI_API_KEY")
    env_chromadb_separate = os.environ.get("PLATFORM_CHROMADB_SEPARATE")
    env_chromadb_host = os.environ.get("PLATFORM_CHROMADB_HOST")
    env_chromadb_port = os.environ.get("PLATFORM_CHROMADB_PORT")

    openai_api_key = env_openai_api_key or yaml_config.get("ai_config", {}).get(
        "openai_api_key"
    )
    chromadb_separate = env_chromadb_separate or yaml_config.get("ai_config", {}).get(
        "chromadb_config", {}
    ).get("isSeparateDatabaseEnabled")
    chromadb_host = env_chromadb_host or yaml_config.get("ai_config", {}).get(
        "chromadb_config", {}
    ).get("db_host")
    chromadb_port = int(
        env_chromadb_port
        or yaml_config.get("ai_config", {}).get("chromadb_config", {}).get("db_port")
        or 8000
    )

    # Redis config
    env_redis_connection_string = os.environ.get("PLATFORM_REDIS_CONNECTION_STRING")
    redis_connection_string = env_redis_connection_string or yaml_config.get(
        "redis_config", {}
    ).get("redis_connection_string")

    # Mailing config
    env_resend_api_key = os.environ.get("PLATFORM_RESEND_API_KEY")
    env_system_email_address = os.environ.get("PLATFORM_SYSTEM_EMAIL_ADDRESS")
    resend_api_key = env_resend_api_key or yaml_config.get("mailing_config", {}).get(
        "resend_api_key"
    )
    system_email_address = env_system_email_address or yaml_config.get(
        "mailing_config", {}
    ).get("system_email_address")

    # Payments config
    env_stripe_secret_key = os.environ.get("PLATFORM_STRIPE_SECRET_KEY")
    env_stripe_publishable_key = os.environ.get("PLATFORM_STRIPE_PUBLISHABLE_KEY")
    env_stripe_webhook_standard_secret = os.environ.get(
        "PLATFORM_STRIPE_WEBHOOK_STANDARD_SECRET"
    )
    env_stripe_webhook_connect_secret = os.environ.get(
        "PLATFORM_STRIPE_WEBHOOK_CONNECT_SECRET"
    )
    env_stripe_client_id = os.environ.get("PLATFORM_STRIPE_CLIENT_ID")

    stripe_secret_key = env_stripe_secret_key or yaml_config.get(
        "payments_config", {}
    ).get("stripe", {}).get("stripe_secret_key")

    stripe_publishable_key = env_stripe_publishable_key or yaml_config.get(
        "payments_config", {}
    ).get("stripe", {}).get("stripe_publishable_key")

    stripe_webhook_standard_secret = (
        env_stripe_webhook_standard_secret
        or yaml_config.get("payments_config", {})
        .get("stripe", {})
        .get("stripe_webhook_standard_secret")
    )

    stripe_webhook_connect_secret = (
        env_stripe_webhook_connect_secret
        or yaml_config.get("payments_config", {})
        .get("stripe", {})
        .get("stripe_webhook_connect_secret")
    )

    stripe_client_id = env_stripe_client_id or yaml_config.get(
        "payments_config", {}
    ).get("stripe", {}).get("stripe_client_id")

    # Create HostingConfig and DatabaseConfig objects
    hosting_config = HostingConfig(
        domain=domain,
        ssl=bool(ssl),
        port=int(port),
        use_default_org=bool(use_default_org),
        allowed_origins=list(allowed_origins),
        allowed_regexp=allowed_regexp,
        self_hosted=bool(self_hosted),
        cookie_config=cookie_config,
    )
    database_config = DatabaseConfig(
        sql_connection_string=sql_connection_string,
    )

    # AI Config
    ai_config = AIConfig(
        openai_api_key=openai_api_key,
        chromadb_config=ChromaDBConfig(
            isSeparateDatabaseEnabled=bool(chromadb_separate),
            db_host=chromadb_host,
            db_port=chromadb_port,
        ),
    )

    # Create PlatformConfig object
    return PlatformConfig(
        site_description=site_description,
        contact_email=contact_email,
        general_config=GeneralConfig(
            development_mode=bool(development_mode),
            logfire_enabled=bool(logfire_enabled),
            timezone=timezone,
        ),
        hosting_config=hosting_config,
        database_config=database_config,
        security_config=SecurityConfig(auth_jwt_secret_key=auth_jwt_secret_key),
        rbac_config=RBACConfig(
            audit_logging_enabled=bool(audit_logging_enabled),
            cache_enabled=bool(cache_enabled),
            cache_ttl_seconds=int(cache_ttl_seconds),
        ),
        ai_config=ai_config,
        redis_config=RedisConfig(redis_connection_string=redis_connection_string),
        mailing_config=MailingConfig(
            resend_api_key=resend_api_key, system_email_address=system_email_address
        ),
        payments_config=InternalPaymentsConfig(
            stripe=InternalStripeConfig(
                stripe_secret_key=stripe_secret_key,
                stripe_publishable_key=stripe_publishable_key,
                stripe_webhook_standard_secret=stripe_webhook_standard_secret,
                stripe_webhook_connect_secret=stripe_webhook_connect_secret,
                stripe_client_id=stripe_client_id,
            )
        ),
    )


def reload_platform_config_cache() -> None:
    """Clear cached platform configuration (mainly for tests or reloads)."""
    get_platform_config.cache_clear()
