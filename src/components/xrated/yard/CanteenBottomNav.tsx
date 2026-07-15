"use client";

// CanteenBottomNav — floating pill footer for the canteen mobile
// dashboard. Fixed to the bottom of the viewport but with padding on
// all four sides so the pill hovers above the footer area with air
// around it (no flush edges). Star rating chip + WhatsApp button live
// on one rounded-full container so the strip reads as a single unit.
//
// The WhatsApp button routes through the VerifiedContactModal so we
// burn a washer only on genuine sends. Only renders below lg.

import { useState } from "react";
import { MessageCircle, Star } from "lucide-react";
import { whatsappDigits } from "@/lib/tradeOff";
import { VerifiedContactModal } from "@/components/xrated/VerifiedContactModal";
import { DEFAULT_PALETTE, type PaletteTokens } from "@/lib/paletteTokens";

const BRAND_GREEN_DARK = "#166534";
const BRAND_YELLOW = "#FFB300";

export function CanteenBottomNav({
  canteenSlug,
  hostSlug,
  hostFirstName,
  hostDisplayName,
  hostWhatsapp,
  hostReviews,
  tradeLabel,
  hostCity,
  palette = DEFAULT_PALETTE
}: {
  canteenSlug?: string;
  hostSlug?: string;
  hostFirstName?: string;
  hostDisplayName?: string;
  hostWhatsapp?: string | null;
  hostReviews?: { avg: number; count: number } | null;
  tradeLabel?: string;
  hostCity?: string | null;
  /** Palette tokens — drives the pill bg + text colours. WhatsApp
   *  button stays WhatsApp-brand green across every palette. */
  palette?: PaletteTokens;
}) {
  const [contactOpen, setContactOpen] = useState(false);
  const showRating = hostReviews && hostReviews.count >= 5;
  const digits = hostWhatsapp ? whatsappDigits(hostWhatsapp) : null;
  const visible = hostFirstName && (showRating || digits);
  if (!visible) return null;

  return (
    <div
      aria-label="Canteen contact bar wrapper"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-3 lg:hidden"
      style={{
        paddingLeft:   "max(12px, env(safe-area-inset-left, 0))",
        paddingRight:  "max(12px, env(safe-area-inset-right, 0))",
        paddingBottom: "max(12px, env(safe-area-inset-bottom, 0))"
      }}
    >
      <nav
        aria-label="Canteen contact bar"
        className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-2 rounded-full border py-1 pl-4 pr-1 shadow-lg backdrop-blur-md"
        style={{
          backgroundColor: "#FFFFFF",
          borderColor: palette.dark
            ? "rgba(0,0,0,0.15)"
            : "rgba(139,69,19,0.14)"
        }}
      >
        {showRating ? (
          <span
            className="inline-flex items-center gap-1 text-[13px] font-black"
            style={{ color: "#171717" }}
          >
            <Star size={14} fill={BRAND_YELLOW} strokeWidth={0} style={{ color: BRAND_YELLOW }}/>
            {hostReviews!.avg.toFixed(1)}
            <span className="text-[11px] font-bold" style={{ color: "#737373" }}>
              · {hostReviews!.count} reviews
            </span>
          </span>
        ) : (
          hostFirstName && (
            <span
              className="inline-flex min-w-0 items-center gap-1 text-[12px] font-black"
              style={{ color: "#171717" }}
            >
              <span className="truncate">{hostFirstName}</span>
              {tradeLabel && (
                <span
                  className="truncate text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: "#737373" }}
                >
                  · {tradeLabel}
                </span>
              )}
            </span>
          )
        )}
        {digits && (
          <button
            type="button"
            onClick={() => setContactOpen(true)}
            aria-label={`WhatsApp ${hostFirstName}`}
            className="inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-sm transition active:scale-[0.97]"
            style={{ backgroundColor: BRAND_GREEN_DARK }}
          >
            <MessageCircle size={13} strokeWidth={2.5}/>
            WhatsApp
          </button>
        )}
      </nav>

      {/* Verified contact modal — burns 1 washer only on genuine send. */}
      {digits && hostSlug && hostFirstName && hostDisplayName && tradeLabel && (
        <VerifiedContactModal
          open={contactOpen}
          onClose={() => setContactOpen(false)}
          merchantSlug={hostSlug}
          merchantDisplayName={hostDisplayName}
          merchantFirstName={hostFirstName}
          merchantWhatsapp={digits}
          tradeLabel={tradeLabel}
          city={hostCity ?? undefined}
          source="canteen-mobile-app"
          sourceLabel={`${hostFirstName}'s canteen page on Thenetworkers.app`}
          canteenSlug={canteenSlug}
        />
      )}
    </div>
  );
}
