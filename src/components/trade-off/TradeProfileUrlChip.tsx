"use client";

// Copyable chip showing the tradie's canonical public URL —
// `xratedtrade.com/<slug>` — sat at the top of the profile hero.
// One-click clipboard copy with a 2s "Copied!" flash.

import { useState } from "react";

export function TradeProfileUrlChip({
  slug,
  fullUrl
}: {
  slug: string;
  // Pre-resolved absolute URL (e.g. `https://xratedtrade.com/<slug>`).
  // Falls back to a relative form if not provided.
  fullUrl?: string;
}) {
  const [copied, setCopied] = useState(false);
  const display = `xratedtrade.com/${slug}`;
  const target = fullUrl ?? `/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        window.prompt("Copy this URL:", target);
      } catch {
        /* no-op */
      }
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-brand-line bg-neutral-50 px-3 text-xs font-semibold text-brand-text transition hover:border-[#FFB300] hover:text-[#FFB300]"
      aria-label={`Copy ${display}`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      <span className="font-mono">{display}</span>
      <span className="text-brand-muted">
        {copied ? "Copied!" : "Copy"}
      </span>
    </button>
  );
}

export default TradeProfileUrlChip;
