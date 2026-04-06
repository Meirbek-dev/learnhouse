"""Ed25519 key management and JWKS support.

Keys are loaded from base64-encoded PEM environment variables:
  PLATFORM_AUTH_ED25519_PRIVATE_KEY  – required by the auth service
  PLATFORM_AUTH_ED25519_PUBLIC_KEY   – required by any service that verifies tokens

Generate a key pair once:
  python -c "
  from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
  from cryptography.hazmat.primitives import serialization
  import base64
  priv = Ed25519PrivateKey.generate()
  pub  = priv.public_key()
  priv_pem = priv.private_bytes(serialization.Encoding.PEM,
      serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
  pub_pem  = pub.public_bytes(serialization.Encoding.PEM,
      serialization.PublicFormat.SubjectPublicKeyInfo)
  print('PRIVATE:', base64.b64encode(priv_pem).decode())
  print('PUBLIC: ', base64.b64encode(pub_pem).decode())
  "
"""

import base64
from functools import lru_cache
from typing import Any

from authlib.jose import OKPKey


def _pem_from_env(env_var: str) -> bytes:
    raw = __import__("os").environ.get(env_var, "")
    if not raw:
        raise RuntimeError(f"{env_var} is not set")
    try:
        return base64.b64decode(raw)
    except Exception as exc:
        raise RuntimeError(f"{env_var} is not valid base64") from exc


@lru_cache(maxsize=1)
def get_private_key() -> OKPKey:
    """Return the Ed25519 private key (used only by the auth service to sign tokens)."""
    pem = _pem_from_env("PLATFORM_AUTH_ED25519_PRIVATE_KEY")
    return OKPKey.import_key(pem)


@lru_cache(maxsize=1)
def get_public_key() -> OKPKey:
    """Return the Ed25519 public key (used to verify tokens, safe to distribute)."""
    raw = __import__("os").environ.get("PLATFORM_AUTH_ED25519_PUBLIC_KEY", "")
    if raw:
        pem = base64.b64decode(raw)
        return OKPKey.import_key(pem)
    # Derive from private key when public key var is not set
    priv = get_private_key()
    return priv.public_key


def get_jwks() -> dict[str, Any]:
    """Return the public key in JWKS format for the /.well-known/jwks.json endpoint."""
    pub = get_public_key()
    jwk = pub.as_dict(is_private=False)
    jwk["use"] = "sig"
    jwk["alg"] = "EdDSA"
    jwk["kid"] = "v1"
    return {"keys": [jwk]}


def reload_key_cache() -> None:
    """Clear cached keys (for testing / key rotation)."""
    get_private_key.cache_clear()
    get_public_key.cache_clear()
