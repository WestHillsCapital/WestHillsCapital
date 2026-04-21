import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { useInternalAuth } from "@/hooks/useInternalAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type Entity = {
  id: number;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
};

type DocItem = {
  id: string;
  title: string;
  pages: number;
};

type FieldItem = {
  id: string;
  name: string;
  color: string;
  type: "text" | "radio" | "checkbox" | "dropdown" | "date";
  options: string[];
  interviewVisible: boolean;
  adminOnly: boolean;
  defaultValue: string;
  source: string;
};

type MappingItem = {
  id: string;
  fieldId: string;
  documentId: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

type PackageItem = {
  id: number;
  name: string;
  custodian_id: number | null;
  depository_id: number | null;
  custodian_name: string | null;
  depository_name: string | null;
  transaction_scope: string;
  description: string | null;
  status: string;
  version: number;
  documents: DocItem[];
  fields: FieldItem[];
  mappings: MappingItem[];
};

type Session = {
  token: string;
  package_name: string;
  custodian_name: string | null;
  depository_name: string | null;
  documents: DocItem[];
  fields: FieldItem[];
  mappings: MappingItem[];
  prefill: Record<string, string>;
  answers: Record<string, string>;
  status: string;
};

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizePackages(items: PackageItem[]): PackageItem[] {
  return items.map((pkg) => ({
    ...pkg,
    documents: Array.isArray(pkg.documents) ? pkg.documents : [],
    fields: Array.isArray(pkg.fields) ? pkg.fields : [],
    mappings: Array.isArray(pkg.mappings) ? pkg.mappings : [],
  }));
}

export default function DocuFill() {
  const search = useSearch();
  const sessionToken = new URLSearchParams(search).get("session");
  const { getAuthHeaders } = useInternalAuth();
  const [tab, setTab] = useState<"packages" | "mapper" | "interview">(sessionToken ? "interview" : "packages");
  const [custodians, setCustodians] = useState<Entity[]>([]);
  const [depositories, setDepositories] = useState<Entity[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const selectedPackage = packages.find((pkg) => pkg.id === selectedPackageId) ?? packages[0] ?? null;
  const selectedDocument = selectedPackage?.documents.find((doc) => doc.id === selectedDocumentId) ?? selectedPackage?.documents[0] ?? null;
  const selectedField = selectedPackage?.fields.find((field) => field.id === selectedFieldId) ?? selectedPackage?.fields[0] ?? null;
  const pageMappings = useMemo(() => {
    if (!selectedPackage || !selectedDocument) return [];
    return selectedPackage.mappings.filter((m) => m.documentId === selectedDocument.id);
  }, [selectedPackage, selectedDocument]);

  async function loadBootstrap() {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/internal/docufill/bootstrap`, { headers: { ...getAuthHeaders() } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load DocuFill data");
      const loadedPackages = normalizePackages(data.packages ?? []);
      setCustodians(data.custodians ?? []);
      setDepositories(data.depositories ?? []);
      setPackages(loadedPackages);
      setSelectedPackageId((current) => current ?? loadedPackages[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load DocuFill data");
    }
  }

  useEffect(() => {
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!sessionToken) return;
    fetch(`${API_BASE}/api/internal/docufill/sessions/${sessionToken}`, { headers: { ...getAuthHeaders() } })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("Could not load interview")))
      .then((data: { session: Session }) => {
        setSession(data.session);
        setAnswers(data.session.answers ?? {});
        setTab("interview");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load interview"));
  }, [sessionToken, getAuthHeaders]);

  useEffect(() => {
    if (selectedPackage && !selectedDocumentId) setSelectedDocumentId(selectedPackage.documents[0]?.id ?? null);
    if (selectedPackage && !selectedFieldId) setSelectedFieldId(selectedPackage.fields[0]?.id ?? null);
  }, [selectedPackage, selectedDocumentId, selectedFieldId]);

  async function savePackage(pkg: PackageItem) {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/internal/docufill/packages/${pkg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          name: pkg.name,
          custodianId: pkg.custodian_id,
          depositoryId: pkg.depository_id,
          transactionScope: pkg.transaction_scope,
          description: pkg.description,
          status: pkg.status,
          documents: pkg.documents,
          fields: pkg.fields,
          mappings: pkg.mappings,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save package");
      setStatus("Saved package.");
      await loadBootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save package");
    } finally {
      setIsSaving(false);
    }
  }

  async function createPackage() {
    setIsSaving(true);
    setError(null);
    try {
      const custodianId = custodians[0]?.id ?? null;
      const depositoryId = depositories[0]?.id ?? null;
      const res = await fetch(`${API_BASE}/api/internal/docufill/packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          name: "New DocuFill Package",
          custodianId,
          depositoryId,
          transactionScope: "Custodial paperwork",
          status: "draft",
          documents: [],
          fields: [],
          mappings: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create package");
      await loadBootstrap();
      setSelectedPackageId(data.package.id);
      setTab("packages");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create package");
    } finally {
      setIsSaving(false);
    }
  }

  async function createEntity(type: "custodians" | "depositories") {
    const count = type === "custodians" ? custodians.length + 1 : depositories.length + 1;
    const label = type === "custodians" ? `New Custodian ${count}` : `New Depository ${count}`;
    const res = await fetch(`${API_BASE}/api/internal/docufill/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ name: label, active: true }),
    });
    if (res.ok) await loadBootstrap();
  }

  function updateEntityLocal(type: "custodians" | "depositories", id: number, patch: Partial<Entity>) {
    const updater = (item: Entity) => item.id === id ? { ...item, ...patch } : item;
    if (type === "custodians") setCustodians((prev) => prev.map(updater));
    if (type === "depositories") setDepositories((prev) => prev.map(updater));
  }

  async function saveEntity(type: "custodians" | "depositories", item: Entity) {
    setError(null);
    const res = await fetch(`${API_BASE}/api/internal/docufill/${type}/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        name: item.name,
        contactName: item.contact_name,
        email: item.email,
        phone: item.phone,
        notes: item.notes,
        active: item.active,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not save record");
      return;
    }
    setStatus("Saved record.");
    await loadBootstrap();
  }

  function updateSelectedPackage(updater: (pkg: PackageItem) => PackageItem) {
    if (!selectedPackage) return;
    setPackages((prev) => prev.map((pkg) => pkg.id === selectedPackage.id ? updater(pkg) : pkg));
  }

  function addDocument() {
    updateSelectedPackage((pkg) => {
      const doc: DocItem = { id: newId("doc"), title: `Document ${pkg.documents.length + 1}`, pages: 1 };
      setSelectedDocumentId(doc.id);
      return { ...pkg, documents: [...pkg.documents, doc] };
    });
  }

  function removeDocument(docId: string) {
    updateSelectedPackage((pkg) => ({
      ...pkg,
      documents: pkg.documents.filter((doc) => doc.id !== docId),
      mappings: pkg.mappings.filter((m) => m.documentId !== docId),
    }));
    setSelectedDocumentId(null);
  }

  function moveDocument(docId: string, direction: -1 | 1) {
    updateSelectedPackage((pkg) => {
      const docs = [...pkg.documents];
      const index = docs.findIndex((doc) => doc.id === docId);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= docs.length) return pkg;
      const [item] = docs.splice(index, 1);
      docs.splice(next, 0, item);
      return { ...pkg, documents: docs };
    });
  }

  function addField() {
    updateSelectedPackage((pkg) => {
      const field: FieldItem = {
        id: newId("field"),
        name: `Field ${pkg.fields.length + 1}`,
        color: "#8BC34A",
        type: "text",
        options: [],
        interviewVisible: true,
        adminOnly: false,
        defaultValue: "",
        source: "interview",
      };
      setSelectedFieldId(field.id);
      return { ...pkg, fields: [...pkg.fields, field] };
    });
  }

  function removeField(fieldId: string) {
    updateSelectedPackage((pkg) => ({
      ...pkg,
      fields: pkg.fields.filter((field) => field.id !== fieldId),
      mappings: pkg.mappings.filter((m) => m.fieldId !== fieldId),
    }));
    setSelectedFieldId(null);
  }

  function placeField() {
    if (!selectedField || !selectedDocument) return;
    updateSelectedPackage((pkg) => ({
      ...pkg,
      mappings: [...pkg.mappings, {
        id: newId("map"),
        fieldId: selectedField.id,
        documentId: selectedDocument.id,
        page: 1,
        x: 18 + (pkg.mappings.length % 5) * 12,
        y: 20 + (pkg.mappings.length % 8) * 8,
        w: 26,
        h: 6,
      }],
    }));
  }

  async function saveAnswers(nextStatus = "in_progress") {
    if (!session) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/internal/docufill/sessions/${session.token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ answers, status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save interview");
      setSession((prev) => prev ? { ...prev, status: data.session.status, answers } : prev);
      setStatus("Interview saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save interview");
    } finally {
      setIsSaving(false);
    }
  }

  async function generatePacket() {
    if (!session) return;
    await saveAnswers("answered");
    const res = await fetch(`${API_BASE}/api/internal/docufill/sessions/${session.token}/generate`, {
      method: "POST",
      headers: { ...getAuthHeaders() },
    });
    const data = await res.json();
    if (res.ok) {
      setGeneratedUrl(data.downloadUrl);
      setStatus("Packet generated.");
    } else {
      setError(data.error ?? "Could not generate packet");
    }
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6 text-[#0F1C3F]">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-semibold">DocuFill</h1>
          <p className="text-sm text-[#6B7A99] mt-1">Set up custodial packages once, then launch clean interviews from Deal Builder.</p>
        </div>
        <div className="flex rounded border border-[#DDD5C4] overflow-hidden bg-white">
          {(["packages", "mapper", "interview"] as const).map((item) => (
            <button key={item} onClick={() => setTab(item)} className={`px-3 py-2 text-sm capitalize ${tab === item ? "bg-[#C49A38] text-black" : "text-[#6B7A99] hover:text-[#0F1C3F]"}`}>{item}</button>
          ))}
        </div>
      </div>
      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-800 px-3 py-2 text-sm">{error}</div>}
      {status && <div className="mb-4 rounded border border-green-200 bg-green-50 text-green-800 px-3 py-2 text-sm">{status}</div>}

      {tab === "packages" && (
        <div className="grid lg:grid-cols-[280px_1fr] gap-5">
          <aside className="bg-white border border-[#DDD5C4] rounded-lg p-4 space-y-3">
            <Button onClick={createPackage} disabled={isSaving} className="w-full bg-[#0F1C3F] hover:bg-[#182B5F]">New Package</Button>
            <div className="space-y-2 max-h-[560px] overflow-y-auto">
              {packages.map((pkg) => (
                <button key={pkg.id} onClick={() => setSelectedPackageId(pkg.id)} className={`w-full text-left rounded border px-3 py-2 ${selectedPackage?.id === pkg.id ? "border-[#C49A38] bg-[#C49A38]/10" : "border-[#DDD5C4] bg-white"}`}>
                  <div className="font-medium text-sm">{pkg.name}</div>
                  <div className="text-xs text-[#6B7A99]">{pkg.custodian_name ?? "No custodian"} · {pkg.depository_name ?? "No depository"}</div>
                  <div className="text-[11px] text-[#8A9BB8]">v{pkg.version} · {pkg.status}</div>
                </button>
              ))}
            </div>
          </aside>

          <section className="bg-white border border-[#DDD5C4] rounded-lg p-5">
            {!selectedPackage ? <EmptyState message="Create a package to begin." /> : (
              <div className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <LabeledInput label="Package Name" value={selectedPackage.name} onChange={(value) => updateSelectedPackage((pkg) => ({ ...pkg, name: value }))} />
                  <label className="block text-sm">
                    <span className="block text-xs text-[#6B7A99] mb-1">Status</span>
                    <select value={selectedPackage.status} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, status: e.target.value }))} className="w-full border border-[#D4C9B5] rounded px-3 py-2">
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="block text-xs text-[#6B7A99] mb-1">Custodian</span>
                    <select value={selectedPackage.custodian_id ?? ""} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, custodian_id: e.target.value ? Number(e.target.value) : null }))} className="w-full border border-[#D4C9B5] rounded px-3 py-2">
                      <option value="">None</option>
                      {custodians.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="block text-xs text-[#6B7A99] mb-1">Depository</span>
                    <select value={selectedPackage.depository_id ?? ""} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, depository_id: e.target.value ? Number(e.target.value) : null }))} className="w-full border border-[#D4C9B5] rounded px-3 py-2">
                      <option value="">None</option>
                      {depositories.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </label>
                </div>
                <LabeledInput label="Package Scope" value={selectedPackage.transaction_scope} onChange={(value) => updateSelectedPackage((pkg) => ({ ...pkg, transaction_scope: value }))} />
                <label className="block">
                  <span className="block text-xs text-[#6B7A99] mb-1">Description / interview notes</span>
                  <Textarea value={selectedPackage.description ?? ""} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, description: e.target.value }))} />
                </label>
                <div className="grid md:grid-cols-2 gap-4">
                  <EntityPanel
                    title="Custodians"
                    items={custodians}
                    onAdd={() => createEntity("custodians")}
                    onChange={(id, patch) => updateEntityLocal("custodians", id, patch)}
                    onSave={(item) => saveEntity("custodians", item)}
                  />
                  <EntityPanel
                    title="Depositories"
                    items={depositories}
                    onAdd={() => createEntity("depositories")}
                    onChange={(id, patch) => updateEntityLocal("depositories", id, patch)}
                    onSave={(item) => saveEntity("depositories", item)}
                  />
                </div>
                <Button onClick={() => savePackage(selectedPackage)} disabled={isSaving} className="bg-[#0F1C3F] hover:bg-[#182B5F]">Save Package</Button>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "mapper" && (
        !selectedPackage ? <EmptyState message="Create or select a package first." /> : (
          <div className="grid lg:grid-cols-[190px_1fr_260px] gap-4 min-h-[720px]">
            <section className="bg-white border border-[#DDD5C4] rounded-lg p-3 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold">Documents</h2>
                <label className="text-xs text-[#C49A38] cursor-pointer">
                  Add
                  <input
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) {
                        addDocument();
                        return;
                      }
                      updateSelectedPackage((pkg) => {
                        const doc: DocItem = { id: newId("doc"), title: file.name.replace(/\.pdf$/i, ""), pages: 1 };
                        setSelectedDocumentId(doc.id);
                        return { ...pkg, documents: [...pkg.documents, doc] };
                      });
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="space-y-2 overflow-y-auto flex-1">
                {selectedPackage.documents.map((doc, index) => (
                  <div key={doc.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/doc", doc.id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => moveDocument(e.dataTransfer.getData("text/doc"), index > selectedPackage.documents.findIndex((d) => d.id === e.dataTransfer.getData("text/doc")) ? 1 : -1)} className={`border rounded p-2 ${selectedDocument?.id === doc.id ? "border-[#C49A38] bg-[#C49A38]/10" : "border-[#DDD5C4]"}`}>
                    <button onClick={() => setSelectedDocumentId(doc.id)} className="w-full h-20 bg-[#F5F0E8] border border-[#DDD5C4] rounded text-xs text-[#6B7A99]">{index + 1}<br />{doc.pages} page(s)</button>
                    <Input value={doc.title} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, documents: pkg.documents.map((d) => d.id === doc.id ? { ...d, title: e.target.value } : d) }))} className="mt-2 h-8 text-xs" />
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => moveDocument(doc.id, -1)} className="text-[11px] text-[#6B7A99]">Up</button>
                      <button onClick={() => moveDocument(doc.id, 1)} className="text-[11px] text-[#6B7A99]">Down</button>
                      <button onClick={() => removeDocument(doc.id)} className="ml-auto text-[11px] text-red-600">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white border border-[#DDD5C4] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold">Assign Package Fields</h2>
                  <p className="text-xs text-[#8A9BB8]">Select a field, then add it to the document preview.</p>
                </div>
                <Button onClick={placeField} disabled={!selectedField || !selectedDocument} className="bg-[#C49A38] hover:bg-[#b58c31] text-black">Add Field to Page</Button>
              </div>
              <div className="relative mx-auto bg-[#F8F6F0] border border-[#DDD5C4] shadow-inner h-[620px] max-w-[720px] overflow-hidden">
                <div className="absolute inset-8 bg-white border border-[#D4C9B5] shadow-sm p-6 text-xs text-[#6B7A99]">
                  <div className="font-semibold text-[#0F1C3F] mb-3">{selectedDocument?.title ?? "No document selected"}</div>
                  {Array.from({ length: 18 }).map((_, i) => <div key={i} className="h-2 bg-[#EFE8D8] rounded mb-3" style={{ width: `${70 + (i % 4) * 7}%` }} />)}
                </div>
                {pageMappings.map((m) => {
                  const field = selectedPackage.fields.find((f) => f.id === m.fieldId);
                  return (
                    <button key={m.id} onClick={() => setSelectedFieldId(m.fieldId)} className="absolute border-2 bg-white/90 rounded px-2 py-1 text-[11px] text-left shadow" style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%`, minHeight: `${m.h * 4}px`, borderColor: field?.color ?? "#C49A38" }}>
                      {field?.name ?? "Field"}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={() => savePackage(selectedPackage)} disabled={isSaving} className="bg-[#0F1C3F] hover:bg-[#182B5F]">Save Mapping</Button>
              </div>
            </section>

            <section className="bg-white border border-[#DDD5C4] rounded-lg p-3 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold">Fields</h2>
                <button onClick={addField} className="text-xs text-[#C49A38]">Add</button>
              </div>
              <div className="space-y-2 overflow-y-auto flex-1">
                {selectedPackage.fields.map((field) => (
                  <button key={field.id} onClick={() => setSelectedFieldId(field.id)} className={`w-full text-left border-2 rounded px-3 py-2 bg-white ${selectedField?.id === field.id ? "ring-2 ring-[#C49A38]/30" : ""}`} style={{ borderColor: field.color }}>
                    <div className="text-sm font-medium">{field.name}</div>
                    <div className="text-[11px] text-[#6B7A99]">{field.type} · {field.interviewVisible ? "Interview" : "Admin default"}</div>
                  </button>
                ))}
              </div>
              {selectedField && (
                <div className="border-t border-[#DDD5C4] pt-3 mt-3 space-y-2">
                  <Input value={selectedField.name} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, fields: pkg.fields.map((f) => f.id === selectedField.id ? { ...f, name: e.target.value } : f) }))} />
                  <Input type="color" value={selectedField.color} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, fields: pkg.fields.map((f) => f.id === selectedField.id ? { ...f, color: e.target.value } : f) }))} />
                  <select value={selectedField.type} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, fields: pkg.fields.map((f) => f.id === selectedField.id ? { ...f, type: e.target.value as FieldItem["type"] } : f) }))} className="w-full border border-[#D4C9B5] rounded px-3 py-2 text-sm">
                    <option value="text">Text box</option>
                    <option value="date">Date</option>
                    <option value="radio">Radio buttons</option>
                    <option value="checkbox">Checkboxes</option>
                    <option value="dropdown">Dropdown</option>
                  </select>
                  <Textarea placeholder="Options, one per line" value={selectedField.options.join("\n")} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, fields: pkg.fields.map((f) => f.id === selectedField.id ? { ...f, options: e.target.value.split("\n").filter(Boolean) } : f) }))} />
                  <Input placeholder="Default/admin value" value={selectedField.defaultValue} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, fields: pkg.fields.map((f) => f.id === selectedField.id ? { ...f, defaultValue: e.target.value } : f) }))} />
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selectedField.interviewVisible} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, fields: pkg.fields.map((f) => f.id === selectedField.id ? { ...f, interviewVisible: e.target.checked } : f) }))} /> Show in interview</label>
                  <button onClick={() => removeField(selectedField.id)} className="text-xs text-red-600">Remove field</button>
                </div>
              )}
            </section>
          </div>
        )
      )}

      {tab === "interview" && (
        <section className="bg-white border border-[#DDD5C4] rounded-lg p-5 max-w-4xl mx-auto">
          {!session ? <EmptyState message="Launch a DocuFill package from Deal Builder or use a session link." /> : (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold">{session.package_name}</h2>
                <p className="text-sm text-[#6B7A99]">{session.custodian_name ?? "No custodian"} · {session.depository_name ?? "No depository"}</p>
              </div>
              <div className="rounded border border-[#DDD5C4] bg-[#F8F6F0] p-4">
                <h3 className="text-sm font-semibold mb-2">Prefilled from Deal Builder</h3>
                <div className="grid sm:grid-cols-2 gap-2 text-xs text-[#6B7A99]">
                  {Object.entries(session.prefill ?? {}).filter(([, value]) => String(value ?? "").trim()).map(([key, value]) => <div key={key}><span className="font-medium text-[#0F1C3F]">{key}:</span> {String(value)}</div>)}
                </div>
              </div>
              <div className="space-y-3">
                {session.fields.filter((field) => field.interviewVisible).map((field) => (
                  <label key={field.id} className="block border rounded p-3" style={{ borderColor: field.color }}>
                    <span className="block text-sm font-medium mb-1">{field.name}</span>
                    {field.type === "dropdown" ? (
                      <select value={answers[field.id] ?? ""} onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))} className="w-full border border-[#D4C9B5] rounded px-3 py-2">
                        <option value="">Select</option>
                        {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : field.type === "checkbox" ? (
                      <div className="space-y-1">{(field.options.length ? field.options : ["Yes"]).map((option) => <label key={option} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={(answers[field.id] ?? "").split(", ").includes(option)} onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.checked ? [...(prev[field.id] ?? "").split(", ").filter(Boolean), option].join(", ") : (prev[field.id] ?? "").split(", ").filter((v) => v !== option).join(", ") }))} /> {option}</label>)}</div>
                    ) : (
                      <Input type={field.type === "date" ? "date" : "text"} value={answers[field.id] ?? field.defaultValue ?? ""} onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))} />
                    )}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => saveAnswers()} disabled={isSaving} variant="outline">Save Interview</Button>
                <Button onClick={generatePacket} disabled={isSaving} className="bg-[#0F1C3F] hover:bg-[#182B5F]">Generate Packet</Button>
                {generatedUrl && <a href={generatedUrl} className="text-sm text-[#C49A38] underline">Download packet PDF</a>}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded border border-dashed border-[#D4C9B5] bg-white p-8 text-center text-sm text-[#6B7A99]">{message}</div>;
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="block text-xs text-[#6B7A99] mb-1">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function EntityPanel({
  title,
  items,
  onAdd,
  onChange,
  onSave,
}: {
  title: string;
  items: Entity[];
  onAdd: () => void;
  onChange: (id: number, patch: Partial<Entity>) => void;
  onSave: (item: Entity) => void;
}) {
  return (
    <div className="border border-[#DDD5C4] rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button onClick={onAdd} className="text-xs text-[#C49A38]">Add</button>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto text-sm">
        {items.map((item) => (
          <div key={item.id} className="rounded bg-[#F8F6F0] border border-[#EFE8D8] p-2 space-y-2">
            <Input value={item.name} onChange={(e) => onChange(item.id, { name: e.target.value })} className="h-8 text-xs bg-white" />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Phone" value={item.phone ?? ""} onChange={(e) => onChange(item.id, { phone: e.target.value })} className="h-8 text-xs bg-white" />
              <Input placeholder="Email" value={item.email ?? ""} onChange={(e) => onChange(item.id, { email: e.target.value })} className="h-8 text-xs bg-white" />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1 text-[11px] text-[#6B7A99]">
                <input type="checkbox" checked={item.active} onChange={(e) => onChange(item.id, { active: e.target.checked })} />
                Active
              </label>
              <button onClick={() => onSave(item)} className="text-[11px] text-[#C49A38]">Save</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-xs text-[#8A9BB8]">None yet.</div>}
      </div>
    </div>
  );
}
