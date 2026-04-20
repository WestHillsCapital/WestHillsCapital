import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useInternalAuth } from "@/hooks/useInternalAuth";
import { ChevronDown, ChevronRight, Sparkles, Save, Globe, FileText, Trash2, Eye, EyeOff } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface TopicCluster {
  cluster: string;
  topics: string[];
}

interface ArticleSection {
  heading?: string;
  paragraphs: string[];
}

interface DraftArticle {
  title: string;
  slug: string;
  excerpt: string;
  group: string;
  metaDescription: string;
  sections: ArticleSection[];
}

interface SavedArticle {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  group_id: string;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
}

const GROUP_LABELS: Record<string, string> = {
  "understanding-pricing":       "Understanding Pricing",
  "making-smart-decisions":      "Making Smart Decisions",
  "ownership-and-practicality":  "Ownership & Practical Reality",
  "choosing-who-to-trust":       "Choosing Who to Trust",
};

// ─── TOPIC PICKER ─────────────────────────────────────────────────────────────

function TopicPicker({ onSelect }: { onSelect: (topic: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const { getAuthHeaders } = useInternalAuth();

  const { data } = useQuery<{ clusters: TopicCluster[] }>({
    queryKey: ["content-topics"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/internal/content/topics`, {
        headers: getAuthHeaders(),
      });
      return res.json();
    },
  });

  return (
    <div className="space-y-2">
      {(data?.clusters ?? []).map((cluster) => (
        <div key={cluster.cluster} className="border border-[#DDD5C4] rounded-lg overflow-hidden">
          <button
            onClick={() => setOpen(open === cluster.cluster ? null : cluster.cluster)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#F5F0E8] transition-colors"
          >
            <span className="text-sm font-semibold text-[#0F1C3F]">{cluster.cluster}</span>
            {open === cluster.cluster ? (
              <ChevronDown className="w-4 h-4 text-[#C49A38] shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#6B7A99] shrink-0" />
            )}
          </button>
          {open === cluster.cluster && (
            <div className="border-t border-[#DDD5C4] bg-white divide-y divide-[#DDD5C4]/50">
              {cluster.topics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => onSelect(topic)}
                  className="w-full text-left px-5 py-2.5 text-sm text-[#4A5B7A] hover:bg-[#C49A38]/8 hover:text-[#0F1C3F] transition-colors"
                >
                  {topic}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── ARTICLE EDITOR ───────────────────────────────────────────────────────────

function ArticleEditor({
  initial,
  savedId,
  initialPublished,
  onSaved,
  onReset,
}: {
  initial: DraftArticle;
  savedId: number | null;
  initialPublished?: boolean;
  onSaved: (id: number) => void;
  onReset: () => void;
}) {
  const { getAuthHeaders } = useInternalAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<DraftArticle>(initial);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(initialPublished ?? false);
  const [liveUrl, setLiveUrl] = useState<string | null>(
    initialPublished ? `https://westhillscapital.com/insights/${initial.slug}` : null
  );
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(!savedId);

  const handleFieldChange = (field: keyof DraftArticle, value: string) => {
    setDraft((d) => ({ ...d, [field]: value }));
    setSaveMsg(null);
    setIsDirty(true);
  };

  const handleSectionHeadingChange = (i: number, value: string) => {
    setDraft((d) => {
      const sections = [...d.sections];
      sections[i] = { ...sections[i], heading: value };
      return { ...d, sections };
    });
    setSaveMsg(null);
    setIsDirty(true);
  };

  const handleParagraphChange = (sectionIdx: number, paraIdx: number, value: string) => {
    setDraft((d) => {
      const sections = d.sections.map((s, si) => {
        if (si !== sectionIdx) return s;
        const paragraphs = [...s.paragraphs];
        paragraphs[paraIdx] = value;
        return { ...s, paragraphs };
      });
      return { ...d, sections };
    });
    setSaveMsg(null);
    setIsDirty(true);
  };

  // Returns the saved article id (creates or updates), throws on error
  const persistDraft = useCallback(async (currentSavedId: number | null, currentDraft: DraftArticle): Promise<number> => {
    const url = currentSavedId
      ? `${API_BASE}/api/internal/content/articles/${currentSavedId}`
      : `${API_BASE}/api/internal/content/articles`;
    const method = currentSavedId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        slug:            currentDraft.slug,
        title:           currentDraft.title,
        excerpt:         currentDraft.excerpt,
        group:           currentDraft.group,
        metaDescription: currentDraft.metaDescription,
        sections:        currentDraft.sections,
        related:         [],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed");
    return data.article.id as number;
  }, [getAuthHeaders]);

  const save = useCallback(async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const id = await persistDraft(savedId, draft);
      onSaved(id);
      setIsDirty(false);
      setSaveMsg("Saved");
      await qc.invalidateQueries({ queryKey: ["content-articles"] });
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [draft, savedId, persistDraft, onSaved, qc]);

  const publish = useCallback(async () => {
    setPublishing(true);
    setSaveMsg(null);
    try {
      let articleId = savedId;
      // Implicitly save first if there are unsaved changes or article not yet saved
      if (isDirty || !articleId) {
        articleId = await persistDraft(savedId, draft);
        onSaved(articleId);
        setIsDirty(false);
        await qc.invalidateQueries({ queryKey: ["content-articles"] });
      }
      const res = await fetch(`${API_BASE}/api/internal/content/articles/${articleId}/publish`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Publish failed");
      setIsPublished(true);
      const url: string = data.article?.liveUrl ?? `https://westhillscapital.com/insights/${draft.slug}`;
      setLiveUrl(url);
      setSaveMsg("Published");
      await qc.invalidateQueries({ queryKey: ["content-articles"] });
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }, [savedId, isDirty, draft, persistDraft, onSaved, getAuthHeaders, qc]);

  const unpublish = useCallback(async () => {
    if (!savedId) return;
    setUnpublishing(true);
    try {
      const res = await fetch(`${API_BASE}/api/internal/content/articles/${savedId}/unpublish`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Unpublish failed");
      setIsPublished(false);
      setLiveUrl(null);
      setSaveMsg("Moved back to draft");
      await qc.invalidateQueries({ queryKey: ["content-articles"] });
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Unpublish failed");
    } finally {
      setUnpublishing(false);
    }
  }, [savedId, getAuthHeaders, qc]);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onReset}
          className="text-xs text-[#8A9BB8] hover:text-[#0F1C3F] transition-colors px-3 py-1.5 rounded border border-[#DDD5C4] hover:border-[#8A9BB8]"
        >
          ← New topic
        </button>
        <div className="flex-1" />
        {saveMsg && !liveUrl && (
          <span className={`text-xs font-medium ${saveMsg === "Published" || saveMsg.includes("Published") ? "text-green-600" : saveMsg.includes("fail") || saveMsg.includes("Save first") ? "text-red-500" : "text-[#C49A38]"}`}>
            {saveMsg}
          </span>
        )}
        {liveUrl && (
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-green-600 hover:underline"
          >
            Published — view live →
          </a>
        )}
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded bg-[#F5F0E8] border border-[#DDD5C4] text-[#4A5B7A] hover:bg-[#E8E0D0] transition-colors disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Saving…" : "Save draft"}
        </button>
        {isPublished ? (
          <button
            onClick={unpublish}
            disabled={unpublishing}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            <EyeOff className="w-3.5 h-3.5" />
            {unpublishing ? "Unpublishing…" : "Unpublish"}
          </button>
        ) : (
          <button
            onClick={publish}
            disabled={publishing}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded bg-[#C49A38] text-white hover:bg-[#B8882A] transition-colors disabled:opacity-50"
          >
            <Globe className="w-3.5 h-3.5" />
            {publishing ? "Publishing…" : "Publish"}
          </button>
        )}
      </div>

      {/* Meta fields */}
      <div className="bg-white border border-[#DDD5C4] rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-[#8A9BB8] uppercase tracking-widest">Article metadata</h3>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="text-xs font-medium text-[#4A5B7A] block mb-1">Title</label>
            <input
              value={draft.title}
              onChange={(e) => handleFieldChange("title", e.target.value)}
              className="w-full border border-[#DDD5C4] rounded-lg px-3 py-2 text-sm text-[#0F1C3F] focus:outline-none focus:border-[#C49A38]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#4A5B7A] block mb-1">Slug</label>
            <input
              value={draft.slug}
              onChange={(e) => handleFieldChange("slug", e.target.value)}
              className="w-full border border-[#DDD5C4] rounded-lg px-3 py-2 text-sm text-[#0F1C3F] font-mono focus:outline-none focus:border-[#C49A38]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#4A5B7A] block mb-1">Excerpt</label>
            <textarea
              value={draft.excerpt}
              onChange={(e) => handleFieldChange("excerpt", e.target.value)}
              rows={3}
              className="w-full border border-[#DDD5C4] rounded-lg px-3 py-2 text-sm text-[#0F1C3F] resize-y focus:outline-none focus:border-[#C49A38]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-[#4A5B7A] block mb-1">Topic group</label>
              <select
                value={draft.group}
                onChange={(e) => handleFieldChange("group", e.target.value)}
                className="w-full border border-[#DDD5C4] rounded-lg px-3 py-2 text-sm text-[#0F1C3F] focus:outline-none focus:border-[#C49A38]"
              >
                {Object.entries(GROUP_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[#4A5B7A] block mb-1">Meta description ({draft.metaDescription.length} chars)</label>
              <input
                value={draft.metaDescription}
                onChange={(e) => handleFieldChange("metaDescription", e.target.value)}
                className="w-full border border-[#DDD5C4] rounded-lg px-3 py-2 text-sm text-[#0F1C3F] focus:outline-none focus:border-[#C49A38]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Article sections */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-[#8A9BB8] uppercase tracking-widest">Article body ({draft.sections.length} sections)</h3>
        {draft.sections.map((section, si) => (
          <div key={si} className="bg-white border border-[#DDD5C4] rounded-xl p-5 space-y-3">
            <input
              value={section.heading ?? ""}
              onChange={(e) => handleSectionHeadingChange(si, e.target.value)}
              placeholder="Section heading (optional)"
              className="w-full border-0 border-b border-[#DDD5C4] pb-2 text-sm font-semibold text-[#0F1C3F] focus:outline-none focus:border-[#C49A38] bg-transparent"
            />
            {section.paragraphs.map((para, pi) => (
              <textarea
                key={pi}
                value={para}
                onChange={(e) => handleParagraphChange(si, pi, e.target.value)}
                rows={Math.max(2, Math.ceil(para.length / 100))}
                className="w-full border border-[#DDD5C4] rounded-lg px-3 py-2 text-sm text-[#4A5B7A] leading-relaxed resize-y focus:outline-none focus:border-[#C49A38]"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SAVED ARTICLES LIST ──────────────────────────────────────────────────────

function SavedArticlesList({ onEdit }: { onEdit: (article: SavedArticle) => void }) {
  const { getAuthHeaders } = useInternalAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ articles: SavedArticle[] }>({
    queryKey: ["content-articles"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/internal/content/articles`, {
        headers: getAuthHeaders(),
      });
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/api/internal/content/articles/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-articles"] }),
  });

  if (isLoading) return <p className="text-sm text-[#8A9BB8]">Loading…</p>;
  if (!data?.articles?.length) return null;

  return (
    <div className="mt-8">
      <h3 className="text-xs font-semibold text-[#8A9BB8] uppercase tracking-widest mb-3">Saved articles</h3>
      <div className="space-y-2">
        {data.articles.map((article) => (
          <div
            key={article.id}
            className="flex items-center gap-3 bg-white border border-[#DDD5C4] rounded-lg px-4 py-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0F1C3F] truncate">{article.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                  article.status === "published"
                    ? "bg-green-50 text-green-700"
                    : "bg-[#F5F0E8] text-[#8A9BB8]"
                }`}>
                  {article.status === "published" ? "Published" : "Draft"}
                </span>
                <span className="text-[11px] text-[#8A9BB8]">/{article.slug}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {article.status === "published" && (
                <a
                  href={`/insights/${article.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded hover:bg-[#F5F0E8] text-[#8A9BB8] hover:text-[#C49A38] transition-colors"
                  title="View live article"
                >
                  <Eye className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                onClick={() => onEdit(article)}
                className="p-1.5 rounded hover:bg-[#F5F0E8] text-[#8A9BB8] hover:text-[#0F1C3F] transition-colors"
                title="Edit"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  if (confirm("Delete this article?")) deleteMutation.mutate(article.id);
                }}
                className="p-1.5 rounded hover:bg-red-50 text-[#8A9BB8] hover:text-red-500 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

type Mode = "topics" | "generating" | "editing";

export default function ContentEngine() {
  const { getAuthHeaders } = useInternalAuth();
  const [mode, setMode] = useState<Mode>("topics");
  const [customTopic, setCustomTopic] = useState("");
  const [draft, setDraft] = useState<DraftArticle | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [initialPublished, setInitialPublished] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const generate = useCallback(async (topic: string) => {
    if (!topic.trim()) return;
    setMode("generating");
    setGenError(null);
    try {
      const res = await fetch(`${API_BASE}/api/internal/content/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setDraft(data.draft);
      setSavedId(null);
      setInitialPublished(false);
      setMode("editing");
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
      setMode("topics");
    }
  }, [getAuthHeaders]);

  // Fetch full article (including sections + metaDescription) before opening editor
  const handleEdit = useCallback(async (article: SavedArticle) => {
    setMode("generating"); // reuse spinner state while fetching
    try {
      const res = await fetch(`${API_BASE}/api/internal/content/articles/${article.id}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load article");
      const full = data.article;
      setSavedId(full.id);
      setInitialPublished(full.status === "published");
      setDraft({
        title: full.title,
        slug: full.slug,
        excerpt: full.excerpt,
        group: full.group,
        metaDescription: full.metaDescription ?? "",
        sections: full.sections ?? [],
      });
      setMode("editing");
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Failed to load article");
      setMode("topics");
    }
  }, [getAuthHeaders]);

  const reset = () => {
    setMode("topics");
    setDraft(null);
    setSavedId(null);
    setInitialPublished(false);
    setGenError(null);
    setCustomTopic("");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[#0F1C3F] mb-1">Content Engine</h1>
        <p className="text-sm text-[#6B7A99]">
          Generate Insights articles in the WHC voice. Review and edit before publishing.
        </p>
      </div>

      {/* Generating state */}
      {mode === "generating" && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-8 h-8 border-2 border-[#C49A38] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#6B7A99]">Drafting article in the WHC voice…</p>
          <p className="text-xs text-[#8A9BB8]">This usually takes 10–20 seconds.</p>
        </div>
      )}

      {/* Topic picker */}
      {mode === "topics" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-sm font-semibold text-[#0F1C3F] mb-4">
              <Sparkles className="w-4 h-4 inline mr-1.5 text-[#C49A38]" />
              Choose a topic
            </h2>
            <TopicPicker onSelect={(t) => generate(t)} />

            {/* Custom topic */}
            <div className="mt-6">
              <label className="text-xs font-semibold text-[#8A9BB8] uppercase tracking-widest block mb-2">Or write your own</label>
              <div className="flex gap-2">
                <input
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && generate(customTopic)}
                  placeholder="Describe the article topic…"
                  className="flex-1 border border-[#DDD5C4] rounded-lg px-3 py-2 text-sm text-[#0F1C3F] focus:outline-none focus:border-[#C49A38]"
                />
                <button
                  onClick={() => generate(customTopic)}
                  disabled={!customTopic.trim()}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#C49A38] text-white hover:bg-[#B8882A] disabled:opacity-40 transition-colors"
                >
                  Draft
                </button>
              </div>
            </div>

            {genError && (
              <p className="mt-3 text-xs text-red-500">{genError}</p>
            )}
          </div>

          <div>
            <SavedArticlesList onEdit={handleEdit} />
          </div>
        </div>
      )}

      {/* Editor */}
      {mode === "editing" && draft && (
        <ArticleEditor
          initial={draft}
          savedId={savedId}
          initialPublished={initialPublished}
          onSaved={(id) => setSavedId(id)}
          onReset={reset}
        />
      )}
    </div>
  );
}
