"use client";

// FaqShareButton — per-FAQ share trigger.
//
// Tries the Web Share API first (mobile-native sheet), falls back to
// clipboard. Shares the canonical anchor URL so the recipient lands on
// the same FAQ with the yellow flash animation.

import { useState } from "react";

export function FaqShareButton({
  shareUrl,
  refCode,
  question
}: {
  shareUrl: string;
  refCode: string;
  question: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "shared">("idle");

  async function handleShare() {
    const navAny = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (typeof navAny.share === "function") {
      try {
        await navAny.share({
          title: `${refCode} — ${question}`,
          text: question,
          url: shareUrl
        });
        setState("shared");
        window.setTimeout(() => setState("idle"), 1500);
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setState("copied");
      window.setTimeout(() => setState("idle"), 1500);
    } catch {
      // Last-ditch — show prompt the user can copy manually.
      window.prompt("Copy this link", shareUrl);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-xs font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300]"
      aria-label={`Share ${refCode}`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      {state === "copied" ? "Link copied" : state === "shared" ? "Shared" : "Share"}
    </button>
  );
}
