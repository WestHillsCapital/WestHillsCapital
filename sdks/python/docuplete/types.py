"""TypedDicts for static analysis of Docuplete API responses.

All SDK methods return plain ``dict`` instances at runtime.  Import these
TypedDicts for IDE completions and mypy/pyright type checking only.
"""
from __future__ import annotations

import sys
from typing import Any, Dict, List, Optional

if sys.version_info >= (3, 11):
    from typing import NotRequired
else:
    try:
        from typing import NotRequired
    except ImportError:
        from typing_extensions import NotRequired

if sys.version_info >= (3, 8):
    from typing import Literal, TypedDict
else:
    from typing_extensions import Literal, TypedDict


# ── Status literals ──────────────────────────────────────────────────────────

SessionStatus = Literal["pending", "in_progress", "generated", "voided", "expired"]
SignerStatus   = Literal["pending", "notified", "signed", "declined"]


# ── Input helpers ─────────────────────────────────────────────────────────────

class RemindersConfig(TypedDict, total=False):
    enabled:       bool
    interval_days: int


class SessionSigner(TypedDict, total=False):
    order: int
    email: str
    name:  str


class BulkCreateSessionItem(TypedDict, total=False):
    package_id:       int
    prefill:          Dict[str, Any]
    link_expiry_days: int
    locale:           str
    reminders:        RemindersConfig
    signers:          List[SessionSigner]


# ── Session types ─────────────────────────────────────────────────────────────

class Session(TypedDict):
    id:                   int
    token:                str
    package_id:           int
    package_name:         str
    status:               SessionStatus
    source:               str
    prefill:              Dict[str, Any]
    answers:              Dict[str, Any]
    locale:               str
    test_mode:            bool
    expires_at:           str
    created_at:           str
    updated_at:           str
    submitted_at:         Optional[str]
    voided_at:            Optional[str]
    voided_reason:        Optional[str]
    link_email_recipient: Optional[str]
    generated_pdf_url:    Optional[str]
    signer_name:          Optional[str]
    signer_email:         Optional[str]
    signed_at:            Optional[str]
    batch_run_id:         Optional[str]


class SessionListItem(TypedDict):
    id:           int
    token:        str
    package_id:   int
    package_name: str
    status:       SessionStatus
    created_at:   str
    updated_at:   str
    submitted_at: Optional[str]
    expires_at:   str


class CreateSessionResult(TypedDict):
    session_token: str
    interview_url: str
    expires_at:    str


class ListSessionsResult(TypedDict):
    sessions: List[SessionListItem]
    total:    int
    limit:    int
    offset:   int


class VoidSessionResult(TypedDict):
    voided_at: str


class GenerateSessionResult(TypedDict):
    """
    When status == "generated" the PDF was produced synchronously and
    ``download_url`` is populated immediately.  When status == "pending"
    the job is queued; poll ``get_generate_status`` with ``job_id``.
    """
    status:       Literal["generated", "pending"]
    job_id:       NotRequired[str]
    download_url: NotRequired[str]


class GenerateStatusResult(TypedDict):
    status:       Literal["pending", "ready", "failed"]
    download_url: NotRequired[str]
    error:        NotRequired[str]


# ── Bulk session types ────────────────────────────────────────────────────────

class BulkCreateSessionResultItem(TypedDict):
    index:         int
    ok:            bool
    session_token: NotRequired[str]
    interview_url: NotRequired[str]
    expires_at:    NotRequired[str]
    error:         NotRequired[str]


class BulkCreateSessionResult(TypedDict):
    results:   List[BulkCreateSessionResultItem]
    total:     int
    succeeded: int
    failed:    int


# ── Audit log types ───────────────────────────────────────────────────────────

class AuditLogEntry(TypedDict):
    id:          int
    event:       str
    actor_type:  str
    actor_email: Optional[str]
    actor_ip:    Optional[str]
    metadata:    Dict[str, Any]
    created_at:  str


class AuditLogResult(TypedDict):
    token:   str
    entries: List[AuditLogEntry]
    total:   int


# ── Signers types ─────────────────────────────────────────────────────────────

class SessionSignerStatus(TypedDict):
    id:             int
    order:          int
    email:          str
    name:           Optional[str]
    status:         SignerStatus
    signer_token:   str
    notified_at:    Optional[str]
    signed_at:      Optional[str]
    declined_at:    Optional[str]
    declined_reason: Optional[str]
    created_at:     str


class SessionSignersResult(TypedDict):
    token:      str
    signers:    List[SessionSignerStatus]
    all_signed: bool


# ── Package types ─────────────────────────────────────────────────────────────

class Package(TypedDict):
    id:         int
    name:       str
    status:     str
    created_at: str
    updated_at: str


# ── Webhook payloads ──────────────────────────────────────────────────────────

class _WebhookBase(TypedDict):
    event:         str
    session_token: str
    package_id:    int
    account_id:    int
    created_at:    str


class SessionSubmittedPayload(_WebhookBase):
    answers: Dict[str, Any]


class PdfGeneratedPayload(_WebhookBase):
    download_url: str
    pdf_sha256:   str


WebhookPayload = Any
