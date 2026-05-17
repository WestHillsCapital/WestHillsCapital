"""
Docuplete Python SDK
====================

Official Python client for the Docuplete API.

Quick start::

    pip install docuplete

Basic usage::

    import os
    from docuplete import Docuplete

    client = Docuplete(api_key=os.environ["DOCUPLETE_API_KEY"])

    # Create a session
    result = client.sessions.create(
        package_id=42,
        prefill={
            "first_name": "Jane",
            "last_name":  "Smith",
            "email":      "jane@example.com",
        },
        link_expiry_days=14,
        reminders={"enabled": True, "interval_days": 3},
    )

    interview_url = result["interview_url"]
    # → send to your client via email, SMS, or redirect

Webhook verification::

    from docuplete import construct_webhook_event

    # In your Flask / Django / FastAPI handler:
    event = construct_webhook_event(
        raw_body,                               # raw request body string
        request.headers["X-Docuplete-Signature"],
        os.environ["DOCUPLETE_WEBHOOK_SECRET"],
    )

    if event["event"] == "pdf.generated":
        download_url = event["download_url"]

See https://docuplete.com/docuplete-docs/ for full API documentation.
"""
from __future__ import annotations

from typing import Optional

from .client import DocupleteClient
from .exceptions import DocupleteError
from .resources.account import AccountResource
from .resources.packages import PackagesResource
from .resources.sandbox import SandboxResource
from .resources.sessions import SessionsResource
from .webhooks import construct_webhook_event, verify_webhook_signature

__version__ = "0.1.0"
__all__ = [
    "Docuplete",
    "DocupleteError",
    "verify_webhook_signature",
    "construct_webhook_event",
]


class Docuplete:
    """
    The Docuplete API client.

    Parameters
    ----------
    api_key : str
        Your live API key (``dp_live_...``). Never commit this — use an
        environment variable.
    base_url : str, optional
        Override the API base URL. Defaults to ``https://api.docuplete.com``.
    timeout : float, optional
        Request timeout in seconds. Default: 30.

    Attributes
    ----------
    sessions : SessionsResource
        Create, list, manage, and audit sessions.
    packages : PackagesResource
        List, retrieve, and inspect webhook deliveries for packages.
    account : AccountResource
        Retrieve the authenticated account's profile.
    sandbox : SandboxResource
        Start a no-key-required demo interview session.

    Example
    -------
    >>> import os
    >>> from docuplete import Docuplete
    >>>
    >>> client = Docuplete(api_key=os.environ["DOCUPLETE_API_KEY"])
    >>>
    >>> # Create a session
    >>> result = client.sessions.create(
    ...     package_id=42,
    ...     prefill={"first_name": "Jane", "email": "jane@example.com"},
    ... )
    >>> print(result["interview_url"])
    >>>
    >>> # Bulk-create 50 sessions at once
    >>> bulk = client.sessions.bulk_create([
    ...     {"package_id": 42, "prefill": {"email": c["email"]}}
    ...     for c in contacts
    ... ])
    >>> for r in bulk["results"]:
    ...     if r["ok"]:
    ...         print("Created:", r["session_token"])
    >>>
    >>> # Check account profile
    >>> acct = client.account.get()
    >>> print(acct["account_name"], acct["role"])
    >>>
    >>> # Start a sandbox demo (no real account needed)
    >>> demo = client.sandbox.start(first_name="Jane", email="jane@example.com")
    >>> print(demo["interview_url"])
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.docuplete.com",
        timeout: float = 30.0,
    ) -> None:
        self._http = DocupleteClient(api_key=api_key, base_url=base_url, timeout=timeout)
        self.sessions = SessionsResource(self._http)
        self.packages = PackagesResource(self._http)
        self.account  = AccountResource(self._http)
        self.sandbox  = SandboxResource(self._http)

    def close(self) -> None:
        """Close the underlying HTTP connection pool."""
        self._http.close()

    def __enter__(self) -> "Docuplete":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
