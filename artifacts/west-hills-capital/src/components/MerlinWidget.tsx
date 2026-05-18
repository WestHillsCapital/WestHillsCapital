import { useEffect, useRef, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

const SESSION_STORAGE_KEY = "merlin_widget_history";

const DEFAULT_W = 380;
const DEFAULT_H = 540;
const MIN_W = 300;
const MIN_H = 320;

type Message = {
  id:       string;
  role:     "user" | "assistant";
  content:  string;
  thinking?: boolean;
};

interface MerlinWidgetProps {
  getAuthHeaders: () => HeadersInit;
  brandColor?: string;
  chatUrl?: string;
}

function WizardHatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M8 2.5C9 5 10 8 10 10C9 12 7.5 14.5 7 17H18C17.5 14.5 15.5 12 15 10C15 7 13 4 8 2.5Z" />
      <path d="M1 17Q3.5 21.5 12 22Q20.5 21.5 23 17H1Z" />
      <path d="M11 17L8.5 15.5L10 14.5L12 16L14 14.5L15.5 15.5L13 17L12.5 16.5H11.5L11 17Z" fillOpacity={0.5} />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-40">
      <circle cx="5" cy="5" r="1.2" /><circle cx="11" cy="5" r="1.2" />
      <circle cx="5" cy="11" r="1.2" /><circle cx="11" cy="11" r="1.2" />
    </svg>
  );
}

function MerlinAvatar({ brandColor }: { brandColor: string }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white"
      style={{ backgroundColor: brandColor }}
      title="Merlin"
    >
      <WizardHatIcon />
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 h-4">
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

function ToolCallBadge({ names }: { names: string[] }) {
  const label = names.map((n) => n.replace(/_/g, " ")).join(", ");
  return (
    <div className="text-[10px] text-[#8A9BB8] italic px-3 py-1">
      ✦ Looking up {label}…
    </div>
  );
}

function renderMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(```(?:[^\n`]*)?\n[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        const codeMatch = part.match(/^```([^\n]*)\n([\s\S]*)```$/);
        if (codeMatch) {
          const code = codeMatch[2].replace(/\n$/, "");
          return (
            <pre
              key={i}
              className="mt-1.5 mb-1 rounded-md bg-black/10 text-[11px] font-mono overflow-x-auto"
              style={{ padding: "8px 10px", whiteSpace: "pre", wordBreak: "normal", maxWidth: "100%" }}
            >
              {code}
            </pre>
          );
        }

        const segments = part.split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={i} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word" }}>
            {segments.map((seg, j) => {
              const bold = seg.match(/^\*\*([^*]+)\*\*$/);
              if (bold) return <strong key={j}>{bold[1]}</strong>;
              return seg;
            })}
          </span>
        );
      })}
    </>
  );
}

function MessageBubble({ message, brandColor }: { message: Message; brandColor: string }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[82%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm text-white"
          style={{ backgroundColor: brandColor, wordBreak: "break-word", overflowWrap: "break-word" }}
        >
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <MerlinAvatar brandColor={brandColor} />
      <div
        className="min-w-0 flex-1 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm bg-[#F0EDE8] text-[#0F1C3F] overflow-hidden"
        style={{ maxWidth: "calc(100% - 36px)" }}
      >
        {message.thinking ? (
          <span className="text-[#6B7A99]"><ThinkingDots /></span>
        ) : (
          renderMarkdown(message.content)
        )}
      </div>
    </div>
  );
}

const SUGGESTED_PROMPTS = [
  "What sessions came in today?",
  "Show me sessions that are still in progress",
  "How many submissions this month?",
  "Find me the Gold IRA package",
];

async function* parseSSE(response: Response): AsyncGenerator<Record<string, unknown>> {
  const reader  = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer    = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part.trim();
      if (line.startsWith("data: ")) {
        try { yield JSON.parse(line.slice(6)) as Record<string, unknown>; } catch { /* ignore */ }
      }
    }
  }
}

export function MerlinWidget({ getAuthHeaders, brandColor = "#0F1C3F", chatUrl }: MerlinWidgetProps) {
  const merlinUrl = chatUrl ?? `${API_BASE}/api/v1/product/merlin/chat`;
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      return stored ? (JSON.parse(stored) as Message[]) : [];
    } catch { return []; }
  });
  const [input,        setInput]       = useState("");
  const [isLoading,    setIsLoading]   = useState(false);
  const [activeTools,  setActiveTools] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef       = useRef<HTMLInputElement | null>(null);
  const abortRef       = useRef<AbortController | null>(null);
  const panelRef       = useRef<HTMLDivElement | null>(null);

  const [pos,  setPos]  = useState<{ left: number; top: number } | null>(null);
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });

  const dragStateRef   = useRef<{ mx: number; my: number; left: number; top: number } | null>(null);
  const resizeStateRef = useRef<{ mx: number; my: number; w: number; h: number } | null>(null);

  const hasGreeted = messages.length > 0;

  const textColor = (() => {
    try {
      const h = brandColor.replace("#", "");
      const r = parseInt(h.slice(0, 2), 16) / 255;
      const g = parseInt(h.slice(2, 4), 16) / 255;
      const b = parseInt(h.slice(4, 6), 16) / 255;
      return 0.299 * r + 0.587 * g + 0.114 * b > 0.6 ? "#0F1C3F" : "#ffffff";
    } catch { return "#ffffff"; }
  })();

  useEffect(() => {
    const filtered = messages.filter((m) => !m.thinking);
    if (filtered.length > 0) {
      try { sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(filtered)); } catch { /* ignore */ }
    }
  }, [messages]);

  useEffect(() => {
    if (open && !hasGreeted) {
      setMessages([{
        id:      "greeting",
        role:    "assistant",
        content: "I'm Merlin — your Docuplete assistant. Ask me anything about your packages, sessions, submissions, or account. A little wizardry goes a long way.",
      }]);
    }
  }, [open, hasGreeted]);

  useEffect(() => {
    if (open) setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  function startDrag(e: React.MouseEvent) {
    if (!panelRef.current) return;
    e.preventDefault();
    const rect = panelRef.current.getBoundingClientRect();
    dragStateRef.current = { mx: e.clientX, my: e.clientY, left: rect.left, top: rect.top };

    function onMove(ev: MouseEvent) {
      if (!dragStateRef.current) return;
      const newLeft = Math.max(0, Math.min(window.innerWidth  - size.w, dragStateRef.current.left + ev.clientX - dragStateRef.current.mx));
      const newTop  = Math.max(0, Math.min(window.innerHeight - 60,     dragStateRef.current.top  + ev.clientY - dragStateRef.current.my));
      setPos({ left: newLeft, top: newTop });
    }

    function onUp() {
      dragStateRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    resizeStateRef.current = { mx: e.clientX, my: e.clientY, w: size.w, h: size.h };

    function onMove(ev: MouseEvent) {
      if (!resizeStateRef.current) return;
      setSize({
        w: Math.max(MIN_W, resizeStateRef.current.w + ev.clientX - resizeStateRef.current.mx),
        h: Math.max(MIN_H, resizeStateRef.current.h + ev.clientY - resizeStateRef.current.my),
      });
    }

    function onUp() {
      resizeStateRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }

  const panelStyle: React.CSSProperties = pos
    ? { position: "fixed", left: pos.left, top: pos.top, width: size.w, height: size.h, zIndex: 50 }
    : { position: "fixed", bottom: 80, right: 20, width: size.w, height: size.h, zIndex: 50 };

  async function sendMessage(text?: string) {
    const userText = (text ?? input).trim();
    if (!userText || isLoading) return;
    setInput("");
    setActiveTools([]);

    const userMsg: Message     = { id: crypto.randomUUID(), role: "user",      content: userText };
    const thinkingMsg: Message = { id: "thinking",         role: "assistant",  content: "", thinking: true };

    setMessages((prev) => [...prev.filter((m) => !m.thinking), userMsg, thinkingMsg]);
    setIsLoading(true);

    const history = [
      ...messages.filter((m) => !m.thinking),
      userMsg,
    ].map((m) => ({ role: m.role, content: m.content }));

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch(merlinUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...(getAuthHeaders() as Record<string, string>) },
        body:    JSON.stringify({ messages: history }),
        signal:  abort.signal,
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const replyId = crypto.randomUUID();
      let replyText = "";
      let started   = false;

      for await (const event of parseSSE(res)) {
        if (abort.signal.aborted) break;

        if (event.type === "tool" && Array.isArray(event.names)) {
          setActiveTools(event.names as string[]);
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== "thinking"),
            { id: "thinking", role: "assistant", content: "", thinking: true },
          ]);
        }

        if (event.type === "chunk" && typeof event.text === "string") {
          setActiveTools([]);
          replyText += event.text;
          if (!started) {
            started = true;
            setMessages((prev) => [
              ...prev.filter((m) => m.id !== "thinking"),
              { id: replyId, role: "assistant", content: replyText },
            ]);
          } else {
            setMessages((prev) =>
              prev.map((m) => m.id === replyId ? { ...m, content: replyText } : m),
            );
          }
        }

        if (event.type === "error" && typeof event.message === "string") {
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== "thinking"),
            { id: crypto.randomUUID(), role: "assistant", content: event.message as string },
          ]);
        }

        if (event.type === "done") break;
      }

      if (!started) {
        setMessages((prev) => prev.filter((m) => m.id !== "thinking"));
      }
    } catch (err) {
      if ((err as { name?: string }).name !== "AbortError") {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== "thinking"),
          { id: crypto.randomUUID(), role: "assistant", content: "I couldn't reach the server. Please check your connection and try again." },
        ]);
      }
    } finally {
      setIsLoading(false);
      setActiveTools([]);
      abortRef.current = null;
    }
  }

  function clearConversation() {
    abortRef.current?.abort();
    setMessages([]);
    setIsLoading(false);
    setActiveTools([]);
    setInput("");
    try { sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch { /* ignore */ }
    setOpen(false);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        style={{ backgroundColor: brandColor, color: textColor }}
        title="Chat with Merlin"
        aria-label="Open Merlin assistant"
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <WizardHatIcon />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          ref={panelRef}
          className="rounded-2xl shadow-2xl border border-[#DDD5C4] bg-white flex flex-col overflow-hidden"
          style={panelStyle}
        >
          {/* Header — drag handle */}
          <div
            onMouseDown={startDrag}
            className="px-4 py-3 flex items-center gap-2.5 shrink-0 select-none"
            style={{ backgroundColor: brandColor, color: textColor, cursor: "grab" }}
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <WizardHatIcon />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm leading-tight">Merlin</div>
              <div className="text-[11px] opacity-70 leading-tight">Docuplete assistant</div>
            </div>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={clearConversation}
              className="ml-auto opacity-60 hover:opacity-100 transition-opacity p-1 rounded"
              style={{ cursor: "pointer" }}
              title="Clear conversation"
              aria-label="Clear and close"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Active tool call indicator */}
          {activeTools.length > 0 && <ToolCallBadge names={activeTools} />}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} brandColor={brandColor} />
            ))}

            {messages.length === 1 && messages[0].role === "assistant" && (
              <div className="space-y-1.5 pt-1">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => void sendMessage(p)}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-[#DDD5C4] bg-[#FAFAF8] text-[#4A5B7A] hover:bg-[#F0EDE8] transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-2 pt-2 border-t border-[#EFE8D8] shrink-0">
            <div className="flex items-center gap-2 bg-[#F8F6F0] rounded-xl px-3 py-2 border border-[#DDD5C4] focus-within:border-[#8A9BB8] transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Ask Merlin anything…"
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-[#0F1C3F] placeholder-[#8A9BB8] outline-none min-w-0"
              />
              <button
                onClick={() => void sendMessage()}
                disabled={!input.trim() || isLoading}
                className="shrink-0 disabled:opacity-40 transition-opacity"
                style={{ color: brandColor }}
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            </div>
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={startResize}
            className="absolute bottom-0 right-0 w-5 h-5 flex items-center justify-center cursor-se-resize"
            style={{ cursor: "se-resize" }}
            title="Drag to resize"
          >
            <GripIcon />
          </div>
        </div>
      )}
    </>
  );
}
