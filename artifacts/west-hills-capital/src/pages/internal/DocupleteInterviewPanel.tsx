import React, { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/DocupletePanels";
import { PackagePickerWithTags } from "@/components/DocupleteWidgets";
import { validateFieldValue, fieldFormatHint } from "@/lib/validateField";
import { getDocupletePrefillDisplayValue } from "@/lib/docuplete-redaction";
import type { PackageItem } from "@/lib/docuplete-local-types";
import type { FieldItem } from "@/lib/docuplete-types";
import type { BuilderStep } from "@/components/PackagePickerSidebar";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

const SEMANTIC_PREFILL_LABELS: Record<string, string> = {
  "email": "email", "email address": "email", "client email": "email", "e-mail": "email", "e-mail address": "email",
  "first name": "firstName", "client first name": "firstName", "given name": "firstName",
  "last name": "lastName", "client last name": "lastName", "surname": "lastName", "family name": "lastName",
  "full name": "fullName", "name": "fullName", "client name": "fullName",
  "date of birth": "dateOfBirth", "client date of birth": "dateOfBirth", "dob": "dateOfBirth", "birth date": "dateOfBirth", "birthday": "dateOfBirth",
  "phone": "phone", "phone number": "phone", "mobile": "phone", "mobile number": "phone", "cell phone": "phone", "telephone": "phone",
  "address": "addressLine1", "street address": "addressLine1", "address line 1": "addressLine1", "address 1": "addressLine1", "client address": "addressLine1",
  "city": "city", "state": "state",
  "zip": "zip", "zip code": "zip", "postal code": "zip",
};

function interviewFieldValue(field: FieldItem, answers: Record<string, string>, prefill: Record<string, string> | undefined) {
  const labelKey = SEMANTIC_PREFILL_LABELS[(field.name ?? "").toLowerCase().trim()];
  const ciLookup = (key: string | undefined) => {
    if (!key || !prefill) return undefined;
    const lower = key.toLowerCase();
    const match = Object.keys(prefill).find((k) => k.toLowerCase() === lower);
    return match ? prefill[match] : undefined;
  };
  return String(
    answers[field.id]
    ?? (field.source ? prefill?.[field.source] : undefined)
    ?? prefill?.[field.name]
    ?? ciLookup(field.name)
    ?? (labelKey ? prefill?.[labelKey] : undefined)
    ?? field.defaultValue
    ?? "",
  );
}

function safeInterviewDisplayValue(field: FieldItem, value: string) {
  if (!value) return "";
  if (!field.sensitive) return value;
  const compact = value.replace(/\s+/g, "");
  return compact.length > 4 ? `••••${compact.slice(-4)}` : "••••";
}

export type InterviewSubTab = "interviews" | "dashboard";

type Session = {
  package_name: string;
  group_name?: string | null;
  custodian_name?: string | null;
  depository_name?: string | null;
  transaction_scope?: string | null;
  answers?: Record<string, string>;
  prefill?: Record<string, unknown>;
  generated_pdf_url?: string | null;
  fields: FieldItem[];
  status?: string;
};

type PortalSession = {
  token: string;
  package_name: string;
  signer_name?: string | null;
  signer_email?: string | null;
  link_email_recipient?: string | null;
  link_emailed_at?: string | null;
  submitted_at?: string | null;
  status: string;
  signing_scroll_required?: boolean | null;
  signing_scroll_confirmed_at?: string | null;
};

export interface DocupleteInterviewPanelProps {
  session: Session | null;
  isPublicSession: boolean;
  isSaving: boolean;
  activePackages: PackageItem[];
  packages: PackageItem[];
  standalonePackageId: string;
  setStandalonePackageId: React.Dispatch<React.SetStateAction<string>>;
  customerLinkPackageId: string;
  setCustomerLinkPackageId: React.Dispatch<React.SetStateAction<string>>;
  customerLinkFirstName: string;
  setCustomerLinkFirstName: React.Dispatch<React.SetStateAction<string>>;
  customerLinkLastName: string;
  setCustomerLinkLastName: React.Dispatch<React.SetStateAction<string>>;
  customerLinkEmail: string;
  setCustomerLinkEmail: React.Dispatch<React.SetStateAction<string>>;
  isGeneratingLink: boolean;
  generatedCustomerLink: string | null;
  generatedCustomerLinkToken: string | null;
  setGeneratedCustomerLink: (v: string | null) => void;
  setGeneratedCustomerLinkToken: (v: string | null) => void;
  linkCopied: boolean;
  linkEmailSent: string | null;
  setLinkEmailSent: (v: string | null) => void;
  showSendLinkForm: boolean;
  setShowSendLinkForm: React.Dispatch<React.SetStateAction<boolean>>;
  showRecipientOverride: boolean;
  setShowRecipientOverride: React.Dispatch<React.SetStateAction<boolean>>;
  sendLinkEmail: string;
  setSendLinkEmail: React.Dispatch<React.SetStateAction<string>>;
  sendLinkName: string;
  setSendLinkName: React.Dispatch<React.SetStateAction<string>>;
  sendLinkMessage: string;
  setSendLinkMessage: React.Dispatch<React.SetStateAction<string>>;
  linkEmailError: string | null;
  setLinkEmailError: (v: string | null) => void;
  isSendingLink: boolean;
  interviewSubTab: InterviewSubTab;
  setInterviewSubTab: React.Dispatch<React.SetStateAction<InterviewSubTab>>;
  portalSessions: PortalSession[];
  portalLoading: boolean;
  portalError: string | null;
  portalTotal: number;
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  fieldErrors: Record<string, string>;
  visibleInterviewFields: FieldItem[];
  missingRequiredFields: string[];
  answeredFieldCount: number;
  generatedUrl: string | null;
  driveUrl: string | null;
  driveWarnings: string[];
  isDownloading: boolean;
  docupleteApiPath: string;
  labelForTransactionScope: (scope: string | null | undefined) => string;
  fieldIsRequired: (f: { interviewMode?: string; required?: boolean; interviewVisible?: boolean }) => boolean;
  goBuilderStep: (step: BuilderStep) => void;
  setTab: React.Dispatch<React.SetStateAction<"packages" | "interview" | "mapper" | "csv" | "groups">>;
  launchStandaloneInterview: () => void;
  generateCustomerLink: () => void;
  copyCustomerLink: () => void;
  handleSendLinkByEmail: () => void | Promise<void>;
  saveAnswers: () => void;
  generatePacket: () => void;
  handleDownloadInterviewCsv: () => void;
  downloadGeneratedPacket: () => void;
  handleInterviewFieldBlur: (field: FieldItem, value: string) => void;
}

export const DocupleteInterviewPanel = React.memo(function DocupleteInterviewPanel(props: DocupleteInterviewPanelProps) {
  const {
    session, isPublicSession, isSaving, activePackages, packages,
    standalonePackageId, setStandalonePackageId,
    customerLinkPackageId, setCustomerLinkPackageId,
    customerLinkFirstName, setCustomerLinkFirstName,
    customerLinkLastName, setCustomerLinkLastName,
    customerLinkEmail, setCustomerLinkEmail,
    isGeneratingLink, generatedCustomerLink,
    setGeneratedCustomerLink, setGeneratedCustomerLinkToken,
    linkCopied, linkEmailSent, setLinkEmailSent,
    showSendLinkForm, setShowSendLinkForm,
    showRecipientOverride, setShowRecipientOverride,
    sendLinkEmail, setSendLinkEmail, sendLinkName, setSendLinkName,
    sendLinkMessage, setSendLinkMessage, linkEmailError, setLinkEmailError,
    isSendingLink, interviewSubTab, setInterviewSubTab,
    portalSessions, portalLoading, portalError, portalTotal,
    answers, setAnswers, fieldErrors, visibleInterviewFields,
    missingRequiredFields, answeredFieldCount,
    generatedUrl, driveUrl, driveWarnings, isDownloading, docupleteApiPath,
    labelForTransactionScope, fieldIsRequired,
    goBuilderStep, setTab, launchStandaloneInterview, generateCustomerLink,
    copyCustomerLink, handleSendLinkByEmail, saveAnswers, generatePacket,
    handleDownloadInterviewCsv, downloadGeneratedPacket, handleInterviewFieldBlur,
  } = props;

  return (
    <section className="bg-white border border-[#DDD5C4] rounded-lg max-w-4xl mx-auto overflow-hidden">
      {!session ? (
        isPublicSession ? <div className="p-5"><EmptyState message="This interview link is invalid or expired." /></div> : (
          <>
          <div className="flex border-b border-[#DDD5C4]">
            {(["interviews", "dashboard"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setInterviewSubTab(t)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  interviewSubTab === t
                    ? "border-[#0F1C3F] text-[#0F1C3F]"
                    : "border-transparent text-[#8A9BB8] hover:text-[#0F1C3F] hover:border-[#DDD5C4]"
                }`}
              >
                {t === "interviews" ? "Interviews" : "Interview Dashboard"}
              </button>
            ))}
          </div>
          {interviewSubTab === "interviews" && <div className="p-5 space-y-6">
            {(() => {
              const hasStaff = activePackages.some((p) => p.enable_interview);
              const hasCustomerLink = activePackages.some((p) => p.enable_customer_link);
              if (!hasStaff && !hasCustomerLink) {
                return (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-sm text-[#6B7A99]">No packages are ready for interviews yet.</p>
                    <Button onClick={() => { goBuilderStep("interview"); setTab("packages"); }} variant="outline">
                      Go to Package Builder →
                    </Button>
                  </div>
                );
              }
              return (
                <div className="space-y-5">
                  {hasStaff && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#0F1C3F] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                        <h3 className="text-sm font-semibold">Staff Interview</h3>
                        <span className="text-xs text-[#8A9BB8]">— walk a client through their paperwork</span>
                      </div>
                      <div className="space-y-2">
                        <PackagePickerWithTags
                          packages={activePackages.filter((p) => p.enable_interview)}
                          value={standalonePackageId}
                          onChange={setStandalonePackageId}
                          transactionLabel={labelForTransactionScope}
                        />
                        <Button onClick={launchStandaloneInterview} disabled={!standalonePackageId || isSaving}>{isSaving ? "Launching…" : "Start Interview"}</Button>
                      </div>
                    </div>
                  )}

                  {hasStaff && hasCustomerLink && <div className="border-t border-[#EFE8D8]" />}

                  {hasCustomerLink && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#0F1C3F] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                        <h3 className="text-sm font-semibold">Customer Link</h3>
                        <span className="text-xs text-[#8A9BB8]">— customer fills the form themselves</span>
                      </div>
                      <div className="space-y-2">
                        <PackagePickerWithTags
                          packages={activePackages.filter((p) => p.enable_customer_link)}
                          value={customerLinkPackageId}
                          onChange={(id) => { setCustomerLinkPackageId(id); setGeneratedCustomerLink(null); setGeneratedCustomerLinkToken(null); setLinkEmailSent(null); setShowSendLinkForm(false); }}
                          transactionLabel={labelForTransactionScope}
                        />
                        {customerLinkPackageId && activePackages.find((p) => String(p.id) === customerLinkPackageId)?.tags.includes("Demo") && (
                          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                            <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                            <p className="text-xs text-amber-800">
                              <strong>Demo package</strong> — this is the pre-loaded sample package for testing only. Remove the "Demo" tag or create a new package before sending links to real clients.
                            </p>
                          </div>
                        )}
                        <div className="grid sm:grid-cols-3 gap-2">
                          <Input placeholder="First name (optional)" value={customerLinkFirstName} onChange={(e) => setCustomerLinkFirstName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && customerLinkPackageId && !isGeneratingLink) generateCustomerLink(); }} className="text-sm" />
                          <Input placeholder="Last name (optional)" value={customerLinkLastName} onChange={(e) => setCustomerLinkLastName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && customerLinkPackageId && !isGeneratingLink) generateCustomerLink(); }} className="text-sm" />
                          <Input placeholder="Email (optional)" value={customerLinkEmail} onChange={(e) => setCustomerLinkEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && customerLinkPackageId && !isGeneratingLink) generateCustomerLink(); }} className="text-sm" />
                        </div>
                        <Button onClick={generateCustomerLink} disabled={!customerLinkPackageId || isGeneratingLink}>
                          {isGeneratingLink ? "Generating…" : "Generate Link"}
                        </Button>
                        {generatedCustomerLink && (
                          <div className="rounded border border-green-200 bg-green-50 p-3 space-y-2">
                            <div className="text-xs font-semibold text-green-800">Link ready</div>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-xs bg-white border border-green-200 rounded px-2 py-1.5 text-[#0F1C3F] break-all">{generatedCustomerLink}</code>
                              <button type="button" onClick={copyCustomerLink} className="shrink-0 text-xs border border-green-300 bg-white text-green-800 rounded px-3 py-1.5 hover:bg-green-100 transition-colors">
                                {linkCopied ? "Copied ✓" : "Copy"}
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => { setShowSendLinkForm((v) => { if (v) setShowRecipientOverride(false); return !v; }); setLinkEmailError(null); }}
                                className="text-xs border border-green-300 bg-white text-green-800 rounded px-3 py-1.5 hover:bg-green-100 transition-colors flex items-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                                {showSendLinkForm ? "Cancel" : "Send by email"}
                              </button>
                              {linkEmailSent && !showSendLinkForm && (
                                <span className="text-[11px] text-green-700">✓ Sent to {linkEmailSent}</span>
                              )}
                            </div>
                            {showSendLinkForm && (
                              <div className="border-t border-green-200 pt-2 space-y-2">
                                {sendLinkEmail.trim() && !showRecipientOverride ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-[#6B7A99]">To:</span>
                                    <span className="text-xs font-medium text-[#0F1C3F]">
                                      {sendLinkName.trim() ? `${sendLinkName.trim()} <${sendLinkEmail.trim()}>` : sendLinkEmail.trim()}
                                    </span>
                                    <button type="button" onClick={() => setShowRecipientOverride(true)} className="text-[11px] text-green-700 hover:underline ml-auto shrink-0">Change</button>
                                  </div>
                                ) : (
                                  <div className="grid sm:grid-cols-2 gap-2">
                                    <Input
                                      placeholder="Client email *"
                                      type="email"
                                      value={sendLinkEmail}
                                      onChange={(e) => setSendLinkEmail(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === "Enter" && sendLinkEmail.trim() && !isSendingLink) void handleSendLinkByEmail(); }}
                                      className="text-sm"
                                    />
                                    <Input
                                      placeholder="Client name (optional)"
                                      value={sendLinkName}
                                      onChange={(e) => setSendLinkName(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === "Enter" && sendLinkEmail.trim() && !isSendingLink) void handleSendLinkByEmail(); }}
                                      className="text-sm"
                                    />
                                  </div>
                                )}
                                <textarea
                                  placeholder="Add a personal message (optional)"
                                  value={sendLinkMessage}
                                  onChange={(e) => setSendLinkMessage(e.target.value)}
                                  rows={2}
                                  className="w-full text-sm border border-green-200 rounded px-2 py-1.5 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-green-400"
                                />
                                {linkEmailError && <p className="text-[11px] text-red-600">{linkEmailError}</p>}
                                <Button
                                  onClick={handleSendLinkByEmail}
                                  disabled={!sendLinkEmail.trim() || isSendingLink}
                                  className="text-xs h-8 px-4"
                                >
                                  {isSendingLink ? "Sending…" : "Send Email"}
                                </Button>
                              </div>
                            )}
                            <p className="text-[11px] text-green-700">Expires in 90 days. When the customer submits, you'll receive the completed packet.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>}
          {interviewSubTab === "dashboard" && (
            <div className="p-5 space-y-4">
              <div>
                <h2 className="text-base font-semibold">Interview Session History</h2>
                <p className="text-xs text-[#8A9BB8] mt-0.5">All customer-link and staff interview sessions. CSV batch sessions are tracked separately in the Batch CSV tab.</p>
              </div>
              {(() => {
                const total     = portalSessions.length;
                const sent      = portalSessions.filter((s) => s.link_emailed_at).length;
                const submitted = portalSessions.filter((s) => s.submitted_at || s.status === "generated" || s.status === "signed").length;
                const signed    = portalSessions.filter((s) => s.status === "signed" || s.status === "generated").length;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Total",     value: total,     cls: "text-[#0F1C3F]" },
                      { label: "Link Sent", value: sent,      cls: "text-blue-700" },
                      { label: "Submitted", value: submitted, cls: "text-violet-700" },
                      { label: "Completed", value: signed,    cls: "text-emerald-700" },
                    ].map(({ label, value, cls }) => (
                      <div key={label} className="rounded-lg border border-[#DDD5C4] bg-[#F8F6F0] px-4 py-3 text-center">
                        <div className={`text-2xl font-bold ${cls}`}>{value}</div>
                        <div className="text-xs text-[#8A9BB8] mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {portalLoading && (
                <div className="flex justify-center py-10">
                  <div className="w-5 h-5 border-2 border-[#0F1C3F] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {portalError && <div className="text-sm text-red-600">{portalError}</div>}
              {!portalLoading && !portalError && portalSessions.length === 0 && (
                <div className="text-center py-10 text-sm text-[#8A9BB8]">No interview sessions yet — start one from the Interviews tab.</div>
              )}
              {!portalLoading && portalSessions.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-[#DDD5C4]">
                  <table className="min-w-full divide-y divide-[#F0EDE6]">
                    <thead className="bg-[#F8F6F0]">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-[#8A9BB8] uppercase tracking-wide">Package</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-[#8A9BB8] uppercase tracking-wide">Recipient</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-[#8A9BB8] uppercase tracking-wide">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-[#8A9BB8] uppercase tracking-wide">PDF</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-[#8A9BB8] uppercase tracking-wide">Sent</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-[#8A9BB8] uppercase tracking-wide">Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0EDE6] bg-white">
                      {portalSessions.map((s) => {
                        const recipient = s.signer_name || s.link_email_recipient || s.signer_email || "—";
                        const statusMap: Record<string, { label: string; cls: string }> = {
                          draft:     { label: "Draft",     cls: "bg-gray-100 text-gray-500" },
                          generated: { label: "Completed", cls: "bg-emerald-50 text-emerald-700" },
                          signed:    { label: "Signed",    cls: "bg-emerald-50 text-emerald-700" },
                          submitted: { label: "Submitted", cls: "bg-violet-50 text-violet-700" },
                          voided:    { label: "Voided",    cls: "bg-red-50 text-red-600" },
                        };
                        const statusInfo = statusMap[s.status] ?? { label: s.status, cls: "bg-gray-100 text-gray-500" };
                        const pdfUrl = `${API_BASE}${docupleteApiPath}/sessions/${s.token}/packet.pdf`;
                        const isCompleted = s.status === "generated" || s.status === "signed";
                        const signingScrollRequired = s.signing_scroll_required === true;
                        const signingScrollConfirmed = signingScrollRequired && Boolean(s.signing_scroll_confirmed_at);
                        const isTerminal = s.status === "generated" || s.status === "signed" || s.status === "voided";
                        return (
                          <tr key={s.token} className="hover:bg-[#FAFAF8]">
                            <td className="px-4 py-2 text-xs text-[#0F1C3F] max-w-[160px] truncate" title={s.package_name}>{s.package_name}</td>
                            <td className="px-4 py-2 text-sm text-[#0F1C3F] max-w-[180px] truncate" title={recipient}>{recipient}</td>
                            <td className="px-4 py-2">
                              <div className="flex flex-col gap-1 items-start">
                                <span className={`inline-flex px-1.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.cls}`}>{statusInfo.label}</span>
                                {signingScrollRequired && signingScrollConfirmed && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                    Scroll confirmed
                                  </span>
                                )}
                                {signingScrollRequired && !signingScrollConfirmed && isTerminal && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                                    Scroll not confirmed
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              {isCompleted ? (
                                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#0F1C3F] underline underline-offset-2 hover:text-[#C49A38]">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                  PDF
                                </a>
                              ) : <span className="text-xs text-[#C0CBDA]">—</span>}
                            </td>
                            <td className="px-4 py-2 text-xs text-[#8A9BB8]">{s.link_emailed_at ? new Date(s.link_emailed_at).toLocaleDateString() : "—"}</td>
                            <td className="px-4 py-2 text-xs">
                              {s.submitted_at
                                ? <span className="text-violet-700 font-medium">{new Date(s.submitted_at).toLocaleDateString()}</span>
                                : isCompleted
                                  ? <span className="text-emerald-600 font-medium">Submitted</span>
                                  : <span className="text-[#C0CBDA]">Pending</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {portalTotal > portalSessions.length && (
                    <div className="px-4 py-2 text-xs text-[#8A9BB8] text-center border-t border-[#F0EDE6]">Showing {portalSessions.length} of {portalTotal} sessions</div>
                  )}
                </div>
              )}
            </div>
          )}
          </>
        )
      ) : (
        <div className="p-5 space-y-5">
          <div>
            <h2 className="text-xl font-semibold">{session.package_name}</h2>
            <p className="text-sm text-[#6B7A99]">
              {[session.group_name, session.custodian_name, session.depository_name, labelForTransactionScope(session.transaction_scope)].filter(Boolean).join(" · ") || "No additional info"}
            </p>
            <p className="text-xs text-[#8A9BB8] mt-1">{answeredFieldCount} of {visibleInterviewFields.length} interview fields answered. Your progress is saved when you click Save Interview.</p>
          </div>
          {missingRequiredFields.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-semibold mb-1">Missing required fields</div>
              <div className="flex flex-wrap gap-1">
                {missingRequiredFields.map((name) => <span key={name} className="rounded bg-white border border-amber-200 px-2 py-0.5 text-xs">{name}</span>)}
              </div>
            </div>
          )}
          <div className="rounded border border-[#DDD5C4] bg-[#F8F6F0] p-4">
            <h3 className="text-sm font-semibold mb-2">Prefilled from Deal Builder</h3>
            <div className="grid sm:grid-cols-2 gap-2 text-xs text-[#6B7A99]">
              {Object.entries(session.prefill ?? {}).filter(([, value]) => String(value ?? "").trim()).map(([key, value]) => (
                <div key={key}><span className="font-medium text-[#0F1C3F]">{key}:</span> {getDocupletePrefillDisplayValue(key, value, session.fields)}</div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {visibleInterviewFields.map((field) => {
              const mode = field.interviewMode ?? (fieldIsRequired(field) ? "required" : "optional");
              const isReadonly = mode === "readonly";
              const currentValue = interviewFieldValue(field, answers, session.prefill as Record<string, string> | undefined);
              const fieldError = fieldErrors[field.id];
              return (
              <div key={field.id} className={`block border rounded p-3 ${isReadonly ? "opacity-75" : ""} ${fieldError ? "border-red-400" : ""}`} style={fieldError ? undefined : { borderColor: field.color }}>
                <span className="flex items-center justify-between gap-2 text-sm font-medium mb-1">
                  <span>{field.name}</span>
                  <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                    mode === "required" ? "bg-red-50 text-red-700 border border-red-100"
                    : mode === "readonly" ? "bg-blue-50 text-blue-700 border border-blue-100"
                    : "bg-[#F8F6F0] text-[#6B7A99] border border-[#EFE8D8]"
                  }`}>{mode === "required" ? "Required" : mode === "readonly" ? "Read only" : "Optional"}</span>
                </span>
                {isReadonly ? (
                  <div className="px-3 py-2 text-sm bg-[#F8F6F0] rounded border border-[#DDD5C4] text-[#334155]">
                    {currentValue || <span className="text-[#8A9BB8] italic">—</span>}
                  </div>
                ) : field.type === "dropdown" ? (
                  <select
                    data-interview-input
                    value={currentValue}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))}
                    onBlur={(e) => handleInterviewFieldBlur(field, e.target.value)}
                    className={`w-full border rounded px-3 py-2 ${fieldError ? "border-red-400" : "border-[#D4C9B5]"}`}
                  >
                    <option value="">{mode === "required" ? "— select —" : "Select"}</option>
                    {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : field.type === "radio" ? (
                  <div className="space-y-1 pt-1">
                    {((field.options ?? []).length ? field.options ?? [] : []).map((option) => (
                      <label key={option} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          data-interview-input
                          type="radio"
                          name={field.id}
                          value={option}
                          checked={currentValue === option}
                          onChange={() => { setAnswers((prev) => ({ ...prev, [field.id]: option })); handleInterviewFieldBlur(field, option); }}
                        />
                        {option}
                      </label>
                    ))}
                    {currentValue && (
                      <button type="button" onClick={() => { setAnswers((prev) => ({ ...prev, [field.id]: "" })); handleInterviewFieldBlur(field, ""); }} className="text-[11px] text-[#8A9BB8] hover:text-[#334155]">Clear selection</button>
                    )}
                  </div>
                ) : field.type === "checkbox" ? (
                  <div className="space-y-1 pt-1">{((field.options ?? []).length ? field.options ?? [] : ["Yes"]).map((option) => {
                    const parseChecked = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
                    return (
                      <label key={option} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          data-interview-input
                          type="checkbox"
                          checked={parseChecked(currentValue).includes(option)}
                          onChange={(e) => setAnswers((prev) => {
                            const existing = parseChecked(interviewFieldValue(field, prev, session.prefill as Record<string, string> | undefined));
                            const updated = e.target.checked ? [...existing.filter((v) => v !== option), option] : existing.filter((v) => v !== option);
                            const next = { ...prev, [field.id]: updated.join(", ") };
                            handleInterviewFieldBlur(field, next[field.id]);
                            return next;
                          })}
                        />
                        {option}
                      </label>
                    );
                  })}</div>
                ) : (
                  <Input
                    data-interview-input
                    type={field.sensitive ? "password" : field.type === "date" ? "date" : "text"}
                    value={currentValue}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))}
                    onBlur={(e) => handleInterviewFieldBlur(field, e.target.value)}
                    className={fieldError ? "border-red-400 focus-visible:ring-red-300" : ""}
                  />
                )}
                {fieldError && <p className="mt-1 text-xs text-red-600">{fieldError}</p>}
                {(() => {
                  const hint = fieldFormatHint(field.validationType, field.validationMessage ?? undefined);
                  const hasValidValue = currentValue.trim() !== "" && validateFieldValue(field, currentValue) === null;
                  return hint && !fieldError && !hasValidValue ? (
                    <p className="mt-1 text-[11px] text-[#8A9BB8]">Format: {hint}</p>
                  ) : null;
                })()}
              </div>
              );
            })}
          </div>
          <div className="rounded border border-[#DDD5C4] bg-white p-4">
            <h3 className="text-sm font-semibold mb-2">Preview before send</h3>
            <div className="grid sm:grid-cols-2 gap-2 text-xs text-[#6B7A99]">
              {visibleInterviewFields.map((field) => {
                const value = interviewFieldValue(field, answers, session.prefill as Record<string, string> | undefined).trim();
                return <div key={field.id}><span className="font-medium text-[#0F1C3F]">{field.name}:</span> {value ? safeInterviewDisplayValue(field, value) : <span className="text-[#B58B2B]">{field.interviewMode === "required" ? "Missing" : "Not provided"}</span>}</div>;
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => saveAnswers()} disabled={isSaving} variant="outline">{isSaving ? "Saving…" : "Save Interview"}</Button>
            <Button onClick={generatePacket} disabled={isSaving || missingRequiredFields.length > 0 || Object.keys(fieldErrors).length > 0} className="disabled:opacity-60">{isSaving ? "Generating…" : "Generate Packet"}</Button>
            <Button onClick={handleDownloadInterviewCsv} variant="outline" className="text-[#6B7A99] border-[#DDD5C4]">Download CSV</Button>
            {generatedUrl && (
              <button type="button" onClick={downloadGeneratedPacket} disabled={isDownloading} className="text-sm text-[#C49A38] underline disabled:opacity-60">
                {isDownloading ? "Downloading…" : "Download packet PDF"}
              </button>
            )}
            {driveUrl && <a href={driveUrl} target="_blank" rel="noreferrer" className="text-sm text-[#C49A38] underline">Open saved Drive packet</a>}
          </div>
          {driveWarnings.length > 0 && <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{driveWarnings.join(" ")}</div>}
        </div>
      )}
    </section>
  );
});
