"use client";

// Merchant Pro — "You're LIVE" banner.
//
// Sits at the top of the Merchant Pro dashboard. Shows the public profile
// URL, a Share button (native Web Share API with clipboard fallback), a
// QR-code popout, and a "View live" link that opens the profile in a new
// tab. Progress chip shows "N of M sections filled".

import { useState } from "react";
import Link from "next/link";

export function MerchantProLiveBanner({
  displayName,
  publicUrl,
  filled,
  total
}: {
  displayName: string;
  /** Absolute URL to the public profile (https://...). */
  publicUrl: string;
  filled: number;
  total: number;
}) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  async function onShare() {
    const shareData = {
      title: `${displayName} on Xrated Trades`,
      url: publicUrl
    };
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // user cancelled — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // browsers without clipboard API — final no-op.
    }
  }

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    publicUrl
  )}`;

  return (
    <div className="rounded-3xl border border-brand-accent/40 bg-gradient-to-br from-brand-accent/15 to-brand-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-brand-accent px-3 text-[11px] font-extrabold uppercase tracking-widest text-black">
          <span aria-hidden="true">●</span> LIVE
        </span>
        <span className="text-[11px] font-bold uppercase tracking-widest text-brand-muted">
          {filled} of {total} sections filled
        </span>
      </div>

      <h2 className="mt-3 text-2xl font-extrabold leading-tight text-brand-text sm:text-3xl">
        Your storefront is live.
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand-line bg-brand-bg px-3 py-2 text-[13px] font-mono text-brand-text">
        <span className="truncate" title={publicUrl}>
          {publicUrl.replace(/^https?:\/\//, "")}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onShare}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-accent px-4 text-[13px] font-bold text-black transition hover:opacity-90"
        >
          {copied ? "Copied!" : "Share link"}
        </button>
        <button
          type="button"
          onClick={() => setShowQr((s) => !s)}
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-brand-line bg-brand-bg px-4 text-[13px] font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
          aria-expanded={showQr}
        >
          {showQr ? "Hide QR" : "Show QR"}
        </button>
        <Link
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-brand-line bg-brand-bg px-4 text-[13px] font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
        >
          View live →
        </Link>
      </div>

      {showQr && (
        <div className="mt-4 inline-block rounded-2xl border border-brand-line bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt={`QR code for ${publicUrl}`}
            width={240}
            height={240}
            className="block h-60 w-60"
          />
        </div>
      )}
    </div>
  );
}
