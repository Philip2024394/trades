// registryKit · types.
//
// The shared shape every registry (Section, Blueprint, App, Pack,
// Design, Button, KG Domain, KG Package, and the future Container,
// Layout, Theme, Asset, Form registries) will conform to.
//
// Every registration must extend RegistrationBase. Domain-specific
// registrations layer their own fields on top — see e.g. SectionRegistration
// for the pattern.

// ─── Marketplace metadata (optional, opt-in) ───────────────────────
//
// Any registration MAY carry this slice so marketplace UIs can render
// installs / rating / author uniformly. Marketplace state that changes
// at runtime (installCount) lives in the DB — this type is for the
// author-declared static shape that ships with the manifest.
export type MarketplaceMetadata = {
  /** Human name shown on marketplace cards — defaults to `name`. */
  displayName?: string;
  /** One-liner used in card grids. */
  tagline?: string;
  /** ImageKit / Supabase URL for the marketplace thumbnail. */
  previewImageUrl?: string;
  /** ImageKit / Supabase URL for the marketplace detail page hero. */
  detailImageUrl?: string;
  /** Author org — "Xrated Trades", "@merchant-name", etc. */
  author?: string;
  /** SPDX-style licence id, or "proprietary" for platform-native. */
  license?: string;
  /** Pricing surface — free / paid / included-in-plan. */
  pricing?: "free" | "paid" | "included";
  /** Category tags used by marketplace filters. Distinct from the
   *  primary `category` on RegistrationBase — these are cross-cutting
   *  facets like ["AI", "Automation", "Trades"]. */
  tags?: readonly string[];
};

// ─── Deprecation ───────────────────────────────────────────────────
//
// Every registration MAY declare a deprecation window. Registry
// consumers can decide whether to hide, warn, or hard-error on hits.
export type Deprecation = {
  /** The semver in which this registration was marked deprecated. */
  deprecatedSince: string;
  /** The semver in which we intend to remove it. Purely advisory. */
  removeIn?: string;
  /** Short human note surfaced in dev-tools / studio UI. */
  reason?: string;
  /** Suggested replacement id. Registry can auto-forward if `resolveAlias`
   *  is called with the deprecated id. */
  replacedBy?: string;
};

// ─── Base every registration extends ───────────────────────────────
export type RegistrationBase = {
  /** Unique id within this registry. Kebab slug or namespaced id —
   *  the factory validates via the schema descriptor. */
  id: string;

  /** SemVer. Enforced. */
  version: string;

  /** Short human name — used in Studio browsers, AI describe output,
   *  marketplace cards. */
  name: string;

  /** One-paragraph description. AI reads this. Keep it accurate. */
  description: string;

  /** Primary index key. Every registry buckets by this. */
  category: string;

  /** Cross-cutting filter tags — kebab-lowercase. First-class on the
   *  base so `listByTag()` works across every registry. Distinct from
   *  the primary `category` (structural) and `searchKeywords` (fuzzy). */
  tags?: readonly string[];

  /** Tokens the .search() function scans in addition to name +
   *  description + tags. Add trade-relevant terms merchants search for. */
  searchKeywords?: readonly string[];

  /** Older ids that should transparently resolve to this registration.
   *  Powers stable references across renames. Aliases must be unique
   *  across the registry (validated). */
  aliases?: readonly string[];

  /** Deprecation window. Present = registration is deprecated. */
  deprecation?: Deprecation;

  /** Optional marketplace slice — see MarketplaceMetadata. */
  marketplace?: MarketplaceMetadata;

  // ─── Platform Constitution v1 additions ─────────────────────────
  //
  // Every registration MAY declare these so marketplace + AI + a11y
  // audit surfaces have uniform data to render. All optional — no
  // existing registration breaks by omission.

  /** Publisher / author name. Free-text human identifier. */
  author?: string;

  /** Theme preset ids this registration is known to render correctly
   *  under. `["*"]` means "every theme". */
  compatibleThemes?: readonly string[];

  /** Devices this registration is designed for. Empty / omitted means
   *  every device. */
  supportedDevices?: readonly ("mobile" | "tablet" | "desktop")[];

  /** Best-effort accessibility grade for the rendered output. */
  accessibilityStatus?: "wcag-aaa" | "wcag-aa" | "wcag-a" | "unverified";

  /** Relative URL (or absolute) to the component's documentation. */
  documentationUrl?: string;

  /** Container ids this registration is known to slot cleanly into.
   *  `["*"]` = every container. AI uses this to constrain composition. */
  compatibleContainers?: readonly string[];

  /** Named animations this registration supports. Distinct from
   *  `motion` timing tokens — this is intent, not implementation. */
  animationSupport?: readonly string[];

  /** Rough runtime cost, used by the AI to budget layouts.
   *  low = < 1KB JS, no side effects;
   *  medium = interactive Radix primitive;
   *  high = heavy animation / third-party embed / video. */
  performanceCost?: "low" | "medium" | "high";
};

// ─── Frozen wrapper ───────────────────────────────────────────────
//
// Just a type-level marker that a registration has been frozen. The
// factory guarantees this at runtime via deepFreeze().
export type Frozen<T> = Readonly<T>;

// ─── Analytics event shape ────────────────────────────────────────
//
// Distinct from telemetry: telemetry is per-call observability
// (hit/miss). Analytics is coarser business-warehouse events that
// power dashboards ("which sections are most installed", "which
// blueprints get searched but never rendered"). Warehouse
// dispatchers subscribe via the `analytics` config hook.
export type RegistryAnalyticsEvent =
  | {
      type: "registration.added";
      registry: string;
      id: string;
      category: string;
      version: string;
      timestamp: number;
    }
  | {
      type: "registration.searched";
      registry: string;
      query: string;
      hitCount: number;
      timestamp: number;
    }
  | {
      type: "registration.hydrated";
      registry: string;
      count: number;
      timestamp: number;
    };

// ─── Registry Relationships (Constitution Amendment 6 §RGP-6) ─────
//
// Every registry's REGISTRY_METADATA declares its relationships in the
// platform graph. This drives AI reasoning, dependency validation,
// marketplace packaging, plugin loading, and lazy loading.
export type RegistryComposition =
  | "root"          // no upstream; has downstream (foundation)
  | "intermediate"  // both upstream and downstream (most)
  | "leaf"          // has upstream; no downstream (terminal)
  | "standalone";   // no upstream, no downstream (rare utility)

export type RegistryRelationships = {
  /** 1..18 per Constitution Amendment 6 canonical layer list. */
  businessOsLayer: number;
  /** Registries this reads from at register() or lookup time. */
  upstreamDependencies: readonly string[];
  /** Registries known to consume this registry's entries. */
  downstreamDependents: readonly string[];
  composition: RegistryComposition;
  /** Whether third-party plugins may register into this registry. */
  pluginCompatible: boolean;
  /** Optional planned parent registry migration path — for future
   *  consolidations (e.g. themeRegistry → brandRegistry). */
  futureParent?: string;
};

/** Standard REGISTRY_METADATA shape every registry file exports.
 *  Required by RGP-2 (Amendment 5) + RGP-6 (Amendment 6). */
export type RegistryMetadata = {
  owner: string;
  purpose: string;
  lifecycle: "alpha" | "beta" | "stable" | "deprecated";
  sinceVersion: string;
  constitutionRefs: readonly string[];
  adrRefs: readonly string[];
  pmmImpact: string;
  relationships: RegistryRelationships;
};

// ─── Snapshot for future DB persistence ───────────────────────────
//
// Structured serialisation of a registry's state at a point in time.
// Version-tagged so we can migrate the shape across releases.
export type RegistrySnapshot<T> = {
  /** Snapshot schema version — bump when the shape changes. */
  version: 1;
  /** Registry label from RegistryConfig. */
  label: string;
  /** ISO 8601 timestamp — when the snapshot was taken. */
  takenAt: string;
  /** Every canonical registration. Aliases are recovered from the
   *  registrations' own `aliases` field, so we don't duplicate. */
  registrations: T[];
};

// ─── Registry factory config ──────────────────────────────────────
export type RegistryConfig<T extends RegistrationBase> = {
  /** Debug label prefixed onto every error. Registry consumers see
   *  e.g. "sectionRegistry: duplicate id …". */
  label: string;

  /** How to validate the id format. Kebab slug or namespaced id. */
  idFormat: "slug" | "namespacedId";

  /** Domain-specific validation. Called after the base validation
   *  (id / semver / name / description) passes. Throw with a clear
   *  message on failure — the factory prefixes with `label`. */
  validate?: (reg: T) => void;

  /** Extra secondary indexes the registry should maintain besides
   *  `byCategory` and the built-in `byTag`. Each entry names a key
   *  on the registration + a function that returns the index value(s).
   *
   *  Example — the blueprint registry indexes byTrade + byOutcome:
   *    indexes: {
   *      byTrade: (m) => m.trades,
   *      byOutcome: (m) => m.outcomes
   *    } */
  indexes?: Record<string, (reg: T) => readonly string[]>;

  /** Optional telemetry hooks. All are fire-and-forget — the registry
   *  never blocks on these. */
  telemetry?: {
    onRegister?: (reg: Frozen<T>) => void;
    onGet?: (id: string, hit: boolean) => void;
    onMiss?: (id: string) => void;
  };

  /** Optional analytics sink for warehouse dispatch. Distinct from
   *  telemetry — coarser events, business-level. */
  analytics?: {
    onEvent?: (event: RegistryAnalyticsEvent) => void;
  };

  /** Optional seed registrations applied at factory-creation time.
   *  Useful for hydrating a registry from a persisted snapshot
   *  ({@link RegistrySnapshot}) on cold boot. */
  seed?: readonly T[];
};

// ─── Registry API ─────────────────────────────────────────────────
//
// The uniform surface every registry exposes. Each existing hand-rolled
// registry currently implements a SUBSET of this — retrofitting them
// broadens each to the full surface without breaking existing callers.
export type Registry<T extends RegistrationBase> = {
  register(reg: T): Frozen<T>;
  get(id: string): Frozen<T> | undefined;
  getOrThrow(id: string): Frozen<T>;
  has(id: string): boolean;
  list(): Frozen<T>[];
  listByCategory(category: string): Frozen<T>[];
  listByIndex(indexName: string, key: string): Frozen<T>[];

  /** Filter by tag — cross-cutting facet, distinct from category. */
  listByTag(tag: string): Frozen<T>[];

  ids(): string[];
  categories(): string[];
  tags(): string[];
  size(): number;
  counts(): { total: number; byCategory: Record<string, number> };

  /** Weighted keyword search across id + name + description + tags +
   *  searchKeywords + category. See registryKit/search.ts. */
  search(query: string, limit?: number): Frozen<T>[];

  /** AI-consumable one-line describe of a single registration. */
  describe(id: string): string;

  /** Return the canonical id an alias points to, or null if not an
   *  alias. Registrations register their aliases at register-time. */
  resolveAlias(alias: string): string | null;

  /** Dev/CI: run cross-registration invariants. Returns warnings +
   *  errors. Empty errors array = healthy. */
  selfCheck(): { warnings: string[]; errors: string[] };

  /** Serialisable snapshot of every current registration + aliases.
   *  Used by future DB persistence layers. */
  snapshot(): RegistrySnapshot<T>;
};
