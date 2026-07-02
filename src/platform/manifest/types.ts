// App Manifest v1 — the canonical descriptor for every App in the
// Xrated Trades Business OS.
//
// Studio understands Apps entirely through their manifest. No pipeline
// in the platform's rendering, install, or navigation-generation code
// references a specific App's slug — everything is looked up through
// the App Registry using this schema.
//
// This file is load-bearing. It is the "spec" everything else pivots on.
// Prefer additive edits over renames; when a breaking change to the
// schema is unavoidable, bump `ManifestVersion` and provide a migration.
//
// Design principles baked in:
//   • Most fields are optional — an App can be minimal (one section)
//     or comprehensive (creates pages, tables, nav, events, AI hooks).
//   • Storage is declared as table *names* (prefixed `app_<slug>_`);
//     actual DDL lives in supabase/migrations. This is intentional —
//     declarative auto-DDL is magical, hard to review, and hard to
//     evolve. The naming convention gives us clean prefix-scoped
//     uninstall/purge without conjuring schema management on top of
//     Supabase.
//   • No I/O in the manifest itself. Pure data. Safe to load in edge
//     runtimes and to reason about statically.
//   • Every App is versioned. Merchants install a specific version.
//     Non-breaking bumps auto-apply; breaking bumps require an opt-in
//     upgrade with a diff view (Studio surface, later phase).

// ─── Schema version ─────────────────────────────────────────────────

export type ManifestVersion = 1;

// ─── High-level enumerations ────────────────────────────────────────

/** App Store category — used for browsing + filtering. Extend by
 *  editing this union and updating the App Store UI's tab list. */
export type AppCategory =
  | "business"
  | "trade"
  | "sales"
  | "products"
  | "services"
  | "information"
  | "operations"
  | "finance"
  | "compliance";

/** Which tier(s) unlock an App. The App Store never disables a locked
 *  App — it shows an upgrade CTA instead. */
export type AppPlan = "free" | "paid" | "verified" | "merchant-pro";

/** Named lifecycle hooks. The referenced module path (e.g.
 *  "./lifecycle.ts") exports a matching function. Hooks run
 *  server-side, transactionally where possible. */
export type AppLifecycleHook = "onInstall" | "onUninstall" | "onUpgrade";

// ─── Capabilities & permissions ─────────────────────────────────────

/** Platform services an App can request. The SDK provides these; Apps
 *  declare them via `requirements.capabilities`. Studio surfaces the
 *  request during install so merchants know what an App can touch. */
export type Capability =
  | "maps"
  | "payments"
  | "products"
  | "messaging"
  | "camera"
  | "location"
  | "documents"
  | "media"
  | "notifications"
  | "authentication"
  | "storage"
  | "analytics"
  | "ai"
  | "events";

/** Permission scopes the App declares — enforced by the SDK when the
 *  App calls platform services. Studio shows these on the install
 *  confirmation. */
export type Permission =
  | "read:listing"
  | "write:listing"
  | "read:products"
  | "write:products"
  | "read:orders"
  | "write:orders"
  | "read:analytics"
  | "publish:events"
  | "subscribe:events"
  | "notify:merchant";

// ─── Free-form slugs ────────────────────────────────────────────────

/** Industry slug — matches `hammerex_trade_off_listings.primary_trade`
 *  values, plus `"*"` meaning "any industry". Example values:
 *  "building-merchant", "plumber", "roofer", "*". */
export type IndustrySlug = string;

/** Page slug within a merchant's application. Example values: "home",
 *  "shop", "product", "contact", "*" (any page). */
export type PageSlug = string;

/** Event kind string. Format: `<producer>.<past-tense-verb>`, e.g.
 *  "cart.enquiry_submitted", "app.installed", "layout.published". Kept
 *  a string in v1; may narrow to a registered union in v2. */
export type EventKind = string;

// ─── Support types ──────────────────────────────────────────────────

/** A page an App creates on install. The installer materialises the
 *  route, the studio_pages row, the default layout, and (optionally)
 *  the navigation entry.
 *
 *  `path` uses the platform's route grammar — `{slug}` binds to the
 *  merchant's slug. Route registration happens through the platform's
 *  route registry, not by dropping files in Next's app dir. */
export type PageDeclaration = {
  pageId: string;
  path: string;
  title: string;
  /** Optional Studio section IDs to seed the page with on install. */
  seedSections?: string[];
};

/** Navigation entry an App contributes to Studio's side drawer and to
 *  the merchant's public site nav (respecting its `visibility` flag).
 *  Sub-nav is expressed with `parent` pointing at another entry's `id`. */
export type NavEntry = {
  id: string;
  label: string;
  icon?: string;
  href: string;
  parent?: string;
  order?: number;
  visibility?: "public" | "merchant" | "both";
};

/** A section this App contributes to Studio. Each id is automatically
 *  namespaced `app.<app-slug>.<local-id>` by the platform at load. The
 *  section's actual metadata (editableFields, defaultConfig, renderer)
 *  lives in the referenced module file — the platform lazy-loads it
 *  when Studio needs to render or the App Store previews. */
export type ManifestSectionRegistration = {
  id: string;
  name: string;
  library: string;
  description: string;
  thumbnail?: string;
  /** Path relative to the App's manifest file. */
  moduleImport: string;
};

/** Where and how the App's content editor appears inside Studio. The
 *  editor opens as a slide-over or modal — the merchant never leaves
 *  the Studio URL. `route` may include `{slug}` for the merchant slug. */
export type ContentEditorRef = {
  route: string;
  title: string;
  icon?: string;
  /** Presentation surface. Default: "slide-over". */
  surface?: "slide-over" | "modal" | "fullscreen";
};

// ─── The manifest itself ───────────────────────────────────────────

export type AppManifest = {
  manifestVersion: ManifestVersion;

  // ─── Identity ─────────────────────────────────────────
  /** Kebab-case, globally unique. Never change once shipped —
   *  renaming orphans every merchant who installed it. */
  slug: string;
  name: string;
  tagline: string;
  description: string;
  /** Emoji glyph or icon URL. Renders in the App Store card and in
   *  the merchant's installed-apps list. */
  icon: string;
  category: AppCategory;
  /** Semver. Merchants install a specific version; the platform tracks
   *  installed version per merchant and surfaces upgrades opt-in. */
  version: string;

  publisher: {
    name: string;
    verified: boolean;
    contactUrl?: string;
  };

  // ─── Compatibility ────────────────────────────────────
  compatibility: {
    /** `"*"` = every industry. Otherwise a list of primary_trade slugs. */
    industries: IndustrySlug[];
    /** Pages this App can be inserted INTO as sections. `"*"` = any page. */
    pages: PageSlug[];
    /** Pages this App CREATES on install. Powers automatic page,
     *  route, and navigation generation. */
    createsPages: PageDeclaration[];
  };

  // ─── Requirements ─────────────────────────────────────
  requirements: {
    plan: AppPlan;
    /** Other Apps that must be installed first. */
    dependencies: string[];
    /** Other Apps this cannot co-exist with. */
    conflicts: string[];
    capabilities: Capability[];
    permissions: Permission[];
  };

  // ─── Studio integration ───────────────────────────────
  studio: {
    sections: ManifestSectionRegistration[];
    /** Advisory: preferred slot IDs (e.g. "home.body", "shop.footer"). */
    slotHints?: string[];
    /** Deep-link to the content editor. Omit for appearance-only Apps. */
    contentEditor?: ContentEditorRef;
  };

  // ─── Navigation ──────────────────────────────────────
  navigation?: NavEntry[];

  // ─── Data ───────────────────────────────────────────
  /** Table NAMES the App uses. MUST be prefixed `app_<slug>_` (dashes
   *  → underscores in the prefix). Actual DDL is in
   *  `supabase/migrations/<timestamp>_app_<slug>_*.sql`. This keeps
   *  Supabase Studio (the DB one) as the single place to review schema
   *  changes, and lets uninstall+purge scope by prefix. */
  storage?: {
    tables: string[];
  };

  // ─── Events ─────────────────────────────────────────
  events?: {
    publishes: EventKind[];
    subscribes: EventKind[];
  };

  // ─── AI metadata ────────────────────────────────────
  /** Powers the AI Industry Pack Composer and the "Ask AI to install"
   *  flow. Keywords are matched against the merchant's business
   *  description; userStories inform pack composition. */
  ai?: {
    keywords: string[];
    userStories?: string[];
    recommendedFor?: string[];
  };

  // ─── Lifecycle ──────────────────────────────────────
  /** Module paths (relative to the manifest file) exporting the named
   *  functions. Runs server-side. onInstall wraps the whole install
   *  in a transaction where the DB supports it. */
  lifecycle?: Partial<Record<AppLifecycleHook, string>>;

  // ─── App Store surface ──────────────────────────────
  appStore: {
    screenshots: string[];
    benefits: string[];
    demoUrl?: string;
    /** Human-readable price label. Examples: "Free", "£4/mo",
     *  "Included in Merchant Pro". Never hard-coded in the App Store
     *  UI — always read from here. */
    priceLabel: string;
  };
};

// ─── Convenience type for the registry ─────────────────────────────

/** Frozen manifest — what the registry returns to callers. */
export type FrozenAppManifest = Readonly<AppManifest>;
