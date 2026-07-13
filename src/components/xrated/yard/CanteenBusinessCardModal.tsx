"use client";

// CanteenBusinessCardModal — full-screen popup that reads as a real
// trade business card. Full-bleed background image of the merchant's
// hero + overlaid: name, address, phone, small QR (opens canteen on
// scan), share-to-WhatsApp button, and close.
//
// Triggered from the hero "Business card" button (replacing the old
// direct WhatsApp CTA). Feels like flipping open the merchant's card.

import { useEffect } from "react";
import { X, Share2, MapPin, Phone } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

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

  if (!open) return null;

  const openUrl = `https://thenetwork.co/${hostSlug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(openUrl)}`;
  const digits = hostWhatsapp ? hostWhatsapp.replace(/[^0-9]/g, "") : null;
  const shareMessage = `Hi ${hostFirstName} — I found your card on The Network. Get in touch about ${tradeLabel.toLowerCase()}.`;
  const shareWaUrl = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(shareMessage)}`
    : null;
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
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl shadow-2xl"
        style={{
          aspectRatio: "9 / 14",
          maxHeight: "calc(100vh - 3rem)"
        }}
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

        {/* Dark gradient overlay for text legibility */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.85) 100%)"
          }}
        />

        {/* Close button — top-right */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close business card"
          className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md transition active:scale-[0.95]"
          style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
        >
          <X size={16} strokeWidth={2.5}/>
        </button>

        {/* Top-left trade tag */}
        <div className="relative z-10 flex items-start justify-between px-4 pt-4">
          <span
            className="rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] shadow-md"
            style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
          >
            {tradeLabel}
          </span>
        </div>

        {/* Middle spacer — pushes contact info to the bottom */}
        <div className="relative z-10 flex-1"/>

        {/* Bottom info block */}
        <div className="relative z-10 flex items-end gap-3 px-4 pb-5">
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black uppercase tracking-[0.24em] text-white/60">
              Business Card
            </div>
            <h2 className="mt-1 text-[22px] font-black leading-tight text-white drop-shadow-md">
              {hostDisplayName}
            </h2>

            {addressFull && (
              <div className="mt-2 flex items-start gap-1.5 text-white/85">
                <MapPin size={12} strokeWidth={2.5} className="mt-0.5 flex-shrink-0"/>
                <span className="text-[11px] font-bold leading-snug drop-shadow-sm">
                  {addressFull}
                </span>
              </div>
            )}

            {digits && (
              <div className="mt-1 flex items-center gap-1.5 text-white/85">
                <Phone size={12} strokeWidth={2.5}/>
                <span className="text-[11px] font-bold drop-shadow-sm">
                  {hostWhatsapp}
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {shareWaUrl && (
                <a
                  href={shareWaUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[11px] font-black uppercase tracking-wider text-white shadow-md transition active:scale-[0.97]"
                  style={{ backgroundColor: BRAND_GREEN_DARK }}
                >
                  <Share2 size={11} strokeWidth={2.5}/>
                  Share to WhatsApp
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3.5 text-[11px] font-black uppercase tracking-wider text-white shadow-md backdrop-blur transition active:scale-[0.97]"
              >
                <X size={11} strokeWidth={2.5}/>
                Close
              </button>
            </div>
          </div>

          {/* Small QR — bottom-right corner */}
          <div
            className="flex flex-shrink-0 flex-col items-center gap-1 rounded-lg bg-white p-1.5 shadow-md"
            style={{ border: `2px solid ${TAN}` }}
          >
            <img
              src={qrUrl}
              alt={`Scan to open ${hostDisplayName} on The Network`}
              width={72}
              height={72}
              className="block"
            />
            <span className="text-[7px] font-black uppercase tracking-[0.14em] text-neutral-600">
              Scan
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
