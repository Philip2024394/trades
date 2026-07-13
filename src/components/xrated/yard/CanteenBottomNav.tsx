"use client";

// CanteenBottomNav — slim sticky contact bar for the canteen mobile
// dashboard. Rating chip on the left (only when reviews ≥ 5 per the
// honest-signal rule), WhatsApp button on the right. Home / Feed / +
// / Messages / Profile row removed 2026-07-13 per Philip — the app
// footer stays contact-only so the WhatsApp CTA is always in reach.
//
// Only renders below lg.

import { MessageCircle, Star } from "lucide-react";
import { whatsappDigits } from "@/lib/tradeOff";

const BRAND_GREEN_DARK = "#166534";
const BRAND_YELLOW = "#FFB300";

export function CanteenBottomNav({
  hostFirstName,
  hostWhatsapp,
  hostReviews,
  tradeLabel
}: {
  canteenSlug?: string;
  hostFirstName?: string;
  hostWhatsapp?: string | null;
  hostReviews?: { avg: number; count: number } | null;
  tradeLabel?: string;
}) {
  const showRating = hostReviews && hostReviews.count >= 5;
  const waUrl = hostWhatsapp
    ? `https://wa.me/${whatsappDigits(hostWhatsapp)}?text=${encodeURIComponent(
        `Hi ${hostFirstName ?? "there"}, I found you on Thenetworkers — I'd like to get in touch.`
      )}`
    : null;
  const visible = hostFirstName && (showRating || waUrl);
  if (!visible) return null;

  return (
    <nav
      aria-label="Canteen contact bar"
      className="fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur-md lg:hidden"
      style={{
        backgroundColor: "rgba(251,246,236,0.95)",
        borderColor:     "rgba(139,69,19,0.10)"
      }}
    >
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-3 py-2">
        {showRating ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-black text-neutral-900">
            <Star size={12} fill={BRAND_YELLOW} strokeWidth={0} style={{ color: BRAND_YELLOW }}/>
            {hostReviews!.avg.toFixed(1)}
            <span className="text-[11px] font-bold text-neutral-500">
              · {hostReviews!.count} reviews
            </span>
          </span>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-[11px] font-black text-neutral-900">
              {hostFirstName}
            </span>
            {tradeLabel && (
              <span className="truncate text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                {tradeLabel}
              </span>
            )}
          </div>
        )}
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`WhatsApp ${hostFirstName}`}
            className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider text-white shadow-sm transition active:scale-[0.97]"
            style={{ backgroundColor: BRAND_GREEN_DARK }}
          >
            <MessageCircle size={11} strokeWidth={2.5}/>
            WhatsApp
          </a>
        )}
      </div>
      {/* Safe-area shim for phones with home indicators */}
      <div style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}/>
    </nav>
  );
}
