// Refacing Trade Member · canonical package + copy (Philip 2026-08-13).
//
// Single source of truth for the Refacing Member offer's price + value props +
// wording. Every surface that presents the Refacing Membership package MUST
// import from here so the pricing/copy can never drift.
//
// Not a parallel Stripe system · not a new subscription engine · just the
// package presentation. When Stripe checkout is wired for the Refacing tier,
// it plugs into the existing subscription infrastructure (src/lib/stripePrices.ts)
// via the `stripePriceIdEnv` field below. Payment activation is HELD until
// explicitly requested — no live checkout is triggered by this module.
//
// Business-model rules baked in (never change without Philip):
//   · Paid Refacing Member = ACCESS to NEX Chat + ELIGIBILITY for Trade Exchange
//     routing. Being in the pool ≠ being selected for every enquiry — the Trade
//     Exchange evaluates suitability per-enquiry (service match, geography,
//     capability, availability).
//   · Qualification (A+/A/B/C) affects ranking/quality · NEVER a gate.
//   · Free/unclaimed listings remain discovery-only.
//   · Wording rules (see docs/refacing/REFACING-MEMBER-ENTITLEMENT-SPEC.md § 6):
//       APPROVED: "Get homeowner enquiries directly through NEX Chat"
//                 "Eligible to receive suitable enquiries via NEX Chat"
//       PROHIBITED: "Pay to get leads" · "Every paid member receives enquiries"
//                   · Any qualification-as-gate wording · Any volume promise.

export type RefacingMembershipPackage = {
  /** Machine id · used in URLs, analytics, Stripe metadata. */
  id: "refacing_trade_member";
  /** Display name shown to trades. */
  displayName: string;
  /** Short tagline for headers. */
  tagline: string;
  /** Canonical monthly price in GBP · number for programmatic use. */
  monthlyGbp: number;
  /** Pre-formatted price string · always used in UI to guarantee consistency. */
  monthlyPriceLabel: string;
  /** Annual price · null while not yet published (Stripe held). */
  annualGbp: number | null;
  /** Env var that will hold the Stripe price id · not populated yet · payment held. */
  stripePriceIdEnv: string;
  /** Ordered value props · rendered as a checkmark list on the package card. */
  valueProps: readonly string[];
  /** Governance/ranking footnote · sits below the value props on every card. */
  qualificationFootnote: string;
  /** Preferred single-line CTA copy · matches the "enquiries via NEX Chat" rule. */
  primaryCtaLabel: string;
  /** Preferred descriptive line for the package intro. */
  intro: string;
};

/**
 * The canonical Refacing Trade Member package. Starting-price tier.
 *
 * Repriced 2026-08-13: £14.99 placeholder → £29.99/month. The £14.99 figure
 * remains in use for the unrelated Professional NEX tier (src/lib/tierCatalog.ts) —
 * that's a different product and MUST NOT be changed here.
 */
export const REFACING_TRADE_MEMBER: RefacingMembershipPackage = {
  id: "refacing_trade_member",
  displayName: "NEX Refacing Trade Member",
  tagline: "Professional trade membership",
  monthlyGbp: 29.99,
  monthlyPriceLabel: "£29.99",
  annualGbp: null,
  stripePriceIdEnv: "STRIPE_PRICE_REFACING_TRADE_MEMBER_MONTHLY",
  valueProps: [
    "Professional NEX trade listing",
    "NEX Trade Chat access — reply to routed enquiries inside NEX",
    "Eligible to receive suitable homeowner enquiries via NEX Chat",
    "Trade Center visibility",
    "Refacing / refurbishment category visibility",
    "Trade Exchange participation — suitable enquiries routed by NEX",
    "Enhanced profile control",
    "Member support",
  ],
  qualificationFootnote:
    "NEX qualification (A+/A/B/C) affects ranking and quality signals only · never a gate. NEX matches homeowners to suitable Refacing Trade Members by service, geography, and capability — being a paid member is the eligibility requirement, not a guarantee of enquiry volume.",
  primaryCtaLabel: "Become a Refacing Trade Member",
  intro:
    "Get homeowner enquiries directly through NEX Chat. Homeowners describe their staircase inside NEX, and suitable Refacing Trade Members are routed the enquiry — you reply inside NEX, no phone number handed out.",
};

/** Convenience shorthand · every surface should read from this rather than
 * hard-coding the price string. */
export const REFACING_MEMBER_PRICE_LABEL = REFACING_TRADE_MEMBER.monthlyPriceLabel;
