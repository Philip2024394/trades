"use client";

// Flip-back side of a Yard post card.
//
// Full-bleed banner-image background with a dark gradient overlay so
// the trade's photo carries the visual weight (matches how the business
// card feels). Text sits over the gradient; QR bottom-left, yellow
// "View profile" button bottom-right, Share top-left, flip-back top-
// right.
//
// QR comes from /trade/<slug>/qr.png (edge-cached 24h), scannable, and
// the Share button attaches the actual /api/trade-off/card-image PNG
// via the Web Share API so the recipient gets the exact same card the
// trade shares from anywhere else in the app.

import { ArrowRight, RotateCcw, Share2 } from "lucide-react";
import { useState } from "react";
import { tradeLabel } from "@/lib/tradeOff";
import { FollowButton } from "../FollowButton";
import type { YardPoster } from "./YardPostCard";

// Lucide 1.x doesn't ship brand icons — inline minimal single-tone
// glyphs so the socials row stays consistent (same weight + size, no
// external asset dependency).
type GlyphProps = { className?: string };
function InstagramGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4 1s.8.9 1 1.4c.2.5.4 1 .4 2.3.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c0 1.2-.2 1.8-.4 2.2a3.7 3.7 0 0 1-1 1.4 3.7 3.7 0 0 1-1.4 1c-.5.2-1 .4-2.2.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2 0-1.8-.2-2.2-.4a3.7 3.7 0 0 1-1.4-1 3.7 3.7 0 0 1-1-1.4c-.2-.5-.4-1-.4-2.2-.1-1.2-.1-1.6-.1-4.8s0-3.6.1-4.8c0-1.2.2-1.8.4-2.2a3.7 3.7 0 0 1 1-1.4 3.7 3.7 0 0 1 1.4-1c.5-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 2.2c-3.1 0-3.5 0-4.7.1a3 3 0 0 0-1.5.3 2.5 2.5 0 0 0-1 .6 2.5 2.5 0 0 0-.6 1 3 3 0 0 0-.3 1.5c-.1 1.2-.1 1.5-.1 4.7s0 3.5.1 4.7a3 3 0 0 0 .3 1.5c.1.3.4.7.6 1 .3.3.6.5 1 .6a3 3 0 0 0 1.5.3c1.2.1 1.5.1 4.7.1s3.5 0 4.7-.1a3 3 0 0 0 1.5-.3c.3-.1.7-.4 1-.6.3-.3.5-.7.6-1a3 3 0 0 0 .3-1.5c.1-1.2.1-1.5.1-4.7s0-3.5-.1-4.7a3 3 0 0 0-.3-1.5 2.5 2.5 0 0 0-.6-1 2.5 2.5 0 0 0-1-.6 3 3 0 0 0-1.5-.3c-1.2-.1-1.5-.1-4.7-.1Zm0 3.4a5.2 5.2 0 1 1 0 10.4 5.2 5.2 0 0 1 0-10.4Zm0 2.2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.4-2.4a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z" />
    </svg>
  );
}
function FacebookGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7h-2.5v-2.9h2.5V9.8c0-2.5 1.5-3.8 3.7-3.8 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.5v1.9h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
    </svg>
  );
}
function TikTokGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19.6 6.9a5.6 5.6 0 0 1-3.4-1.1v8.4a5.6 5.6 0 1 1-5.6-5.6c.3 0 .5 0 .8.1v2.8a2.9 2.9 0 1 0 2 2.7V2h2.7a5.6 5.6 0 0 0 3.5 4.9Z" />
    </svg>
  );
}
function YoutubeGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5a3 3 0 0 0-2.1 2.1C0 8.2 0 12 0 12s0 3.8.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-2 .5-5.8.5-5.8s0-3.8-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z" />
    </svg>
  );
}

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK = "#0A0A0A";

const PAID_TIERS = new Set(["app_trial", "app_paid", "app_verified"]);
const IS_PROD = process.env.NODE_ENV === "production";
function profileHref(poster: YardPoster): string {
  if (!IS_PROD) return `/${poster.slug}`;
  // 2026-07-13: dual-domain paid/free routing retired — everything on
  // the single thenetworkers.app domain. Tier gating is done at page
  // level, not by domain.
  return `https://thenetworkers.app/${poster.slug}`;
}

function formatWa(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  if (digits.length <= 6) return `+${digits}`;
  return `+${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
}

export function YardCardBack({
  poster,
  onFlipBack
}: {
  poster: YardPoster;
  onFlipBack: () => void;
}) {
  const subject = poster.trading_name?.trim() || poster.display_name;
  const cardPngSrc = `/api/trade-off/card-image?slug=${encodeURIComponent(poster.slug)}`;
  const qrSrc = `/trade/${encodeURIComponent(poster.slug)}/qr.png`;
  const [sharing, setSharing] = useState(false);

  async function doShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (sharing) return;
    setSharing(true);
    try {
      const profileUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/${poster.slug}`
          : `/${poster.slug}`;

      let file: File | null = null;
      try {
        const resp = await fetch(cardPngSrc);
        if (resp.ok) {
          const blob = await resp.blob();
          file = new File([blob], `${poster.slug}-business-card.png`, {
            type: "image/png"
          });
        }
      } catch {
        /* fall through to text share */
      }

      const shareText = `${subject} — ${tradeLabel(poster.primary_trade)}${
        poster.city ? ` in ${poster.city}` : ""
      }.`;

      if (
        file &&
        typeof navigator !== "undefined" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: subject,
            text: shareText,
            url: profileUrl
          });
          return;
        } catch (err) {
          const isAbort =
            err instanceof Error &&
            (err.name === "AbortError" || /abort/i.test(err.message));
          if (isAbort) return;
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
    } finally {
      setSharing(false);
    }
  }

  return (
    <div
      className="relative flex h-full min-h-full flex-col overflow-hidden rounded-2xl border border-[#1B1A17]/10 shadow-sm"
      style={{
        background: poster.banner_url
          ? `center/cover no-repeat url("${poster.banner_url}")`
          : "linear-gradient(120deg, #FFB300 0%, #B8860B 100%)"
      }}
    >
      {/* Dark gradient overlay — bottom-weighted so text + QR area is
          legible while the top of the banner stays visible. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,10,10,0.10) 0%, rgba(10,10,10,0.35) 40%, rgba(10,10,10,0.85) 100%)"
        }}
      />

      {/* Top-left — Share (yellow) */}
      <button
        type="button"
        onClick={doShare}
        aria-label="Share this business card"
        disabled={sharing}
        className="absolute left-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full shadow-md transition hover:scale-105 active:scale-95 disabled:opacity-60"
        style={{
          background: BRAND_YELLOW,
          color: BRAND_BLACK,
          touchAction: "manipulation"
        }}
      >
        <Share2 className="h-3 w-3" aria-hidden />
      </button>

      {/* Top-right — Flip back (yellow) */}
      <button
        type="button"
        onClick={onFlipBack}
        aria-label="Flip back to post"
        className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full shadow-md transition hover:scale-105 active:scale-95"
        style={{
          background: BRAND_YELLOW,
          color: BRAND_BLACK,
          touchAction: "manipulation"
        }}
      >
        <RotateCcw className="h-3 w-3" aria-hidden />
      </button>

      {/* Text stack — moved up. Sits in the upper third under the
          top-corner buttons; the QR + CTA row owns the whole bottom
          strip so text and barcode never touch. */}
      <div className="relative z-[5] flex flex-col gap-0.5 px-3 pt-11 text-white">
        <p
          className="truncate text-[9px] font-black uppercase tracking-[0.18em]"
          style={{ color: BRAND_YELLOW }}
        >
          {tradeLabel(poster.primary_trade)}
        </p>
        <p className="mt-1 truncate text-[15px] font-black leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] sm:text-[17px]">
          {subject}
        </p>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[11px] font-semibold text-white/85 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
          {poster.city && <span className="truncate">{poster.city}</span>}
          {poster.whatsapp && (
            <span className="truncate">{formatWa(poster.whatsapp)}</span>
          )}
        </div>

        {/* Socials — same for free and paid tier. Only renders icons
            the trade actually filled. Small (5x5) so they never
            dominate the identity block. */}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {poster.instagram && (
            <a
              href={poster.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-sm transition hover:scale-110 hover:bg-white"
            >
              <InstagramGlyph className="h-3.5 w-3.5" />
            </a>
          )}
          {poster.facebook && (
            <a
              href={poster.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-sm transition hover:scale-110 hover:bg-white"
            >
              <FacebookGlyph className="h-3.5 w-3.5" />
            </a>
          )}
          {poster.tiktok && (
            <a
              href={poster.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-sm transition hover:scale-110 hover:bg-white"
            >
              <TikTokGlyph className="h-3.5 w-3.5" />
            </a>
          )}
          {poster.youtube && (
            <a
              href={poster.youtube}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-sm transition hover:scale-110 hover:bg-white"
            >
              <YoutubeGlyph className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {/* Follow strip — the network's stickiness lever. Small chip
            variant matches the socials row density. */}
        <div className="mt-2 inline-flex">
          <FollowButton
            targetSlug={poster.slug}
            initialCount={poster.follower_count ?? 0}
            size="chip"
          />
        </div>
      </div>

      {/* Bottom-left — QR on a white plate (scannable) */}
      <div className="absolute bottom-2 left-2 z-10 rounded-md bg-white p-1 shadow">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrSrc}
          alt=""
          className="block h-12 w-12 sm:h-14 sm:w-14"
          draggable={false}
        />
      </div>

      {/* Bottom-right — yellow "View profile" CTA */}
      <a
        href={profileHref(poster)}
        className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-black shadow-md transition active:scale-[0.97]"
        style={{ background: BRAND_YELLOW, color: BRAND_BLACK }}
      >
        View profile
        <ArrowRight className="h-3 w-3" aria-hidden />
      </a>
    </div>
  );
}
