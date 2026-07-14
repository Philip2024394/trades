"use client";

// VerifiedContactButton — a drop-in <button> that opens the
// VerifiedContactModal. Kept as a thin wrapper so the many merchant
// WhatsApp CTAs across the platform (canteen hero, business card,
// product PDPs, style showcase, admin card, trade profile, etc.)
// route through the washer rail with a single-line change per site.
//
// Usage:
//   <VerifiedContactButton
//     merchantSlug={admin.slug}
//     merchantDisplayName={admin.displayName}
//     merchantFirstName={firstName}
//     merchantWhatsapp={admin.whatsapp}
//     tradeLabel={admin.tradeLabel}
//     source="canteen-product-carousel"
//     sourceLabel={`Mike's product listing for ${product.name}`}
//     className="..."
//     style={...}
//   >
//     <MessageCircle size={12}/>
//     Message Mike
//   </VerifiedContactButton>
//
// Every prop except children mirrors VerifiedContactModal.

import { useState } from "react";
import {
  VerifiedContactModal,
  type ContactSource
} from "@/components/xrated/VerifiedContactModal";

export function VerifiedContactButton({
  merchantSlug,
  merchantDisplayName,
  merchantFirstName,
  merchantWhatsapp,
  tradeLabel,
  city,
  source,
  sourceLabel,
  canteenSlug,
  className,
  style,
  ariaLabel,
  disabled,
  children
}: {
  merchantSlug: string;
  merchantDisplayName: string;
  merchantFirstName: string;
  merchantWhatsapp: string | null | undefined;
  tradeLabel: string;
  city?: string | null;
  source: ContactSource;
  sourceLabel: string;
  canteenSlug?: string;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!merchantWhatsapp) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        disabled={disabled}
        className={className}
        style={style}
      >
        {children}
      </button>
      <VerifiedContactModal
        open={open}
        onClose={() => setOpen(false)}
        merchantSlug={merchantSlug}
        merchantDisplayName={merchantDisplayName}
        merchantFirstName={merchantFirstName}
        merchantWhatsapp={merchantWhatsapp}
        tradeLabel={tradeLabel}
        city={city}
        source={source}
        sourceLabel={sourceLabel}
        canteenSlug={canteenSlug}
      />
    </>
  );
}
