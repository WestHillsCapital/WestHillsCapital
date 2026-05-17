"""Tests for webhook signature verification."""
import hashlib
import hmac
import json

import pytest

from docuplete import construct_webhook_event, verify_webhook_signature


SECRET = "whsec_test_secret"


def _sign(body: str) -> str:
    return "sha256=" + hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()


class TestVerifyWebhookSignature:
    def test_valid_signature(self) -> None:
        body = json.dumps({"event": "session.submitted", "session_token": "df_abc"})
        sig  = _sign(body)
        assert verify_webhook_signature(body, sig, SECRET) is True

    def test_invalid_signature(self) -> None:
        body = json.dumps({"event": "session.submitted"})
        assert verify_webhook_signature(body, "sha256=deadbeef", SECRET) is False

    def test_tampered_body(self) -> None:
        body    = json.dumps({"event": "session.submitted"})
        sig     = _sign(body)
        tampered = json.dumps({"event": "session.voided"})
        assert verify_webhook_signature(tampered, sig, SECRET) is False

    def test_wrong_secret(self) -> None:
        body = json.dumps({"event": "session.submitted"})
        sig  = _sign(body)
        assert verify_webhook_signature(body, sig, "wrong_secret") is False

    def test_missing_prefix(self) -> None:
        body = json.dumps({"event": "session.submitted"})
        raw  = hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
        assert verify_webhook_signature(body, raw, SECRET) is False


class TestConstructWebhookEvent:
    def test_valid_event(self) -> None:
        payload = {"event": "session.submitted", "session_token": "df_abc", "answers": {}}
        body    = json.dumps(payload)
        sig     = _sign(body)
        event   = construct_webhook_event(body, sig, SECRET)
        assert event["event"] == "session.submitted"
        assert event["session_token"] == "df_abc"

    def test_invalid_signature_raises(self) -> None:
        body = json.dumps({"event": "session.submitted"})
        with pytest.raises(ValueError, match="Invalid webhook signature"):
            construct_webhook_event(body, "sha256=bad", SECRET)

    def test_invalid_json_raises(self) -> None:
        body = "not json {"
        sig  = _sign(body)
        with pytest.raises(ValueError, match="not valid JSON"):
            construct_webhook_event(body, sig, SECRET)
