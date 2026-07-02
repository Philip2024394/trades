/**
 * @fileoverview MERCHANT-ONLY component.
 * @merchantOnly Only renders when isStorefrontOn(listing) === true.
 * Importing this from a service-trade context is a code smell — use
 * the service/ siblings instead.
 */

// PaymentIconsRow — bordered container of payment-method "brand pill" SVGs.
//
// The actual payment is arranged via WhatsApp (we don't custody money),
// but this row signals to the buyer which payment surfaces the
// tradesperson accepts. Tradespeople pick their accepted methods in the
// dashboard; this component receives that selection via `selected`.
//
// `selected` semantics:
//   - null OR empty array  → render the platform default set
//                            (visa, mastercard, amex, apple_pay, whatsapp)
//   - non-empty array      → render ONLY those keys, in the order given
//
// Supported keys: 'visa' | 'mastercard' | 'amex' | 'apple_pay' |
//                 'google_pay' | 'whatsapp' | 'cash' | 'bank_transfer'.
//
// Server component — pure markup, no state. SVG marks are stylised
// monograms, not copyrighted full logos.

import type { ReactNode } from "react";

export const PAYMENT_METHOD_KEYS = [
  "visa",
  "mastercard",
  "amex",
  "apple_pay",
  "google_pay",
  "whatsapp",
  "cash",
  "bank_transfer"
] as const;

export type PaymentMethodKey = (typeof PAYMENT_METHOD_KEYS)[number];

const DEFAULT_KEYS: PaymentMethodKey[] = [
  "visa",
  "mastercard",
  "amex",
  "apple_pay"
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodKey, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  whatsapp: "WhatsApp",
  cash: "Cash",
  bank_transfer: "Bank transfer"
};

export function PaymentMethodMark({ k }: { k: PaymentMethodKey }): ReactNode {
  switch (k) {
    case "visa":
      return <VisaMark />;
    case "mastercard":
      return <MastercardMark />;
    case "amex":
      return <AmexMark />;
    case "apple_pay":
      return <ApplePayMark />;
    case "google_pay":
      return <GooglePayMark />;
    case "whatsapp":
      return <WhatsAppMark />;
    case "cash":
      return <CashMark />;
    case "bank_transfer":
      return <BankTransferMark />;
    default:
      return null;
  }
}

export function PaymentIconsRow({
  selected,
  bottomSlot
}: {
  selected?: string[] | null;
  /** Optional content rendered INSIDE the same trust card, separated by
   *  a thin divider. Used to host the compact reviews block — keeps
   *  payments + social proof inside one bordered surface. */
  bottomSlot?: ReactNode;
}) {
  const keys: PaymentMethodKey[] =
    Array.isArray(selected) && selected.length > 0
      ? (selected.filter((k): k is PaymentMethodKey =>
          (PAYMENT_METHOD_KEYS as readonly string[]).includes(k)
        ))
      : DEFAULT_KEYS;
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      <div className="p-4">
        <p className="text-[13px] font-extrabold uppercase tracking-[0.18em]" style={{ color: "#FFB300" }}>
          PAYMENTS ACCEPTED
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {keys.map((k) => (
            <Pill key={k} aria-label={PAYMENT_METHOD_LABELS[k]}>
              <PaymentMethodMark k={k} />
            </Pill>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-neutral-500">
          Final payment arranged direct via WhatsApp — your card never enters this site.
        </p>
      </div>
      {bottomSlot && (
        <div className="border-t border-neutral-200">{bottomSlot}</div>
      )}
    </div>
  );
}

function Pill({
  children,
  "aria-label": ariaLabel
}: {
  children: React.ReactNode;
  "aria-label": string;
}) {
  // Modern card-shaped chip. ~46×30 with a subtle gradient + 1px hairline
  // border + soft drop-shadow so each mark reads as a real payment card
  // rather than a boxed monogram. Inner padding zero — the SVG mark fills
  // the chip end-to-end (proper 1.586:1 card aspect ratio).
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className="inline-flex h-[30px] w-[46px] items-center justify-center overflow-hidden rounded-md border border-neutral-200"
      style={{
        background: "linear-gradient(180deg, #FFFFFF 0%, #F5F5F5 100%)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06), inset 0 0 0 0.5px rgba(0,0,0,0.04)"
      }}
    >
      {children}
    </span>
  );
}

// All card marks share the same outer dimensions (46×30, 1.533:1 — close
// to a real credit-card 1.586:1) so they line up flush inside the Pill
// chip. Each fills the chip end-to-end with a brand-coloured face and a
// modern minimal logo treatment. NOT the official brand logos — these
// are stylised renderings that respect brand colour but avoid trademark
// likeness.

const CARD_W = 46;
const CARD_H = 30;

// Visa — deep navy face + signature gold underline stripe.
function VisaMark() {
  return (
    <svg
      width={CARD_W}
      height={CARD_H}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="visa-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1A1F71" />
          <stop offset="100%" stopColor="#13174F" />
        </linearGradient>
      </defs>
      <rect width={CARD_W} height={CARD_H} rx="4" fill="url(#visa-bg)" />
      <rect x="0" y="22" width={CARD_W} height="2" fill="#F7B600" />
      <text
        x="23"
        y="17"
        textAnchor="middle"
        fontFamily="Arial Black, Helvetica, sans-serif"
        fontSize="10"
        fontWeight="900"
        fontStyle="italic"
        fill="#FFFFFF"
        letterSpacing="0.8"
      >
        VISA
      </text>
    </svg>
  );
}

// Mastercard — clean white face + iconic interlocking red/orange/yellow
// circles. Modern flat treatment, no text mark.
function MastercardMark() {
  return (
    <svg
      width={CARD_W}
      height={CARD_H}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      aria-hidden="true"
    >
      <rect width={CARD_W} height={CARD_H} rx="4" fill="#FFFFFF" />
      <circle cx="19" cy="15" r="7" fill="#EB001B" />
      <circle cx="27" cy="15" r="7" fill="#F79E1B" />
      <path
        d="M23 9.5a7 7 0 0 1 0 11a7 7 0 0 1 0-11z"
        fill="#FF5F00"
      />
    </svg>
  );
}

// Amex — solid blue face + bold "AMEX" wordmark with subtle border.
function AmexMark() {
  return (
    <svg
      width={CARD_W}
      height={CARD_H}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="amex-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2E77BC" />
          <stop offset="100%" stopColor="#1B5A99" />
        </linearGradient>
      </defs>
      <rect width={CARD_W} height={CARD_H} rx="4" fill="url(#amex-bg)" />
      <text
        x="23"
        y="19"
        textAnchor="middle"
        fontFamily="Arial Black, Helvetica, sans-serif"
        fontSize="9"
        fontWeight="900"
        fill="#FFFFFF"
        letterSpacing="1"
      >
        AMEX
      </text>
    </svg>
  );
}

// Apple Pay — black face + apple glyph + clean Pay wordmark. Layout
// pulls the glyph + wordmark into a tight pair centred horizontally so
// nothing gets clipped by the 46px card width.
function ApplePayMark() {
  return (
    <svg
      width={CARD_W}
      height={CARD_H}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      aria-hidden="true"
    >
      <rect width={CARD_W} height={CARD_H} rx="4" fill="#0A0A0A" />
      {/* Apple glyph — centred on x≈14, y≈15. */}
      <path
        d="M16.8 14.2c.4-.5.7-1.1.6-1.8c-.6 0-1.3.4-1.6.9c-.3.4-.6 1-.6 1.7c.6.1 1.2-.3 1.6-.8zm.5.7c-.9-.1-1.6.5-2 .5c-.4 0-1-.5-1.8-.5c-.9 0-1.7.5-2.2 1.4c-.9 1.6-.2 4 .7 5.3c.4.7 1 1.4 1.7 1.4c.7 0 .9-.4 1.7-.4c.8 0 1.1.4 1.8.4c.7 0 1.2-.7 1.7-1.3c.4-.7.6-1.4.6-1.4s-1.4-.5-1.4-2.1c0-1.3 1.1-1.9 1.2-2c-.6-.9-1.7-1-2-1.1z"
        fill="#FFFFFF"
      />
      <text
        x="22"
        y="20"
        fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
        fontSize="10"
        fontWeight="600"
        fill="#FFFFFF"
        letterSpacing="-0.2"
      >
        Pay
      </text>
    </svg>
  );
}

// Google Pay — clean white face + signature multicolor G glyph + Pay.
function GooglePayMark() {
  return (
    <svg
      width={CARD_W}
      height={CARD_H}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      aria-hidden="true"
    >
      <rect
        width={CARD_W}
        height={CARD_H}
        rx="4"
        fill="#FFFFFF"
        stroke="#E5E5E5"
        strokeWidth="0.5"
      />
      {/* Stylised G glyph in the 4 Google brand colors. */}
      <g transform="translate(8 9)">
        <path
          d="M12 6.2v2.2h3.2c-.1.7-.6 1.7-1.7 2.4l-.1.1l2.4 1.9l.2 0a6 6 0 0 0 1.8-4.5c0-.5 0-.9-.1-1.3z"
          fill="#4285F4"
        />
        <path
          d="M12 14a6 6 0 0 0 4.2-1.5l-2-1.6c-.6.4-1.3.6-2.2.6a3.8 3.8 0 0 1-3.6-2.6L8.3 9l-2.5 1.9l-.1.1A6 6 0 0 0 12 14z"
          fill="#34A853"
        />
        <path
          d="M8.4 8.4a3.7 3.7 0 0 1 0-2.3v-1.6L5.8 2.6l-.1 0a6 6 0 0 0 0 6.7z"
          fill="#FBBC04"
        />
        <path
          d="M12 4.6c1.3 0 2.2.6 2.7 1l2-2A6 6 0 0 0 12 2a6 6 0 0 0-5.3 3.3l2.6 2a3.8 3.8 0 0 1 2.7-1.5z"
          fill="#EA4335"
        />
      </g>
      <text
        x="33"
        y="20"
        fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
        fontSize="10"
        fontWeight="600"
        fill="#1F1F1F"
        letterSpacing="-0.2"
      >
        Pay
      </text>
    </svg>
  );
}

// WhatsApp — green face + speech-bubble glyph. Sized to match card chip.
function WhatsAppMark() {
  return (
    <svg
      width={CARD_W}
      height={CARD_H}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      aria-hidden="true"
    >
      <rect width={CARD_W} height={CARD_H} rx="4" fill="#25D366" />
      <path
        d="M30.4 13.8a7.6 7.6 0 0 0-13 5.4c0 1.4.4 2.7 1.1 3.9l-1.2 4.3l4.4-1.2a7.6 7.6 0 0 0 8.7-12.4zm-5.6 11.6a6.3 6.3 0 0 1-3.2-.9l-.2-.1l-2.6.7l.7-2.5l-.2-.3a6.3 6.3 0 1 1 5.5 3.1z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

// Cash — dark green face + clean white "CASH" pill with £ symbol.
function CashMark() {
  return (
    <svg
      width={CARD_W}
      height={CARD_H}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cash-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0F9152" />
          <stop offset="100%" stopColor="#0F7A3F" />
        </linearGradient>
      </defs>
      <rect width={CARD_W} height={CARD_H} rx="4" fill="url(#cash-bg)" />
      <circle cx="14" cy="15" r="6.5" fill="#FFFFFF" />
      <text
        x="14"
        y="19"
        textAnchor="middle"
        fontFamily="Arial Black, Helvetica, sans-serif"
        fontSize="11"
        fontWeight="900"
        fill="#0F7A3F"
      >
        £
      </text>
      <text
        x="32"
        y="19"
        textAnchor="middle"
        fontFamily="Arial Black, Helvetica, sans-serif"
        fontSize="7"
        fontWeight="900"
        fill="#FFFFFF"
        letterSpacing="0.5"
      >
        CASH
      </text>
    </svg>
  );
}

// Bank Transfer — deep slate face + clean bank-pillar glyph + "BANK".
function BankTransferMark() {
  return (
    <svg
      width={CARD_W}
      height={CARD_H}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bank-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#404040" />
          <stop offset="100%" stopColor="#262626" />
        </linearGradient>
      </defs>
      <rect width={CARD_W} height={CARD_H} rx="4" fill="url(#bank-bg)" />
      {/* Bank pillar glyph */}
      <g transform="translate(7 8)" fill="#FFFFFF">
        <path d="M6 0 0 3v1.5h12V3L6 0z" />
        <rect x="0.5" y="5" width="1.5" height="6" />
        <rect x="3.5" y="5" width="1.5" height="6" />
        <rect x="6.5" y="5" width="1.5" height="6" />
        <rect x="9.5" y="5" width="1.5" height="6" />
        <rect x="0" y="11.5" width="12" height="1.5" />
      </g>
      <text
        x="33"
        y="19"
        textAnchor="middle"
        fontFamily="Arial Black, Helvetica, sans-serif"
        fontSize="7"
        fontWeight="900"
        fill="#FFFFFF"
        letterSpacing="0.4"
      >
        BANK
      </text>
    </svg>
  );
}
