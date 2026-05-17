from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any, Dict


def verify_webhook_signature(body: str, signature: str, secret: str) -> bool:
    """Return True if the X-Docuplete-Signature header is valid for *body*.

    Uses a timing-safe comparison (``hmac.compare_digest``) to prevent
    timing attacks.  Always pass the raw body string — do not parse it
    as JSON before calling this function.

    Args:
        body:       The raw request body as a string.
        signature:  The value of the ``X-Docuplete-Signature`` header.
        secret:     Your package's webhook signing secret.
    """
    expected = "sha256=" + hmac.new(
        secret.encode("utf-8"),
        body.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    try:
        return hmac.compare_digest(expected, signature)
    except (TypeError, ValueError):
        return False


def construct_webhook_event(
    body: str,
    signature: str,
    secret: str,
) -> Dict[str, Any]:
    """Verify *signature* and return the parsed webhook event payload.

    Raises:
        ValueError: If the signature is invalid.
        ValueError: If the body is not valid JSON.

    Args:
        body:       The raw request body as a string.
        signature:  The value of the ``X-Docuplete-Signature`` header.
        secret:     Your package's webhook signing secret.
    """
    if not verify_webhook_signature(body, signature, secret):
        raise ValueError("Invalid webhook signature.")
    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Webhook body is not valid JSON: {exc}") from exc
