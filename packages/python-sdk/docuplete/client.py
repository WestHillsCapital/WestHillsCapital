"""
Core HTTP client for the Docuplete Python SDK.
"""
from __future__ import annotations

import json
from typing import Any, Dict, Optional, Type, TypeVar

import httpx

from .exceptions import DocupleteError

T = TypeVar("T")

_DEFAULT_BASE_URL = "https://api.docuplete.com"
_SDK_VERSION = "0.1.0"
_DEFAULT_TIMEOUT = 30.0


class DocupleteClient:
    """
    Low-level HTTP client. You should use :class:`docuplete.Docuplete` instead,
    which attaches resource helpers (``sessions``, ``packages``, etc.).
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = _DEFAULT_BASE_URL,
        timeout: float = _DEFAULT_TIMEOUT,
        http_client: Optional[httpx.Client] = None,
    ) -> None:
        if not api_key:
            raise ValueError("Docuplete SDK: api_key is required")

        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._http = http_client or httpx.Client(
            timeout=timeout,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": f"docuplete-python/{_SDK_VERSION}",
                "Accept": "application/json",
            },
        )

    def close(self) -> None:
        """Close the underlying HTTP connection pool."""
        self._http.close()

    def __enter__(self) -> "DocupleteClient":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

    # ── Low-level request helpers ─────────────────────────────────────────────

    def _url(self, path: str) -> str:
        return f"{self._base_url}/api/v1{path}"

    def _raise_for_response(self, response: httpx.Response) -> None:
        if response.is_success:
            return
        message = f"Request failed with status {response.status_code}"
        code = "api_error"
        issues: list[str] = []
        try:
            body = response.json()
            if isinstance(body, dict):
                if body.get("error"):
                    message = body["error"]
                if body.get("code"):
                    code = body["code"]
                if body.get("issues"):
                    issues = body["issues"]
        except Exception:
            pass
        raise DocupleteError(message, response.status_code, code, issues or None)

    def request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        body: Optional[Any] = None,
    ) -> Any:
        """Make a raw HTTP request and return the parsed JSON response."""
        # Strip None values from query params
        clean_params = (
            {k: str(v) for k, v in params.items() if v is not None}
            if params
            else None
        )

        try:
            response = self._http.request(
                method=method,
                url=self._url(path),
                params=clean_params,
                content=json.dumps(body).encode() if body is not None else None,
            )
        except httpx.TimeoutException as exc:
            raise DocupleteError(
                f"Request timed out after {self._timeout}s",
                status=0,
                code="timeout",
            ) from exc
        except httpx.RequestError as exc:
            raise DocupleteError(
                f"Network error: {exc}",
                status=0,
                code="network_error",
            ) from exc

        self._raise_for_response(response)
        return response.json()

    def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        return self.request("GET", path, params=params)

    def post(self, path: str, body: Any = None) -> Any:
        return self.request("POST", path, body=body)

    def patch(self, path: str, body: Any = None) -> Any:
        return self.request("PATCH", path, body=body)

    def delete(self, path: str) -> Any:
        return self.request("DELETE", path)
