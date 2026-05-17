from __future__ import annotations

from typing import Any, Dict, List, Optional

import httpx

from ._errors import DocupleteError


class SessionsResource:
    """Wraps all /api/v1/sessions endpoints."""

    def __init__(self, http: httpx.Client) -> None:
        self._http = http

    # ── helpers ───────────────────────────────────────────────────────────────

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        try:
            resp = self._http.request(method, path, **kwargs)
        except httpx.TimeoutException as exc:
            raise DocupleteError(f"Request timed out: {exc}", status=0, code="timeout") from exc
        except httpx.RequestError as exc:
            raise DocupleteError(f"Network error: {exc}", status=0, code="network_error") from exc

        if not resp.is_success:
            try:
                body = resp.json()
            except Exception:
                body = {}
            message = body.get("error") or resp.reason_phrase or "API error"
            code    = body.get("code") or ""
            issues  = body.get("issues") or []
            raise DocupleteError(message, status=resp.status_code, code=code, issues=issues)

        if resp.status_code == 204:
            return {}
        return resp.json()

    # ── create ────────────────────────────────────────────────────────────────

    def create(
        self,
        *,
        package_id: int,
        prefill: Optional[Dict[str, Any]] = None,
        link_expiry_days: Optional[int] = None,
        locale: Optional[str] = None,
        reminders: Optional[Dict[str, Any]] = None,
        signers: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Create a single headless interview session.

        Returns a dict with keys ``session_token``, ``interview_url``,
        and ``expires_at``.
        """
        body: Dict[str, Any] = {"packageId": package_id}
        if prefill is not None:
            body["prefill"] = prefill
        if link_expiry_days is not None:
            body["linkExpiryDays"] = link_expiry_days
        if locale is not None:
            body["locale"] = locale
        if reminders is not None:
            body["reminders"] = reminders
        if signers is not None:
            body["signers"] = signers

        data = self._request("POST", "/api/v1/sessions", json=body)
        return {
            "session_token": data.get("sessionToken"),
            "interview_url": data.get("interviewUrl"),
            "expires_at":    data.get("expiresAt"),
        }

    # ── get ───────────────────────────────────────────────────────────────────

    def get(self, token: str) -> Dict[str, Any]:
        """Fetch the current state of a session including answers."""
        data = self._request("GET", f"/api/v1/sessions/{token}")
        session = data.get("session", data)
        return _snake(session)

    # ── list ──────────────────────────────────────────────────────────────────

    def list(
        self,
        *,
        package_id: Optional[int] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        updated_after: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Return a paginated list of sessions.

        Returns a dict with keys ``sessions``, ``total``, ``limit``,
        and ``offset``.
        """
        params: Dict[str, Any] = {"limit": limit, "offset": offset}
        if package_id is not None:
            params["packageId"] = package_id
        if status is not None:
            params["status"] = status
        if updated_after is not None:
            params["updatedAfter"] = updated_after
        if search is not None:
            params["search"] = search

        data = self._request("GET", "/api/v1/sessions", params=params)
        sessions = [_snake(s) for s in data.get("sessions", [])]
        return {
            "sessions": sessions,
            "total":    data.get("total", len(sessions)),
            "limit":    data.get("limit", limit),
            "offset":   data.get("offset", offset),
        }

    # ── send_link ─────────────────────────────────────────────────────────────

    def send_link(
        self,
        token: str,
        *,
        recipient_email: str,
        recipient_name: str,
        custom_message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send (or resend) the interview link to a client by email."""
        body: Dict[str, Any] = {
            "recipientEmail": recipient_email,
            "recipientName":  recipient_name,
        }
        if custom_message is not None:
            body["customMessage"] = custom_message
        return self._request("POST", f"/api/v1/sessions/{token}/send-link", json=body)

    # ── void ──────────────────────────────────────────────────────────────────

    def void(
        self,
        token: str,
        *,
        reason: Optional[str] = None,
        notify_signer: bool = True,
    ) -> Dict[str, Any]:
        """Immediately invalidate the interview link.

        Returns a dict with key ``voided_at``.
        """
        body: Dict[str, Any] = {"notifySigner": notify_signer}
        if reason is not None:
            body["reason"] = reason
        data = self._request("POST", f"/api/v1/sessions/{token}/void", json=body)
        return _snake(data)

    # ── generate ──────────────────────────────────────────────────────────────

    def generate(self, token: str) -> Dict[str, Any]:
        """Trigger server-side PDF generation for a session.

        Returns a dict with ``status`` set to ``"generated"`` (synchronous,
        ``download_url`` is populated) or ``"pending"`` (async, use
        ``get_generate_status`` to poll).
        """
        data = self._request("POST", f"/api/v1/sessions/{token}/generate")
        return _snake(data)

    def get_generate_status(self, token: str, job_id: str) -> Dict[str, Any]:
        """Poll the status of an async PDF generation job.

        Returns a dict with ``status`` set to ``"pending"``, ``"ready"``,
        or ``"failed"``.
        """
        data = self._request(
            "GET",
            f"/api/v1/sessions/{token}/generate-status",
            params={"jobId": job_id},
        )
        return _snake(data)

    # ── bulk_create ───────────────────────────────────────────────────────────

    def bulk_create(self, sessions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create up to 100 sessions in a single request.

        Each item follows the same schema as :meth:`create`.  Partial
        failures do not abort the rest.  Always returns per-item results
        with an ``ok`` flag.
        """
        body = [_camel(s) for s in sessions]
        data = self._request("POST", "/api/v1/sessions/bulk", json={"sessions": body})
        results = [_snake(r) for r in data.get("results", [])]
        return {
            "results":   results,
            "total":     data.get("total", len(results)),
            "succeeded": data.get("succeeded", 0),
            "failed":    data.get("failed", 0),
        }

    # ── audit_log ─────────────────────────────────────────────────────────────

    def audit_log(self, token: str, *, limit: int = 200) -> Dict[str, Any]:
        """Return the immutable chronological audit trail for a session."""
        data = self._request(
            "GET",
            f"/api/v1/sessions/{token}/audit-log",
            params={"limit": limit},
        )
        entries = [_snake(e) for e in data.get("entries", [])]
        return {
            "token":   data.get("token", token),
            "entries": entries,
            "total":   data.get("total", len(entries)),
        }

    # ── signers ───────────────────────────────────────────────────────────────

    def signers(self, token: str) -> Dict[str, Any]:
        """Return the ordered list of signers for a multi-party signing session."""
        data = self._request("GET", f"/api/v1/sessions/{token}/signers")
        return {
            "token":      data.get("token", token),
            "signers":    [_snake(s) for s in data.get("signers", [])],
            "all_signed": data.get("allSigned", False),
        }


# ── key conversion helpers ────────────────────────────────────────────────────

def _to_snake(key: str) -> str:
    """Convert a single camelCase key to snake_case."""
    import re
    s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", key)
    s = re.sub(r"([a-z\d])([A-Z])", r"\1_\2", s)
    return s.lower()


def _snake(obj: Any) -> Any:
    """Recursively convert dict keys from camelCase to snake_case."""
    if isinstance(obj, dict):
        return {_to_snake(k): _snake(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_snake(i) for i in obj]
    return obj


def _to_camel(key: str) -> str:
    """Convert snake_case to camelCase."""
    parts = key.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


def _camel(obj: Any) -> Any:
    """Recursively convert dict keys from snake_case to camelCase."""
    if isinstance(obj, dict):
        return {_to_camel(k): _camel(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_camel(i) for i in obj]
    return obj
