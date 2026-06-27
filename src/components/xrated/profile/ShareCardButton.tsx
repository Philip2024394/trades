"use client";

// Xrated Trades — one-tap share button for a tradesperson's business
// card. Fetches /api/trade-off/card-image?slug=<slug>, attaches the PNG
// to the Web Share API, and falls back to WhatsApp Web prefilled text
// when the browser can't share files.
//
// Variants:
//   'profile'   — small yellow-outline button sitting next to the WhatsApp
//                 CTA on the public profile. Customer-share = viral
//                 acquisition: every share carries the slug URL + QR.
//   'dashboard' — primary yellow-filled CTA on the tradesperson dashboard.
//                 Tradesperson-share to their own customers.

import { useState } from "react";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK = "#0A0A0A";

export interface ShareCardButtonProps {
  slug: string;
  displayName: string;
  primaryTrade: string;
  city: string;
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
  variant = "profile",
  label
}: ShareCardButtonProps) {
  const [busy, setBusy] = useState(false);

  const firstName = displayName.split(/\s+/)[0] || displayName;
  const defaultLabel =
    variant === "dashboard"
      ? "Share to WhatsApp"
      : `Share ${firstName}'s card`;
  const buttonLabel = label ?? defaultLabel;

  async function share() {
    if (busy) return;
    setBusy(true);
    try {
      const cardUrl = `/api/trade-off/card-image?slug=${encodeURIComponent(slug)}`;
      const profileUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/${slug}`
          : `/${slug}`;

      let canShareFile = false;
      let file: File | null = null;
      try {
        const resp = await fetch(cardUrl);
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
        // image fetch failed — fall through to text-only share path
        console.warn("[share-card] card fetch failed", err);
      }

      const shareTitle = `${displayName} — ${primaryTrade}`;
      const shareText = `${displayName} — ${primaryTrade} in ${city}.`;

      if (canShareFile && file) {
        const shareData: ShareData = {
          files: [file],
          title: shareTitle,
          text: shareText,
          url: profileUrl
        };
        try {
          await navigator.share(shareData);
          return;
        } catch (err) {
          // User cancelled or share failed — fall through to WA fallback.
          const isAbort =
            err instanceof Error &&
            (err.name === "AbortError" || /abort/i.test(err.message));
          if (isAbort) return;
          console.warn("[share-card] navigator.share failed", err);
        }
      }

      // Fallback — open WhatsApp Web prefilled. The slug URL previews
      // as an image in WhatsApp chats once the rewrite below ships
      // (/<slug>/card.png).
      const text = encodeURIComponent(`${shareText}\n${profileUrl}`);
      if (typeof window !== "undefined") {
        window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
      }
    } finally {
      setBusy(false);
    }
  }

  if (variant === "dashboard") {
    return (
      <button
        type="button"
        onClick={share}
        disabled={busy}
        className="inline-flex h-12 min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 text-[13px] font-extrabold transition active:scale-[0.97] disabled:opacity-60 sm:text-sm"
        style={{ background: BRAND_YELLOW, color: BRAND_BLACK }}
        aria-label="Share business card to WhatsApp"
        data-share-card-trigger="dashboard"
      >
        <ShareGlyph />
        {busy ? "Preparing card…" : buttonLabel}
      </button>
    );
  }

  // 'profile' variant — yellow-outline secondary CTA, designed to sit
  // next to (and not compete with) the green/yellow WhatsApp primary.
  return (
    <button
      type="button"
      onClick={share}
      disabled={busy}
      className="inline-flex h-11 min-h-[44px] items-center justify-center gap-1.5 rounded-xl border-2 bg-transparent px-4 text-[13px] font-extrabold transition active:scale-[0.97] disabled:opacity-60"
      style={{ borderColor: BRAND_YELLOW, color: BRAND_YELLOW }}
      aria-label="Share business card"
      data-share-card-trigger="profile"
    >
      <ShareGlyph />
      {busy ? "Preparing…" : buttonLabel}
    </button>
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
