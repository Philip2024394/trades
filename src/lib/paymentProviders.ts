// Payment provider helpers — single source of truth for provider
// metadata + Payment Link template interpolation.
//
// Hard rule: we NEVER hold funds. Every provider here either redirects
// the customer to the provider's hosted page (Payment Link mode) or
// charges direct to the merchant's connected account (Stripe/PayPal/
// Square OAuth, Phases 2-4). No PCI scope on our side.

export type PaymentProviderKey =
  | "stripe"
  | "paypal"
  | "square"
  | "payment_link";

export const PAYMENT_PROVIDER_LABEL: Record<PaymentProviderKey, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  square: "Square",
  payment_link: "Payment Link"
};

// Curated "popular UK provider" list shown in the Payment Link mode
// configurator. Free-text always accepted — this is just the dropdown
// of well-known names so merchants don't have to type.
export const POPULAR_UK_LINK_PROVIDERS: string[] = [
  "Worldpay",
  "SumUp",
  "Mollie",
  "Klarna",
  "Clearpay",
  "Revolut Business",
  "Tide",
  "Zettle by PayPal",
  "Takepayments",
  "GoCardless",
  "Adyen",
  "Barclaycard",
  "HSBC Merchant Services",
  "NatWest Tyl",
  "Lloyds Cardnet",
  "Square (manual link)",
  "Stripe (manual link)",
  "PayPal (manual link)"
];

export type BuildPaymentLinkInput = {
  template: string;
  /** Order amount in pence (integer, GBP). */
  amountPence: number;
  /** Customer-facing order reference (e.g. "ORD-87EF8D"). */
  ref: string;
};

/** Substitute {{amount}} and {{ref}} placeholders in the template.
 *
 *  Amount substitution is **smart**: if the template substring looks
 *  like `amount={{amount}}` we ALSO support a `{{amount_pence}}` raw
 *  variant for providers that take integer pence (Stripe-style). The
 *  default {{amount}} renders pounds-with-decimal (e.g. "247.50") since
 *  that's what most UK hosted-pay providers expect.
 *
 *  Returns null if the template is empty or doesn't contain at least
 *  one placeholder — that protects us from sending naked links that
 *  open a generic payment page with no amount/ref.
 */
export function buildPaymentLink(input: BuildPaymentLinkInput): string | null {
  const t = (input.template ?? "").trim();
  if (t.length === 0) return null;
  if (!t.includes("{{amount}}") && !t.includes("{{amount_pence}}")) return null;

  const pounds = (input.amountPence / 100).toFixed(2);
  const refEnc = encodeURIComponent(input.ref);
  const poundsEnc = encodeURIComponent(pounds);

  return t
    .replace(/\{\{amount_pence\}\}/g, String(input.amountPence))
    .replace(/\{\{amount\}\}/g, poundsEnc)
    .replace(/\{\{ref\}\}/g, refEnc);
}

/** Validates a pasted Payment Link template. Returns a human-readable
 *  error string when invalid, or null when OK. */
export function validatePaymentLinkTemplate(
  template: string
): string | null {
  const t = (template ?? "").trim();
  if (t.length === 0) return "Paste a payment link template.";
  if (!/^https?:\/\//i.test(t))
    return "Link must start with https:// (or http:// for local testing).";
  if (!t.includes("{{amount}}") && !t.includes("{{amount_pence}}"))
    return "Template must include {{amount}} (pounds.pence) or {{amount_pence}} (integer pence) so we can append the order total.";
  if (t.length > 1024) return "Link is too long (max 1024 chars).";
  return null;
}

/** Generate a short human-friendly order reference. Format ORD-XXXXXX
 *  (6 uppercase alphanumerics). Collision risk is low for one merchant
 *  but we also enforce a unique index on (listing_id, order_ref) in
 *  Supabase so collisions surface as a DB error rather than a silent
 *  mix-up. */
export function generateOrderRef(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `ORD-${out}`;
}
