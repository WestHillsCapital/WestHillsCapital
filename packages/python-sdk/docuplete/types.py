"""
All typed data structures for the Docuplete Python SDK.

TypedDicts are used throughout for compatibility with Python 3.8+
and to provide dict-style access alongside attribute access.
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union
from typing_extensions import TypedDict, Required

# ── Common ────────────────────────────────────────────────────────────────────

SessionStatus = Literal[
    "draft", "pending", "in_progress", "submitted",
    "signed", "generated", "voided", "expired",
]

SupportedLocale = Literal[
    "en", "es", "fr", "de", "pt", "zh", "ja", "ko", "ar",
]


# ── Session creation ──────────────────────────────────────────────────────────

class SessionSigner(TypedDict, total=False):
    """A signer in a multi-party sequential signing workflow."""
    email: Required[str]
    name: str
    order: int


class RemindersConfig(TypedDict):
    enabled: bool
    interval_days: int


class CreateSessionParams(TypedDict, total=False):
    """Parameters for ``sessions.create()``."""
    package_id: Required[int]
    prefill: Dict[str, str]
    link_expiry_days: Optional[int]
    locale: SupportedLocale
    reminders: RemindersConfig
    signers: List[SessionSigner]


class CreateSessionResult(TypedDict):
    session_token: str
    interview_url: str
    expires_at: Optional[str]


# ── Bulk session creation ─────────────────────────────────────────────────────

class BulkCreateSessionItem(TypedDict, total=False):
    package_id: Required[int]
    prefill: Dict[str, str]
    link_expiry_days: Optional[int]
    locale: SupportedLocale
    reminders: RemindersConfig
    signers: List[SessionSigner]


class BulkCreateSessionResultItem(TypedDict, total=False):
    index: Required[int]
    ok: Required[bool]
    session_token: str
    interview_url: str
    expires_at: Optional[str]
    error: str


class BulkCreateSessionResult(TypedDict):
    results: List[BulkCreateSessionResultItem]
    total: int
    succeeded: int
    failed: int


# ── Session list ──────────────────────────────────────────────────────────────

class ListSessionsParams(TypedDict, total=False):
    package_id: int
    status: SessionStatus
    limit: int
    offset: int
    updated_after: str
    search: str


class SessionListItem(TypedDict, total=False):
    id: int
    token: str
    package_id: int
    package_name: str
    status: SessionStatus
    source: str
    prefill: Dict[str, Any]
    locale: str
    test_mode: bool
    created_at: str
    updated_at: str
    expires_at: Optional[str]
    submitted_at: Optional[str]
    voided_at: Optional[str]


class ListSessionsResult(TypedDict):
    sessions: List[SessionListItem]
    total: int
    limit: int
    offset: int


class Session(TypedDict, total=False):
    id: int
    token: str
    package_id: int
    package_name: str
    status: SessionStatus
    answers: Dict[str, Any]
    prefill: Dict[str, Any]
    expires_at: str
    created_at: str
    updated_at: str


# ── PDF generation ────────────────────────────────────────────────────────────

class GenerateSessionPending(TypedDict):
    status: Literal["pending"]
    job_id: str


class GenerateSessionPacket(TypedDict):
    token: str
    status: str
    byte_size: int


class GenerateSessionReady(TypedDict):
    status: Literal["generated"]
    packet: GenerateSessionPacket
    download_url: str


GenerateSessionResult = Union[GenerateSessionPending, GenerateSessionReady]


class GenerateStatusResult(TypedDict, total=False):
    status: Required[Literal["pending", "processing", "ready", "failed"]]
    download_url: str
    error: str


# ── Audit log ─────────────────────────────────────────────────────────────────

class AuditLogEntry(TypedDict, total=False):
    id: Required[int]
    event: Required[str]
    actor_type: Required[str]
    actor_email: Optional[str]
    actor_ip: Optional[str]
    metadata: Dict[str, Any]
    created_at: Required[str]


class AuditLogResult(TypedDict):
    token: str
    entries: List[AuditLogEntry]
    total: int


# ── Multi-party signing ───────────────────────────────────────────────────────

class SessionSignerStatus(TypedDict, total=False):
    id: Required[int]
    order: Required[int]
    email: Required[str]
    name: Optional[str]
    status: Required[str]
    signer_token: Required[str]
    notified_at: Optional[str]
    signed_at: Optional[str]
    declined_at: Optional[str]
    declined_reason: Optional[str]
    created_at: Required[str]


class SessionSignersResult(TypedDict):
    token: str
    signers: List[SessionSignerStatus]
    all_signed: bool


# ── Custom domain ─────────────────────────────────────────────────────────────

class CustomDomainStatus(TypedDict, total=False):
    domain: Optional[str]
    status: Required[str]
    verified_at: Optional[str]
    cname_target: Required[str]
    instructions: Optional[str]


# ── Send link / void ──────────────────────────────────────────────────────────

class SendLinkParams(TypedDict, total=False):
    recipient_email: Required[str]
    recipient_name: str
    custom_message: str


class VoidSessionParams(TypedDict, total=False):
    reason: str
    notify_signer: bool


class VoidSessionResult(TypedDict):
    ok: bool
    token: str
    voided_at: str


# ── Sandbox ───────────────────────────────────────────────────────────────────

class SandboxStartParams(TypedDict, total=False):
    first_name: str
    last_name: str
    email: str
    date_of_birth: str
    address_line1: str
    city: str
    state: str
    zip: str


class SandboxStartResult(TypedDict):
    session_token: str
    interview_url: str
    prefill: Dict[str, str]
    expires_at: str


# ── Webhook payloads ──────────────────────────────────────────────────────────

class BaseWebhookPayload(TypedDict):
    event: str
    package_id: int
    package_name: str
    session_token: str


class SessionCreatedPayload(BaseWebhookPayload):
    event: Literal["session.created"]
    created_at: str
    prefill: Dict[str, Any]
    expires_at: Optional[str]
    source: str


class SessionViewedPayload(BaseWebhookPayload):
    event: Literal["session.viewed"]
    viewed_at: str
    prefill: Dict[str, Any]


class SessionStartedPayload(BaseWebhookPayload):
    event: Literal["session.started"]
    started_at: str
    prefill: Dict[str, Any]


class SessionSubmittedPayload(BaseWebhookPayload):
    event: Literal["session.submitted"]
    submitted_at: str
    prefill: Dict[str, Any]
    answers: Dict[str, Any]


class PdfGeneratedPayload(BaseWebhookPayload):
    event: Literal["pdf.generated"]
    generated_at: str
    prefill: Dict[str, Any]
    answers: Dict[str, Any]
    download_url: Optional[str]


class SessionVoidedPayload(BaseWebhookPayload):
    event: Literal["session.voided"]
    voided_at: str
    reason: Optional[str]
    prefill: Dict[str, Any]


class SessionExpiredPayload(BaseWebhookPayload):
    event: Literal["session.expired"]
    expired_at: str
    prefill: Dict[str, Any]


class SignerCompletedPayload(BaseWebhookPayload):
    event: Literal["signer.completed"]
    signed_at: str
    signer_order: int
    signer_email: str
    signer_name: Optional[str]
    all_signed: bool


WebhookPayload = Union[
    SessionCreatedPayload,
    SessionViewedPayload,
    SessionStartedPayload,
    SessionSubmittedPayload,
    PdfGeneratedPayload,
    SessionVoidedPayload,
    SessionExpiredPayload,
    SignerCompletedPayload,
]
