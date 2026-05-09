"""Sessions resource — create, list, manage, and audit Docuplete sessions."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from ..client import DocupleteClient
from ..types import (
    AuditLogResult,
    BulkCreateSessionItem,
    BulkCreateSessionResult,
    CreateSessionResult,
    GenerateSessionResult,
    GenerateStatusResult,
    ListSessionsParams,
    ListSessionsResult,
    RemindersConfig,
    SendLinkParams,
    Session,
    SessionSignerStatus,
    SessionSignersResult,
    SessionSigner,
    SessionStatus,
    SupportedLocale,
    VoidSessionParams,
    VoidSessionResult,
)


class SessionsResource:
    """
    Access via ``client.sessions``.

    Example
    -------
    >>> from docuplete import Docuplete
    >>> client = Docuplete(api_key="dp_live_...")
    >>> result = client.sessions.create(
    ...     package_id=42,
    ...     prefill={"first_name": "Jane", "email": "jane@example.com"},
    ...     link_expiry_days=14,
    ... )
    >>> print(result["interview_url"])
    """

    def __init__(self, client: DocupleteClient) -> None:
        self._client = client

    def list(
        self,
        *,
        package_id: Optional[int] = None,
        status: Optional[SessionStatus] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        updated_after: Optional[str] = None,
        search: Optional[str] = None,
    ) -> ListSessionsResult:
        """
        List sessions for your account with optional filters.

        Returns sessions in descending ``created_at`` order.

        Parameters
        ----------
        package_id : int, optional
            Filter to sessions belonging to a specific package.
        status : str, optional
            Filter by session status: ``"pending"``, ``"submitted"``,
            ``"generated"``, ``"voided"``, etc.
        limit : int, optional
            Maximum results to return (default: 50, max: 200).
        offset : int, optional
            Number of results to skip for pagination.
        updated_after : str, optional
            ISO-8601 timestamp — return only sessions updated after this time.
        search : str, optional
            Full-text search across prefill values.

        Example
        -------
        >>> sessions = client.sessions.list(status="generated", limit=25)
        >>> for s in sessions["sessions"]:
        ...     print(s["token"], s["status"])
        """
        params: Dict[str, Any] = {
            "packageId":    package_id,
            "status":       status,
            "limit":        limit,
            "offset":       offset,
            "updatedAfter": updated_after,
            "search":       search,
        }
        data = self._client.get("/sessions", params=params)
        return _snake(data)  # type: ignore[return-value]

    def create(
        self,
        *,
        package_id: int,
        prefill: Optional[Dict[str, str]] = None,
        link_expiry_days: Optional[int] = None,
        locale: Optional[SupportedLocale] = None,
        reminders: Optional[RemindersConfig] = None,
        signers: Optional[List[SessionSigner]] = None,
    ) -> CreateSessionResult:
        """
        Create a new interview session via the headless API.

        Returns a ``session_token`` and a ready-to-use ``interview_url``
        to send or redirect your client to.

        Prefill values should use field **source keys** as keys
        (e.g. ``{"first_name": "Jane", "email": "jane@example.com"}``).

        Parameters
        ----------
        package_id : int
            ID of the active package to use for this session.
        prefill : dict, optional
            Map of field source key → string value.
        link_expiry_days : int or None, optional
            Days until the link expires (1–3650). Pass ``None`` for a link
            that never expires. Omit to use your organisation default.
        locale : str, optional
            Interview language: ``"en"``, ``"es"``, ``"fr"``, etc.
        reminders : dict, optional
            ``{"enabled": True, "interval_days": 3}``
        signers : list, optional
            List of ``{"email": ..., "name": ..., "order": ...}`` dicts for
            multi-party sequential signing. Maximum 10 signers.

        Returns
        -------
        dict
            ``{"session_token": "df_...", "interview_url": "https://...", "expires_at": ...}``

        Example
        -------
        >>> result = client.sessions.create(
        ...     package_id=42,
        ...     prefill={"first_name": "Jane", "last_name": "Smith", "email": "jane@acme.com"},
        ...     link_expiry_days=14,
        ...     reminders={"enabled": True, "interval_days": 3},
        ... )
        >>> interview_url = result["interview_url"]
        >>> # Send interview_url to your client via email, SMS, or redirect
        """
        body: Dict[str, Any] = {"packageId": package_id}
        if prefill is not None:
            body["prefill"] = _camel_prefill(prefill)
        if link_expiry_days is not None:
            body["linkExpiryDays"] = link_expiry_days
        if locale is not None:
            body["locale"] = locale
        if reminders is not None:
            body["reminders"] = {
                "enabled":      reminders["enabled"],
                "intervalDays": reminders["interval_days"],
            }
        if signers is not None:
            body["signers"] = [
                {
                    "email": s["email"],
                    **({"name": s["name"]} if "name" in s else {}),
                    **({"order": s["order"]} if "order" in s else {}),
                }
                for s in signers
            ]

        data = self._client.post("/sessions", body=body)
        return _snake(data)  # type: ignore[return-value]

    def bulk_create(
        self,
        sessions: List[BulkCreateSessionItem],
    ) -> BulkCreateSessionResult:
        """
        Create up to 100 sessions in a single request.

        Each item accepts the same parameters as :meth:`create`. Per-item
        failures do not abort the batch — check each result's ``ok`` field.

        Returns HTTP 207 Multi-Status regardless of individual outcomes.

        Parameters
        ----------
        sessions : list
            Up to 100 session creation items.

        Example
        -------
        >>> contacts = [{"email": "a@co.com"}, {"email": "b@co.com"}]
        >>> result = client.sessions.bulk_create([
        ...     {"package_id": 42, "prefill": {"email": c["email"]}}
        ...     for c in contacts
        ... ])
        >>> for r in result["results"]:
        ...     if r["ok"]:
        ...         print("Created:", r["session_token"])
        ...     else:
        ...         print("Failed item", r["index"], ":", r["error"])
        """
        items = []
        for item in sessions:
            camel: Dict[str, Any] = {"packageId": item["package_id"]}
            if "prefill" in item:
                camel["prefill"] = _camel_prefill(item["prefill"])
            if "link_expiry_days" in item:
                camel["linkExpiryDays"] = item["link_expiry_days"]
            if "locale" in item:
                camel["locale"] = item["locale"]
            if "reminders" in item:
                r = item["reminders"]
                camel["reminders"] = {"enabled": r["enabled"], "intervalDays": r["interval_days"]}
            if "signers" in item:
                camel["signers"] = [
                    {"email": s["email"], **({} if "name" not in s else {"name": s["name"]})}
                    for s in item["signers"]
                ]
            items.append(camel)

        data = self._client.post("/sessions/bulk", body={"sessions": items})
        return _snake(data)  # type: ignore[return-value]

    def get(self, token: str) -> Session:
        """
        Fetch the current state of a session by its token.

        Parameters
        ----------
        token : str
            The session token (``df_...``).

        Example
        -------
        >>> session = client.sessions.get("df_a1b2c3...")
        >>> print(session["status"])   # "generated"
        >>> print(session["answers"])  # {"first_name": "Jane", ...}
        """
        data = self._client.get(f"/sessions/{token}")
        return _snake(data.get("session", data))  # type: ignore[return-value]

    def audit_log(
        self,
        token: str,
        *,
        limit: Optional[int] = None,
    ) -> AuditLogResult:
        """
        Retrieve the full chronological audit trail for a session.

        Each entry records a discrete event — session created, link sent, first
        viewed, submitted, PDF generated, downloaded, voided, etc. — with the
        actor type, IP address, and a UTC timestamp.

        Entries are returned oldest-first and are immutable once written.

        Example
        -------
        >>> log = client.sessions.audit_log("df_a1b2c3...")
        >>> for entry in log["entries"]:
        ...     print(entry["event"], entry["created_at"], entry["actor_ip"])
        """
        params: Dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        data = self._client.get(f"/sessions/{token}/audit-log", params=params or None)
        return _snake(data)  # type: ignore[return-value]

    def signers(self, token: str) -> SessionSignersResult:
        """
        Return the ordered list of signers for a multi-party signing session.

        For sessions created with a ``signers`` list, this shows each signer's
        current status, their unique interview token, and timestamps.

        Example
        -------
        >>> result = client.sessions.signers("df_a1b2c3...")
        >>> for signer in result["signers"]:
        ...     print(signer["email"], signer["status"])
        """
        data = self._client.get(f"/sessions/{token}/signers")
        return _snake(data)  # type: ignore[return-value]

    def generate(self, token: str) -> GenerateSessionResult:
        """
        Trigger final PDF generation for a completed session.

        When the job is queued, returns ``{"status": "pending", "job_id": "..."}``.
        Poll :meth:`get_generate_status` until ``status == "ready"``.

        Example
        -------
        >>> import time
        >>> result = client.sessions.generate("df_a1b2c3...")
        >>> if result["status"] == "generated":
        ...     print("Ready:", result["download_url"])
        ... else:
        ...     while True:
        ...         time.sleep(2)
        ...         s = client.sessions.get_generate_status(token)
        ...         if s["status"] == "ready":
        ...             print(s["download_url"])
        ...             break
        """
        data = self._client.post(
            f"/product/docuplete/sessions/{token}/generate", body={}
        )
        return _snake(data)  # type: ignore[return-value]

    def get_generate_status(
        self,
        token: str,
        job_id: Optional[str] = None,
    ) -> GenerateStatusResult:
        """
        Poll the status of a background PDF generation job.

        Parameters
        ----------
        token : str
            Session token.
        job_id : str, optional
            Job ID returned by :meth:`generate`. Pass for faster lookup.
        """
        params: Dict[str, Any] = {}
        if job_id is not None:
            params["jobId"] = job_id
        data = self._client.get(
            f"/product/docuplete/sessions/{token}/generate-status",
            params=params or None,
        )
        return _snake(data)  # type: ignore[return-value]

    def send_link(
        self,
        token: str,
        *,
        recipient_email: str,
        recipient_name: Optional[str] = None,
        custom_message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Send (or re-send) the interview link email to a recipient.

        Example
        -------
        >>> client.sessions.send_link(
        ...     "df_a1b2c3...",
        ...     recipient_email="jane@example.com",
        ...     recipient_name="Jane Smith",
        ... )
        """
        body: Dict[str, Any] = {"recipientEmail": recipient_email}
        if recipient_name is not None:
            body["recipientName"] = recipient_name
        if custom_message is not None:
            body["customMessage"] = custom_message
        return self._client.post(  # type: ignore[return-value]
            f"/product/docuplete/sessions/{token}/send-link", body=body
        )

    def void(
        self,
        token: str,
        *,
        reason: Optional[str] = None,
        notify_signer: bool = False,
    ) -> VoidSessionResult:
        """
        Void a session, immediately invalidating its interview link.

        Voided sessions cannot be submitted. This action cannot be undone.

        Parameters
        ----------
        token : str
            Session token to void.
        reason : str, optional
            Reason for voiding — stored in the audit log.
        notify_signer : bool
            When ``True``, sends the signer an email notifying them the session
            was voided. Default: ``False``.

        Example
        -------
        >>> client.sessions.void("df_a1b2c3...", reason="Sent in error")
        """
        body: Dict[str, Any] = {"notifySigner": notify_signer}
        if reason is not None:
            body["reason"] = reason
        data = self._client.post(
            f"/product/docuplete/sessions/{token}/void", body=body
        )
        return _snake(data)  # type: ignore[return-value]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_snake(s: str) -> str:
    """Convert a camelCase string to snake_case."""
    import re
    s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", s)
    s = re.sub(r"([a-z\d])([A-Z])", r"\1_\2", s)
    return s.lower()


def _snake(obj: Any) -> Any:
    """Recursively convert all dict keys from camelCase to snake_case."""
    if isinstance(obj, dict):
        return {_to_snake(k): _snake(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_snake(item) for item in obj]
    return obj


def _camel_prefill(prefill: Dict[str, str]) -> Dict[str, str]:
    """
    Leave prefill keys as-is — they are field source keys defined by the user
    in the Docuplete dashboard and can be any case. Do not transform them.
    """
    return prefill
