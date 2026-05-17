"""Account resource — retrieve the authenticated account's profile."""
from __future__ import annotations

from typing import Any, Dict

from ..client import DocupleteClient


class AccountResource:
    """
    Access via ``client.account``.

    Example
    -------
    >>> acct = client.account.get()
    >>> print(acct["account_name"], acct["role"])
    """

    def __init__(self, client: DocupleteClient) -> None:
        self._client = client

    def get(self) -> Dict[str, Any]:
        """
        Return profile information for the authenticated account.

        Returns
        -------
        dict
            Keys: ``account_id`` (int), ``account_name`` (str), ``slug`` (str),
            ``email`` (str | None), ``role`` (``"admin"`` | ``"member"``).

        Example
        -------
        >>> acct = client.account.get()
        >>> print(acct["account_id"], acct["account_name"])
        >>> if acct["role"] == "admin":
        ...     print("Has admin access")
        """
        data = self._client.get("/product/auth/me")
        role = data.get("role", "member")
        if role not in ("admin", "member"):
            role = "member"
        return {
            "account_id":   data.get("accountId"),
            "account_name": data.get("accountName"),
            "slug":         data.get("slug"),
            "email":        data.get("email"),
            "role":         role,
        }
