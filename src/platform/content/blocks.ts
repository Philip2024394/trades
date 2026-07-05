// Per-block typed data schemas. One shape per ContentBlockKind.
//
// These are the STRUCTURED objects the Creative Director produces.
// No HTML, no markdown, no rendering concerns.

export type HeroBlockData = {
  headline: string;
  subheadline?: string;
  supportingLine?: string;
  primaryCtaLabel: string;
  primaryCtaHref?: string;              // resolved by render layer
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  trustBadges?: readonly string[];      // "Gas Safe", "12 yrs trading", etc.
  imageHint?: string;                   // guidance for the media picker
};

export type ServiceListBlockData = {
  intro?: string;
  items: readonly {
    slug: string;
    title: string;
    description: string;
    marginBand?: "high" | "medium" | "low";
    featured?: boolean;
    ctaLabel?: string;
    tags?: readonly string[];
  }[];
};

export type ValuePropsBlockData = {
  heading: string;
  intro?: string;
  items: readonly {
    title: string;
    description: string;
    iconHint?: string;                  // Lucide icon name suggestion
  }[];
};

export type TrustCopyBlockData = {
  heading: string;
  intro?: string;
  bullets: readonly string[];
  guaranteeLine?: string;
  badges?: readonly string[];
};

export type FaqBlockData = {
  heading: string;
  intro?: string;
  items: readonly {
    question: string;
    answer: string;
    services?: readonly string[];
  }[];
};

export type ProjectStoryBlockData = {
  title: string;
  service: string;
  location?: string;
  duration?: string;
  materials: readonly string[];
  photoCount: number;
  challenge: string;
  solution: string;
  process: readonly string[];
  outcome: string;
  customerQuote?: { text: string; attribution: string };
  seo: {
    title: string;
    description: string;
    keywords: readonly string[];
  };
};

export type SeoPageBlockData = {
  pageKind:
    | "home"
    | "service"
    | "town"
    | "county"
    | "service-area"
    | "faq"
    | "case-study"
    | "emergency";
  slug: string;
  path: string;
  title: string;
  description: string;
  h1: string;
  keywords: readonly string[];
  internalLinks: readonly { slug: string; label: string; rel?: string }[];
  /** Structured JSON-LD schema hints — actual @context/@type mapping
   *  happens at render. */
  schemaHints?: readonly string[];
};

export type BrandVoiceProfileBlockData = {
  personality: string;                  // "premium" / "friendly" / ...
  toneNotes: string;                    // human-readable tone description
  vocabulary: {
    prefer: readonly string[];
    avoid: readonly string[];
  };
  transformationsApplied: readonly string[];
};

export type TestimonialCopyBlockData = {
  heading: string;
  intro?: string;
  quotes: readonly {
    quote: string;
    attribution: string;
    service?: string;
    location?: string;
  }[];
};

export type CtaBandBlockData = {
  headline: string;
  supportingLine?: string;
  primaryCtaLabel: string;
  primaryCtaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
};
