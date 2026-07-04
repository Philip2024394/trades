"use client";

// Payment pack — 12 payment method buttons.
//
// Every button here is brand-locked. Payment providers publish strict
// look-and-feel rules (Apple Pay guidelines, Shop Pay policy, PayPal
// terms) — this pack ships the canonical appearance so merchants don't
// accidentally violate agreements. Merchants can still change label
// and href but the brand mark is protected.
//
// State machine wired for the full commerce flow:
//   default → hover → pressed → loading → success | error
// Success auto-reverts after 2s (handled by useButtonState).

import { buttonRegistry } from "../buttonRegistry";
import {
  resolveState,
  shapeToStyle,
  sizeToFontPx,
  sizeToHeightPx,
  sizeToPaddingXPx
} from "../themeAdapter";
import { MotionScope } from "../motion/MotionScope";
import { SmartPayButton } from "../payments/SmartPayButton";
import type {
  ButtonRegistration,
  ButtonRendererProps,
  ButtonRole
} from "../types";

type Pay = { label: string; href: string };

// ─── Shared renderer ────────────────────────────────

function PayRenderer({
  reg,
  brandMark,
  providerId,
  ...props
}: {
  reg: ButtonRegistration<Pay>;
  brandMark: React.ReactNode;
  /** Provider id for /api/pay/session — matches the processor registry. */
  providerId: string;
} & ButtonRendererProps<Pay>) {
  const { config, state, tokens, size, shape, motion, data, mode, onEvent } = props;
  const resolved = resolveState(reg, state, tokens);
  const height = sizeToHeightPx(size);
  const paddingX = sizeToPaddingXPx(size);
  const font = sizeToFontPx(size);
  const shapeCss = shapeToStyle(shape);
  // Payment runtime context supplied by the surrounding section /
  // page. If present in `data.domain.paymentContext`, click routes
  // through /api/pay/session. Otherwise the button falls back to
  // plain href navigation (payment-link mode).
  const payCtx = (data.domain?.paymentContext ?? null) as
    | {
        brandId?: string;
        amountMinor?: number;
        currency?: string;
        orderRef?: string;
        description?: string;
        customerEmail?: string;
        returnUrl?: string;
        cancelUrl?: string;
      }
    | null;
  const showLabel = state !== "loading";
  return (
    <MotionScope motion={motion} state={state}>
      {({ animation }) => (
        <SmartPayButton
          href={config.href || "#"}
          mode={mode === "published" ? "published" : mode}
          ctx={{
            providerId,
            brandId: payCtx?.brandId,
            amountMinor: payCtx?.amountMinor,
            currency: payCtx?.currency,
            orderRef: payCtx?.orderRef,
            description: payCtx?.description,
            customerEmail: payCtx?.customerEmail,
            returnUrl: payCtx?.returnUrl,
            cancelUrl: payCtx?.cancelUrl
          }}
          render={({ onClick }) => (
            <a
              href={config.href || "#"}
              onClick={(e) => {
                onEvent?.({ event: "click" });
                onClick(e);
              }}
              tabIndex={mode === "edit" ? -1 : undefined}
              aria-live={
                state === "loading" || state === "success" || state === "error"
                  ? "polite"
                  : undefined
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                maxWidth: 320,
                height,
                paddingLeft: paddingX,
                paddingRight: paddingX,
                fontSize: font,
                fontWeight: 600,
                background: resolved.background,
                color: resolved.ink,
                border: resolved.borderWidth
                  ? `${resolved.borderWidth}px solid ${resolved.border}`
                  : "none",
                boxShadow: resolved.shadow,
                transform: resolved.transform,
                opacity: resolved.opacity,
                transition:
                  "transform 120ms ease-out, box-shadow 120ms ease-out, background 120ms ease-out",
                animation,
                cursor: "pointer",
                textDecoration: "none",
                ...shapeCss
              }}
            >
              <span
                aria-hidden="true"
                style={{ display: "inline-flex", alignItems: "center" }}
              >
                {brandMark}
              </span>
              {showLabel && <span>{config.label}</span>}
              {state === "loading" && <span>Processing…</span>}
              {state === "success" && <span>Paid ✓</span>}
              {state === "error" && <span>Retry</span>}
            </a>
          )}
        />
      )}
    </MotionScope>
  );
}

// ─── Brand marks ────────────────────────────────────

function ApplePayMark() {
  return (
    <svg width="42" height="18" viewBox="0 0 128 55" fill="currentColor" aria-hidden="true">
      <text x="0" y="42" fontFamily="-apple-system, BlinkMacSystemFont, system-ui" fontSize="42" fontWeight="600"></text>
      <text x="26" y="42" fontFamily="-apple-system, BlinkMacSystemFont, system-ui" fontSize="34" fontWeight="600">Pay</text>
    </svg>
  );
}
function GooglePayMark() {
  return (
    <svg width="52" height="18" viewBox="0 0 200 55" aria-hidden="true">
      <text x="0" y="42" fontFamily="Google Sans, Product Sans, system-ui" fontSize="34" fontWeight="500" fill="#4285F4">G</text>
      <text x="24" y="42" fontFamily="Google Sans, Product Sans, system-ui" fontSize="34" fontWeight="500" fill="#EA4335">o</text>
      <text x="46" y="42" fontFamily="Google Sans, Product Sans, system-ui" fontSize="34" fontWeight="500" fill="#FBBC05">o</text>
      <text x="68" y="42" fontFamily="Google Sans, Product Sans, system-ui" fontSize="34" fontWeight="500" fill="#4285F4">g</text>
      <text x="88" y="42" fontFamily="Google Sans, Product Sans, system-ui" fontSize="34" fontWeight="500" fill="#34A853">l</text>
      <text x="98" y="42" fontFamily="Google Sans, Product Sans, system-ui" fontSize="34" fontWeight="500" fill="#EA4335">e</text>
      <text x="122" y="42" fontFamily="Google Sans, Product Sans, system-ui" fontSize="34" fontWeight="500" fill="#5F6368">Pay</text>
    </svg>
  );
}
function PayPalMark() {
  return (
    <svg width="60" height="18" viewBox="0 0 300 90" aria-hidden="true">
      <text x="0" y="65" fontFamily="Helvetica, Arial, sans-serif" fontSize="70" fontWeight="800" fill="#003087">Pay</text>
      <text x="120" y="65" fontFamily="Helvetica, Arial, sans-serif" fontSize="70" fontWeight="800" fill="#009cde">Pal</text>
    </svg>
  );
}
function StripeMark() {
  return (
    <svg width="42" height="18" viewBox="0 0 140 55" fill="currentColor" aria-hidden="true">
      <text x="0" y="42" fontFamily="system-ui" fontSize="38" fontWeight="700">stripe</text>
    </svg>
  );
}
function KlarnaMark() {
  return (
    <svg width="42" height="14" viewBox="0 0 140 50" aria-hidden="true">
      <rect width="140" height="50" rx="14" fill="#FFA8CD" />
      <text x="70" y="34" textAnchor="middle" fontFamily="Klarna Text, system-ui" fontSize="28" fontWeight="700" fill="#0A0A0A">Klarna</text>
    </svg>
  );
}
function AfterpayMark() {
  return (
    <svg width="52" height="18" viewBox="0 0 200 55" fill="currentColor" aria-hidden="true">
      <text x="0" y="42" fontFamily="system-ui" fontSize="30" fontWeight="800">afterpay</text>
    </svg>
  );
}
function ShopPayMark() {
  return (
    <svg width="52" height="18" viewBox="0 0 200 60" aria-hidden="true">
      <rect x="6" y="10" width="40" height="40" rx="8" fill="#5A31F4"/>
      <text x="26" y="40" textAnchor="middle" fontFamily="system-ui" fontSize="28" fontWeight="800" fill="#FFFFFF">S</text>
      <text x="56" y="44" fontFamily="system-ui" fontSize="34" fontWeight="800" fill="#FFFFFF">shop</text>
      <text x="140" y="44" fontFamily="system-ui" fontSize="34" fontWeight="800" fill="#FFFFFF">Pay</text>
    </svg>
  );
}
function AmazonPayMark() {
  return (
    <svg width="60" height="18" viewBox="0 0 200 60" aria-hidden="true">
      <text x="0" y="42" fontFamily="system-ui" fontSize="30" fontWeight="700" fill="#FF9900">amazon pay</text>
    </svg>
  );
}
function CashAppMark() {
  return (
    <svg width="34" height="18" viewBox="0 0 100 60" aria-hidden="true">
      <rect width="60" height="60" rx="14" fill="#00D632"/>
      <text x="30" y="42" textAnchor="middle" fontFamily="system-ui" fontSize="42" fontWeight="800" fill="#FFFFFF">$</text>
      <text x="68" y="42" fontFamily="system-ui" fontSize="28" fontWeight="700" fill="#00D632">Pay</text>
    </svg>
  );
}
function SepaMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/>
    </svg>
  );
}
function BnplMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  );
}
function CardMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  );
}

// ─── Registrations ──────────────────────────────────

const REGS: Record<string, ButtonRegistration<Pay>> = {};

type PaySpec = {
  id: string;
  name: string;
  role: ButtonRole;
  defaultLabel: string;
  defaultHref: string;
  bg: string;
  ink: string;
  border?: string;
  shortPitch: string;
  brandMark: React.ReactNode;
  telemetryKey: string;
};

const SPECS: PaySpec[] = [
  { id: "pay.apple_1", name: "Apple Pay", role: "checkout", defaultLabel: "", defaultHref: "/pay/apple", bg: "#000000", ink: "#FFFFFF", shortPitch: "Apple HIG — solid black. Shown on iOS Safari only per policy.", brandMark: <ApplePayMark />, telemetryKey: "pay.apple" },
  { id: "pay.google_1", name: "Google Pay", role: "checkout", defaultLabel: "", defaultHref: "/pay/google", bg: "#000000", ink: "#FFFFFF", shortPitch: "Google Pay black — the required light-on-dark treatment.", brandMark: <GooglePayMark />, telemetryKey: "pay.google" },
  { id: "pay.paypal_1", name: "PayPal", role: "checkout", defaultLabel: "", defaultHref: "/pay/paypal", bg: "#FFC439", ink: "#003087", shortPitch: "PayPal branded yellow — the highest-recognition treatment.", brandMark: <PayPalMark />, telemetryKey: "pay.paypal" },
  { id: "pay.stripe_1", name: "Stripe Checkout", role: "checkout", defaultLabel: "Pay with card", defaultHref: "/pay/stripe", bg: "#635BFF", ink: "#FFFFFF", shortPitch: "Stripe brand purple — universal card checkout.", brandMark: <StripeMark />, telemetryKey: "pay.stripe" },
  { id: "pay.klarna_1", name: "Klarna", role: "checkout", defaultLabel: "Pay with Klarna", defaultHref: "/pay/klarna", bg: "#FFA8CD", ink: "#0A0A0A", shortPitch: "Klarna pink — buy-now-pay-later.", brandMark: <KlarnaMark />, telemetryKey: "pay.klarna" },
  { id: "pay.afterpay_1", name: "Afterpay / Clearpay", role: "checkout", defaultLabel: "Pay in 4 with Afterpay", defaultHref: "/pay/afterpay", bg: "#B2FCE4", ink: "#0A0A0A", shortPitch: "Afterpay mint — buy in 4 interest-free.", brandMark: <AfterpayMark />, telemetryKey: "pay.afterpay" },
  { id: "pay.shop_pay_1", name: "Shop Pay", role: "checkout", defaultLabel: "", defaultHref: "/pay/shop", bg: "#5A31F4", ink: "#FFFFFF", shortPitch: "Shopify's one-tap purple.", brandMark: <ShopPayMark />, telemetryKey: "pay.shop" },
  { id: "pay.amazon_pay_1", name: "Amazon Pay", role: "checkout", defaultLabel: "", defaultHref: "/pay/amazon", bg: "#FFFFFF", ink: "#0A0A0A", border: "#E5E5E5", shortPitch: "Amazon Pay — light theme with orange wordmark.", brandMark: <AmazonPayMark />, telemetryKey: "pay.amazon" },
  { id: "pay.cash_app_1", name: "Cash App Pay", role: "checkout", defaultLabel: "", defaultHref: "/pay/cashapp", bg: "#00D632", ink: "#FFFFFF", shortPitch: "Cash App neon green — US-first.", brandMark: <CashAppMark />, telemetryKey: "pay.cashapp" },
  { id: "pay.sepa_1", name: "SEPA / Bank Transfer", role: "checkout", defaultLabel: "Pay by bank transfer", defaultHref: "/pay/sepa", bg: "#FFFFFF", ink: "#0A0A0A", border: "#D4D4D4", shortPitch: "European direct-debit.", brandMark: <SepaMark />, telemetryKey: "pay.sepa" },
  { id: "pay.bnpl_1", name: "Buy in 4 (BNPL)", role: "checkout", defaultLabel: "Buy in 4 interest-free", defaultHref: "/pay/bnpl", bg: "#0A0A0A", ink: "#FFFFFF", shortPitch: "Generic BNPL fallback when Klarna/Afterpay aren't available.", brandMark: <BnplMark />, telemetryKey: "pay.bnpl" },
  { id: "pay.card_1", name: "Card checkout (generic)", role: "checkout", defaultLabel: "Pay with card", defaultHref: "/pay/card", bg: "#0A0A0A", ink: "#FFFFFF", shortPitch: "Universal fallback — matches merchant brand.", brandMark: <CardMark />, telemetryKey: "pay.card" }
];

for (const s of SPECS) {
  const reg: ButtonRegistration<Pay> = {
    id: s.id,
    name: s.name,
    version: "1.0.0",
    category: "ecommerce",
    role: s.role,
    description: `${s.name} — brand-safe checkout button.`,
    shortPitch: s.shortPitch,
    editableFields: [
      { key: "label", label: "Label", type: { kind: "text", maxLength: 40 }, default: s.defaultLabel, role: "primary_action_label", priority: "text", aiPromptable: true, description: "Payment provider guidelines may restrict this — check policy.", group: "Content" },
      { key: "href", label: "Checkout endpoint", type: { kind: "link" }, default: s.defaultHref, role: "primary_action_href", group: "Content" }
    ],
    states: {
      default: {
        backgroundLiteral: s.bg,
        inkLiteral: s.ink,
        borderLiteral: s.border ?? "transparent",
        borderWidthPx: s.border ? 1 : 0,
        shadowPreset: "soft"
      },
      hover: { translateYPx: -1, shadowPreset: "floating" },
      focus_visible: { shadowPreset: "glow" },
      pressed: { scale: 0.98 },
      loading: { opacity: 0.85 },
      success: { backgroundLiteral: "#10B981", inkLiteral: "#FFFFFF", shadowPreset: "glow" },
      error: { backgroundLiteral: "#DC2626", inkLiteral: "#FFFFFF" },
      disabled: { opacity: 0.4 }
    },
    motion: {
      hover: "lift",
      press: "shrink",
      loading: "spinner",
      success: "checkmark_morph",
      error: "shake"
    },
    shape: { kind: "rect", radiusPx: 8 },
    size: "lg",
    themeTokensUsed: [],
    a11y: {
      ariaLabelFor: (c) => (c.label as string) || s.name,
      role: "button",
      activateOnSpace: true
    },
    telemetry: { eventOnClick: s.telemetryKey, payloadKeys: ["href"] },
    conversionHints: {
      primaryActionRecommended: true,
      aboveFoldRecommended: false,
      minContrast: 4.5,
      minTapTargetPx: 44
    },
    aiPrompts: {
      explain: `Explain why ${s.name} shipped alone or in a stack of options.`,
      improveCopy: "Payment provider guidelines usually pin label — verify before rewrite.",
      improveStyle: "Payment brand assets are protected. Adjust size / shape only if provider permits.",
      restyle: "Provider brand — only ambient shadow / height variations are safe.",
      generateFromBrief: `${s.name} button for {vertical}.`,
      scoreConversion: "Assess trust cues + geographic fit (Shop Pay in US, SEPA in EU).",
      scoreAccessibility: "Contrast + tap + focus + aria-live on state changes.",
      suggestIcon: "Brand mark is fixed."
    },
    searchKeywords: ["payment", "checkout", "pay", s.name.toLowerCase()],
    defaultConfig: () => ({ label: s.defaultLabel, href: s.defaultHref }),
    renderer: (props) => (
      <PayRenderer
        reg={REGS[s.id]}
        brandMark={s.brandMark}
        providerId={s.telemetryKey.replace(/^pay\./, "")}
        {...props}
      />
    )
  };
  REGS[s.id] = reg;
  buttonRegistry.register(reg);
}
