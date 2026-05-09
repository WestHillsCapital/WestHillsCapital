"""Docuplete SDK exceptions."""
from __future__ import annotations

from typing import List, Optional


class DocupleteError(Exception):
    """
    Raised when the Docuplete API returns an error response.

    Attributes
    ----------
    message : str
        Human-readable error description.
    status : int
        HTTP status code (0 for network errors).
    code : str
        Machine-readable error code, e.g. ``"package_not_found"``.
    issues : list[str] or None
        Field-level validation errors, when present.

    Example
    -------
    >>> try:
    ...     result = client.sessions.create(package_id=999, prefill={})
    ... except DocupleteError as e:
    ...     print(e.status, e.code)  # 404 package_not_found
    """

    def __init__(
        self,
        message: str,
        status: int,
        code: str = "api_error",
        issues: Optional[List[str]] = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.issues = issues or []

    def __repr__(self) -> str:
        return (
            f"DocupleteError(status={self.status!r}, code={self.code!r}, "
            f"message={str(self)!r})"
        )
