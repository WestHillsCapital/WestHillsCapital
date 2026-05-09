"""
Webhook signature verification helpers.

Docuplete signs every outbound webhook delivery with a per-package HMAC-SHA256
secret. The signature is sent in the ``X-Docuplete-Signature`` header as::

    sha256=<hex-encoded-hmac>

Always verify the signature before processing the payload.

Example (Flask)::

    from flask import Flask, request
    from docuplete import construct_webhook_event, DocupleteError

    app = Flask(__name__)

    @app.post("/webhook/docuplete")
    def webhook():
        sig = request.headers.get("X-Docuplete-Signature", "")
        try:
            event = construct_webhook_event(
                request.get_data(as_text=True),
                sig,
                os.environ["DOCUPLETE_WEBHOOK_SECRET"],
            )
        except ValueError:
            return "Invalid signature", 401

        if event["event"] == "pdf.generated":
            print("PDF ready:", event["download_url"])

        return "", 200

Example (Django)::

    from django.http import HttpResponse
    from docuplete import construct_webhook_event

    def docuplete_webhook(request):
        sig = request.headers.get("X-Docuplete-Signature", "")
        try:
            event = construct_webhook_event(
                request.body.decode(),
                sig,
                settings.DOCUPLETE_WEBHOOK_SECRET,
            )
        except ValueError:
            return HttpResponse(status=401)
        ...
        return HttpResponse(status=200)
"""
from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any, Dict


def _compute_hmac(secret: str, payload: str) -> str:
    """Return the HMAC-SHA256 hex digest of *payload* using *secret*."""
    return hmac.new(
        secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_webhook_signature(
    raw_body: str,
    signature: str,
    secret: str,
) -> bool:
    """
    Verify the ``X-Docuplete-Signature`` header on an incoming webhook.

    Uses :func:`hmac.compare_digest` for a constant-time comparison that
    prevents timing attacks.

    Parameters
    ----------
    raw_body : str
        The raw request body string. **Do not** parse it as JSON first.
    signature : str
        The value of the ``X-Docuplete-Signature`` request header.
    secret : str
        Your package's webhook signing secret (``wh_...``).

    Returns
    -------
    bool
        ``True`` if the signature is valid, ``False`` otherwise.

    Example
    -------
    >>> valid = verify_webhook_signature(raw_body, sig, os.environ["WH_SECRET"])
    >>> if not valid:
    ...     return HttpResponse(status=401)
    """
    if not signature or not secret:
        return False
    expected = "sha256=" + _compute_hmac(secret, raw_body)
    return hmac.compare_digest(expected, signature.strip())


def construct_webhook_event(
    raw_body: str,
    signature: str,
    secret: str,
) -> Dict[str, Any]:
    """
    Parse and verify a webhook request in one step.

    Raises :class:`ValueError` if the signature is invalid.

    Parameters
    ----------
    raw_body : str
        The raw request body string. **Do not** parse it as JSON first.
    signature : str
        The value of the ``X-Docuplete-Signature`` request header.
    secret : str
        Your package's webhook signing secret (``wh_...``).

    Returns
    -------
    dict
        The parsed webhook payload. Inspect ``event["event"]`` to determine
        the event type.

    Raises
    ------
    ValueError
        If the signature is missing or does not match the expected value.

    Example
    -------
    >>> event = construct_webhook_event(raw_body, sig, secret)
    >>> if event["event"] == "pdf.generated":
    ...     print("PDF ready:", event["download_url"])
    """
    if not verify_webhook_signature(raw_body, signature, secret):
        raise ValueError("Invalid webhook signature")
    return json.loads(raw_body)  # type: ignore[no-any-return]
