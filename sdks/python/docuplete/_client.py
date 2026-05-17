from __future__ import annotations

from types import TracebackType
from typing import Optional, Type

import httpx

from ._errors import DocupleteError
from ._packages import PackagesResource
from ._sessions import SessionsResource

_DEFAULT_BASE_URL = "https://api.docuplete.com"
_DEFAULT_TIMEOUT  = 30.0


class Docuplete:
    """The official Python client for the Docuplete API.

    Usage::

        import os
        from docuplete import Docuplete

        client = Docuplete(api_key=os.environ["DOCUPLETE_API_KEY"])

        result = client.sessions.create(package_id=42)
        print(result["interview_url"])

    Or as a context manager (closes the connection pool on exit)::

        with Docuplete(api_key=os.environ["DOCUPLETE_API_KEY"]) as client:
            result = client.sessions.create(package_id=42)

    Args:
        api_key:  Your live Docuplete API key (``dp_live_…``).
        timeout:  Request timeout in seconds.  Default is 30.
        base_url: Override the API base URL — useful in tests.

    Raises:
        DocupleteError: On any API or network error.
    """

    def __init__(
        self,
        *,
        api_key: str,
        timeout: float = _DEFAULT_TIMEOUT,
        base_url: str = _DEFAULT_BASE_URL,
    ) -> None:
        if not api_key:
            raise DocupleteError(
                "api_key is required. Pass your Docuplete API key (dp_live_…).",
                code="missing_api_key",
            )

        self._http = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type":  "application/json",
                "User-Agent":    "docuplete-python/0.1.0",
            },
            timeout=timeout,
        )

        self.sessions = SessionsResource(self._http)
        self.packages = PackagesResource(self._http)

    # ── context manager ───────────────────────────────────────────────────────

    def __enter__(self) -> "Docuplete":
        return self

    def __exit__(
        self,
        exc_type:  Optional[Type[BaseException]],
        exc_val:   Optional[BaseException],
        exc_tb:    Optional[TracebackType],
    ) -> None:
        self.close()

    def close(self) -> None:
        """Close the underlying HTTP connection pool."""
        self._http.close()
