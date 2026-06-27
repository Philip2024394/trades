"use client";

// Xrated Trades — one-tap share button for a tradesperson's business
// card. Two-step flow:
//   1. Tap the button → preview modal opens showing the actual card PNG
//      the customer would receive, plus Close + Share buttons.
//   2. Tap Share inside the modal → fetches the card PNG, attaches it
//      to Web Share API; falls back to WhatsApp Web prefilled text.
//
// The preview step matters because the share sheet (iOS / Android) opens
// AFTER the card fetch completes — without the preview, the user has no
// idea what they're about to send. Especially important for the profile
// variant (customer is sharing a stranger's card to a friend).
//
// Variants:
//   'profile'   — small yellow-outline button on the public profile.
//   'dashboard' — primary yellow-filled CTA on the tradesperson dashboard.

import { useState } from "react";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK = "#0A0A0A";

export interface ShareCardButtonProps {
  slug: string;
  displayName: string;
  primaryTrade: string;
  city: string;
  /** Business / trading name (e.g. "Ahmed Scaffolding Solutions").
   *  Preferred over the personal first name in the share label + text
   *  because that's the brand the card actually shows. */
  tradingName?: string | null;
  /** Display string only — used in fallback wa.me text. */
  whatsapp?: string;
  variant?: "profile" | "dashboard";
  /** Override the button label. Useful when the surface needs
   *  something tighter (e.g. an icon-only mobile bar). */
  label?: string;
}

export function ShareCardButton({
  slug,
  displayName,
  primaryTrade,
  city,
  tradingName,
  variant = "profile",
  label
}: ShareCardButtonProps) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const trimmedTrading = tradingName?.trim() || "";
  const subject = trimmedTrading || displayName;
  const defaultLabel =
    variant === "dashboard"
      ? "Share to WhatsApp"
      : `Share ${subject}'s card`;
  const buttonLabel = label ?? defaultLabel;

  const cardSrc = `/api/trade-off/card-image?slug=${encodeURIComponent(slug)}`;

  async function doShare() {
    if (busy) return;
    setBusy(true);
    try {
      const profileUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/${slug}`
          : `/${slug}`;

      let canShareFile = false;
      let file: File | null = null;
      try {
        const resp = await fetch(cardSrc);
        if (resp.ok) {
          const blob = await resp.blob();
          file = new File([blob], `${slug}-business-card.png`, {
            type: "image/png"
          });
          const probe: ShareData = { files: [file] };
          if (
            typeof navigator !== "undefined" &&
            typeof navigator.canShare === "function" &&
            navigator.canShare(probe)
          ) {
            canShareFile = true;
          }
        }
      } catch (err) {
        console.warn("[share-card] card fetch failed", err);
      }

      const shareTitle = `${subject} — ${primaryTrade}`;
      const shareText = `${subject} — ${primaryTrade} in ${city}.`;

      if (canShareFile && file) {
        try {
          await navigator.share({
            files: [file],
            title: shareTitle,
            text: shareText,
            url: profileUrl
          });
          setOpen(false);
          return;
        } catch (err) {
          const isAbort =
            err instanceof Error &&
            (err.name === "AbortError" || /abort/i.test(err.message));
          if (isAbort) return;
          console.warn("[share-card] navigator.share failed", err);
        }
      }

      const text = encodeURIComponent(`${shareText}\n${profileUrl}`);
      if (typeof window !== "undefined") {
        window.open(
          `https://wa.me/?text=${text}`,
          "_blank",
          "noopener,noreferrer"
        );
      }
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const trigger =
    variant === "dashboard" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-12 min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 text-[13px] font-extrabold transition active:scale-[0.97] sm:text-sm"
        style={{ background: BRAND_YELLOW, color: BRAND_BLACK }}
        aria-label="Preview business card before sharing"
        data-share-card-trigger="dashboard"
      >
        <ShareGlyph />
        {buttonLabel}
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 min-h-[44px] items-center justify-center gap-1.5 rounded-xl border-2 bg-transparent px-4 text-[13px] font-extrabold transition active:scale-[0.97]"
        style={{ borderColor: BRAND_YELLOW, color: BRAND_YELLOW }}
        aria-label="Preview business card before sharing"
        data-share-card-trigger="profile"
      >
        <ShareGlyph />
        {buttonLabel}
      </button>
    );

  return (
    <>
      {trigger}
      {open && (
        <PreviewModal
          cardSrc={cardSrc}
          subject={subject}
          primaryTrade={primaryTrade}
          city={city}
          busy={busy}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
          onShare={doShare}
        />
      )}
    </>
  );
}

function PreviewModal({
  cardSrc,
  subject,
  primaryTrade,
  city,
  busy,
  onClose,
  onShare
}: {
  cardSrc: string;
  subject: string;
  primaryTrade: string;
  city: string;
  busy: boolean;
  onClose: () => void;
  onShare: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Preview business card before sharing"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: BRAND_YELLOW }}
        >
          Preview
        </p>
        <h2 className="mt-1 text-lg font-extrabold leading-tight text-neutral-900">
          You&rsquo;re sharing this card
        </h2>
        <p className="mt-1 text-[13px] text-neutral-500">
          {subject} — {primaryTrade} in {city}.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cardSrc}
            alt={`${subject} business card`}
            className="block aspect-[1075/720] w-full"
          />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-11 min-h-[44px] rounded-xl border border-neutral-300 bg-white text-[13px] font-extrabold text-neutral-800 transition active:scale-[0.97] disabled:opacity-60"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onShare}
            disabled={busy}
            className="h-11 min-h-[44px] rounded-xl text-[13px] font-extrabold transition active:scale-[0.97] disabled:opacity-60"
            style={{ background: BRAND_YELLOW, color: BRAND_BLACK }}
            data-share-card-confirm="true"
          >
            {busy ? "Preparing…" : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

export default ShareCardButton;
