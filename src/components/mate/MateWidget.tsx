"use client";

// Mate widget — the floating agent chip mounted anywhere in the
// app. Bottom-right corner (safe area for iOS). Tap → expands
// to a full chat panel. Persists conversation_id in localStorage
// so returning users pick up mid-thread.
//
// Surface is passed in by whichever layout mounts it:
//   • Merchant AppShell drawer → surface="merchant"
//   • Homeowner shell         → surface="homeowner"
//   • Public canteen page      → surface="visitor" + canteenSlug

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";

type Msg = {
  id?:            string;
  role:           "user" | "assistant";
  content:        string;
  feedback?:      1 | -1 | null;
  model?:         string;
};

type Props = {
  surface:      "merchant" | "homeowner" | "visitor";
  canteenSlug?: string;
  homeownerId?: string;
  /** Optional overrides — used by embed contexts to preset the
   *  greeting or seed suggested prompts. */
  greeting?:    string;
  quickPrompts?: string[];
};

const DEFAULT_GREETINGS: Record<Props["surface"], string> = {
  merchant:  "Alright mate. Ask me anything about your dashboard, your reviews, or how to get to Gold.",
  homeowner: "Alright mate. What are you trying to sort out around the house?",
  visitor:   "Hi there. I can tell you about this trade, their prices, or help you get a quote."
};

const DEFAULT_PROMPTS: Record<Props["surface"], string[]> = {
  merchant: [
    "How am I doing this week?",
    "How do I reach Gold?",
    "Draft a reply to my last review"
  ],
  homeowner: [
    "What trade do I need for a leaking radiator?",
    "How do I find a good electrician nearby?",
    "What should a new consumer unit cost?"
  ],
  visitor: [
    "What does this trade specialise in?",
    "Are they any good?",
    "How do I get a quote?"
  ]
};

const STORAGE_KEY = (s: string) => `mate_conv_${s}`;

export function MateWidget({ surface, canteenSlug, homeownerId, greeting, quickPrompts }: Props) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput]       = useState("");
  const [convId, setConvId]     = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const scrollRef               = useRef<HTMLDivElement>(null);

  // Load persisted conv id on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY(surface));
    if (stored) setConvId(stored);
  }, [surface]);

  // On open, if we have a conv id but no messages yet, load history
  useEffect(() => {
    if (!open || !convId || messages.length > 0) return;
    (async () => {
      try {
        const res  = await fetch(`/api/mate/history?conversation_id=${convId}`);
        const json = await res.json();
        if (json.ok && json.messages) {
          setMessages(json.messages.map((m: { id: string; role: string; content: string; feedback_signal: number | null; model: string | null }) => ({
            id:       m.id,
            role:     m.role === "assistant" ? "assistant" : "user",
            content:  m.content,
            feedback: m.feedback_signal as 1 | -1 | null,
            model:    m.model ?? undefined
          })));
        }
      } catch {}
    })();
  }, [open, convId, messages.length]);

  // Auto-scroll to latest
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setErr(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    try {
      const res  = await fetch("/api/mate/converse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surface,
          conversation_id: convId,
          message:         trimmed,
          canteen_slug:    canteenSlug,
          homeowner_id:    homeownerId
        })
      });
      const json = await res.json();
      if (res.status === 429) {
        setErr(`You've hit today's ${json.cap}-message limit. Try again tomorrow, or upgrade for higher caps.`);
        return;
      }
      if (!res.ok || !json.ok) throw new Error(json.error ?? "converse_failed");
      if (json.conversation_id && json.conversation_id !== convId) {
        setConvId(json.conversation_id);
        localStorage.setItem(STORAGE_KEY(surface), json.conversation_id);
      }
      setMessages((prev) => [...prev, {
        id:      json.message_id,
        role:    "assistant",
        content: json.answer,
        model:   json.model_used
      }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "converse_failed");
    } finally {
      setBusy(false);
    }
  }

  async function feedback(msgId: string | undefined, signal: 1 | -1) {
    if (!msgId) return;
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, feedback: signal } : m));
    try {
      await fetch("/api/mate/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: msgId, signal })
      });
    } catch {}
  }

  const showGreeting = messages.length === 0;
  const usePrompts   = quickPrompts ?? DEFAULT_PROMPTS[surface];

  return (
    <>
      {/* Floating chip */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat with Mate"
          className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition hover:scale-105 active:scale-95"
          style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
        >
          <span className="absolute -top-1 -right-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider shadow" style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}>
            Mate
          </span>
          <MessageCircle size={22} strokeWidth={2.3}/>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-4 right-4 z-40 flex h-[min(600px,90dvh)] w-[min(400px,94vw)] flex-col overflow-hidden rounded-2xl border shadow-2xl"
          style={{ backgroundColor: "white", borderColor: "rgba(0,0,0,0.10)" }}
          role="dialog" aria-label="Chat with Mate"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-3 py-2" style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
                <MessageCircle size={15} strokeWidth={2.4}/>
              </div>
              <div>
                <p className="text-sm font-black">Mate</p>
                <p className="text-[9px] font-black uppercase tracking-wider opacity-70">The Networkers AI</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1 hover:bg-white/10">
              <X size={16}/>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {showGreeting && (
              <div className="rounded-2xl bg-neutral-100 p-3 text-[13px] text-neutral-800">
                {greeting ?? DEFAULT_GREETINGS[surface]}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={m.id ?? i} className={m.role === "user" ? "flex justify-end" : ""}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl px-3 py-2 text-[13px]" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
                    {m.content}
                  </div>
                ) : (
                  <div>
                    <div className="max-w-[85%] rounded-2xl bg-neutral-100 px-3 py-2 text-[13px] text-neutral-900 whitespace-pre-wrap">
                      {m.content}
                    </div>
                    {m.id && (
                      <div className="mt-1 flex items-center gap-1 pl-1">
                        <button
                          onClick={() => feedback(m.id, 1)}
                          className={"flex h-5 w-5 items-center justify-center rounded-full transition " + (m.feedback === 1 ? "bg-green-100 text-green-700" : "text-neutral-400 hover:text-neutral-700")}
                          aria-label="Helpful"
                        >
                          <ThumbsUp size={10} strokeWidth={2.5}/>
                        </button>
                        <button
                          onClick={() => feedback(m.id, -1)}
                          className={"flex h-5 w-5 items-center justify-center rounded-full transition " + (m.feedback === -1 ? "bg-red-100 text-red-700" : "text-neutral-400 hover:text-neutral-700")}
                          aria-label="Not helpful"
                        >
                          <ThumbsDown size={10} strokeWidth={2.5}/>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-[12px] text-neutral-500">
                <Loader2 size={12} className="animate-spin"/> Mate&rsquo;s thinking&hellip;
              </div>
            )}
            {err && (
              <div className="rounded-lg bg-red-50 p-2 text-[12px] text-red-800">{err}</div>
            )}
          </div>

          {/* Quick prompts */}
          {showGreeting && (
            <div className="border-t px-3 py-2">
              <p className="mb-1.5 text-[9px] font-black uppercase tracking-wider text-neutral-500">Try asking</p>
              <div className="flex flex-wrap gap-1">
                {usePrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="rounded-full border px-2.5 py-1 text-[11px] hover:bg-neutral-50"
                    style={{ borderColor: "rgba(0,0,0,0.10)" }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t p-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Mate anything…"
              disabled={busy}
              maxLength={1200}
              className="flex-1 rounded-full border px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
              style={{ borderColor: "rgba(0,0,0,0.10)" }}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-50"
              style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
              aria-label="Send"
            >
              <Send size={14}/>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
