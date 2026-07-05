// Content Manifest — the AI Creative Director's output.
//
// The strategy is the product. The website is one output. Every
// generated piece of content is a structured, addressable, regeneratable
// unit that carries its OWN provenance.
//
// Design notes:
//   - Blocks are typed data, never HTML/markdown. Rendering happens later.
//   - Every block is addressable by (manifestSlug, blockSlug) for
//     targeted regeneration.
//   - Provenance is required on every block — no anonymous AI output.
//   - Output medium is manifest-level. The same intelligence can produce
//     a website, quote document, email campaign, etc. — v1 ships website,
//     the shape supports the rest.

import type { EvidenceStrengthBand } from "@/platform/business";

/** What kind of downstream artifact this manifest produces. v1 ships
 *  `website`; future outputs plug in without schema changes. */
export type OutputMedium =
  | "website"
  | "quote-document"
  | "email-campaign"
  | "google-business-post"
  | "facebook-ad"
  | "brochure"
  | "landing-page"
  | "sms-follow-up"
  | "ai-assistant-response"
  | "customer-portal-message";

/** Purposes are used by explainability, A/B testing, and regeneration. */
export type ContentPurpose =
  | "trust"
  | "conversion"
  | "seo"
  | "education"
  | "reassurance"
  | "showcase"
  | "engagement"
  | "compliance"
  | "brand-voice";

export type ContentAudience =
  | "new-visitor"
  | "returning-visitor"
  | "residential-customer"
  | "commercial-customer"
  | "emergency-customer"
  | "trade-buyer"
  | "landlord"
  | "self-builder";

/** What can be regenerated in isolation. Drives the "keep strategy,
 *  refine hero" primitive. */
export type RegenerationScope = "block" | "section" | "page" | "manifest";

/** Kinds of block. Each kind has its own typed `data` payload — see
 *  `./blocks`. */
export type ContentBlockKind =
  | "hero"
  | "service-list"
  | "value-props"
  | "trust-copy"
  | "faq"
  | "project-story"
  | "seo-page"
  | "brand-voice-profile"
  | "testimonial-copy"
  | "cta-band";

/** Where this content came from. Required on every block — no
 *  anonymous AI output. */
export type ContentProvenance = {
  /** composerRegistry slug of the specialist that produced the block. */
  generatedBy: string;
  /** Specialist version. */
  generatorVersion: string;
  /** Backend used to produce this block. */
  generatorBackend: "template" | "llm" | "hybrid";

  /** The intelligence sources that seeded this block. */
  sources: {
    profileSlug: string;
    strategySlug: string;
    recipeSlug: string;
    /** Trade intelligence slug — often the profile.trade. */
    tradeSlug?: string;
    /** Playbook slugs from the resolved strategy. */
    playbooks: readonly string[];
    /** Pattern slugs cited by the playbooks that produced this block. */
    patterns?: readonly string[];
    /** Evidence slugs backing the strongest playbook rationale. */
    evidence?: readonly string[];
    /** Knowledge Package refs — trade knowledge base slugs used. */
    knowledgeRefs?: readonly string[];
  };

  /** Purpose of this block. */
  purpose: ContentPurpose;

  /** Target audience (optional). */
  audience?: ContentAudience;

  /** The merchant's primary business goal this block serves. */
  primaryGoal: string;

  /** Confidence band inherited from cited playbooks + patterns. */
  confidenceBand: EvidenceStrengthBand;

  /** ISO 8601 timestamp. */
  generatedAt: string;
};

/** Hints for editing + regeneration. */
export type RegenerationHints = {
  /** Regeneration scopes this block supports. */
  scopes: readonly RegenerationScope[];
  /** Which top-level fields on `data` a merchant may edit inline
   *  without regenerating. */
  editableFields: readonly string[];
  /** Which upstream sources invalidate this block if they change —
   *  drives cache invalidation + auto-regeneration triggers.
   *  Examples: "profile", "strategy", "trade:carpenter",
   *  "playbook:trust-first". */
  invalidatedBy: readonly string[];
  /** Human hint for the merchant "Regenerate this" button. */
  regenerationHint?: string;
};

/** One addressable, regeneratable content unit. */
export type ContentBlock<TData = unknown> = {
  /** Stable slug — used for regeneration addressability. */
  slug: string;
  /** Block kind — matches a composer's supported block kinds. */
  kind: ContentBlockKind;
  /** Typed data payload. See `./blocks` for per-kind schemas. */
  data: TData;
  /** Provenance — required. */
  provenance: ContentProvenance;
  /** Regeneration hints — required. */
  regeneration: RegenerationHints;
};

/** A section groups blocks that render together on one page. */
export type ContentSection = {
  slug: string;
  /** Merchant-facing label — "Hero", "Services", "Trust", "FAQ". */
  label: string;
  /** Ordered blocks in this section. */
  blocks: readonly ContentBlock[];
};

/** A page groups sections. */
export type ContentPage = {
  slug: string;
  /** URL path (may be templated with {location} etc.). */
  path: string;
  /** Merchant-facing label. */
  label: string;
  /** Ordered sections. */
  sections: readonly ContentSection[];
  /** SEO metadata for this page. */
  seo?: {
    title: string;
    description: string;
    keywords: readonly string[];
    canonical?: string;
  };
};

/** The Creative Director's full output for one merchant × one output
 *  medium × one moment in time. */
export type ContentManifest = {
  manifestVersion: 1;
  /** Stable slug (typically <merchantId>-<outputMedium>-<timestamp>). */
  slug: string;

  /** Which downstream artifact this manifest produces. */
  outputMedium: OutputMedium;

  /** Snapshot of the ResolvedStrategy provenance at generation time. */
  strategySnapshot: {
    profileSlug: string;
    strategySlug: string;
    recipeSlug: string;
    tradeSlug?: string;
    playbooks: readonly string[];
    resolvedAt: string;
  };

  /** Brand voice personality used (drives BrandVoiceComposer). */
  brandVoice: BrandVoicePersonality;

  /** Pages (websites, brochures). For single-artifact outputs (SMS,
   *  Google post) there's typically one page containing one section. */
  pages: readonly ContentPage[];

  /** Aggregate cross-page blocks (Site header, footer, sitewide FAQ). */
  siteWideBlocks?: readonly ContentBlock[];

  /** Generation metadata. */
  generatedAt: string;
  /** Compose-time warnings — surfaced in the merchant Studio. */
  warnings?: readonly string[];
};

/** Personality selected by the merchant OR derived from strategy. */
export type BrandVoicePersonality =
  | "premium"
  | "friendly"
  | "traditional"
  | "luxury"
  | "commercial"
  | "emergency"
  | "casual"
  | "expert";

/** A targeted regeneration request. Drives the "keep strategy but
 *  change the hero" primitive. */
export type RegenerationRequest = {
  scope: RegenerationScope;
  /** Which block slug(s) to regenerate. Required unless scope=manifest. */
  targetBlockSlugs?: readonly string[];
  /** Which section slug to regenerate. Required if scope=section. */
  targetSectionSlug?: string;
  /** Which page slug to regenerate. Required if scope=page. */
  targetPageSlug?: string;
  /** Optional overrides that apply only to this regeneration —
   *  e.g. `{ brandVoice: "luxury" }` for "make the hero more premium". */
  overrides?: {
    brandVoice?: BrandVoicePersonality;
    tone?: string;
    audience?: ContentAudience;
  };
};

/** The Creative Director's input — the "brief" it works to. */
export type CreativeBrief = {
  outputMedium: OutputMedium;
  strategy: import("@/platform/business/resolver").ResolvedStrategy;
  /** Brand voice personality — merchant-selected or strategy-derived. */
  brandVoice: BrandVoicePersonality;
  /** Optional: which pages to include for a website output. Defaults
   *  to recipe.pages when absent. */
  pageSlugs?: readonly string[];
  /** Optional: project photos + metadata to feed the Project Story
   *  Composer. Empty = the composer produces no case studies. */
  projects?: readonly ProjectInput[];
};

export type ProjectInput = {
  slug: string;
  service: string;
  location?: string;
  duration?: string;
  materials?: readonly string[];
  photoCount?: number;
  customerQuote?: { text: string; attribution: string };
  freeformNotes?: string;
};
