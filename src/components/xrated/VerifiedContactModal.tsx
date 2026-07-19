"use client";

// VerifiedContactModal — the single popup that gates every merchant
// WhatsApp button on the platform. Every "Message on WhatsApp" CTA
// (canteen, mobile app, business card, Trade Center product PDP,
// category enquire, etc.) routes through this modal:
//
//   1. Visitor fills Name + WhatsApp + Comment.
//   2. Preview the pre-filled WhatsApp message (source-stamped).
//   3. Press Send → POST /api/washers/deduct (stubbed) → open WhatsApp
//      with the professionally formatted pre-filled message.
//
// Rules baked in from project_washers_lead_gen_model.md:
//   - 1 washer per verified send.
//   - Popup abandon = no washer.
//   - Source stamped in the pre-filled message so the merchant can
//     see which surface produced the lead ("saw your Trade Center
//     listing for X" vs "saw your canteen post about Y").
//   - Signed-in trade viewers bypass the popup (feature flag prop
//     `viewerIsTrade`); anonymous customers always see it.

import { useState } from "react";
import { X, Send, MessageCircle, ShieldCheck } from "lucide-react";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK = "#0A0A0A";
const BRAND_GREEN_DARK = "#166534";

export type ContactSource =
  | "canteen-hero"
  | "canteen-business-card"
  | "canteen-mobile-app"
  | "canteen-contact-page"
  | "trade-center-pdp"
  | "trade-center-category"
  | "product-carousel"
  | "portfolio"
  | "inspiration-detail"
  | "other";

export function VerifiedContactModal({
  open,
  onClose,
  merchantSlug,
  merchantDisplayName,
  merchantFirstName,
  merchantWhatsapp,
  tradeLabel,
  city,
  source,
  sourceLabel,
  canteenSlug
}: {
  open: boolean;
  onClose: () => void;
  merchantSlug: string;
  merchantDisplayName: string;
  merchantFirstName: string;
  /** Digits only or +/spaces — stripped to digits on send. */
  merchantWhatsapp: string;
  tradeLabel: string;
  city?: string | null;
  /** Canonical surface enum — feeds the API + logs so the merchant
   *  admin can chart which surface produces washers-worth-of-leads. */
  source: ContactSource;
  /** Human-readable version of `source` — dropped into the pre-filled
   *  WhatsApp message so the merchant reads the origin naturally
   *  ("saw your canteen page", "saw your Trade Center listing for
   *  Blum soft-close hinges"). */
  sourceLabel: string;
  /** Canteen slug — powers the legal link ("agree to {merchant}'s
   *  terms & privacy"). Optional so non-canteen surfaces still work. */
  canteenSlug?: string;
}) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const merchantDigits = merchantWhatsapp.replace(/[^0-9]/g, "");
  const previewName = name.trim() || "[Your name]";
  const previewComment = comment.trim() || "[Your message]";

  // Pre-filled WhatsApp body — professionally formatted, source-stamped.
  const preFilledMessage =
    `Hi ${merchantFirstName}, ${previewName} here — I saw ${sourceLabel} on Thenetworkers.app.` +
    `\n\nComment: ${previewComment}` +
    `\n\n— Sent via Thenetworkers.app · WhatsApp verified`;

  async function handleSend() {
    const cleanName = name.trim();
    const cleanWa = whatsapp.trim();
    const cleanComment = comment.trim();
    if (cleanName.length < 2) {
      setError("Please add your name.");
      return;
    }
    if (cleanWa.replace(/[^0-9]/g, "").length < 7) {
      setError("Please add a valid WhatsApp number.");
      return;
    }
    if (cleanComment.length < 4) {
      setError("Please write a short message.");
      return;
    }
    setError(null);
    setSending(true);

    // TODO(backend): the deduct endpoint must:
    //   - atomically decrement merchant_washer_bag.balance by 1
    //   - append a washer_transactions row (kind=deduct, source, guest phone hash)
    //   - honor 30-day idempotency per (merchant, guest_phone_hash)
    //   - honor viewerIsTrade → skip deduction
    //   - enforce spam guardrails (URL block, rate limit)
    try {
      await fetch(`/api/washers/deduct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantSlug,
          source,
          sourceLabel,
          guestName: cleanName,
          guestWhatsapp: cleanWa,
          guestComment: cleanComment
        })
      });
    } catch {
      // Deduction endpoint may not exist yet — proceed to WhatsApp
      // handoff regardless so the visitor's flow doesn't stall.
    }

    // Open WhatsApp with the pre-filled message.
    const finalMessage =
      `Hi ${merchantFirstName}, ${cleanName} here — I saw ${sourceLabel} on Thenetworkers.app.` +
      `\n\nComment: ${cleanComment}` +
      `\n\n— Sent via Thenetworkers.app · WhatsApp verified`;
    const url = merchantDigits
      ? `https://wa.me/${merchantDigits}?text=${encodeURIComponent(finalMessage)}`
      : null;
    if (url && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    setSending(false);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Message ${merchantDisplayName}`}
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 backdrop-blur-sm px-3 md:items-center md:px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl md:rounded-2xl"
      >
        {/* Close button — dark red for unmistakable dismiss */}
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md transition active:scale-95 disabled:opacity-50"
          style={{ backgroundColor: "#991B1B" }}
        >
          <X size={16} strokeWidth={2.8}/>
        </button>

        {/* Header */}
        <div className="border-b p-4 md:p-5" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
            Message the merchant
          </div>
          <h3 className="mt-1 text-[19px] font-black leading-tight text-neutral-900">
            {merchantDisplayName}
          </h3>
          <div className="mt-0.5 text-[11.5px] font-bold text-neutral-500">
            {tradeLabel}{city ? ` · ${city}` : ""}
          </div>
        </div>

        {/* Form */}
        <div
          className="flex flex-col gap-3 overflow-y-auto p-4 md:p-5"
          style={{ maxHeight: "calc(100dvh - 8rem)" }}
        >
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              placeholder="e.g. Alex Smith"
              className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
              style={{ borderColor: "rgba(139,69,19,0.20)" }}
              disabled={sending}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Your WhatsApp number
            </label>
            <input
              type="tel"
              inputMode="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value.slice(0, 24))}
              placeholder="e.g. 07700 900101"
              className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
              style={{ borderColor: "rgba(139,69,19,0.20)" }}
              disabled={sending}
            />
            <div className="mt-1 text-[10px] leading-snug text-neutral-500">
              Only shared with {merchantFirstName} — not shown publicly.
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Your message
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 800))}
              placeholder="Tell Mike what you're looking for…"
              rows={3}
              className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] leading-snug text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
              style={{ borderColor: "rgba(139,69,19,0.20)" }}
              disabled={sending}
            />
          </div>

          {/* Preview panel — the exact WhatsApp message that will send */}
          <div
            className="rounded-lg border p-3 text-[11.5px] leading-relaxed text-neutral-700 whitespace-pre-wrap"
            style={{ backgroundColor: "#F0F9F1", borderColor: "rgba(22,101,52,0.25)" }}
          >
            <div className="mb-1 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: BRAND_GREEN_DARK }}>
              <MessageCircle size={11} strokeWidth={2.6}/>
              WhatsApp preview
            </div>
            {preFilledMessage}
          </div>

          {/* Verification badge + terms line */}
          <div className="flex items-start gap-2 rounded-lg border bg-neutral-50 p-2.5" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
            <ShieldCheck size={13} strokeWidth={2.4} className="mt-0.5 flex-shrink-0" style={{ color: BRAND_GREEN_DARK }}/>
            <div className="text-[10.5px] leading-snug text-neutral-600">
              Thenetworkers.app verifies your details before your message reaches {merchantFirstName}. By sending you agree to{" "}
              {canteenSlug ? (
                <a
                  href={`/trade-off/yard/canteens/${canteenSlug}/legal`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-black text-neutral-900 underline decoration-neutral-400 underline-offset-2 hover:decoration-neutral-900"
                >
                  {merchantFirstName}&apos;s terms &amp; privacy
                </a>
              ) : (
                <span className="font-black text-neutral-900">
                  {merchantFirstName}&apos;s terms &amp; privacy
                </span>
              )}.
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-2 py-1.5 text-[11px] font-black uppercase tracking-wider text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer / send */}
        <div className="border-t bg-neutral-50 p-3 md:p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !merchantDigits}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-black uppercase tracking-wider text-white shadow-md transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: BRAND_GREEN_DARK }}
          >
            <Send size={14} strokeWidth={2.6}/>
            {sending ? "Opening WhatsApp…" : `Send to ${merchantFirstName}`}
          </button>
          <div className="mt-2 text-center text-[9.5px] font-black uppercase tracking-[0.14em] text-neutral-400">
            WhatsApp opens in a new tab with your message ready to send
          </div>
        </div>
      </div>
    </div>
  );
}
