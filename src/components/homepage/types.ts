// Types shared across every homepage section.
//
// Every section is a Server Component that accepts a typed `content`
// prop. Structure is invariant; content is swappable. This is how the
// same section becomes a merchant landing, a manufacturer page, a
// homeowner page — nothing changes but props.

export type CtaButton = {
  label: string;
  href: string;
};

export type HeroContent = {
  overline: string;
  headline: string;
  headlineHighlight?: string; // rendered in accent yellow if provided
  subheadline: string;
  primaryCta: CtaButton;
  secondaryCta?: CtaButton;
  trustPoints: string[]; // shown as ✔ list under the CTAs
};

export type ComparisonColumn = {
  kind: "directory" | "lead" | "notebook";
  label: string;
  points: string[];
};

export type WhatIsStep = {
  n: number;
  label: string;
  detail?: string;
};

export type NotebookTab = {
  key: string;
  label: string;
};

export type LiveNotebookContent = {
  businessName: string;
  trade: string;
  city: string;
  yearsOnRecord: number;
  verifiedBadges: string[]; // e.g. ["Gas Safe", "Companies House"]
  jobsOnRecord: number;
  circleSize: number;
  tabs: NotebookTab[]; // Timeline / Projects / Certificates / etc
};

export type CircleMember = {
  name: string;
  trade: string;
  x: number; // 0-100 position in the ring container (percentage)
  y: number;
};

export type TradeCircleContent = {
  center: {
    name: string;
    trade: string;
  };
  members: CircleMember[];
};

export type MerchantContent = {
  name: string;
  city: string;
  branchCount: number;
  productCount: number;
  circleSize: number;
  offer: {
    label: string;
    validUntil: string;
  };
};

export type ProjectContent = {
  title: string;
  city: string;
  propertyType: string;
  completedAt: string; // display string
  totalCost: string; // display string
  weeks: number;
  trades: string[];
  products: string[];
  merchant: string;
  warranty: string;
};

export type PricingTier = {
  key: string;
  name: string;
  priceLabel: string;
  cadenceLabel: string;
  bullets: string[];
  cta: CtaButton;
  featured?: boolean;
};

export type FinalCtaContent = {
  headline: string;
  subheadline: string;
  primaryCta: CtaButton;
  secondaryCta?: CtaButton;
};

export type FooterContent = {
  brandLine: string;
  columns: Array<{
    title: string;
    links: Array<{ label: string; href: string }>;
  }>;
  signature: string;
};
