from __future__ import annotations

from typing import List


class DocupleteError(Exception):
    """Raised on any API or network error from the Docuplete SDK."""

    def __init__(
        self,
        message: str,
        *,
        status: int = 0,
        code: str = "",
        issues: List[str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.issues: List[str] = issues or []

    def __str__(self) -> str:
        base = super().__str__()
        parts = [base]
        if self.status:
            parts.append(f"HTTP {self.status}")
        if self.code:
            parts.append(f"code={self.code!r}")
        return " — ".join(parts)
