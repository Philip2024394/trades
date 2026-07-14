"use client";

// CanteenBusinessCardModal — full-screen popup that reads as a real
// trade business card. Full-bleed background image of the merchant's
// hero + overlaid: name, address, phone, small QR (opens canteen on
// scan), share-to-WhatsApp button, and close.
//
// Triggered from the hero "Business card" button (replacing the old
// direct WhatsApp CTA). Feels like flipping open the merchant's card.

import { useEffect, useState } from "react";
import { X, MessageCircle, MapPin, Phone } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";
import { VerifiedContactModal } from "@/components/xrated/VerifiedContactModal";

const TAN = "#B8860B";

export function CanteenBusinessCardModal({
  open,
  onClose,
  hostSlug,
  hostDisplayName,
  hostFirstName,
  tradeLabel,
  hostWhatsapp,
  addressLine,
  postcode,
  city,
  backgroundImageUrl
}: {
  open: boolean;
  onClose: () => void;
  hostSlug: string;
  hostDisplayName: string;
  hostFirstName: string;
  tradeLabel: string;
  hostWhatsapp: string | null;
  addressLine?: string | null;
  postcode?: string | null;
  city?: string | null;
  backgroundImageUrl?: string | null;
}) {
  // Esc to close + prevent body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  // Verified contact modal state — the "Message on WhatsApp" button
  // no longer opens WhatsApp directly. It opens the VerifiedContactModal
  // which collects name/WA/comment and burns a washer on Send.
  // Hook is placed BEFORE the early return so React sees a stable
  // hook order across renders.
  const [contactOpen, setContactOpen] = useState(false);

  if (!open) return null;

  // Split the display name the same way the canteen hero does — last
  // word rendered in tan/yellow, rest of the name above it. Falls back
  // gracefully when the display name is a single word.
  const nameWords = hostDisplayName.trim().split(/\s+/);
  const nameLast = nameWords.pop() ?? hostDisplayName;
  const nameRest = nameWords.join(" ");

  const openUrl = `https://thenetworkers.app/${hostSlug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(openUrl)}`;
  const digits = hostWhatsapp ? hostWhatsapp.replace(/[^0-9]/g, "") : null;
  const addressFull = [addressLine, city, postcode].filter(Boolean).join(", ");

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-label={`${hostDisplayName} business card`}
      className="fixed inset-0 z-[100] flex items-center justify-center px-3 py-6"
      style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      {/* Landscape card + stacked action buttons underneath.
          Aspect 3:2 matches a UK business card (85mm × 55mm). The
          buttons live OUTSIDE the card itself so the card art stays
          uncluttered — closer to how a physical card looks in the
          hand. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-2xl flex-col gap-3"
        style={{ maxHeight: "calc(100vh - 3rem)" }}
      >
        {/* The card itself */}
        <div
          className="relative overflow-hidden rounded-2xl shadow-2xl"
          style={{ aspectRatio: "3 / 2" }}
        >
          {/* Full-bleed background image */}
          {backgroundImageUrl ? (
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundImage: `url('${backgroundImageUrl}')`,
                backgroundSize: "cover",
                backgroundPosition: "center"
              }}
            />
          ) : (
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ backgroundColor: BRAND_BLACK }}
            />
          )}

          {/* Left-to-right dark gradient — legibility on the left
              where the name and details sit, image visible on the
              right around the QR. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.20) 70%, rgba(0,0,0,0.05) 100%)"
            }}
          />

          {/* Close button — top-right of the card. Dark red so the
              dismiss affordance reads unmistakably at any card colour. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close business card"
            className="absolute z-20 inline-flex h-11 w-11 items-center justify-center rounded-full shadow-md transition active:scale-[0.95]"
            style={{
              backgroundColor: "#991B1B",
              color: "#FFFFFF",
              top:   "max(16px, env(safe-area-inset-top, 0))",
              right: "max(16px, env(safe-area-inset-right, 0))"
            }}
          >
            <X size={20} strokeWidth={2.8}/>
          </button>

          {/* Card body — mirrors the canteen hero's typography
              (Playfair Display serif headline, last word in tan,
              "Connect. Share. Grow." tagline, trade tag chip). Then
              the QR is floated in the bottom-right corner so the
              card art on the left stays uncluttered — same feel as
              a real trade business card. */}
          <div className="relative z-10 flex h-full flex-col justify-between p-4 sm:p-6">
            {/* Top row — trade tag + "Business Card" eyebrow */}
            <div className="flex items-center justify-between gap-2">
              <span
                className="rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] shadow-md"
                style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
              >
                {tradeLabel}
              </span>
            </div>

            {/* Main copy — headline mirrors the canteen hero. Splits
                the display name so the last word (surname) renders in
                tan, matching how the hero splits the canteen name. */}
            <div className="min-w-0 pr-[35%]">
              <div className="text-[9px] font-black uppercase tracking-[0.24em] text-white/60">
                Business Card
              </div>
              <h2
                className="mt-1 text-[24px] font-black leading-[1.05] tracking-tight text-white drop-shadow-md sm:text-[32px] md:text-[36px]"
                style={{ fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' }}
              >
                {nameRest && (
                  <>
                    {nameRest}
                    <br/>
                  </>
                )}
                <span style={{ color: BRAND_YELLOW }}>{nameLast}.</span>
              </h2>
              <p className="mt-1 text-[11px] font-bold text-white/85 drop-shadow-sm sm:text-[12px]">
                Connect. Share. Grow.
              </p>

              {/* Address + phone — kept compact so the QR breathing
                  room stays in the bottom-right. */}
              <div className="mt-2 flex flex-col gap-1">
                {addressFull && (
                  <div className="flex items-start gap-1.5 text-white/90">
                    <MapPin size={12} strokeWidth={2.5} className="mt-0.5 flex-shrink-0"/>
                    <span className="text-[12px] font-bold leading-snug drop-shadow-sm sm:text-[12.5px]">
                      {addressFull}
                    </span>
                  </div>
                )}
                {digits && (
                  <div className="flex items-center gap-1.5 text-white/90">
                    <Phone size={12} strokeWidth={2.5}/>
                    <span className="text-[12px] font-bold drop-shadow-sm sm:text-[12.5px]">
                      {hostWhatsapp}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* QR — absolute-positioned in the bottom-right corner of
              the card. Sits on top of everything (z-20) so it never
              gets covered by the gradient. Matches how a real trade
              card would print a scannable code in the corner. */}
          <div
            className="absolute z-20 flex flex-col items-center gap-1 rounded-lg bg-white p-1.5 shadow-md sm:p-2"
            style={{
              border: `2px solid ${TAN}`,
              bottom: "max(16px, env(safe-area-inset-bottom, 0))",
              right:  "max(16px, env(safe-area-inset-right, 0))"
            }}
          >
            <img
              src={qrUrl}
              alt={`Scan to open ${hostDisplayName} on Thenetworkers`}
              width={90}
              height={90}
              className="block h-[64px] w-[64px] sm:h-[90px] sm:w-[90px]"
            />
            <span className="text-[7px] font-black uppercase tracking-[0.14em] text-neutral-600">
              Scan
            </span>
          </div>
        </div>

        {/* Action buttons — outside the card so the card reads as a
            card, not a form. Message routes through VerifiedContactModal
            so we burn a washer only on a genuine send. */}
        {digits && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-[12px] font-black uppercase tracking-wider text-white shadow-md transition active:scale-[0.97]"
              style={{ backgroundColor: BRAND_GREEN_DARK }}
            >
              <MessageCircle size={14} strokeWidth={2.5}/>
              Message {hostFirstName}
            </button>
          </div>
        )}
      </div>

      {/* Verified contact modal — collects name/WA/comment before
          opening WhatsApp. Fires the washer deduction on Send. */}
      {digits && (
        <VerifiedContactModal
          open={contactOpen}
          onClose={() => {
            setContactOpen(false);
            onClose();
          }}
          merchantSlug={hostSlug}
          merchantDisplayName={hostDisplayName}
          merchantFirstName={hostFirstName}
          merchantWhatsapp={digits}
          tradeLabel={tradeLabel}
          city={city}
          source="canteen-business-card"
          sourceLabel={`${hostFirstName}'s business card on Thenetworkers.app`}
          canteenSlug={hostSlug}
        />
      )}
    </div>
  );
}
