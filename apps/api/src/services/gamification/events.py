"""Event publisher abstraction for gamification domain.

Routers and services import `publisher` and call `publish_gamification_updated(org_id)`.
Default is NoopPublisher; can be swapped to HttpPublisher via DI or module config.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from urllib import request as _urlrequest
from urllib.error import URLError


class EventPublisher:
    def publish_gamification_updated(self, org_id: int) -> None:  # pragma: no cover
        raise NotImplementedError


class NoopPublisher(EventPublisher):
    def publish_gamification_updated(self, org_id: int) -> None:
        """Do nothing."""
        return


@dataclass
class HttpPublisher(EventPublisher):
    urls: list[str]
    timeout: float = 1.5

    def publish_gamification_updated(self, org_id: int) -> None:
        payload = json.dumps({"orgId": int(org_id)}).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        for url in self.urls:
            try:
                req = _urlrequest.Request(
                    url, data=payload, headers=headers, method="POST"
                )
                with _urlrequest.urlopen(req, timeout=self.timeout) as resp:  # noqa: S310
                    if 200 <= resp.status < 300:
                        return
            except (URLError, TimeoutError, Exception):
                continue
        return


# Default publisher instance used by services
# Enable HTTP revalidation if configured; otherwise fallback to NoopPublisher.
_urls_env = os.environ.get("GAMIFICATION_REVALIDATE_URLS")
if _urls_env:
    urls = [u.strip() for u in _urls_env.split(",") if u.strip()]
else:
    # Sensible defaults for local dev; can be overridden via env
    urls = [
        "http://localhost:8000/api/revalidate/gamification",
        "http://localhost/api/revalidate/gamification",
    ]

publisher: EventPublisher = HttpPublisher(
    urls=urls, timeout=float(os.environ.get("GAMIFICATION_REVALIDATE_TIMEOUT", "1.5"))
)
