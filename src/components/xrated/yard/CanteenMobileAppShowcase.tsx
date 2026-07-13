"use client";

// CanteenMobileAppShowcase — dual-purpose showcase card that lives on
// the mobile canteen home page directly under the profile hero.
//
// For Mick's customers: a real "take this canteen with you" tool — QR
// code opens the same page on their phone, or grab the short URL.
//
// For future canteen owners visiting Mick's page: a live showcase of
// what £5/mo buys — Mick's actual canteen rendered inside an iPhone
// frame, bullet points calling out the app's real utility. Every
// canteen becomes a walking billboard, with Mick as the credibility.
//
// Layout: two columns side-by-side even on mobile. Left column carries
// the primary CTA (View app), value bullets, and QR. Right column
// carries the iPhone frame with Mick's canteen preview inside.

import { useState } from "react";
import { Copy, Check, ExternalLink, MessageCircle, ShoppingBag, Bell, Zap } from "lucide-react";
import { BRAND_YELLOW } from "@/lib/brand/tokens";

export function CanteenMobileAppShowcase({
  hostSlug,
  hostFirstName,
  tradeLabel,
  heroImageUrl,
  heroTitle
}: {
  hostSlug: string;
  hostFirstName: string;
  tradeLabel: string;
  /** Mick's canteen hero image — rendered inside the iPhone frame so
   *  the preview reads as HIS canteen specifically. */
  heroImageUrl: string | null;
  /** Canteen name / headline — shown as the phone screen's headline. */
  heroTitle: string;
}) {
  const [copied, setCopied] = useState(false);
  const displayUrl = `thenetwork.co/${hostSlug}`;
  const openUrl = `https://thenetwork.co/${hostSlug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(openUrl)}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(openUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // no-op
    }
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border bg-white p-3 shadow-md md:p-4"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="relative grid grid-cols-[1fr_120px] gap-3 md:grid-cols-[1fr_150px] md:gap-4">
        {/* ── Left column ──────────────────────────────────── */}
        <div className="flex flex-col gap-2.5">
          {/* Section header */}
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.22em] text-neutral-500">
              {tradeLabel}
            </div>
            <div className="mt-0.5 text-[15px] font-black leading-tight text-neutral-900 md:text-[17px]">
              {hostFirstName}&apos;s canteen, on your phone.
            </div>
          </div>

          {/* View app CTA — primary action, top-left as specified */}
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-9 w-max items-center gap-1.5 rounded-lg px-3 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97]"
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            <ExternalLink size={12} strokeWidth={2.5}/>
            View app
          </a>

          {/* Value bullets — three quick reasons this app matters. */}
          <ul className="mt-1 flex flex-col gap-1.5">
            <BulletRow icon={Zap}          label="Live updates from the canteen"/>
            <BulletRow icon={MessageCircle} label={`Message ${hostFirstName} in one tap`}/>
            <BulletRow icon={ShoppingBag}  label="Products, prices, deals in one place"/>
            <BulletRow icon={Bell}         label="Never miss a bulk-buy drop"/>
          </ul>

          {/* QR code — bottom-left corner. Scan to open on your phone. */}
          <div className="mt-1 flex items-center gap-2">
            <img
              src={qrUrl}
              alt={`QR code for ${displayUrl}`}
              width={64}
              height={64}
              className="flex-shrink-0 rounded-md border p-1 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-neutral-500">
                Scan to open
              </div>
              <div className="mt-0.5 truncate text-[11px] font-black text-neutral-900 md:text-[12px]">
                {displayUrl}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="mt-1 inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[9px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-50"
                style={{ borderColor: "rgba(139,69,19,0.20)" }}
                aria-label="Copy link"
              >
                {copied ? (
                  <>
                    <Check size={9} strokeWidth={2.5}/>
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={9} strokeWidth={2.5}/>
                    Copy link
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right column: iPhone frame ─────────────────── */}
        <IphoneFrame
          heroImageUrl={heroImageUrl}
          heroTitle={heroTitle}
          tradeLabel={tradeLabel}
        />
      </div>

      {/* Powered by — subtle sales cue for future merchants without
          hijacking Mick's brand. */}
      <div className="relative mt-3 border-t pt-2 text-center" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
        <span className="text-[9px] font-black uppercase tracking-[0.22em] text-neutral-500">
          Powered by <span style={{ color: "#B8860B" }}>Thenetwork.co</span>
        </span>
      </div>
    </div>
  );
}

function BulletRow({
  icon: Icon,
  label
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }>;
  label: string;
}) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${BRAND_YELLOW}22` }}
      >
        <Icon size={9} strokeWidth={2.5} style={{ color: BRAND_YELLOW }}/>
      </span>
      <span className="text-[10.5px] font-bold text-white/85 md:text-[11.5px]">
        {label}
      </span>
    </li>
  );
}

function IphoneFrame(_props: {
  heroImageUrl: string | null;
  heroTitle: string;
  tradeLabel: string;
}) {
  return (
    <div
      className="relative mx-auto aspect-[9/19] w-full max-w-[130px] overflow-hidden rounded-[18px] border-[3px] border-neutral-900 bg-neutral-950 shadow-2xl"
      style={{
        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06) inset"
      }}
    >
      {/* Dynamic-island / notch approximation */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1 z-30 h-2 w-8 -translate-x-1/2 rounded-full bg-black"
      />

      {/* Phone screen — white placeholder. Philip will drop the
          canteen screenshot in here later. */}
      <div className="absolute inset-0 bg-white"/>
    </div>
  );
}
