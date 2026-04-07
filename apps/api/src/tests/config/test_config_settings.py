import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from config.config import (
    AIConfig,
    CookieConfig,
    DatabaseConfig,
    GeneralConfig,
    HostingConfig,
    InternalPaymentsConfig,
    MailingConfig,
    PlatformConfig,
    RedisConfig,
    SecurityConfig,
)


def test_hosting_config_parses_comma_separated_origins(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PLATFORM_DOMAIN", "example.com")
    monkeypatch.setenv(
        "PLATFORM_ALLOWED_ORIGINS",
        " https://one.example , https://two.example ",
    )
    monkeypatch.setenv("PLATFORM_COOKIE_DOMAIN", ".example.com")
    monkeypatch.setenv("PLATFORM_ALLOWED_REGEXP", r"^https?://example\.com$")

    cfg = HostingConfig(_env_file=None)

    assert cfg.allowed_origins == ["https://one.example", "https://two.example"]
    assert cfg.cookie_config.domain == "example.com"


def _generate_test_public_key() -> str:
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return public_pem.decode('utf-8')


def test_platform_config_accepts_public_key_only_security_config() -> None:
    PlatformConfig(
        general_config=GeneralConfig.model_construct(
            development_mode=False,
            logfire_enabled=False,
            timezone="UTC",
        ),
        hosting_config=HostingConfig.model_construct(
            domain="example.com",
            ssl=True,
            port=9000,
            allowed_origins=["https://example.com"],
            allowed_regexp=r"^https?://example\.com$",
            cookie_config=CookieConfig(domain="example.com"),
            cookie_domain=None,
        ),
        database_config=DatabaseConfig.model_construct(
            sql_connection_string="postgresql+psycopg://openu:openu@db:5432/openu"
        ),
        redis_config=RedisConfig.model_construct(
            redis_connection_string="redis://redis:6379/0"
        ),
        security_config=SecurityConfig.model_construct(
            auth_ed25519_private_key=None,
            auth_ed25519_public_key=_generate_test_public_key(),
        ),
        ai_config=AIConfig(),
        mailing_config=MailingConfig.model_construct(
            resend_api_key=None,
            system_email_address=None,
        ),
        payments_config=InternalPaymentsConfig(),
    )


def test_security_config_requires_key_material() -> None:
    with pytest.raises(ValueError, match="At least one of PLATFORM_AUTH_ED25519_PRIVATE_KEY"):
        SecurityConfig.model_validate(
            {
                "PLATFORM_AUTH_ED25519_PRIVATE_KEY": None,
                "PLATFORM_AUTH_ED25519_PUBLIC_KEY": None,
            }
        )
