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
import { MessageCircle, X, Send, ThumbsUp, ThumbsDown, Loader2, Paperclip, Image as ImageIcon } from "lucide-react";

const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 2_500_000; // 2.5MB raw before base64 inflation

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";

type UiCard = {
  kind:     "draft-review-reply" | "draft-yard-post" | "list" | "action";
  payload:  Record<string, unknown>;
  fromTool: string;
};

type Msg = {
  id?:            string;
  role:           "user" | "assistant";
  content:        string;
  feedback?:      1 | -1 | null;
  model?:         string;
  uiCards?:       UiCard[];
  /** Client-side preview URL for a photo the user just sent. Not
   *  persisted server-side; refreshing loses the thumb. Fine. */
  imagePreview?:  string;
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
    "How am I doing this month?",
    "Reply to my last review",
    "Compare views vs WhatsApp taps"
  ],
  homeowner: [
    "What trade do I need for a leaking radiator?",
    "Find a plumber near me",
    "What should a new consumer unit cost?"
  ],
  visitor: [
    "What does this trade specialise in?",
    "Are they any good?",
    "How do I get a quote?"
  ]
};

const STORAGE_KEY = (s: string) => `mate_conv_${s}`;

type PendingImage = {
  base64:     string;   // no data: prefix
  media_type: string;
  previewUrl: string;   // data: URL for the preview thumb
  size:       number;
};

export function MateWidget({ surface, canteenSlug, homeownerId, greeting, quickPrompts }: Props) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput]       = useState("");
  const [convId, setConvId]     = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const fileRef                 = useRef<HTMLInputElement>(null);
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

  async function pickFile(f: File) {
    if (!ALLOWED_IMAGE.includes(f.type)) {
      setErr("That file type isn't supported. Try JPG, PNG, WebP or GIF.");
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setErr("Photo is over 2.5MB. Try a smaller one or compress it first.");
      return;
    }
    const buf   = await f.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64   = btoa(bin);
    const dataUrl = `data:${f.type};base64,${b64}`;
    setPendingImage({ base64: b64, media_type: f.type, previewUrl: dataUrl, size: f.size });
    setErr(null);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    const hasImage = !!pendingImage;
    if ((!trimmed && !hasImage) || busy) return;
    setBusy(true);
    setErr(null);
    setInput("");
    const displayContent = trimmed || (hasImage ? "(sent a photo)" : "");
    const previewToShow  = pendingImage?.previewUrl;
    setMessages((prev) => [...prev, { role: "user", content: displayContent, imagePreview: previewToShow }]);
    const imgToSend = pendingImage;
    setPendingImage(null);
    try {
      const res  = await fetch("/api/mate/converse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surface,
          conversation_id:  convId,
          message:          trimmed,
          canteen_slug:     canteenSlug,
          homeowner_id:     homeownerId,
          image_base64:     imgToSend?.base64,
          image_media_type: imgToSend?.media_type
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
        model:   json.model_used,
        uiCards: Array.isArray(json.ui_cards) ? json.ui_cards : []
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
                  <div className="flex flex-col items-end gap-1">
                    {m.imagePreview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.imagePreview} alt="attached" className="max-h-40 max-w-[70%] rounded-xl object-contain shadow"/>
                    )}
                    {m.content && (
                      <div className="max-w-[85%] rounded-2xl px-3 py-2 text-[13px]" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
                        {m.content}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="max-w-[85%] rounded-2xl bg-neutral-100 px-3 py-2 text-[13px] text-neutral-900 whitespace-pre-wrap">
                      {m.content}
                    </div>
                    {m.uiCards && m.uiCards.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {m.uiCards.map((c, ci) => (
                          <MateCard key={ci} card={c}/>
                        ))}
                      </div>
                    )}
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

          {/* Attachment preview strip */}
          {pendingImage && (
            <div className="flex items-center gap-2 border-t px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingImage.previewUrl} alt="preview" className="h-10 w-10 rounded object-cover"/>
              <div className="flex-1 text-[11px] text-neutral-600">
                <ImageIcon size={11} className="mr-1 inline"/> Photo ready. Add a note or just send.
              </div>
              <button
                onClick={() => setPendingImage(null)}
                className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100"
                aria-label="Remove photo"
              >
                <X size={13}/>
              </button>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t p-2"
          >
            <input
              ref={fileRef}
              type="file"
              accept={ALLOWED_IMAGE.join(",")}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
              aria-label="Attach photo"
            >
              <Paperclip size={15}/>
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={pendingImage ? "Add a note…" : "Ask Mate anything…"}
              disabled={busy}
              maxLength={1200}
              className="flex-1 rounded-full border px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
              style={{ borderColor: "rgba(0,0,0,0.10)" }}
            />
            <button
              type="submit"
              disabled={busy || (!input.trim() && !pendingImage)}
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

/** Tool-result artefact renderer. Each tool that returns a `ui`
 *  payload maps to one of these card shapes. Kept in the widget so
 *  the tool contract stays back-end-owned + rendering stays visual. */
function MateCard({ card }: { card: UiCard }) {
  const [busy, setBusy]     = useState(false);
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [draft, setDraft]   = useState<string>(String(card.payload.draft ?? ""));

  if (card.kind === "draft-review-reply") {
    const applyUrl = String(card.payload.apply_endpoint ?? "");
    async function apply() {
      if (!applyUrl || busy) return;
      setBusy(true); setError(null);
      try {
        const res = await fetch(applyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: draft })
        });
        if (!res.ok) throw new Error(`apply_failed_${res.status}`);
        setDone(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "apply_failed");
      } finally {
        setBusy(false);
      }
    }
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-2.5">
        <p className="mb-1 text-[9px] font-black uppercase tracking-wider text-neutral-500">Draft reply</p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy || done}
          rows={3}
          className="w-full resize-none rounded-lg border border-neutral-200 p-2 text-[12px] focus:outline-none focus:ring-1"
        />
        {done ? (
          <p className="mt-1.5 text-[11px] font-semibold text-green-700">Reply posted.</p>
        ) : (
          <button
            onClick={apply}
            disabled={busy || !draft.trim()}
            className="mt-1.5 rounded-full px-3 py-1 text-[11px] font-black transition disabled:opacity-50"
            style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
          >
            {busy ? "Posting…" : "Apply reply"}
          </button>
        )}
        {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
      </div>
    );
  }

  if (card.kind === "list") {
    const items = Array.isArray(card.payload.items) ? card.payload.items as Array<Record<string, unknown>> : [];
    const title = String(card.payload.title ?? "");
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-2.5">
        {title && <p className="mb-1 text-[9px] font-black uppercase tracking-wider text-neutral-500">{title}</p>}
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li key={i} className="text-[12px]">
              <a
                href={String(it.profile_url ?? "#")}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-neutral-100 px-2 py-1.5 hover:bg-neutral-50"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-black">{String(it.display_name ?? "")}</span>
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500">{String(it.trust_tier ?? "")}</span>
                </div>
                <div className="text-[10px] text-neutral-500">
                  {String(it.city ?? "")}{it.rating_avg ? ` · ${it.rating_avg}★ (${it.rating_count ?? 0})` : ""}
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return null;
}
