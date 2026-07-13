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

// ─── Trade Center Week 1 extensions (all optional, all additive) ────
//
// Why they belong on the AppManifest (per 3-question rule in memory
// `project_extend_dont_duplicate_permanent_rule.md`):
//
//   1. Why platform?  These declarations are consumed by platform-
//      level subsystems (AI Dispatcher, Feature Flag Enforcer,
//      Telemetry Bus, Command Palette). Duplicating them per App
//      would rebuild the platform.
//
//   2. Which future Apps benefit?  Every App. Marketplace, Projects,
//      Fleet, Insurance, Finance, Recruitment, Training — each will
//      register AI tools, flags, telemetry, and palette commands.
//
//   3. Which doc authorises?  TRADE_CENTER_PLATFORM_DELTA §4.2 rows
//      "Manifest version envelope / AI tool declarations / feature
//      flag declarations / telemetry declarations". ADRs 033, 034,
//      037, 038 (see PLATFORM_DECISIONS.md).

/** Platform + API compatibility envelope. All fields optional so
 *  existing manifests continue to validate. Populated Apps get
 *  richer version-based upgrade tracking.
 *
 *  Authorised by ADR-033. */
export type PlatformCompat = {
  /** SemVer of the AppManifest surface the App targets. Distinct from
   *  `manifestVersion` (which is the schema shape). Bump when the
   *  App consumes new fields added by ADRs after ADR-033. */
  apiVersion?: string;
  /** SemVer of the App's own DB schema (its `app_<slug>_*` tables).
   *  Migration tooling reads this to plan upgrades. */
  schemaVersion?: string;
  /** Head of the migrations directory the App expects live —
   *  timestamp-slug format matching supabase/migrations/*.sql. */
  migrationVersion?: string;
  /** Minimum platform semver this App runs against. Boot loader
   *  refuses to register the App if the running platform is older. */
  minPlatformVersion?: string;
};

/** An AI tool the App contributes to the platform AI Dispatcher.
 *  The Dispatcher discovers these at boot from every App's manifest
 *  and exposes them to Opus/Haiku via the standard tool-use interface.
 *
 *  Authorised by ADR-034. Delta §4.3 "AI Dispatcher with tool
 *  discovery per App". */
export type AIToolDeclaration = {
  /** Fully qualified tool name — MUST be `<appSlug>.<name>` to avoid
   *  collisions across Apps. Validator enforces the prefix. */
  name: string;
  /** One-line description read by the model to decide when to call. */
  description: string;
  /** JSON Schema for the tool's parameters. Kept as `unknown` at the
   *  manifest layer — validation done by the Dispatcher at call time. */
  parameters: unknown;
  /** Optional handler import path (relative to the manifest file). The
   *  Dispatcher lazy-loads the module and invokes the default export
   *  with the parsed arguments. */
  handler?: string;
  /** Tier gate — Dispatcher hides the tool from users below this tier. */
  requiredTier?: AppPlan;
  /** Rough per-call cost bucket — used by the cost router in
   *  §7 of PLATFORM_ARCHITECTURE. Optional; defaults to "low". */
  cost?: "low" | "medium" | "high";
};

/** A plugin-scoped feature flag the App owns.
 *
 *  Authorised by ADR-037. Delta §4.3 "Plugin-scoped feature flag
 *  registry". */
export type FeatureFlagDeclaration = {
  /** Fully-qualified flag key — MUST be `<appSlug>.<local-key>`. */
  key: string;
  description: string;
  /** Default value if no override rule matches. */
  default: boolean;
  /** Scope of evaluation. `user` = per-user override. `business` =
   *  per-active-business. `country` = per detected country. `global` =
   *  platform-wide. */
  scope: "user" | "business" | "country" | "global";
  /** Optional A/B variant labels — only meaningful when the flag
   *  serves more than a boolean. */
  variants?: readonly string[];
};

/** A custom telemetry metric the App emits beyond the auto-baseline
 *  (which every App gets for free from the runtime wrapper).
 *
 *  Authorised by ADR-038. Delta §4.2 "AppManifest telemetry
 *  declarations". */
export type TelemetryDeclaration = {
  /** Fully-qualified metric name — MUST be `<appSlug>.<local-name>`. */
  metric: string;
  kind: "counter" | "gauge" | "histogram";
  description: string;
  /** Optional label dimensions. Runtime rejects labels not declared. */
  labels?: readonly string[];
};

/** A command the App contributes to the platform Command Palette.
 *  ⌘K opens the palette; every registered command from every App
 *  appears grouped by App with keyboard shortcuts.
 *
 *  Authorised by ADR-047 (workspace navigation pattern) + Delta §4.3
 *  "Command Palette (⌘K)". */
export type CommandDeclaration = {
  /** Fully-qualified command id — MUST be `<appSlug>.<local-id>`. */
  id: string;
  /** Human-readable label shown in the palette row. */
  label: string;
  /** Group the command renders under. Palette buckets by group. */
  group: "actions" | "products" | "merchants" | "categories" | "recent";
  /** Optional keyboard shortcut in Linear-style notation ("g m", "⌘k"). */
  shortcut?: string;
  /** Optional handler module path (relative to the manifest file).
   *  Palette runtime lazy-loads and invokes. */
  handler?: string;
  /** Optional lucide icon name — palette resolves via lucide-react. */
  icon?: string;
};

/** A fine-grained capability the App mints. Distinct from
 *  `requirements.capabilities` (the coarse-grained platform services
 *  the App consumes). Capabilities declared here become the atomic
 *  policy units that Enterprise Admins compose into roles.
 *
 *  Authorised by ADR-040 + Delta §4.3 "Capability model +
 *  can() runtime". */
export type PolicyCapabilityDeclaration = {
  /** Fully-qualified key — MUST be `<appSlug>.<capability>`. Example:
   *  "orders.approve_refund", "marketplace.moderate_listings". */
  key: string;
  /** Human-readable description shown in Admin role composers. */
  description: string;
  /** Evaluation scope. `user` = per-user. `business` = per-active-
   *  business (multi-tenant). `platform` = platform-wide. */
  scope: "user" | "business" | "platform";
  /** Tier(s) the capability is available in by default. */
  defaultTiers: readonly AppPlan[];
  /** Role keys that receive this capability by default. */
  defaultRoles?: readonly string[];
};

/** A widget the App contributes to a shell surface. Shell renders
 *  widgets from every registered App for the matching slot without
 *  hard-coding App slugs.
 *
 *  Authorised by ADR-048 + Delta §6 Week 2 "Home 'Today's Work'
 *  strip + BFF endpoint". */
export type WidgetDeclaration = {
  /** Fully-qualified widget id — MUST be `<appSlug>.<widget>`. */
  id: string;
  /** Shell slot the widget renders into. */
  slot: "home.today" | "home.secondary" | "right-panel";
  /** One-line label shown above the widget. */
  label: string;
  /** Optional order hint — lower renders first. */
  order?: number;
  /** Handler module path (relative to the manifest file). The default
   *  export is a React server component OR an async function returning
   *  the payload the shell renders through its default renderer. */
  handler: string;
  /** Refresh interval in seconds — shell polls or invalidates on
   *  events. Omit for static widgets. */
  refreshInterval?: number;
  /** Optional tier gate. */
  requiredTier?: AppPlan;
};

/** A notification kind the App emits. The Notifications Platform
 *  Service (ADR-049) discovers these and routes them to the user's
 *  preferred channels (in-app / email / push).
 *
 *  Authorised by ADR-049. */
export type NotificationKindDeclaration = {
  /** Fully-qualified kind — MUST be `<appSlug>.<kind>`. Example:
   *  "orders.dispatched", "reviews.published". */
  kind: string;
  /** Category the user sees in their notification preferences. */
  category: string;
  /** Human-readable description of when this notification fires. */
  description: string;
  /** Default channels — user preferences may override. */
  defaultChannels: readonly ("in-app" | "email" | "push")[];
  /** Optional severity hint — shells may prioritise. */
  severity?: "info" | "warning" | "critical";
};

/** A Universal Search provider the App contributes. Search
 *  orchestrator fans out to every registered provider in parallel.
 *
 *  Authorised by ADR-041 + Delta §4.3 "Universal Search
 *  orchestrator". */
export type SearchProviderDeclaration = {
  /** Fully-qualified provider id — MUST be `<appSlug>.<provider>`. */
  id: string;
  /** Group the results render under (matches CommandDeclaration
   *  groups so the palette + universal search share the taxonomy). */
  kind: "products" | "merchants" | "categories" | "actions" | "content" | "files" | "users";
  /** Human-readable group label. */
  label: string;
  /** Base weight (0–1) contribution to global result ranking. */
  weight: number;
  /** Handler module path — default export is `(q: string) => Promise<SearchResult[]>`. */
  handler: string;
  /** Whether this provider participates in semantic search (pgvector). */
  supportsSemanticSearch?: boolean;
};

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

  // ─── Trade Center Week 1 additions (ADR-033 through ADR-047) ────
  //
  // All optional. Existing manifests continue to validate. Apps
  // opt in when they need the corresponding platform subsystem.

  /** Platform + API compatibility envelope. ADR-033. */
  platformCompat?: PlatformCompat;

  /** AI tools the App contributes to the platform AI Dispatcher.
   *  The Dispatcher auto-discovers these at boot. ADR-034. */
  aiTools?: readonly AIToolDeclaration[];

  /** Feature flags this App owns. Namespaced `<slug>.<key>`.
   *  Shell reads via `flags.isEnabled()`. ADR-037. */
  featureFlags?: readonly FeatureFlagDeclaration[];

  /** Custom telemetry metrics this App emits beyond the auto-baseline
   *  the runtime wrapper provides for every App. ADR-038. */
  telemetry?: readonly TelemetryDeclaration[];

  /** Commands this App contributes to the platform Command Palette.
   *  Discovered at boot; no manual wiring. ADR-047. */
  commands?: readonly CommandDeclaration[];

  // ─── Trade Center Week 2 additions (ADR-040 through ADR-050) ────

  /** Fine-grained capabilities this App mints. Enterprise Admin
   *  role composers list these; runtime `can()` checks them. ADR-040. */
  declaredCapabilities?: readonly PolicyCapabilityDeclaration[];

  /** Search providers this App contributes to Universal Search.
   *  Orchestrator fans out to every registered provider. ADR-041. */
  searchProviders?: readonly SearchProviderDeclaration[];

  /** Widgets this App contributes to shell surfaces (Home Today's
   *  Work strip, right panel). Shell auto-renders. ADR-048. */
  widgets?: readonly WidgetDeclaration[];

  /** Notification kinds this App emits. Notifications Platform
   *  Service routes to user's preferred channels. ADR-049. */
  notificationKinds?: readonly NotificationKindDeclaration[];
};

// ─── Convenience type for the registry ─────────────────────────────

/** Frozen manifest — what the registry returns to callers. */
export type FrozenAppManifest = Readonly<AppManifest>;
