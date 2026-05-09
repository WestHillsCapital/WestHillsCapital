"""Packages resource — list and retrieve Docuplete packages."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from ..client import DocupleteClient
from .sessions import _snake


class PackagesResource:
    """
    Access via ``client.packages``.

    Example
    -------
    >>> packages = client.packages.list()
    >>> for pkg in packages:
    ...     print(pkg["id"], pkg["name"])
    """

    def __init__(self, client: DocupleteClient) -> None:
        self._client = client

    def list(self) -> List[Dict[str, Any]]:
        """
        List all active packages for your organisation.

        Returns
        -------
        list[dict]
            Each dict contains ``id``, ``name``, ``created_at``, and metadata.

        Example
        -------
        >>> packages = client.packages.list()
        >>> package_id = packages[0]["id"]
        """
        data = self._client.get("/packages")
        result = data if isinstance(data, list) else data.get("packages", data)
        return [_snake(p) for p in result]

    def get(self, package_id: int) -> Dict[str, Any]:
        """
        Retrieve a single package by ID.

        Parameters
        ----------
        package_id : int
            Numeric package ID.

        Example
        -------
        >>> pkg = client.packages.get(42)
        >>> print(pkg["name"], pkg["id"])
        """
        data = self._client.get(f"/packages/{package_id}")
        pkg = data.get("package", data)
        return _snake(pkg)
