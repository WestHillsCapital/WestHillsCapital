import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const PUBLIC_BASE = `${API_BASE}/api/v1/docufill/public`;

type VerifyResult = {
  token: string;
  packageName: string;
  signerName: string | null;
  signerEmail: string | null;
  signedAt: string | null;
  pdfSha256: string | null;
  tsaUrl: string | null;
  tsaObtained: boolean;
  hashMatches?: boolean;
};

type Status = "idle" | "loading" | "found" | "unsigned" | "not_found" | "error";

function isHex64(s: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(s);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short", timeZone: "UTC",
  });
}

function ShieldCheck({ ok }: { ok: boolean }) {
  return ok ? (
    <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  ) : (
    <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
    </svg>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 py-3 border-b border-[#EDE9DE] last:border-0">
      <span className="text-xs font-semibold uppercase tracking-widest text-[#8A9BB8] pt-0.5">{label}</span>
      <span className={`text-sm text-[#0F1C3F] break-all ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

export default function Verify() {
  const [location] = useLocation();
  const [input, setInput]         = useState("");
  const [status, setStatus]       = useState<Status>("idle");
  const [result, setResult]       = useState<VerifyResult | null>(null);
  const [errorMsg, setErrorMsg]   = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get("token");
    const hash   = params.get("hash");
    if (token) { setInput(token); doLookup(token); }
    else if (hash) { setInput(hash); doLookup(hash); }
  }, []);

  async function doLookup(raw?: string) {
    const val = (raw ?? input).trim();
    if (!val) return;
    setStatus("loading");
    setResult(null);
    setErrorMsg("");
    try {
      let url: string;
      if (isHex64(val)) {
        url = `${PUBLIC_BASE}/verify?hash=${encodeURIComponent(val)}`;
      } else {
        url = `${PUBLIC_BASE}/sessions/${encodeURIComponent(val)}/verify`;
      }
      const res  = await fetch(url);
      const data = await res.json() as VerifyResult & { error?: string };
      if (res.status === 404) {
        if (data.error?.includes("not been signed")) {
          setStatus("unsigned");
        } else {
          setStatus("not_found");
        }
        return;
      }
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "Lookup failed. Please try again.");
        return;
      }
      setResult(data);
      setStatus("found");
    } catch {
      setStatus("error");
      setErrorMsg("A network error occurred. Please try again.");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void doLookup();
  }

  const shortHash = result?.pdfSha256 ? result.pdfSha256.slice(0, 16) + "…" + result.pdfSha256.slice(-8) : null;
  const isVerified = status === "found" && result !== null;
  const hashMismatch = result?.hashMatches === false;

  return (
    <div className="min-h-screen bg-[#F8F6F0] flex flex-col">
      {/* Minimal header */}
      <div className="bg-white border-b border-[#DDD5C4] px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <a href="/" className="font-serif text-[#0F1C3F] text-lg hover:opacity-75 transition-opacity">
            West Hills Capital
          </a>
          <span className="text-[#DDD5C4]">/</span>
          <span className="text-sm text-[#6B7A99]">Document Verification</span>
        </div>
      </div>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12 space-y-8">
        {/* Page heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-[#0F1C3F]">Verify a signed document</h1>
          <p className="text-sm text-[#6B7A99] leading-relaxed">
            Enter a session token or SHA-256 document hash to confirm authenticity of a
            Docuplete e-signed document. No login required.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#DDD5C4] p-6 space-y-4">
          <label className="text-sm font-medium text-[#0F1C3F]" htmlFor="verify-input">
            Session token or SHA-256 hash
          </label>
          <div className="flex gap-3">
            <Input
              id="verify-input"
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); if (status !== "idle") { setStatus("idle"); setResult(null); } }}
              placeholder="Paste token or 64-character hash…"
              className="font-mono text-sm"
              autoFocus
            />
            <Button
              type="submit"
              disabled={!input.trim() || status === "loading"}
              className="bg-[#0F1C3F] hover:bg-[#182B5F] shrink-0"
            >
              {status === "loading" ? "Looking up…" : "Verify"}
            </Button>
          </div>
          <p className="text-xs text-[#8A9BB8]">
            A session token looks like <span className="font-mono">df_…</span>. A hash is 64 hexadecimal characters.
            Both are on the Electronic Signing Certificate page of the signed PDF.
          </p>
        </form>

        {/* Status: not found */}
        {status === "not_found" && (
          <div className="bg-white rounded-xl border border-[#DDD5C4] p-6 flex items-start gap-4">
            <svg className="w-8 h-8 text-[#8A9BB8] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803m10.607 0A7.5 7.5 0 0 1 5.196 5.196" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-[#0F1C3F]">No signed document matches this input</p>
              <p className="text-xs text-[#6B7A99] mt-1">Double-check the token or hash and try again.</p>
            </div>
          </div>
        )}

        {/* Status: session exists but unsigned */}
        {status === "unsigned" && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 flex items-start gap-4">
            <svg className="w-7 h-7 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">This document has not been signed yet</p>
              <p className="text-xs text-amber-700 mt-1">A session exists for this token but it has not been completed and signed.</p>
            </div>
          </div>
        )}

        {/* Status: error */}
        {status === "error" && (
          <div className="bg-red-50 rounded-xl border border-red-200 p-4">
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}

        {/* Status: found — result card */}
        {status === "found" && result && (
          <div className="bg-white rounded-xl border border-[#DDD5C4] overflow-hidden">
            {/* Header bar */}
            <div className={`px-6 py-5 flex items-center gap-4 ${hashMismatch ? "bg-red-50 border-b border-red-200" : "bg-[#EAF4EE] border-b border-emerald-200"}`}>
              <ShieldCheck ok={!hashMismatch} />
              <div>
                <p className={`text-base font-semibold ${hashMismatch ? "text-red-700" : "text-emerald-800"}`}>
                  {hashMismatch
                    ? "Hash mismatch — document may have been altered"
                    : result.hashMatches === true
                      ? "Authentic — hash verified"
                      : "Signed document record found"}
                </p>
                <p className={`text-xs mt-0.5 ${hashMismatch ? "text-red-600" : "text-emerald-700"}`}>
                  {hashMismatch
                    ? "The hash you provided does not match the stored PDF hash for this session."
                    : result.hashMatches === true
                      ? "The provided hash matches the stored PDF hash exactly."
                      : "Signature and signing record verified on Docuplete."}
                </p>
              </div>
            </div>

            {/* Detail rows */}
            <div className="px-6 py-2">
              <Row label="Package" value={result.packageName} />
              <Row label="Signer" value={result.signerName ?? "—"} />
              <Row label="Email" value={result.signerEmail ?? "—"} />
              <Row label="Signed at" value={formatDate(result.signedAt)} />
              {result.pdfSha256 && (
                <Row label="Document hash" value={
                  <span className="text-xs leading-relaxed">
                    <span className="opacity-60">{result.pdfSha256.slice(0, 32)}</span>
                    {result.pdfSha256.slice(32)}
                  </span>
                } mono />
              )}
              {result.tsaUrl && (
                <Row label="Timestamp auth." value={
                  <a href={result.tsaUrl} target="_blank" rel="noopener noreferrer"
                     className="text-[#0F1C3F] underline underline-offset-2 hover:opacity-75 transition-opacity text-xs break-all">
                    {result.tsaUrl}
                  </a>
                } />
              )}
              <Row label="TSA token" value={
                result.tsaObtained
                  ? <span className="text-emerald-700 font-medium">On record — RFC 3161</span>
                  : <span className="text-[#8A9BB8]">Not obtained</span>
              } />
            </div>

            {/* TSA verification note */}
            {result.tsaObtained && (
              <div className="mx-6 mb-5 mt-1 bg-[#F8F6F0] rounded-lg border border-[#DDD5C4] px-5 py-4 space-y-2">
                <p className="text-xs font-semibold text-[#0F1C3F]">Verifying the RFC 3161 timestamp independently</p>
                <p className="text-xs text-[#6B7A99] leading-relaxed">
                  The stored DER timestamp token can be verified against the PDF hash using OpenSSL:
                </p>
                <pre className="text-[11px] bg-white border border-[#DDD5C4] rounded p-3 overflow-x-auto text-[#0F1C3F] leading-relaxed whitespace-pre-wrap">
{`openssl ts -verify \\
  -data signed-document.pdf \\
  -in signing-token.tsr \\
  -CAfile tsa-chain.pem`}
                </pre>
                <p className="text-xs text-[#8A9BB8]">
                  Contact Docuplete to request the DER token file for this session. The token confirms the
                  document existed in its signed form at the timestamp shown above.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <div className="border-t border-[#DDD5C4] bg-white px-4 py-5 text-center">
        <p className="text-xs text-[#8A9BB8]">
          Powered by{" "}
          <a href="https://docuplete.com" className="underline underline-offset-2 hover:text-[#0F1C3F] transition-colors">
            Docuplete
          </a>
          {" · "}
          <a href="/" className="underline underline-offset-2 hover:text-[#0F1C3F] transition-colors">
            West Hills Capital
          </a>
        </p>
      </div>
    </div>
  );
}
