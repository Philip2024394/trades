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
  "apple_pay",
  "whatsapp"
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
  selected
}: {
  selected?: string[] | null;
}) {
  const keys: PaymentMethodKey[] =
    Array.isArray(selected) && selected.length > 0
      ? (selected.filter((k): k is PaymentMethodKey =>
          (PAYMENT_METHOD_KEYS as readonly string[]).includes(k)
        ))
      : DEFAULT_KEYS;
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
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
  );
}

function Pill({
  children,
  "aria-label": ariaLabel
}: {
  children: React.ReactNode;
  "aria-label": string;
}) {
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className="grid h-9 w-14 place-items-center rounded-md border border-neutral-200 bg-neutral-50"
    >
      {children}
    </span>
  );
}

// Stylised Visa monogram — navy rounded rectangle with white "VISA"
// wordmark inside. Not the official Visa logo.
function VisaMark() {
  return (
    <svg width="40" height="20" viewBox="0 0 40 20" aria-hidden="true">
      <rect x="0" y="0" width="40" height="20" rx="3" fill="#1A1F71" />
      <text
        x="20"
        y="14"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="10"
        fontWeight="900"
        fontStyle="italic"
        fill="#FFFFFF"
        letterSpacing="0.5"
      >
        VISA
      </text>
    </svg>
  );
}

// Stylised Mastercard mark — overlapping red and yellow circles with a
// small "Mastercard" beneath. Not the official Mastercard logo.
function MastercardMark() {
  return (
    <svg width="40" height="22" viewBox="0 0 40 22" aria-hidden="true">
      <circle cx="16" cy="9" r="7" fill="#EB001B" />
      <circle cx="24" cy="9" r="7" fill="#F79E1B" />
      <path
        d="M20 4.2a7 7 0 0 1 0 9.6a7 7 0 0 1 0-9.6z"
        fill="#FF5F00"
      />
      <text
        x="20"
        y="21"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="5"
        fontWeight="700"
        fill="#0A0A0A"
      >
        Mastercard
      </text>
    </svg>
  );
}

// Stylised Amex monogram — blue rounded rectangle with white "AMEX"
// wordmark inside. Not the official American Express logo.
function AmexMark() {
  return (
    <svg width="40" height="20" viewBox="0 0 40 20" aria-hidden="true">
      <rect x="0" y="0" width="40" height="20" rx="3" fill="#2E77BC" />
      <text
        x="20"
        y="14"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="9"
        fontWeight="900"
        fill="#FFFFFF"
        letterSpacing="0.5"
      >
        AMEX
      </text>
    </svg>
  );
}

// Stylised Apple Pay — dark rounded rect with apple glyph + "Pay" text.
// Not the official Apple Pay logo.
function ApplePayMark() {
  return (
    <svg width="44" height="20" viewBox="0 0 44 20" aria-hidden="true">
      <rect x="0" y="0" width="44" height="20" rx="3" fill="#0A0A0A" />
      <path
        d="M14.4 6.3c.5-.6.8-1.4.7-2.2c-.7 0-1.5.5-2 1.1c-.4.5-.8 1.3-.7 2.1c.8.1 1.5-.4 2-1zm.7.8c-1.1-.1-2 .6-2.5.6c-.5 0-1.3-.6-2.2-.6c-1.1 0-2.2.7-2.7 1.7c-1.2 2-.3 5 .8 6.6c.5.8 1.2 1.7 2.1 1.7c.8 0 1.2-.5 2.2-.5c1 0 1.4.5 2.2.5c.9 0 1.5-.8 2.1-1.6c.6-.9.9-1.8.9-1.8s-1.8-.7-1.8-2.7c0-1.7 1.4-2.5 1.5-2.5c-.8-1.2-2-1.3-2.6-1.4z"
        fill="#FFFFFF"
      />
      <text
        x="29"
        y="14"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="9"
        fontWeight="700"
        fill="#FFFFFF"
      >
        Pay
      </text>
    </svg>
  );
}

// Stylised Google Pay — white rounded rect with bold multi-colour "G"
// glyph + "Pay" text. Not the official Google Pay logo.
function GooglePayMark() {
  return (
    <svg width="44" height="20" viewBox="0 0 44 20" aria-hidden="true">
      <rect x="0" y="0" width="44" height="20" rx="3" fill="#FFFFFF" stroke="#D1D5DB" />
      <text
        x="9"
        y="14"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="11"
        fontWeight="900"
        fill="#4285F4"
      >
        G
      </text>
      <text
        x="28"
        y="14"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="9"
        fontWeight="700"
        fill="#0A0A0A"
      >
        Pay
      </text>
    </svg>
  );
}

// Stylised WhatsApp chat-bubble glyph in green.
function WhatsAppMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Z"
        fill="#25D366"
      />
    </svg>
  );
}

// Stylised Cash banknote — green rounded rectangle with "£" glyph.
function CashMark() {
  return (
    <svg width="40" height="20" viewBox="0 0 40 20" aria-hidden="true">
      <rect x="0" y="0" width="40" height="20" rx="3" fill="#0F7A3F" />
      <circle cx="20" cy="10" r="6" fill="#FFFFFF" />
      <text
        x="20"
        y="14"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="10"
        fontWeight="900"
        fill="#0F7A3F"
      >
        £
      </text>
    </svg>
  );
}

// Stylised Bank Transfer — building / bank glyph in neutral grey.
function BankTransferMark() {
  return (
    <svg width="24" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2 2 7v2h20V7L12 2zm-8 9v8H2v2h20v-2h-2v-8h-2v8h-3v-8h-2v8h-2v-8H9v8H6v-8H4z"
        fill="#404040"
      />
    </svg>
  );
}
