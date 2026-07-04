"use client";

// Payment expansion — 20 more brand-safe payment method buttons.
//
// Covers the gaps in the base payment pack:
//   • Escrow.com — marketplace escrow
//   • Wise — international transfers (formerly TransferWise)
//   • Coinbase Commerce — crypto (BTC/ETH/USDC)
//   • Alipay / WeChat Pay — Chinese e-wallets
//   • Cash on Delivery / Bank Transfer — the universal fallbacks
//   • Paytm / Razorpay — India
//   • Zelle / Venmo — US P2P
//   • Adyen / Mollie / Square — global processors
//   • QRIS — Indonesia national QR standard
//   • GoPay / Dana / OVO / LinkAja — Indonesian e-wallets
//
// All share the checkout role + full state machine. Every button uses
// its provider's brand colour + canonical wordmark for legal safety.

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
  ButtonRendererProps
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
  providerId: string;
} & ButtonRendererProps<Pay>) {
  const { config, state, tokens, size, shape, motion, data, mode, onEvent } = props;
  const resolved = resolveState(reg, state, tokens);
  const height = sizeToHeightPx(size);
  const paddingX = sizeToPaddingXPx(size);
  const font = sizeToFontPx(size);
  const shapeCss = shapeToStyle(shape);
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

function EscrowMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
    </svg>
  );
}
function WiseMark() {
  return (
    <svg width="42" height="18" viewBox="0 0 100 40" fill="currentColor" aria-hidden="true">
      <text x="0" y="30" fontFamily="system-ui, sans-serif" fontSize="28" fontWeight="800">wise</text>
    </svg>
  );
}
function CoinbaseMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <rect x="9" y="9" width="6" height="6" fill="#FFFFFF" rx="1"/>
    </svg>
  );
}
function AlipayMark() {
  return (
    <svg width="52" height="18" viewBox="0 0 160 50" fill="currentColor" aria-hidden="true">
      <text x="0" y="36" fontFamily="system-ui, sans-serif" fontSize="30" fontWeight="700">Alipay</text>
    </svg>
  );
}
function WeChatMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8.5 4C4.9 4 2 6.5 2 9.5c0 1.7.9 3.2 2.4 4.3l-.6 1.8 2.1-1.1c.8.2 1.7.3 2.6.3l.5-.1c-.1-.4-.1-.8-.1-1.1 0-2.9 2.9-5.3 6.5-5.3.4 0 .8 0 1.1.1C15.6 5.9 12.4 4 8.5 4zm-2 3c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1zm5 0c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1z"/>
      <path d="M22 14.5c0-2.6-2.6-4.7-5.7-4.7-3.3 0-5.9 2.1-5.9 4.7 0 2.7 2.6 4.7 5.9 4.7.7 0 1.4-.1 2-.3l1.9 1-.5-1.6c1.3-.9 2.3-2.2 2.3-3.8zm-7.6-1.5c.4 0 .8.3.8.8s-.3.8-.8.8-.8-.3-.8-.8.3-.8.8-.8zm4 0c.4 0 .8.3.8.8s-.3.8-.8.8-.8-.3-.8-.8.3-.8.8-.8z"/>
    </svg>
  );
}
function CodMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  );
}
function BankTransferMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 22V10M21 22V10M3 10h18L12 3z"/><path d="M6 22V14M10 22V14M14 22V14M18 22V14"/>
    </svg>
  );
}
function PaytmMark() {
  return (
    <svg width="52" height="18" viewBox="0 0 160 50" aria-hidden="true">
      <text x="0" y="36" fontFamily="system-ui, sans-serif" fontSize="30" fontWeight="700" fill="#00BAF2">Paytm</text>
    </svg>
  );
}
function RazorpayMark() {
  return (
    <svg width="60" height="18" viewBox="0 0 200 50" aria-hidden="true">
      <text x="0" y="36" fontFamily="system-ui, sans-serif" fontSize="28" fontWeight="700" fill="#3395FF">Razorpay</text>
    </svg>
  );
}
function ZelleMark() {
  return (
    <svg width="42" height="18" viewBox="0 0 100 40" aria-hidden="true">
      <text x="0" y="30" fontFamily="system-ui, sans-serif" fontSize="26" fontWeight="800" fill="#6D1ED4">zelle</text>
    </svg>
  );
}
function VenmoMark() {
  return (
    <svg width="52" height="18" viewBox="0 0 140 50" aria-hidden="true">
      <text x="0" y="36" fontFamily="system-ui, sans-serif" fontSize="30" fontWeight="800" fill="#008CFF">venmo</text>
    </svg>
  );
}
function AdyenMark() {
  return (
    <svg width="52" height="18" viewBox="0 0 140 40" fill="currentColor" aria-hidden="true">
      <text x="0" y="30" fontFamily="system-ui, sans-serif" fontSize="26" fontWeight="700">Adyen</text>
    </svg>
  );
}
function MollieMark() {
  return (
    <svg width="52" height="18" viewBox="0 0 140 40" aria-hidden="true">
      <text x="0" y="30" fontFamily="system-ui, sans-serif" fontSize="26" fontWeight="700" fill="#000E52">Mollie</text>
    </svg>
  );
}
function SquareMark() {
  return (
    <svg width="42" height="18" viewBox="0 0 120 40" aria-hidden="true">
      <rect x="4" y="4" width="24" height="24" rx="4" fill="#3E4348"/>
      <rect x="10" y="10" width="12" height="12" rx="2" fill="#FFFFFF"/>
      <text x="34" y="26" fontFamily="system-ui, sans-serif" fontSize="20" fontWeight="700" fill="#FFFFFF">Square</text>
    </svg>
  );
}
function QrisMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><path d="M14 14h.01M20 14h.01M14 20h.01M20 20h.01M17 14v3M17 17h3M17 20v-3M20 17h-3"/>
    </svg>
  );
}
function GopayMark() {
  return (
    <svg width="52" height="18" viewBox="0 0 140 40" aria-hidden="true">
      <text x="0" y="30" fontFamily="system-ui, sans-serif" fontSize="26" fontWeight="800" fill="#00AED6">GoPay</text>
    </svg>
  );
}
function DanaMark() {
  return (
    <svg width="52" height="18" viewBox="0 0 140 40" aria-hidden="true">
      <text x="0" y="30" fontFamily="system-ui, sans-serif" fontSize="26" fontWeight="800" fill="#118EEA">DANA</text>
    </svg>
  );
}
function OvoMark() {
  return (
    <svg width="42" height="18" viewBox="0 0 100 40" aria-hidden="true">
      <text x="0" y="30" fontFamily="system-ui, sans-serif" fontSize="26" fontWeight="800" fill="#4C2A86">OVO</text>
    </svg>
  );
}
function LinkAjaMark() {
  return (
    <svg width="60" height="18" viewBox="0 0 160 40" aria-hidden="true">
      <text x="0" y="30" fontFamily="system-ui, sans-serif" fontSize="24" fontWeight="800" fill="#E53935">LinkAja</text>
    </svg>
  );
}
function GrabPayMark() {
  return (
    <svg width="60" height="18" viewBox="0 0 160 40" aria-hidden="true">
      <text x="0" y="30" fontFamily="system-ui, sans-serif" fontSize="26" fontWeight="800" fill="#00B14F">GrabPay</text>
    </svg>
  );
}

// ─── Registrations ──────────────────────────────────

const REGS: Record<string, ButtonRegistration<Pay>> = {};

type PaySpec = {
  id: string;
  name: string;
  defaultLabel: string;
  defaultHref: string;
  bg: string;
  ink: string;
  border?: string;
  shortPitch: string;
  brandMark: React.ReactNode;
  telemetryKey: string;
  keywords: string[];
};

const SPECS: PaySpec[] = [
  {
    id: "pay.escrow_1",
    name: "Escrow.com",
    defaultLabel: "Pay via Escrow",
    defaultHref: "/pay/escrow",
    bg: "#0055A5",
    ink: "#FFFFFF",
    shortPitch: "Marketplace escrow — funds held until delivery confirmed.",
    brandMark: <EscrowMark />,
    telemetryKey: "pay.escrow",
    keywords: ["escrow", "marketplace", "trust", "hold"]
  },
  {
    id: "pay.wise_1",
    name: "Wise",
    defaultLabel: "",
    defaultHref: "/pay/wise",
    bg: "#9FE870",
    ink: "#0A0A0A",
    shortPitch: "International bank transfers — real exchange rate.",
    brandMark: <WiseMark />,
    telemetryKey: "pay.wise",
    keywords: ["wise", "transferwise", "international", "cross-border"]
  },
  {
    id: "pay.coinbase_1",
    name: "Coinbase Commerce",
    defaultLabel: "Pay with crypto",
    defaultHref: "/pay/coinbase",
    bg: "#0052FF",
    ink: "#FFFFFF",
    shortPitch: "BTC / ETH / USDC checkout via Coinbase Commerce.",
    brandMark: <CoinbaseMark />,
    telemetryKey: "pay.coinbase",
    keywords: ["crypto", "bitcoin", "coinbase", "ethereum", "usdc"]
  },
  {
    id: "pay.alipay_1",
    name: "Alipay",
    defaultLabel: "",
    defaultHref: "/pay/alipay",
    bg: "#00A0E9",
    ink: "#FFFFFF",
    shortPitch: "Alipay — China's leading e-wallet.",
    brandMark: <AlipayMark />,
    telemetryKey: "pay.alipay",
    keywords: ["alipay", "china", "ewallet"]
  },
  {
    id: "pay.wechat_1",
    name: "WeChat Pay",
    defaultLabel: "Pay with WeChat",
    defaultHref: "/pay/wechat",
    bg: "#07C160",
    ink: "#FFFFFF",
    shortPitch: "WeChat Pay — universal in mainland China.",
    brandMark: <WeChatMark />,
    telemetryKey: "pay.wechat",
    keywords: ["wechat", "weixin", "china", "ewallet"]
  },
  {
    id: "pay.cod_1",
    name: "Cash on Delivery",
    defaultLabel: "Pay on delivery",
    defaultHref: "/pay/cod",
    bg: "#FFFFFF",
    ink: "#0A0A0A",
    border: "#D4D4D4",
    shortPitch: "COD — pay when it arrives. Common in SEA + India.",
    brandMark: <CodMark />,
    telemetryKey: "pay.cod",
    keywords: ["cod", "cash on delivery", "post-paid"]
  },
  {
    id: "pay.bank_transfer_1",
    name: "Bank Transfer",
    defaultLabel: "Pay by bank transfer",
    defaultHref: "/pay/bank",
    bg: "#FFFFFF",
    ink: "#0A0A0A",
    border: "#D4D4D4",
    shortPitch: "Universal fallback — manual bank transfer with reference.",
    brandMark: <BankTransferMark />,
    telemetryKey: "pay.bank",
    keywords: ["bank", "transfer", "manual", "wire"]
  },
  {
    id: "pay.paytm_1",
    name: "Paytm",
    defaultLabel: "",
    defaultHref: "/pay/paytm",
    bg: "#FFFFFF",
    ink: "#0A0A0A",
    border: "#00BAF2",
    shortPitch: "Paytm — India's leading e-wallet.",
    brandMark: <PaytmMark />,
    telemetryKey: "pay.paytm",
    keywords: ["paytm", "india", "ewallet", "upi"]
  },
  {
    id: "pay.razorpay_1",
    name: "Razorpay",
    defaultLabel: "",
    defaultHref: "/pay/razorpay",
    bg: "#FFFFFF",
    ink: "#0A0A0A",
    border: "#3395FF",
    shortPitch: "Razorpay — India's universal payment aggregator.",
    brandMark: <RazorpayMark />,
    telemetryKey: "pay.razorpay",
    keywords: ["razorpay", "india", "aggregator", "upi"]
  },
  {
    id: "pay.zelle_1",
    name: "Zelle",
    defaultLabel: "",
    defaultHref: "/pay/zelle",
    bg: "#FFFFFF",
    ink: "#0A0A0A",
    border: "#6D1ED4",
    shortPitch: "Zelle — instant US bank-to-bank.",
    brandMark: <ZelleMark />,
    telemetryKey: "pay.zelle",
    keywords: ["zelle", "usa", "bank", "p2p"]
  },
  {
    id: "pay.venmo_1",
    name: "Venmo",
    defaultLabel: "",
    defaultHref: "/pay/venmo",
    bg: "#008CFF",
    ink: "#FFFFFF",
    shortPitch: "Venmo — US peer-to-peer favourite.",
    brandMark: <VenmoMark />,
    telemetryKey: "pay.venmo",
    keywords: ["venmo", "usa", "p2p"]
  },
  {
    id: "pay.adyen_1",
    name: "Adyen",
    defaultLabel: "Pay via Adyen",
    defaultHref: "/pay/adyen",
    bg: "#0ABF53",
    ink: "#FFFFFF",
    shortPitch: "Adyen — enterprise global processor (Uber, Netflix use it).",
    brandMark: <AdyenMark />,
    telemetryKey: "pay.adyen",
    keywords: ["adyen", "enterprise", "global"]
  },
  {
    id: "pay.mollie_1",
    name: "Mollie",
    defaultLabel: "Pay via Mollie",
    defaultHref: "/pay/mollie",
    bg: "#FFFFFF",
    ink: "#000E52",
    border: "#000E52",
    shortPitch: "Mollie — European card + local method aggregator.",
    brandMark: <MollieMark />,
    telemetryKey: "pay.mollie",
    keywords: ["mollie", "europe", "netherlands", "ideal"]
  },
  {
    id: "pay.square_1",
    name: "Square",
    defaultLabel: "",
    defaultHref: "/pay/square",
    bg: "#3E4348",
    ink: "#FFFFFF",
    shortPitch: "Square — in-person + online, US / UK / AU.",
    brandMark: <SquareMark />,
    telemetryKey: "pay.square",
    keywords: ["square", "usa", "in-person", "pos"]
  },
  {
    id: "pay.qris_1",
    name: "QRIS (Indonesia)",
    defaultLabel: "Bayar dengan QRIS",
    defaultHref: "/pay/qris",
    bg: "#FFFFFF",
    ink: "#B02A2D",
    border: "#B02A2D",
    shortPitch: "QRIS — Bank Indonesia's universal QR standard.",
    brandMark: <QrisMark />,
    telemetryKey: "pay.qris",
    keywords: ["qris", "indonesia", "qr", "bank indonesia"]
  },
  {
    id: "pay.gopay_1",
    name: "GoPay",
    defaultLabel: "",
    defaultHref: "/pay/gopay",
    bg: "#FFFFFF",
    ink: "#00AED6",
    border: "#00AED6",
    shortPitch: "GoPay — Gojek's Indonesian e-wallet.",
    brandMark: <GopayMark />,
    telemetryKey: "pay.gopay",
    keywords: ["gopay", "gojek", "indonesia", "ewallet"]
  },
  {
    id: "pay.dana_1",
    name: "DANA",
    defaultLabel: "",
    defaultHref: "/pay/dana",
    bg: "#FFFFFF",
    ink: "#118EEA",
    border: "#118EEA",
    shortPitch: "DANA — Alipay-backed Indonesian e-wallet.",
    brandMark: <DanaMark />,
    telemetryKey: "pay.dana",
    keywords: ["dana", "indonesia", "ewallet"]
  },
  {
    id: "pay.ovo_1",
    name: "OVO",
    defaultLabel: "",
    defaultHref: "/pay/ovo",
    bg: "#FFFFFF",
    ink: "#4C2A86",
    border: "#4C2A86",
    shortPitch: "OVO — Grab-backed Indonesian e-wallet.",
    brandMark: <OvoMark />,
    telemetryKey: "pay.ovo",
    keywords: ["ovo", "grab", "indonesia", "ewallet"]
  },
  {
    id: "pay.linkaja_1",
    name: "LinkAja",
    defaultLabel: "",
    defaultHref: "/pay/linkaja",
    bg: "#FFFFFF",
    ink: "#E53935",
    border: "#E53935",
    shortPitch: "LinkAja — Telkomsel-backed Indonesian e-wallet.",
    brandMark: <LinkAjaMark />,
    telemetryKey: "pay.linkaja",
    keywords: ["linkaja", "telkomsel", "indonesia", "ewallet"]
  },
  {
    id: "pay.grabpay_1",
    name: "GrabPay",
    defaultLabel: "",
    defaultHref: "/pay/grabpay",
    bg: "#FFFFFF",
    ink: "#00B14F",
    border: "#00B14F",
    shortPitch: "GrabPay — SEA-wide Grab e-wallet.",
    brandMark: <GrabPayMark />,
    telemetryKey: "pay.grabpay",
    keywords: ["grabpay", "grab", "sea", "singapore", "malaysia", "philippines"]
  }
];

for (const s of SPECS) {
  const reg: ButtonRegistration<Pay> = {
    id: s.id,
    name: s.name,
    version: "1.0.0",
    category: "ecommerce",
    role: "checkout",
    description: `${s.name} — brand-safe checkout button.`,
    shortPitch: s.shortPitch,
    editableFields: [
      { key: "label", label: "Label", type: { kind: "text", maxLength: 40 }, default: s.defaultLabel, role: "primary_action_label", priority: "text", aiPromptable: true, description: "Payment provider guidelines may restrict this — check policy.", group: "Content" },
      { key: "href", label: "Checkout endpoint", type: { kind: "link" }, default: s.defaultHref, role: "primary_action_href", description: "Configured per-brand in /studio/payments — this is the callback route.", group: "Content" }
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
      explain: `Explain when ${s.name} is the right primary or secondary payment method for a merchant.`,
      improveCopy: "Provider guidelines usually pin label — check policy before rewrite.",
      improveStyle: "Provider brand assets are protected — style adjustments limited to sizing / shape.",
      restyle: "Provider brand — only ambient shadow / height variations are safe.",
      generateFromBrief: `${s.name} button for {vertical} in {region}.`,
      scoreConversion: "Assess regional fit + trust cues.",
      scoreAccessibility: "Contrast + tap + focus + aria-live.",
      suggestIcon: "Brand mark is fixed."
    },
    searchKeywords: ["payment", "checkout", "pay", ...s.keywords],
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
