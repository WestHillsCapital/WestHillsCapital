import { useEffect, useRef, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type Message = {
  id:       string;
  role:     "user" | "assistant";
  content:  string;
  thinking?: boolean;
};

type FieldItem = {
  id:            string;
  name:          string;
  type:          string;
  interviewMode: "required" | "optional" | "readonly" | "omitted";
  options?:      string[];
  condition?:    { fieldId: string; operator: string; value?: string } | null;
};

interface MerlinCustomerChatProps {
  token:          string;
  fields:         FieldItem[];
  answers:        Record<string, string>;
  brandColor:     string;
  packageName:    string;
  onFieldUpdate:  (updates: Record<string, string>) => void;
  onSwitchToForm: () => void;
}

function WandIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 4V2m0 13v-2M8 9H2m13.5-1.5L14 9M3 3l18 18M8.5 14.5 3 20m9-9 7.5-7.5" />
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

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 h-4">
      <span className="w-1.5 h-1.5 rounded-full bg-[#8A9BB8] animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-[#8A9BB8] animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-[#8A9BB8] animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

function getBrandTextColor(hex: string): string {
  try {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b > 0.6 ? "#0F1C3F" : "#ffffff";
  } catch { return "#ffffff"; }
}

// Parse SSE stream from a ReadableBody response
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

export function MerlinCustomerChat({
  token,
  fields,
  answers,
  brandColor,
  packageName,
  onFieldUpdate,
  onSwitchToForm,
}: MerlinCustomerChatProps) {
  const brandTextColor = getBrandTextColor(brandColor);
  const [messages,   setMessages]   = useState<Message[]>([]);
  const [input,      setInput]      = useState("");
  const [isLoading,  setIsLoading]  = useState(false);
  const [reviewShown, setReviewShown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef       = useRef<HTMLInputElement | null>(null);
  const hasInitedRef   = useRef(false);

  const interviewFields = fields.filter((f) => f.interviewMode !== "omitted" && f.interviewMode !== "readonly");
  const requiredFields  = interviewFields.filter((f) => f.interviewMode === "required");
  const answeredCount   = requiredFields.filter((f) => answers[f.id]?.trim()).length;
  const allRequiredAnswered = answeredCount === requiredFields.length && requiredFields.length > 0;

  // Initial greeting
  useEffect(() => {
    if (hasInitedRef.current) return;
    hasInitedRef.current = true;

    const firstPendingField = interviewFields.find((f) => !answers[f.id]?.trim());
    const greeting = firstPendingField
      ? `I'm Merlin — I'll guide you through the ${packageName} form one step at a time. Consider it handled.\n\nLet's start: what is your ${firstPendingField.name.toLowerCase()}?`
      : `I'm Merlin. I can see you've already made good progress on the ${packageName} form — a little wizardry goes a long way. Ask me anything, or I can help you review what's been filled in.`;

    setMessages([{ id: "greeting", role: "assistant", content: greeting }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-show review step when all required fields answered (only once)
  useEffect(() => {
    if (!allRequiredAnswered || reviewShown || messages.length === 0 || isLoading) return;
    setReviewShown(true);

    // Build a review summary message
    const lines = interviewFields
      .filter((f) => answers[f.id]?.trim())
      .map((f) => {
        const val = answers[f.id];
        return `  • **${f.name}**: ${val}`;
      });

    const reviewContent = [
      `All required fields are answered — consider it handled! Here's what I've recorded:\n`,
      ...lines,
      `\nEverything look right? You can confirm below to review the form and submit, or keep chatting if you'd like to make any changes.`,
    ].join("\n");

    setMessages((prev) => [
      ...prev,
      { id: "review-summary", role: "assistant", content: reviewContent },
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRequiredAnswered]);

  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [messages]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  async function sendMessage(text?: string) {
    const userText = (text ?? input).trim();
    if (!userText || isLoading) return;
    setInput("");

    const userMsg: Message     = { id: crypto.randomUUID(), role: "user",     content: userText };
    const thinkingMsg: Message = { id: "thinking",         role: "assistant", content: "", thinking: true };
    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setIsLoading(true);

    const history = [
      ...messages.filter((m) => !m.thinking),
      userMsg,
    ].map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${API_BASE}/api/v1/docufill/public/sessions/${token}/merlin`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ messages: history, answers }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const replyId = crypto.randomUUID();
      let replyText = "";
      let started   = false;

      for await (const event of parseSSE(res)) {
        if (event.type === "chunk" && typeof event.text === "string") {
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

        if (event.type === "field_updates" && event.updates && typeof event.updates === "object") {
          onFieldUpdate(event.updates as Record<string, string>);
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
    } catch {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== "thinking"),
        { id: crypto.randomUUID(), role: "assistant", content: "I couldn't reach the server just now. Your progress is saved — please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-[480px]">
      {/* Merlin header */}
      <div
        className="rounded-xl px-4 py-3 flex items-center gap-3 mb-4 shrink-0"
        style={{ backgroundColor: brandColor, color: brandTextColor }}
      >
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <WandIcon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm leading-tight">Merlin</div>
          <div className="text-[11px] opacity-70 leading-tight">Your document guide</div>
        </div>

        {/* Progress indicator */}
        {requiredFields.length > 0 && (
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div className="text-[11px] opacity-80 font-medium">
              {answeredCount}/{requiredFields.length}
            </div>
            <div className="w-16 h-1.5 rounded-full bg-white/25 overflow-hidden">
              <div
                className="h-full rounded-full bg-white/80 transition-all duration-500"
                style={{ width: `${requiredFields.length > 0 ? (answeredCount / requiredFields.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={onSwitchToForm}
          className="ml-2 text-[11px] opacity-70 hover:opacity-100 transition-opacity border border-white/30 rounded-lg px-2 py-1 whitespace-nowrap shrink-0"
          title="Switch to self-fill form"
        >
          Fill form yourself
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2 min-h-0">
        {messages.map((msg) => {
          const isUser = msg.role === "user";

          if (isUser) {
            return (
              <div key={msg.id} className="flex justify-end">
                <div
                  className="max-w-[80%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm text-white"
                  style={{ backgroundColor: brandColor }}
                >
                  {msg.content}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex items-start gap-2.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-white"
                style={{ backgroundColor: brandColor }}
              >
                <WandIcon className="w-3.5 h-3.5" />
              </div>
              <div className="max-w-[82%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm bg-[#F0EDE8] text-[#0F1C3F]">
                {msg.thinking ? (
                  <ThinkingDots />
                ) : (
                  <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Review gate — shown after Merlin summary when all required fields are done */}
      {allRequiredAnswered && reviewShown && (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 shrink-0">
          <p className="text-sm font-medium text-green-800 mb-1">All required fields complete.</p>
          <p className="text-xs text-green-700 mb-2">
            Switch to the form to do a final review of your answers before submitting. Any changes Merlin made are already filled in.
          </p>
          <button
            onClick={onSwitchToForm}
            className="text-sm font-semibold text-white px-4 py-1.5 rounded-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: brandColor }}
          >
            Review and submit →
          </button>
        </div>
      )}

      {/* Input */}
      <div className="mt-3 shrink-0">
        <div className="flex items-center gap-2 bg-[#F8F6F0] rounded-xl px-3 py-2.5 border border-[#DDD5C4] focus-within:border-[#8A9BB8] transition-colors">
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
            placeholder={isLoading ? "Merlin is thinking…" : "Type your answer or ask a question…"}
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
        <p className="text-[10px] text-[#8A9BB8] mt-1.5 text-center">
          Merlin fills fields as you answer. All answers are encrypted in transit.
        </p>
      </div>
    </div>
  );
}
