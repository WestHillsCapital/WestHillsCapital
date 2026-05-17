from __future__ import annotations

from typing import Any, Dict, List

import httpx

from ._errors import DocupleteError
from ._sessions import _snake


class PackagesResource:
    """Wraps all /api/v1/packages endpoints."""

    def __init__(self, http: httpx.Client) -> None:
        self._http = http

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

    def list(self) -> List[Dict[str, Any]]:
        """Return all packages for the account."""
        data = self._request("GET", "/api/v1/packages")
        packages = data if isinstance(data, list) else data.get("packages", data)
        return [_snake(p) for p in packages]

    def get(self, package_id: int) -> Dict[str, Any]:
        """Fetch a single package by ID."""
        data = self._request("GET", f"/api/v1/packages/{package_id}")
        pkg = data.get("package", data)
        return _snake(pkg)
