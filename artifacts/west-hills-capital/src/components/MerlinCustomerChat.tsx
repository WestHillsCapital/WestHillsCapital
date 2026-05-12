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
  label?:        string;
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

function WizardHatIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
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

function MicIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function SpeakerOnIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function SpeakerOffIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
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

function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/^[ \t]*[-*•]\s+/gm, "")
    .replace(/^[ \t]*\d+\.\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .trim();
}

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
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [input,       setInput]       = useState("");
  const [isLoading,   setIsLoading]   = useState(false);
  const [reviewShown, setReviewShown] = useState(false);

  // Voice state
  const [voiceEnabled,  setVoiceEnabled]  = useState(false);
  const [isListening,   setIsListening]   = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef  = useRef<any>(null);
  const lastSpokenIdRef = useRef<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef       = useRef<HTMLInputElement | null>(null);
  const hasInitedRef   = useRef(false);

  const interviewFields    = fields.filter((f) => f.interviewMode !== "omitted" && f.interviewMode !== "readonly");
  const requiredFields     = interviewFields.filter((f) => f.interviewMode === "required");
  const answeredCount      = requiredFields.filter((f) => answers[f.id]?.trim()).length;
  const allRequiredAnswered = answeredCount === requiredFields.length && requiredFields.length > 0;

  // Initial greeting
  useEffect(() => {
    if (hasInitedRef.current) return;
    hasInitedRef.current = true;

    const firstPendingField = interviewFields.find((f) => !answers[f.id]?.trim());
    const greeting = firstPendingField
      ? `I'm Merlin — I'll guide you through the ${packageName} form one step at a time. Consider it handled.\n\nLet's start: ${(firstPendingField.label ?? firstPendingField.name).toLowerCase()}`
      : `I'm Merlin. I can see you've already made good progress on the ${packageName} form — a little wizardry goes a long way. Ask me anything, or I can help you review what's been filled in.`;

    setMessages([{ id: "greeting", role: "assistant", content: greeting }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Speak new assistant messages when voice is enabled
  useEffect(() => {
    if (!voiceEnabled || isLoading) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant" || lastMsg.thinking) return;
    if (lastMsg.id === lastSpokenIdRef.current) return;
    lastSpokenIdRef.current = lastMsg.id;

    const text = stripMarkdownForSpeech(lastMsg.content);
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  }, [messages, voiceEnabled, isLoading]);

  // Cancel speech on unmount
  useEffect(() => {
    return () => { window.speechSynthesis.cancel(); };
  }, []);

  // Auto-show review step when all required fields answered (only once)
  useEffect(() => {
    if (!allRequiredAnswered || reviewShown || messages.length === 0 || isLoading) return;
    setReviewShown(true);

    const lines = interviewFields
      .filter((f) => answers[f.id]?.trim())
      .map((f) => {
        const val = answers[f.id];
        return `  • **${f.label ?? f.name}**: ${val}`;
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

  function toggleVoice() {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    if (!next) {
      window.speechSynthesis.cancel();
      recognitionRef.current?.stop();
    }
  }

  function toggleListening() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

    if (!SR) {
      alert("Voice input isn't supported in this browser. Try Chrome on Android or Safari on iPhone.");
      return;
    }

    window.speechSynthesis.cancel();

    const recognition = new SR();
    recognition.continuous    = false;
    recognition.interimResults = false;
    recognition.lang          = "en-US";

    recognition.onstart = () => setIsListening(true);
    recognition.onend   = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setTimeout(() => void sendMessage(transcript), 200);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  async function sendMessage(text?: string) {
    const userText = (text ?? input).trim();
    if (!userText || isLoading) return;
    setInput("");
    window.speechSynthesis.cancel();

    const userMsg: Message     = { id: crypto.randomUUID(), role: "user",     content: userText };
    const thinkingMsg: Message = { id: "thinking",         role: "assistant", content: "", thinking: true };
    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setIsLoading(true);

    const history = [
      ...messages.filter((m) => !m.thinking),
      userMsg,
    ].map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${API_BASE}/api/v1/docuplete/public/sessions/${token}/merlin`, {
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
          <WizardHatIcon className="w-5 h-5" />
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

        {/* Voice toggle */}
        <button
          onClick={toggleVoice}
          className="ml-2 shrink-0 opacity-70 hover:opacity-100 transition-opacity border border-white/30 rounded-lg p-1.5"
          title={voiceEnabled ? "Mute Merlin's voice" : "Enable Merlin's voice"}
          aria-label={voiceEnabled ? "Mute Merlin's voice" : "Enable Merlin's voice"}
        >
          {voiceEnabled
            ? <SpeakerOnIcon className="w-3.5 h-3.5" />
            : <SpeakerOffIcon className="w-3.5 h-3.5" />
          }
        </button>

        <button
          onClick={onSwitchToForm}
          className="text-[11px] opacity-70 hover:opacity-100 transition-opacity border border-white/30 rounded-lg px-2 py-1 whitespace-nowrap shrink-0"
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
                <WizardHatIcon className="w-3.5 h-3.5" />
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

      {/* Review gate */}
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
            placeholder={
              isListening
                ? "Listening…"
                : isLoading
                ? "Merlin is thinking…"
                : "Type your answer or tap the mic…"
            }
            disabled={isLoading || isListening}
            className="flex-1 bg-transparent text-sm text-[#0F1C3F] placeholder-[#8A9BB8] outline-none min-w-0"
          />

          {/* Mic button */}
          <button
            onClick={toggleListening}
            disabled={isLoading}
            className={[
              "shrink-0 transition-all rounded-full p-1",
              isListening
                ? "text-white animate-pulse"
                : "text-[#8A9BB8] hover:text-[#0F1C3F]",
            ].join(" ")}
            style={isListening ? { backgroundColor: brandColor } : undefined}
            aria-label={isListening ? "Stop listening" : "Speak your answer"}
            title={isListening ? "Stop listening" : "Speak your answer"}
          >
            <MicIcon className="w-4 h-4" />
          </button>

          {/* Send button */}
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
