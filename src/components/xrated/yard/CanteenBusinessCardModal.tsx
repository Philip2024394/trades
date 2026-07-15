"use client";

// CanteenBusinessCardModal — full-screen popup that reads as a real
// trade business card. Full-bleed background image of the merchant's
// hero + overlaid: name, address, phone, small QR (opens canteen on
// scan), Share-to-WhatsApp button, and close.
//
// Share model (2026-07-15): the modal is SHARE-ONLY — no direct
// "Message merchant" affordance. Tapping Share Business Card pre-fills
// a WhatsApp message with the merchant's contact card + canteen link
// and opens WhatsApp's contact picker so the user forwards to anyone.
// The share burns 1 washer per successful share (same lead-gen model
// as verified contacts — a shared card is a spread-lead surface). See
// project_washers_lead_gen_model.md.

import { useEffect, useState } from "react";
import { X, Share2, MapPin, Phone } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK } from "@/lib/brand/tokens";

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

  // Sharing state — tracked so the Share button can show "Sharing…"
  // while the washer deduction fires + the wa.me handoff opens.
  const [sharing, setSharing] = useState(false);

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
                  <div className="flex items-center gap-1.5">
                    <Phone size={12} strokeWidth={2.5} className="text-white"/>
                    <span
                      className="text-[12px] font-bold drop-shadow-sm sm:text-[12.5px]"
                      style={{ color: "#FFFFFF" }}
                    >
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

        {/* Action button — Share Business Card. Fires a washer deduct
            call (spread-lead is counted as a lead surface per the
            lead-gen model) then opens WhatsApp's contact picker with
            a pre-formed card message. NO direct "message merchant"
            button here — the card is a share surface, not a contact
            form. Verified-contact flow lives on the hero WhatsApp CTA. */}
        {digits && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={sharing}
              onClick={async () => {
                if (sharing) return;
                setSharing(true);
                // Best-effort washer deduct — proceed to share even if
                // the endpoint fails so the visitor flow never stalls.
                try {
                  await fetch(`/api/washers/deduct`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      merchantSlug: hostSlug,
                      source: "canteen-business-card-share",
                      sourceLabel: `${hostFirstName}'s business card share on Thenetworkers.app`
                    })
                  });
                } catch { /* stub or offline — swallow */ }

                // Compose the shareable card. Recipient sees the
                // merchant's trade, city, WhatsApp number, and canteen
                // link. Uses wa.me/?text (no phone) so WhatsApp opens
                // its contact picker instead of a specific chat.
                const canteenUrl = `https://thenetworkers.app/trade-off/yard/canteens/${hostSlug}`;
                const addrLine = [addressLine, city, postcode].filter(Boolean).join(", ");
                const shareText =
                  `📇 ${hostDisplayName}` +
                  `\n${tradeLabel}${city ? ` · ${city}` : ""}` +
                  (addrLine ? `\n📍 ${addrLine}` : "") +
                  `\n📱 WhatsApp: +${digits}` +
                  `\n\n👇 Full profile + reviews` +
                  `\n${canteenUrl}` +
                  `\n\n— Shared via ${hostFirstName}'s Tradesite on Thenetworkers.app`;
                const shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
                if (typeof window !== "undefined") {
                  window.open(shareUrl, "_blank", "noopener,noreferrer");
                }
                setSharing(false);
                onClose();
              }}
              className="inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-[12px] font-black uppercase tracking-wider text-white shadow-md transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70"
              style={{ backgroundColor: "#166534" }}
            >
              <Share2 size={14} strokeWidth={2.5}/>
              {sharing ? "Sharing…" : "Share Business Card"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
