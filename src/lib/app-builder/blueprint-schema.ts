// NEX App Builder · AppBlueprint schema (Philip 2026-08-14).
//
// THE CENTRAL CONTRACT between NEX and the workers.
//
// NEX (conversational + Studio) understands a customer request and produces
// an AppBlueprint. Workers then build the actual application from the
// Blueprint. The Blueprint MUST be:
//
//   - Machine-readable (JSON-serialisable)
//   - Versionable (blueprintVersion field · migrations possible)
//   - Deterministic (workers can build the same output from the same Blueprint)
//   - Independent of React/Next.js implementation details
//   - Independent of any specific deployment provider
//   - Honest about what's KNOWN, INFERRED, REQUIRED, or UNKNOWN
//     (per ADR-0028 · 0% fabrication)
//
// This file defines the TypeScript types + a Zod-style runtime validator.
// Companion files:
//   - provenance.ts  — KNOWN / INFERRED / REQUIRED / UNKNOWN classifier
//   - validator.ts   — runtime validation (returns typed result envelope)
//   - examples/      — worked examples (staircase, restaurant, etc.)

// ============================================================================
// Top-level Blueprint
// ============================================================================

export type AppBlueprint = {
  blueprintVersion: 1;
  /** Stable id · "ab_<ulid>". Persists across regenerations. */
  id: string;
  /** Public-facing name. */
  name: string;
  /** Optional short tagline. */
  tagline?: string;
  /** Business identity. */
  identity: IdentitySpec;
  /** Domain configuration (target hostname · not the current host). */
  domain: DomainSpec;
  /** Industry / trade taxonomy binding. */
  vertical: VerticalSpec;
  /** Brand system (colours, typography, tone, imagery). */
  brand: BrandSpec;
  /** Every page in the site. */
  pages: PageSpec[];
  /** Top-level navigation (order + destinations). */
  navigation: NavigationSpec;
  /** Global footer (may reference NEX defaults). */
  footer: FooterSpec;
  /** Structured data models used by pages (products, staff, projects, etc.). */
  data: DataModelSpec[];
  /** External integrations declared as REQUIREMENTS (not credentials). */
  integrations: IntegrationRequirement[];
  /** SEO metadata (title/description/OG/JSON-LD hints). */
  seo: SeoSpec;
  /** Responsive design intent — coarse policy the workers must respect. */
  responsive: ResponsiveSpec;
  /** Worker task DAG produced from the Blueprint (populated by planner). */
  workerTasks: WorkerTaskRef[];
  /** Provenance for every leaf field (ADR-0028 · 0% fabrication). */
  provenance: ProvenanceMap;
  /** Original customer utterances that produced this Blueprint. */
  sourceUtterances: string[];
  /** Timestamps + revision. */
  meta: BlueprintMeta;
};

// ============================================================================
// Identity + Domain + Vertical
// ============================================================================

export type IdentitySpec = {
  /** Full legal / trading name. */
  legalName?: string;
  /** Short display name. */
  displayName: string;
  /** Contact channels. */
  contact: ContactSpec;
  /** Physical location(s), if applicable. */
  locations: LocationSpec[];
  /** Founded year, size, etc. — enrichment fields, all optional. */
  aboutBlurb?: string;
  yearFounded?: number;
  teamSize?: string;
};

export type ContactSpec = {
  primaryEmail?: string;
  primaryPhone?: string;
  whatsapp?: string;
  serviceRadius?: ServiceRadiusSpec;
};

export type ServiceRadiusSpec = {
  centre: { kind: "postcode"; value: string } | { kind: "coordinates"; lat: number; lng: number };
  radiusMiles: number;
  /** Optional soft outer boundary (works but travel surcharge, etc.). */
  softOuterMiles?: number;
};

export type LocationSpec = {
  id: string;
  label: string;
  addressLines: string[];
  postcode?: string;
  city?: string;
  country: string;
  coordinates?: { lat: number; lng: number };
  isPrimary: boolean;
};

export type DomainSpec = {
  /** Requested primary domain (e.g. "rowanstaircases.co.uk"). May be desired-but-not-owned. */
  primary?: string;
  /** Preview subdomain during build (e.g. "rowan-preview.nex.local"). */
  preview?: string;
  /** Alternative domains to redirect. */
  aliases?: string[];
};

export type VerticalSpec = {
  /** Trade slug matching src/lib/tradeOff.ts taxonomy. */
  taxonomySlug: string;
  /** e.g. "manufacture" / "install" / "service" — matches tradeTemplateSections. */
  section?: string;
  /** Rough archetype used by design/brand defaults. */
  archetype?: "premium" | "traditional" | "modern" | "rustic" | "commercial";
};

// ============================================================================
// Brand
// ============================================================================

export type BrandSpec = {
  /** Colour palette (semantic tokens · not raw hex where possible). */
  palette: PaletteSpec;
  /** Typography scale intent (families + relative sizes). */
  typography: TypographySpec;
  /** Tone of voice (customer-facing copy). */
  toneOfVoice?: "premium" | "friendly" | "authoritative" | "playful" | "no-nonsense" | "artisanal";
  /** Logo asset (id refers to hero library or upload). */
  logoAssetId?: string;
  /** Style preferences that influence imagery selection. */
  imageryDirection?: string[];
};

export type PaletteSpec = {
  primary: string;         // hex or CSS variable
  onPrimary: string;
  accent?: string;
  background: string;
  foreground: string;
  muted?: string;
  border?: string;
  /** Additional semantic slots may be added by design system. */
  extra?: Record<string, string>;
};

export type TypographySpec = {
  headingFamily: string;
  bodyFamily: string;
  /** Relative scale (e.g. "1.25" = major-third). */
  scale?: number;
};

// ============================================================================
// Pages · Sections · Components
// ============================================================================

export type PageSpec = {
  /** Stable id ("home", "about", etc.) — stays constant across regenerations. */
  id: string;
  /** Route path. Supports :params (e.g. "/products/:slug"). */
  path: string;
  /** Human-facing title (used for browser tab + nav). */
  title: string;
  /** Optional page-level intent hint for workers. */
  purpose?: string;
  /** Ordered sections that compose the page. */
  sections: SectionInstance[];
  /** Page-level SEO overrides. */
  seo?: Partial<SeoSpec>;
};

export type SectionInstance = {
  /** Stable id across regenerations — used for state, targeting corrections. */
  instanceId: string;
  /** Registry id (matches src/lib/studio/sectionRegistry.ts, e.g. "hero/photo-full"). */
  registryId: string;
  /** Props passed to the section renderer (validated against registry). */
  props: Record<string, unknown>;
  /** Data binding — e.g. { source: "products", limit: 6 }. */
  data?: DataBindingRef;
  /** Actions triggered by CTAs / clicks. */
  actions?: ActionRef[];
  /** Responsive overrides per breakpoint. */
  responsive?: {
    mobile?: Partial<SectionInstance>;
    tablet?: Partial<SectionInstance>;
    desktop?: Partial<SectionInstance>;
  };
  /** Optional states (hover/empty/loading/error). */
  states?: {
    empty?: Record<string, unknown>;
    loading?: Record<string, unknown>;
    error?: Record<string, unknown>;
  };
};

export type DataBindingRef = {
  /** Matches a DataModelSpec.id below (e.g. "products", "team", "testimonials"). */
  source: string;
  /** Optional filter/sort/limit hints. */
  where?: Record<string, unknown>;
  orderBy?: { field: string; dir: "asc" | "desc" };
  limit?: number;
};

export type ActionRef =
  | { kind: "navigate"; to: string }
  | { kind: "open-modal"; modalId: string }
  | { kind: "submit-form"; formId: string; onSuccess?: ActionRef }
  | { kind: "integration"; provider: string; op: string; payload?: Record<string, unknown> };

// ============================================================================
// Navigation + Footer
// ============================================================================

export type NavigationSpec = {
  /** Ordered top-level entries. */
  primary: NavEntry[];
  /** Mobile behaviour hint. */
  mobileBehaviour?: "drawer" | "bottom-sheet" | "full-screen";
  /** CTA slot (single high-emphasis action in the nav). */
  ctaSlot?: {
    label: string;
    action: ActionRef;
  };
};

export type NavEntry = {
  label: string;
  /** Either a page id (internal) or an external URL. */
  target: { kind: "page"; pageId: string } | { kind: "url"; href: string };
  children?: NavEntry[];
};

export type FooterSpec = {
  columns: FooterColumn[];
  legalLinks: NavEntry[];
  copyrightTemplate?: string;   // e.g. "© {year} {displayName}"
  socialLinks?: SocialLink[];
};

export type FooterColumn = { title: string; entries: NavEntry[] };
export type SocialLink = { platform: string; href: string };

// ============================================================================
// Data models
// ============================================================================

export type DataModelSpec = {
  /** e.g. "products", "team", "projects", "testimonials". */
  id: string;
  /** Human label used in the Studio editor. */
  label: string;
  /** Field definitions. */
  fields: DataField[];
  /** Initial seed rows (empty when customer hasn't supplied data yet). */
  seed?: Record<string, unknown>[];
  /** Whether this model is required for the app to be considered complete. */
  required: boolean;
};

export type DataField = {
  name: string;
  kind: "text" | "richtext" | "number" | "currency" | "image" | "images" | "date" | "boolean" | "reference";
  required: boolean;
  /** For reference kind: id of the DataModelSpec referenced. */
  referenceTo?: string;
  /** Optional constraints. */
  min?: number;
  max?: number;
  /** Free-form hint the Studio can surface to the operator. */
  hint?: string;
};

// ============================================================================
// Integrations
// ============================================================================

export type IntegrationRequirement = {
  /** e.g. "stripe" · "resend" · "google-maps" · "companies-house". */
  provider: string;
  /** Why this integration is needed (drives which pages/sections require it). */
  purpose: string;
  /** Operations the generated app will need to perform. */
  operations: string[];
  /** Whether the app can function partially without it. */
  optional: boolean;
  /** Configuration that must be supplied at deployment time (as SHAPES · not values). */
  requiredConfig: string[];
};

// ============================================================================
// SEO + Responsive + Meta
// ============================================================================

export type SeoSpec = {
  siteTitleTemplate?: string;
  defaultDescription?: string;
  defaultOgImageAssetId?: string;
  jsonLd?: Array<{ type: string; data: Record<string, unknown> }>;
  robots?: "index,follow" | "noindex,follow" | "noindex,nofollow";
};

export type ResponsiveSpec = {
  /** Coarse policy · fine layout adjustments live on SectionInstance.responsive. */
  breakpoints: { mobile: number; tablet: number; desktop: number };
  strategy: "mobile-first" | "desktop-first";
  /** Whether nav collapses to drawer on mobile (default yes). */
  navCollapses: boolean;
};

export type BlueprintMeta = {
  createdAt: string;   // ISO
  updatedAt: string;
  revision: number;
  /** Free-form correlation id — links back to the source conversation. */
  conversationId?: string;
};

// ============================================================================
// Provenance (per ADR-0028 · 0% fabrication)
// ============================================================================

export type ProvenanceLevel = "KNOWN" | "INFERRED" | "REQUIRED" | "UNKNOWN";

/**
 * ProvenanceMap: dotted-path → provenance record.
 * Every leaf field in the Blueprint that came from the customer OR was
 * inferred by NEX MUST have an entry. Fields with no entry are treated as
 * UNKNOWN and workers may not proceed as if the value is authoritative.
 *
 * Example key: "identity.contact.primaryEmail"
 */
export type ProvenanceMap = Record<string, ProvenanceRecord>;

export type ProvenanceRecord = {
  level: ProvenanceLevel;
  /** Where the value came from — e.g. "customer:turn-3", "brain:staircase.hero-defaults", "worker:default". */
  source: string;
  /** 0..1. Meaningful only for INFERRED. */
  confidence?: number;
  /** Optional short reason the classifier chose this level. */
  reason?: string;
};

// ============================================================================
// Worker task refs (planner output · workers execute)
// ============================================================================

export type WorkerTaskRef = {
  /** Task id · "task_<ulid>". */
  id: string;
  kind: WorkerTaskKind;
  /** Human short label. */
  label: string;
  /** Which Blueprint node this task builds (dotted path). */
  targetPath: string;
  /** Ordered ids of tasks that must complete first. */
  dependsOn: string[];
  /** Free-form structured payload for the specific worker. */
  payload: Record<string, unknown>;
};

export type WorkerTaskKind =
  | "validate.blueprint"
  | "compose.page"
  | "select.section"
  | "select.image"
  | "generate.copy"
  | "assemble.data-model"
  | "attach.integration"
  | "assemble.nav"
  | "render.preview"
  | "qa.visual.screenshot"
  | "qa.functional.playwright"
  | "publish.route";
