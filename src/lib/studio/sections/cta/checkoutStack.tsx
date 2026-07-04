"use client";

// checkout.stack_1 — payment stack section.
//
// Ships the CTA for the checkout moment: headline + amount +
// stack of payment buttons the merchant picks from their configured
// providers. Every button embedded here inherits the section's
// paymentContext (amount, currency, orderRef) so clicking either kicks
// the merchant into the right provider's hosted checkout via
// /api/pay/session.
//
// Config:
//   • headline / subhead / trust marks (copy)
//   • productName / orderRef / description
//   • amountMinor (in minor units — cents / paise / rupiah)
//   • currency (ISO 4217)
//   • returnUrl / cancelUrl
//   • providerButtons — pipe-separated variant keys, one payment
//     button per merchant preference (e.g.
//     "pay.stripe_1|pay.paypal_1|pay.gopay_1|pay.qris_1")
//
// The button variants themselves live in the button registry — this
// section is a HOST that resolves them via ButtonSlot at render time.

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import { ButtonSlot } from "@/platform/buttons/ButtonSlot";
import "@/platform/buttons";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  productName: string;
  amountMinor: number;
  currency: string;
  orderRef: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  providerButtons: string; // pipe-separated variantKeys
  trustLine: string;
};

function CheckoutStack({
  instanceId,
  config,
  tokens,
  data,
  mode
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const surface = (tokens["color.surface"] as string) ?? "#FFFFFF";
  const ink = (tokens["color.text"] as string) ?? "#0A0A0A";
  const muted = (tokens["color.muted"] as string) ?? "#737373";
  const headingFont = (tokens["font.heading"] as string) ?? "inherit";
  const bodyFont = (tokens["font.body"] as string) ?? "inherit";

  const variantKeys = (config.providerButtons ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  const amountDisplay = formatAmount(config.amountMinor, config.currency);
  // Merchant intent — most Global Buttons come from the brand's config;
  // for a checkout section we treat every button as CHECKOUT role
  // so they inherit any Global checkout overrides.
  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{ background: surface, color: ink, fontFamily: bodyFont }}
      {...sectionRootAttrs(instanceId, "checkout.stack_1", "Checkout stack")}
    >
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 px-5 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-14">
        {/* LEFT — copy */}
        <div>
          {config.eyebrow && (
            <p
              className="text-[11px] font-extrabold uppercase tracking-[0.28em]"
              style={{ color: accent }}
              {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
            >
              {config.eyebrow}
            </p>
          )}
          <h1
            className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl"
            style={{ fontFamily: headingFont, letterSpacing: "-0.02em" }}
            {...treeAttrs(instanceId, "heading", "Headline", "text")}
          >
            {config.heading}
          </h1>
          {config.subheading && (
            <p
              className="mt-4 max-w-xl text-[14px] leading-relaxed sm:text-[16px]"
              style={{ color: muted }}
              {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
            >
              {config.subheading}
            </p>
          )}
          {config.productName && (
            <div className="mt-6 rounded-2xl border p-4" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
              <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: muted }}>
                Order summary
              </p>
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <p
                  className="text-[14px] font-bold"
                  {...treeAttrs(instanceId, "productName", "Product name", "text")}
                >
                  {config.productName}
                </p>
                <p
                  className="font-mono text-[16px] font-extrabold"
                  {...treeAttrs(instanceId, "amountMinor", "Amount", "text")}
                >
                  {amountDisplay}
                </p>
              </div>
              {config.description && (
                <p className="mt-1 text-[12px]" style={{ color: muted }}>
                  {config.description}
                </p>
              )}
            </div>
          )}
          {config.trustLine && (
            <p
              className="mt-5 text-[11px] font-bold uppercase tracking-widest"
              style={{ color: muted }}
              {...treeAttrs(instanceId, "trustLine", "Trust line", "text")}
            >
              {config.trustLine}
            </p>
          )}
        </div>

        {/* RIGHT — payment button stack */}
        <div className="flex flex-col gap-3">
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: muted }}
          >
            Pay with
          </p>
          {variantKeys.length === 0 && mode === "edit" && (
            <p
              role="note"
              className="rounded-lg border border-dashed p-4 text-[12px]"
              style={{ borderColor: "#D4D4D4", color: muted }}
            >
              Pick payment buttons in the toolbar — pipe-separated variant
              keys, e.g.{" "}
              <code className="rounded bg-neutral-100 px-1 font-mono">
                pay.stripe_1|pay.paypal_1|pay.gopay_1
              </code>
            </p>
          )}
          {variantKeys.map((vk, i) => (
            <div key={`${vk}-${i}`} className="flex justify-center">
              <ButtonSlot
                role="checkout"
                variantKey={vk}
                fallbackVariantKey="pay.card_1"
                tokens={tokens}
                data={data}
                mode={mode}
                paymentContext={{
                  brandId: (data.domain?.brandId as string | undefined) ?? undefined,
                  amountMinor: config.amountMinor,
                  currency: config.currency,
                  orderRef: config.orderRef,
                  description: config.description || config.productName,
                  customerEmail: (data.domain?.customerEmail as string | undefined) ?? undefined,
                  returnUrl: config.returnUrl,
                  cancelUrl: config.cancelUrl
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Convert minor units to a human display string. Falls back to the
 *  raw major-unit division when a currency isn't in the Intl table. */
function formatAmount(minor: number, currency: string): string {
  const value = (minor ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency ?? "USD"
    }).format(value);
  } catch {
    return `${currency ?? ""} ${value.toFixed(2)}`;
  }
}

const registration: SectionRegistration<Config> = {
  id: "checkout.stack_1",
  name: "Checkout stack",
  version: "1.0.0",
  library: "cta",
  description:
    "Amount + product summary on the left, stack of payment buttons on the right. Merchant picks which providers to offer via a pipe-separated variant list.",
  editableFields: [
    { key: "eyebrow", label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Checkout", role: "eyebrow", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", label: "Headline", type: { kind: "text", maxLength: 120 }, default: "Ready when you are.", role: "headline", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Subheading", type: { kind: "text", maxLength: 240, multiline: true }, default: "Pick the payment method that suits you. Every transaction is encrypted end-to-end and reconciled instantly.", role: "subhead", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "productName", label: "Product / order name", type: { kind: "text", maxLength: 80 }, default: "Consultation call", role: "product_name", priority: "text", group: "Order" },
    { key: "amountMinor", label: "Amount (minor units — cents / paise / rupiah)", type: { kind: "number", min: 0, step: 1, unit: "minor" }, default: 4999, role: "price_value", description: "$4999 minor = $49.99 for cent-based currencies; Rp 100000 for zero-decimal IDR (Midtrans divides back by 100 for you).", group: "Order" },
    { key: "currency", label: "Currency (ISO 4217)", type: { kind: "text", maxLength: 3 }, default: "USD", role: "price_currency", description: "USD · EUR · GBP · IDR · INR · JPY · SGD …", group: "Order" },
    { key: "orderRef", label: "Order reference", type: { kind: "text", maxLength: 60 }, default: "order-{timestamp}", description: "Unique per checkout. Use {timestamp} to auto-generate.", group: "Order" },
    { key: "description", label: "Description", type: { kind: "text", maxLength: 200 }, default: "30-minute strategy session", group: "Order" },
    { key: "returnUrl", label: "Return URL (success)", type: { kind: "link" }, default: "/checkout/success", group: "Order" },
    { key: "cancelUrl", label: "Cancel URL", type: { kind: "link" }, default: "/checkout/cancel", group: "Order" },
    { key: "providerButtons", label: "Payment buttons (pipe-separated variant keys)", type: { kind: "text", maxLength: 500 }, default: "pay.stripe_1|pay.paypal_1|pay.card_1|pay.gopay_1|pay.qris_1|pay.cod_1", description: "Order matters — the top button is the recommended default. Every key must exist in the button registry.", group: "Payment" },
    { key: "trustLine", label: "Trust line", type: { kind: "text", maxLength: 80 }, default: "SSL secured · Instant confirmation · 24-hour refund window", role: "trust_line", priority: "text", aiPromptable: true, group: "Trust" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "Explain when a payment-stack checkout section outperforms an inline checkout page.",
    improve: "Suggest a shorter headline + tighter trust line without losing the reassurance.",
    rewrite: "Rewrite the copy for {tone} — 'trade-plain', 'reassuring', 'premium'.",
    suggestAlternative: "If the merchant only offers one payment method, suggest a single-CTA section instead.",
    score: "Score for checkout friction — clear amount, provider variety, trust cue placement."
  },
  thumbnail: "",
  telemetryTags: ["checkout", "payment", "cta"],
  bestForVerticals: ["*"],
  defaultConfig: () => ({
    eyebrow: "Checkout",
    heading: "Ready when you are.",
    subheading:
      "Pick the payment method that suits you. Every transaction is encrypted end-to-end and reconciled instantly.",
    productName: "Consultation call",
    amountMinor: 4999,
    currency: "USD",
    orderRef: "order-{timestamp}",
    description: "30-minute strategy session",
    returnUrl: "/checkout/success",
    cancelUrl: "/checkout/cancel",
    providerButtons:
      "pay.stripe_1|pay.paypal_1|pay.card_1|pay.gopay_1|pay.qris_1|pay.cod_1",
    trustLine: "SSL secured · Instant confirmation · 24-hour refund window"
  }),
  renderer: CheckoutStack
};

sectionRegistry.register(registration);
