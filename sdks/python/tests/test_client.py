"""Tests for the Docuplete client using respx (httpx mock transport)."""
import json

import httpx
import pytest
import respx

from docuplete import Docuplete, DocupleteError


BASE = "https://api.docuplete.com"


@pytest.fixture
def client():
    with respx.mock(base_url=BASE) as mock:
        c = Docuplete(api_key="dp_live_test", base_url=BASE)
        yield c, mock
        c.close()


class TestInit:
    def test_missing_api_key_raises(self) -> None:
        with pytest.raises(DocupleteError, match="api_key is required"):
            Docuplete(api_key="")

    def test_context_manager(self) -> None:
        with Docuplete(api_key="dp_live_test") as c:
            assert c.sessions is not None
            assert c.packages is not None


class TestSessionsCreate:
    def test_create_returns_snake_case(self, client) -> None:
        c, mock = client
        mock.post("/api/v1/sessions").mock(return_value=httpx.Response(201, json={
            "sessionToken": "df_abc123",
            "interviewUrl": "https://forms.docuplete.com/i/df_abc123",
            "expiresAt":    "2026-08-01T00:00:00Z",
        }))
        result = c.sessions.create(package_id=42)
        assert result["session_token"] == "df_abc123"
        assert result["interview_url"] == "https://forms.docuplete.com/i/df_abc123"
        assert result["expires_at"] == "2026-08-01T00:00:00Z"

    def test_create_sends_prefill(self, client) -> None:
        c, mock = client
        route = mock.post("/api/v1/sessions").mock(return_value=httpx.Response(201, json={
            "sessionToken": "df_abc",
            "interviewUrl": "https://forms.docuplete.com/i/df_abc",
            "expiresAt":    "2026-08-01T00:00:00Z",
        }))
        c.sessions.create(
            package_id=42,
            prefill={"first_name": "Jane"},
            link_expiry_days=7,
        )
        body = json.loads(route.calls[0].request.content)
        assert body["packageId"] == 42
        assert body["prefill"] == {"first_name": "Jane"}
        assert body["linkExpiryDays"] == 7

    def test_api_error_raises(self, client) -> None:
        c, mock = client
        mock.post("/api/v1/sessions").mock(return_value=httpx.Response(403, json={
            "error": "Forbidden",
            "code":  "unauthorized",
        }))
        with pytest.raises(DocupleteError) as exc_info:
            c.sessions.create(package_id=42)
        err = exc_info.value
        assert err.status == 403
        assert err.code == "unauthorized"


class TestSessionsGet:
    def test_get_converts_keys(self, client) -> None:
        c, mock = client
        mock.get("/api/v1/sessions/df_abc").mock(return_value=httpx.Response(200, json={
            "session": {
                "id": 1, "token": "df_abc", "packageId": 42, "packageName": "Intake",
                "status": "pending", "source": "api", "prefill": {}, "answers": {},
                "locale": "en", "testMode": False, "expiresAt": "2026-08-01T00:00:00Z",
                "createdAt": "2026-05-01T00:00:00Z", "updatedAt": "2026-05-01T00:00:00Z",
                "submittedAt": None, "voidedAt": None, "voidedReason": None,
                "linkEmailRecipient": None, "generatedPdfUrl": None,
                "signerName": None, "signerEmail": None, "signedAt": None,
                "batchRunId": None,
            }
        }))
        session = c.sessions.get("df_abc")
        assert session["token"] == "df_abc"
        assert session["package_id"] == 42
        assert session["package_name"] == "Intake"


class TestSessionsList:
    def test_list_returns_sessions(self, client) -> None:
        c, mock = client
        mock.get("/api/v1/sessions").mock(return_value=httpx.Response(200, json={
            "sessions": [{"id": 1, "token": "df_abc", "packageId": 1, "packageName": "P",
                          "status": "pending", "createdAt": "2026-05-01T00:00:00Z",
                          "updatedAt": "2026-05-01T00:00:00Z", "submittedAt": None,
                          "expiresAt": "2026-08-01T00:00:00Z"}],
            "total": 1, "limit": 50, "offset": 0,
        }))
        result = c.sessions.list()
        assert result["total"] == 1
        assert result["sessions"][0]["token"] == "df_abc"


class TestSessionsBulk:
    def test_bulk_create(self, client) -> None:
        c, mock = client
        mock.post("/api/v1/sessions/bulk").mock(return_value=httpx.Response(207, json={
            "results": [
                {"index": 0, "ok": True, "sessionToken": "df_1",
                 "interviewUrl": "https://forms.docuplete.com/i/df_1",
                 "expiresAt": "2026-08-01T00:00:00Z"},
            ],
            "total": 1, "succeeded": 1, "failed": 0,
        }))
        result = c.sessions.bulk_create([
            {"package_id": 42, "prefill": {"first_name": "Jane"}},
        ])
        assert result["succeeded"] == 1
        assert result["results"][0]["ok"] is True
        assert result["results"][0]["session_token"] == "df_1"


class TestWebhookVerification:
    def test_verify_only(self) -> None:
        import hashlib, hmac as _hmac
        secret = "whsec_test"
        body   = json.dumps({"event": "session.submitted"})
        sig    = "sha256=" + _hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()

        from docuplete import verify_webhook_signature
        assert verify_webhook_signature(body, sig, secret) is True
