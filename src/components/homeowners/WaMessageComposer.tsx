"use client";

// WaMessageComposer — inline expand on a post/trade card. Homeowner
// picks a template (or types custom), then clicks "Send via WhatsApp".
// We POST /api/homeowner/wa-messages which saves the message + returns
// a wa.me URL; we then open() it so WhatsApp launches with the text
// pre-filled. Homeowner hits send in WhatsApp. Record is captured
// 100% on the SiteBook side (we composed it here first).
//
// Trade replies via WhatsApp OR via the /r/{token} footer link that
// lands as an inbound message on the same thread.

import { useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

type Template = {
  id:    string;
  label: string;
  body:  string;
};

// Free tier gets these six basics. Pro tier unlocks the full library
// (loaded via the templates API — not implemented in this widget yet).
const FREE_TEMPLATES: Template[] = [
  {
    id:    "custom",
    label: "Custom message",
    body:  ""
  },
  {
    id:    "ask-for-quote",
    label: "Ask for a quote",
    body:  "Hi, could you give me a rough quote for this job? Happy to share photos or arrange a site visit — let me know what you need."
  },
  {
    id:    "confirm-booking",
    label: "Confirm booking",
    body:  "Just confirming we're still on for the agreed date. Please let me know if anything changes."
  },
  {
    id:    "check-timing",
    label: "Check timing",
    body:  "Any update on when you can start? No rush, just planning around it."
  },
  {
    id:    "send-photo",
    label: "Send a photo reference",
    body:  "Just sent a photo through — let me know what you think when you get a chance."
  },
  {
    id:    "follow-up",
    label: "Follow up",
    body:  "Just following up on the message above — did you get a chance to look? No pressure, just checking in."
  }
];

type Props = {
  postId:          string;
  tradeListingId:  string;
  tradeName:       string;
  onSent?:         () => void;
  onCancel?:       () => void;
};

export function WaMessageComposer({ postId, tradeListingId, tradeName, onSent, onCancel }: Props) {
  const [templateId, setTemplateId] = useState<string>("custom");
  const [body,       setBody]       = useState<string>("");
  const [busy,       setBusy]       = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = FREE_TEMPLATES.find((x) => x.id === id);
    if (t && t.body) setBody(t.body);
  }

  const trimmed = body.trim();
  const canSend = trimmed.length >= 3 && !busy;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/homeowner/wa-messages", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          postId,
          tradeListingId,
          body:         trimmed,
          templateUsed: templateId
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setError(prettyError(data.error));
        setBusy(false);
        return;
      }
      // Launch WhatsApp with the pre-filled text — user hits send there.
      if (typeof window !== "undefined") window.open(data.waUrl, "_blank", "noopener");
      setBody("");
      setTemplateId("custom");
      setBusy(false);
      onSent?.();
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ backgroundColor: BRAND_GREEN }}>
          <MessageCircle size={14} strokeWidth={2.4}/>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Message via WhatsApp · saved to SiteBook
          </p>
          <p className="text-[13px] font-black text-neutral-900">
            To {tradeName}
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
            aria-label="Cancel"
          >
            <X size={14}/>
          </button>
        )}
      </div>

      {/* Template picker */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {FREE_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pickTemplate(t.id)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
              templateId === t.id
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 text-neutral-700 hover:border-neutral-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 1500))}
          rows={4}
          placeholder="Type your message… will be sent via WhatsApp AND saved here."
          className="w-full rounded-xl border-2 border-neutral-200 bg-white px-3 py-2.5 text-[13.5px] leading-relaxed text-neutral-900 outline-none placeholder-neutral-400 focus:border-neutral-900"
        />
        <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
          <span>{body.length} / 1500</span>
          <span className="text-neutral-400">Copy stays in your SiteBook</span>
        </div>

        {error && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-800">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSend}
          className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-[12.5px] font-black uppercase tracking-wider text-white shadow-sm transition hover:brightness-95 disabled:opacity-50"
          style={{ backgroundColor: BRAND_GREEN }}
        >
          <Send size={14} strokeWidth={2.5}/>
          {busy ? "Preparing…" : "Send via WhatsApp"}
        </button>
        <p className="mt-1.5 text-center text-[10.5px] text-neutral-500">
          WhatsApp opens with the message pre-filled. Hit send there.
        </p>
      </form>
    </div>
  );
}

function prettyError(code: string): string {
  switch (code) {
    case "empty-body":       return "Type a message first.";
    case "missing-post":     return "No post selected.";
    case "missing-trade":    return "No trade selected.";
    case "post-not-found":   return "That post isn't yours.";
    case "trade-not-found":  return "Trade not found.";
    case "trade-no-whatsapp":return "This trade doesn't have a WhatsApp number on file.";
    case "thread-revoked":   return "You've closed this conversation. Start a new post to reach out again.";
    case "quota-exceeded":   return "You're out of WhatsApp reveals. Top up a pack or go Pro to keep messaging.";
    case "not-authed":       return "Please sign in first.";
    default:                 return "Couldn't send that message. Try again.";
  }
}

// Convenience wrapper so a card can render a single "Message [trade]"
// pill that expands to the full composer on click. Small, drop-in.
export function WaMessageComposerToggle(props: Props) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm transition hover:brightness-95"
        style={{ backgroundColor: BRAND_GREEN, borderColor: BRAND_GREEN }}
      >
        <MessageCircle size={12} strokeWidth={2.5}/>
        Message {props.tradeName}
      </button>
    );
  }
  return (
    <WaMessageComposer
      {...props}
      onCancel={() => setOpen(false)}
      onSent={() => { setOpen(false); props.onSent?.(); }}
    />
  );
}

// Yellow variant kept for API parity so a page can override the CTA
// tone. Unused today — dark green is the canonical WhatsApp CTA.
export const BRAND_YELLOW_CONST = BRAND_YELLOW;
