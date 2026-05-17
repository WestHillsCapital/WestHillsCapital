"""Sandbox resource — start a no-key-required demo interview session."""
from __future__ import annotations

from typing import Any, Dict, Optional

from ..client import DocupleteClient
from .sessions import _snake


class SandboxResource:
    """
    Access via ``client.sandbox``.

    No API key enforcement — the sandbox endpoint is publicly accessible.
    Sandbox sessions are prefixed with ``df_sbx_`` and expire after 7 days.

    Example
    -------
    >>> result = client.sandbox.start(first_name="Jane", email="jane@example.com")
    >>> print(result["interview_url"])
    """

    def __init__(self, client: DocupleteClient) -> None:
        self._client = client

    def start(
        self,
        *,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        email: Optional[str] = None,
        date_of_birth: Optional[str] = None,
        address_line1: Optional[str] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        zip: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Start a public sandbox interview session backed by a demo package.

        All parameters are optional prefill values. The returned
        ``interview_url`` can be opened in a browser to try the demo interview
        without creating a real account or session.

        Parameters
        ----------
        first_name : str, optional
        last_name : str, optional
        email : str, optional
        date_of_birth : str, optional
            ISO 8601 date string, e.g. ``"1990-01-15"``.
        address_line1 : str, optional
        city : str, optional
        state : str, optional
            Two-letter state code, e.g. ``"CA"``.
        zip : str, optional

        Returns
        -------
        dict
            Keys: ``session_token`` (str), ``interview_url`` (str),
            ``expires_at`` (str).

        Example
        -------
        >>> result = client.sandbox.start(
        ...     first_name="Jane",
        ...     last_name="Smith",
        ...     email="jane@example.com",
        ... )
        >>> print(result["interview_url"])
        """
        params: Dict[str, Any] = {}
        if first_name is not None:    params["firstName"]    = first_name
        if last_name is not None:     params["lastName"]     = last_name
        if email is not None:         params["email"]        = email
        if date_of_birth is not None: params["dateOfBirth"]  = date_of_birth
        if address_line1 is not None: params["addressLine1"] = address_line1
        if city is not None:          params["city"]         = city
        if state is not None:         params["state"]        = state
        if zip is not None:           params["zip"]          = zip

        data = self._client.get("/sandbox/start", params or None)
        return _snake(data)
