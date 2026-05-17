import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface SamlConfig {
  enabled: boolean;
  enforced: boolean;
  domain: string;
  idp_entity_id: string;
  idp_sso_url: string;
  idp_certificate: string;
  sp: {
    entity_id: string;
    acs_url: string;
    metadata_url: string;
  };
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function SsoSettings() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [config, setConfig] = useState<SamlConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [domain, setDomain] = useState("");
  const [idpEntityId, setIdpEntityId] = useState("");
  const [idpSsoUrl, setIdpSsoUrl] = useState("");
  const [idpCertificate, setIdpCertificate] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [enforced, setEnforced] = useState(false);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  async function authHeaders() {
    const token = await getToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  // ── Load current config ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch("/api/v1/product/settings/saml", { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: SamlConfig = await res.json();
        setConfig(data);
        setDomain(data.domain ?? "");
        setIdpEntityId(data.idp_entity_id ?? "");
        setIdpSsoUrl(data.idp_sso_url ?? "");
        setIdpCertificate(data.idp_certificate ?? "");
        setEnabled(data.enabled ?? false);
        setEnforced(data.enforced ?? false);
      } catch (err: unknown) {
        setFetchError(err instanceof Error ? err.message : "Failed to load SAML config");
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveState("saving");
    setSaveError("");
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/v1/product/settings/saml", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          domain: domain.trim(),
          idp_entity_id: idpEntityId.trim(),
          idp_sso_url: idpSsoUrl.trim(),
          idp_certificate: idpCertificate.trim(),
          enabled,
          enforced,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const updated: SamlConfig = await res.json();
      setConfig(updated);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
      setSaveState("error");
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    try {
      const headers = await authHeaders();
      await fetch("/api/v1/product/settings/saml", { method: "DELETE", headers });
      setConfig(null);
      setDomain(""); setIdpEntityId(""); setIdpSsoUrl(""); setIdpCertificate("");
      setEnabled(false); setEnforced(false);
      setDeleteConfirm(false);
    } catch {
      setSaveError("Delete failed. Please try again.");
    }
  }

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <p className="text-white/50">Sign in to manage SSO settings.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#5B8DEF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 mb-4">{fetchError}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white p-6 md:p-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <a href="/" className="text-[#5B8DEF] text-sm hover:underline mb-4 inline-block">
            ← Back
          </a>
          <h1 className="text-2xl font-bold text-white">SAML SSO Configuration</h1>
          <p className="text-white/50 text-sm mt-1">
            Connect your organisation&apos;s identity provider to enable single sign-on.
          </p>
        </div>

        {/* SP details (read-only) */}
        {config?.sp && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-8 space-y-3">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest mb-4">
              Service Provider Details
            </h2>
            <ReadOnlyField label="SP Entity ID" value={config.sp.entity_id} />
            <ReadOnlyField label="ACS (Callback) URL" value={config.sp.acs_url} />
            <ReadOnlyField label="Metadata URL" value={config.sp.metadata_url} />
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-white/70 hover:text-white"
                onClick={() =>
                  window.open("/api/v1/product/settings/saml/sp-metadata", "_blank")
                }
              >
                Download SP Metadata XML
              </Button>
            </div>
          </div>
        )}

        {/* Config form */}
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-5">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest">
              Identity Provider Settings
            </h2>

            <FormField
              label="Verified Domain"
              id="domain"
              placeholder="corp.example.com"
              value={domain}
              onChange={setDomain}
              hint="Users with email addresses on this domain will be redirected to your IdP."
            />

            <FormField
              label="IdP Entity ID"
              id="idpEntityId"
              placeholder="https://idp.example.com/saml/metadata"
              value={idpEntityId}
              onChange={setIdpEntityId}
            />

            <FormField
              label="IdP SSO URL"
              id="idpSsoUrl"
              placeholder="https://idp.example.com/saml/sso"
              value={idpSsoUrl}
              onChange={setIdpSsoUrl}
            />

            <div className="space-y-2">
              <Label htmlFor="cert" className="text-white/70 text-sm">
                IdP Certificate (PEM)
              </Label>
              <Textarea
                id="cert"
                placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
                value={idpCertificate}
                onChange={(e) => setIdpCertificate(e.target.value)}
                rows={6}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono text-xs resize-none focus:border-[#5B8DEF]"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest">
              Access Policy
            </h2>
            <ToggleRow
              id="enabled"
              label="Enable SSO"
              description="Allow users to sign in using your identity provider."
              checked={enabled}
              onChange={setEnabled}
            />
            <ToggleRow
              id="enforced"
              label="Enforce SSO"
              description="Require all users on the verified domain to use SSO. Disables email/password login for that domain."
              checked={enforced}
              onChange={(v) => {
                setEnforced(v);
                if (v) setEnabled(true);
              }}
            />
          </div>

          {saveError && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {saveError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              className="bg-[#5B8DEF] hover:bg-[#4a7de8] text-white"
              disabled={saveState === "saving"}
            >
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                ? "Saved ✓"
                : "Save Configuration"}
            </Button>

            {config && (
              <Button
                type="button"
                variant="outline"
                className={
                  deleteConfirm
                    ? "border-red-500 text-red-400 hover:bg-red-500/10"
                    : "border-white/20 text-white/50 hover:text-white"
                }
                onClick={handleDelete}
              >
                {deleteConfirm ? "Confirm Delete" : "Delete"}
              </Button>
            )}
            {deleteConfirm && (
              <button
                type="button"
                className="text-white/40 text-sm hover:text-white/70"
                onClick={() => setDeleteConfirm(false)}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-white/40 mb-0.5">{label}</p>
        <p className="text-sm text-white/80 font-mono break-all">{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="text-xs text-[#5B8DEF] hover:text-white shrink-0 mt-4"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

function FormField({
  label,
  id,
  placeholder,
  value,
  onChange,
  hint,
}: {
  label: string;
  id: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-white/70 text-sm">
        {label}
      </Label>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#5B8DEF]"
      />
      {hint && <p className="text-xs text-white/30">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4">
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="mt-0.5"
      />
      <div>
        <Label htmlFor={id} className="text-white/80 text-sm font-medium cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-white/40 mt-0.5">{description}</p>
      </div>
    </div>
  );
}
