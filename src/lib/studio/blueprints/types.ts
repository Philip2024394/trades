// Blueprint Manifest v1 — canonical descriptor for a Blueprint.
//
// A Blueprint is a full multi-page layout preset tied to:
//   • one or more trades (slugs from src/lib/tradeOff.ts)
//   • one or more outcomes (from OUTCOME_SLUGS below)
//   • a design variant (Corporate / Industrial / Tradesman / Premium /
//     Emergency / Minimal)
//   • a scoring profile across seven dimensions (six existing + Trust)
//
// Design rules (mirroring PackManifest):
//   • Runtime never references a blueprint slug directly. Everything
//     goes through the registry lookup.
//   • Manifests are deep-frozen on registration; the renderer, wizard,
//     browser and recommender all see the same shape.
//   • Section keys inside layout arrays reference sectionRegistry ids
//     — the installer validates every key is registered before writing
//     the layout row.

export type BlueprintManifestVersion = 1;

export const OUTCOME_SLUGS = [
  "quote-requests",
  "phone-calls",
  "whatsapp-enquiries",
  "emergency-callout",
  "product-sales",
  "service-sales",
  "project-showcase",
  "staff-recruitment",
  "local-coverage",
  "trade-account",
  "equipment-hire",
  "training-signups"
] as const;
export type OutcomeSlug = (typeof OUTCOME_SLUGS)[number];

export const DESIGN_VARIANTS = [
  "corporate",
  "industrial",
  "tradesman",
  "premium",
  "emergency",
  "minimal"
] as const;
export type DesignVariant = (typeof DESIGN_VARIANTS)[number];

export const CREDENTIAL_SCHEMES = [
  "gas-safe",
  "niceic",
  "napit",
  "stroma",
  "trustmark",
  "fmb",
  "mcs",
  "hetas",
  "oftec",
  "fensa",
  "certass",
  "chas",
  "safecontractor",
  "smas",
  "constructionline",
  "ipaf",
  "pasma",
  "waste-carrier",
  "companies-house",
  "vat",
  "public-liability",
  "cscs"
] as const;
export type CredentialScheme = (typeof CREDENTIAL_SCHEMES)[number];

export type BlueprintPageId = "home" | "services" | "coverage" | "contact" | "about" | "projects" | string;

export type BlueprintSectionSeed = {
  /** Section registration id from sectionRegistry (e.g.
   *  "hero.plant_hire_bold_1", "cta.checkout_stack_v2"). */
  key: string;
  /** Starter config merged over section.defaultConfig(). Every field
   *  here is content, not appearance — appearance is driven by the
   *  design variant. */
  config?: Record<string, unknown>;
  /** Advisory hint for the page-scaffolder. v1 uses append order. */
  slotHint?: "hero" | "body" | "footer";
};

export type BlueprintPageLayout = {
  pageId: BlueprintPageId;
  title?: string;
  sections: BlueprintSectionSeed[];
};

/** Seven scoring dimensions — six inherited from the existing PageScorer
 *  (src/lib/studio/scoring/heuristics.ts) plus Trust, which is new for
 *  the Blueprint Studio and folded into the scorer in Lane 6. */
export type BlueprintScore = {
  conversion: number;
  seo: number;
  trust: number;
  mobile: number;
  accessibility: number;
  speed: number;
  brandConsistency?: number;
};

export type BlueprintManifest = {
  manifestVersion: BlueprintManifestVersion;

  // ─── Identity ─────────────────────────────────────────
  slug: string;
  name: string;
  tagline: string;
  description: string;
  version: string;

  publisher: {
    name: string;
    verified: boolean;
    contactUrl?: string;
  };

  // ─── Targeting ────────────────────────────────────────
  /** Trade slugs from src/lib/tradeOff.ts. Order matters: the first
   *  slug is the "canonical" trade the blueprint was designed for. */
  trades: string[];

  /** Outcomes this blueprint delivers, ranked by strength of fit. */
  outcomes: OutcomeSlug[];

  /** Default design variant. User can swap post-install via one-tap. */
  variant: DesignVariant;

  // ─── Layout ───────────────────────────────────────────
  /** Multi-page layout. `home` is required — everything else optional. */
  layout: {
    home: BlueprintSectionSeed[];
  } & Partial<Record<BlueprintPageId, BlueprintSectionSeed[]>>;

  /** Optional reference to a Layout Pattern (`@/platform/layouts`).
   *  Introduced by ADR-011 (2026-07-05): blueprints are concrete
   *  INSTANCES of abstract Layout Patterns. Declaring a `layoutId`
   *  lets the AI composer select layouts at the pattern level and
   *  then pick concrete blueprints matching that pattern.
   *
   *  Optional for backward compatibility. The 52 existing blueprints
   *  will be retrofitted with `layoutId` values in M3 Batch 4. */
  layoutId?: string;

  /** Optional pool of hero section keys the blueprint accepts. When
   *  present, buildLayoutFromSeeds picks ONE at random to replace the
   *  first hero seed on the home page — the config (headline, CTAs,
   *  background image) stays the same, only the visual component swaps.
   *
   *  Purpose: two merchants installing the same blueprint should NOT
   *  end up with identical-looking sites. Give each trade a curated
   *  pool of 3-6 hero variants that all suit the trade, then let the
   *  install pick one. Two carpenters get different heroes.
   *
   *  When omitted, the first seed's key is used verbatim — legacy
   *  blueprints keep working unchanged. */
  heroPool?: string[];

  // ─── Score ────────────────────────────────────────────
  /** Precomputed score at build time. The live scorer recomputes on
   *  install to account for merchant-specific token state, but the
   *  precomputed values power the browser card without a DB read. */
  score: BlueprintScore;

  // ─── Widgets & Apps ───────────────────────────────────
  /** Credentials that unlock verified widgets on this blueprint. If a
   *  merchant lacks the credential, the widget renders greyed with an
   *  "Add your <scheme> number" tooltip. */
  requiredCredentials?: CredentialScheme[];

  /** App slugs pre-selected by the Instant Setup flow. Merchants can
   *  deselect any before publish. */
  suggestedApps: string[];

  // ─── Compliance ───────────────────────────────────────
  /** Compliance blocks baked in. The Publish flow warns before allowing
   *  a merchant to hide any of these. */
  compliance: Array<
    | "consumer-contracts-14day"
    | "asa-superlative-guard"
    | "gdpr-form-auditor"
    | "wras-water-cold"
    | "cdm-2015"
    | "part-p-notify"
  >;

  // ─── Marketing ────────────────────────────────────────
  browserCard: {
    /** ~15-word one-line summary shown on the card. */
    oneLiner: string;
    /** Bullet list of what makes this blueprint different. */
    benefits: string[];
    /** e.g. "Free for your trade", "Included in Merchant Pro",
     *  "Upgrade to unlock". */
    priceLabel: string;
    /** Minutes-to-live estimate shown on the card. */
    estimatedBuildMinutes: number;
  };

  // ─── Industry Brain ───────────────────────────────────
  /** Business Module ids this trade typically expects. Powers the
   *  "modules recommended for your business" surface in Studio.
   *  See src/lib/studio/modules/registry.ts for valid ids. Optional
   *  so pre-industry-brain manifests still work. */
  expectedModules?: string[];
  /** Free-text list of things this trade cares about. Used by the
   *  Industry AI system prompt + proactive suggestions ("You don't
   *  have a Finance Calculator — merchants often add one"). No
   *  fabricated stats; keep bullets factual + verifiable. */
  industryIntelligence?: string[];
};

/** Frozen manifest — what the registry returns. */
export type FrozenBlueprintManifest = Readonly<BlueprintManifest>;

/** Rank input — the shape the recommender scores against. */
export type BlueprintRankInput = {
  merchantTradeSlug?: string;
  wizardOutcomes?: OutcomeSlug[];
  heldCredentials?: CredentialScheme[];
  /** Optional peer popularity map (blueprint slug → 0..1 normalised
   *  install share over the last 30 days). Loaded by the API route from
   *  studio_blueprint_installs. Empty map disables the signal. */
  peerPopularity?: Map<string, number>;
};

/** Rank result — one row per candidate. */
export type BlueprintRankResult = {
  manifest: FrozenBlueprintManifest;
  score: number;
  reasons: string[];
};
