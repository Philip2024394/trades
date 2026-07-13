# Trade Center — Platform Architecture (Master Blueprint)

**Owner:** Philip O'Farrell
**Status:** Canonical master architecture — every other doc references this
**Version:** 1.1 · 2026-07-11 (amendments incorporated; conditional approval landed)
**Parent docs:** `TRADE_CENTER_2_SPEC.md` (what we build) · `TRADE_CENTER_DESIGN_PRINCIPLES.md` (what deserves to be built)

## Final Principle (governs every rule below)

> **The shell owns the experience.**
> **Plugins own the business logic.**
> **Services own the data.**
> **Infrastructure owns reliability.**
> **No layer may violate the responsibilities of another layer.**

If a change to Trade Center cannot be described in that four-line contract without leaking, the change is wrong.

---

## 0. Purpose

This document is the **master architecture** for Trade Center. Every developer, AI, and future team member reads this before touching code.

It defines the platform in **five layers**, the **plugin contract** every plugin implements, the **event architecture** through which everything communicates, and the **workspace state** the shell owns.

Nothing else in the platform breaks these rules. If an implementation cannot conform, the implementation changes — not the architecture.

### 0.1 Ten platform commitments (v1.1 amendments)

These are the non-negotiable commitments the architecture makes to itself. Every subsequent section implements them.

1. **Plugin-first.** Every module is a plugin. Marketplace is Plugin #1 — not "the app." An external team must be able to ship a plugin without shell changes.
2. **Policies over roles.** Access is composed from capabilities (`CanCreateOrder`, `CanApproveRefund`). Roles are named bundles of capabilities.
3. **AI is a platform service.** No plugin owns AI. Plugins register tools; the platform dispatcher discovers and calls them.
4. **Universal search.** Search is not for products — it's for everything. Products, merchants, messages, orders, projects, files, knowledge, users, commands, plugins, docs, saved lists, recent activity. Spotlight-class.
5. **Everything emits events.** No silent state change. Preferences, themes, favourites, notifications — every mutation emits.
6. **Every plugin carries versions.** `moduleVersion`, `apiVersion`, `schemaVersion`, `migrationVersion` — encoded in the manifest.
7. **Feature flags belong to plugins.** Modules own their flags; the shell enables them. No global flags by default.
8. **Telemetry starts on day one.** Every plugin auto-reports performance, errors, usage, latency. No bolt-on analytics later.
9. **UI is a platform asset.** The Platform Design System owns buttons/cards/tables/lists/dialogs/panels/charts/forms. Plugins compose; plugins never build primitives.
10. **Workflows are orchestrated.** No plugin hardcodes a multi-step flow. The workflow engine runs it based on events.

### 0.2 Design ambition

The architecture must scale to **100+ plugins** without redesign. Marketplace is one plugin. Equipment Hire is another. Trade Finance, Fleet Management, Compliance, CRM, Payroll, Video Calls, Document Signing, IoT — all future plugins. **The shell must never be rebuilt.**

---

## 1. The Five Layers

```
┌───────────────────────────────────────────────────────────────┐
│                    LAYER 5 — PRESENTATION                     │
│   Desktop · Tablet · Mobile · PWA · Future Desktop App        │
│              (all share the same shell)                       │
└───────────────────────────────────────────────────────────────┘
                             ▲
                             │  renders
                             ▼
┌───────────────────────────────────────────────────────────────┐
│                     LAYER 1 — PLATFORM SHELL                  │
│  Persistent Navigation · Sidebar · Command Palette · Search   │
│  Notifications · User Context · Workspace State · AI · Theme  │
│  Permissions · Module Registry                                │
│         (knows only modules, never products)                  │
└───────────────────────────────────────────────────────────────┘
                             ▲
                             │  registers · dispatches to
                             ▼
┌───────────────────────────────────────────────────────────────┐
│                   LAYER 2 — PLATFORM MODULES                  │
│   Marketplace · Orders · Messages · Trade Profiles            │
│   Merchant Stores · Suppliers · Knowledge · Reviews           │
│   Saved Lists · Projects · Business Dashboard · Analytics     │
│   Studio · AI  (+ future: Equipment Hire, Trade Finance,      │
│   Insurance, Training, CRM, Fleet, Compliance, IoT…)          │
└───────────────────────────────────────────────────────────────┘
                             ▲
                             │  invokes · consumes events from
                             ▼
┌───────────────────────────────────────────────────────────────┐
│                   LAYER 3 — DOMAIN SERVICES                   │
│  Products · Merchants · Users · Orders · Inventory            │
│  Payments · Delivery · Verification · Messaging · Search      │
│  Analytics · Identity · AI · Media                            │
│    (each owns its DB · communicates via events only)          │
└───────────────────────────────────────────────────────────────┘
                             ▲
                             │  runs on
                             ▼
┌───────────────────────────────────────────────────────────────┐
│                   LAYER 4 — INFRASTRUCTURE                    │
│  API Gateway · Auth · Cache · Storage · Queues · Search       │
│  AI Dispatcher · Image · Email · Push · Logs · Monitoring     │
│  Feature Flags · Audit Log                                    │
└───────────────────────────────────────────────────────────────┘
```

### 1.1 Golden rules of the layer stack

1. **Higher layers know lower layers. Lower layers never know higher layers.** The Shell knows Modules. Modules know Domain Services. Domain Services know Infrastructure. Reverse coupling is FORBIDDEN.
2. **Sibling communication is via events, not imports.** Two modules never `import` each other's code. Two domain services never share a table. Coupling goes through the event bus.
3. **Presentation is a delivery mechanism, not a layer with logic.** Desktop, tablet, mobile, PWA all render the same shell + modules. Device-specific code lives in adapters, never in domain.
4. **The shell is stable. Modules are volatile.** The shell can be extended (a new slot, a new hook) but never restructured. Modules can be added, removed, replaced, sunset.
5. **Every layer boundary is enforced at build time.** ESLint boundary rules reject cross-layer imports at PR time.

---

## 2. Layer 1 — Platform Shell

The shell is the operating system of Trade Center. It owns everything a user experiences that is not *inside* a module.

### 2.1 What the shell owns

| Concern | Responsibility |
|---|---|
| **Persistent Navigation** | Primary rail (9 slots), top bar, breadcrumbs |
| **Sidebar** | Primary rail + secondary rail (context-sensitive per active module) + pinned block |
| **Command Palette** | ⌘K overlay, action dispatch, group rendering |
| **Global Search** | Universal search input, intent routing, results grouping |
| **Notifications** | Bell, slideover, toast region, delivery via SSE/push |
| **User Context** | Session, active capabilities (composed from roles), current viewer identity |
| **Workspace State** | Current plugin, sidebar collapsed, right panel slot, pinned items, recent activity, mode (Simple/Workspace) |
| **AI Assistant** | Right panel copilot, ⌘K "Ask AI" group, streaming pipe, **tool discovery from plugins** |
| **AI Dispatcher** | Model routing (`/api/ai/dispatch`), cost control, per-tier quota enforcement |
| **Universal Search** | Global search that queries every registered `SearchProvider` — products, merchants, messages, orders, files, users, commands, docs, everything |
| **Theme** | Light/dark mode, density mode, brand tokens |
| **Policy Engine** | Capability-based access checks (`can(ctx, "orders.approve_refund")`) at route + action + API layers |
| **Plugin Registry** | Load / register / dispatch to plugins; plugin lifecycle; version compatibility checks |
| **Workflow Engine** | Runs orchestrations from event triggers (§9) — no plugin owns cross-plugin flows |
| **Telemetry Bus** | Auto-captures performance, errors, usage, latency, command usage, AI usage, search usage, navigation usage from every plugin |
| **Feature Flag Enforcer** | Reads plugin-owned flags, applies rollout rules at route + widget level |
| **Company Switcher** | Multi-tenancy — user's active business context |
| **Country Context** | Detected country + currency + locale + tax rules |
| **Platform Design System** | Owns UI primitives (buttons/cards/tables/lists/dialogs/panels/charts/forms). Plugins compose these; plugins never build primitives. |

### 2.2 What the shell explicitly does NOT own

- Product data
- Order data
- Message data
- Merchant data
- Any business logic that would live in a module
- Any domain rule (verification thresholds, pricing tiers, trade taxonomy)
- Any UI that appears *inside* the main pane (main pane is always module-rendered)

**The shell knows only modules, never products.**

### 2.3 Shell surfaces

Every shell surface is a named slot that modules can register into:

- `shell.primaryNav` — 9 rail slots
- `shell.secondaryNav` — context-sensitive per active module
- `shell.pinnedItems` — user-pinned modules/merchants/lists
- `shell.recentItems` — auto-populated last-touched items
- `shell.topBar.left` — logo + breadcrumbs
- `shell.topBar.search` — universal search input
- `shell.topBar.actions` — notifications, AI, company switcher, user menu
- `shell.commandPalette.groups` — grouped result surfaces
- `shell.rightPanel.slots` — AI, compare, cart, job-list, module-specific
- `shell.notifications` — toast + slideover + bell badge
- `shell.homeWidgets` — Today's Work strip widgets

Modules register into slots via their manifest (§4). Slots are typed. Slot registration is versioned. Slot dispatch is idempotent.

### 2.4 Shell lifecycle

```
1. Boot          → load module registry from tc_shell.registry
2. Auth resolve  → hydrate user context (session, roles, country)
3. Mode select   → Simple or Workspace (per §21 of spec)
4. Render shell  → primary + secondary rail + top bar
5. Route mount   → dispatch to active module's route handler
6. Module hydrate → load module's sidebar state, widgets, AI tools
7. Event stream  → subscribe to real-time channels (notifications, orders, messages)
8. Palette ready → ⌘K live
```

Each step has a defined SLO (see spec §11.1). Boot to interactive < 400ms.

---

## 3. Layer 2 — Platform Plugins

### 3.1 What is a plugin?

A plugin is a **domain-bounded, self-contained, installable unit** that plugs into the shell via a formal contract (§4).

**Every plugin behaves as though it could ship externally.** Marketplace, Orders, Messages — they are internal today but architected as if they were third-party. No plugin gets shortcuts. No plugin is "special." **Marketplace is simply Plugin #1.**

A plugin owns:

- A slice of the user's work (Marketplace = buying, Orders = tracking, Quotes = quoting)
- A set of routes under a namespace (`/marketplace/*`, `/orders/*`)
- Its own database schema (Layer 3 → 4)
- Its own event contracts (what it emits, what it listens to)
- Its own read models optimised for its UI
- Its own feature flags
- Its own migrations
- Its own tests
- Its own telemetry emissions
- Its own AI tools (registered with the platform dispatcher)
- Its own search provider (registered with universal search)
- Its own workflow contributions (registered with the workflow engine)

A plugin does **NOT** own:

- Shell chrome
- UI primitives (they come from the Platform Design System)
- The AI dispatcher (it's a platform service; plugins only register tools)
- Universal search (it's a platform service; plugins only register providers)
- The workflow engine (it's a platform service; plugins only contribute triggers + steps)
- Other plugins' data
- The user's overall context (that's the shell)
- Cross-plugin orchestration (that's the workflow engine)

### 3.2 The plugin-first rule

Anyone — internal engineer, external vendor, AI agent — should be able to ship a new plugin by:

1. Creating a folder
2. Writing a manifest that implements the contract
3. Running the plugin install command
4. Watching the shell auto-discover it

If any of these four steps requires editing shell code, the shell is broken. File an architectural amendment.

### 3.3 Plugin inventory (current + planned)

**Current (v2.0):**
- Marketplace
- Orders
- Messages
- Trade Profiles
- Merchant Stores
- Suppliers (directory)
- Knowledge (base)
- Reviews
- Saved Lists
- Projects
- Business Dashboard
- Analytics
- Studio (external app, exposed as a module surface)
- AI

**Planned (v2.x → v3.x):**
- Equipment Hire
- Trade Finance
- Insurance
- Training
- Certification
- Employment
- Apprenticeships
- Vehicle Marketplace
- Property Marketplace
- Material Estimation
- AR Measuring
- IoT Devices
- Fleet Management
- CRM
- Accounting
- Payroll
- Scheduling
- Video Calls
- Document Signing
- Safety Management
- Compliance

**Beyond v3.x — modules we haven't imagined yet.**

**Rule:** the architecture MUST accept plugin 100 without redesign. If adding a plugin requires shell rework, the shell was wrong.

### 3.4 Plugin lifecycle

```
1. Manifest declared          → src/modules/{slug}/manifest.ts
2. Registered with registry   → tc_shell.registry insert
3. Migrations applied         → tc_{slug}.* schema created
4. Read models built          → subscribed to relevant events
5. Slots claimed              → primary/secondary nav, widgets, palette actions
6. Health check green         → boot integration test passes
7. Live to users              → per-tier availability check
8. Sunset (optional)          → deprecation window + redirect period
```

A module can be enabled/disabled per environment via feature flags (§9). A disabled module leaves NO trace in the shell UI.

### 3.5 Plugin code layout

```
src/plugins/{slug}/
├── manifest.ts              # THE plugin contract (§4)
├── plugin.json              # metadata + version envelope (read at registry boot)
├── routes/                  # Next.js route handlers
├── components/              # plugin-scoped React (composes Platform Design System only)
├── domain/                  # pure domain logic, no I/O
├── services/                # calls into Layer 3 domain services
├── read/                    # read model builders + queries
├── events/                  # event emitters + listeners
├── ai/                      # AI tools + prompts (registered with dispatcher)
├── search/                  # search provider adapter (registered with universal search)
├── workflows/               # workflow contributions (steps + triggers)
├── flags/                   # plugin-owned feature flags
├── telemetry/               # custom metrics beyond the auto-instrumented baseline
├── notifications/           # notification provider adapter
├── migrations/              # versioned SQL migrations, plugin-scoped
├── tests/                   # plugin-scoped tests
└── README.md                # plugin-scoped docs
```

Any import from `src/plugins/{a}/` inside `src/plugins/{b}/` is REJECTED at build time (ESLint boundary rule). Plugins communicate only via the event bus, the workflow engine, or a public plugin's manifest exports.

---

## 4. The Plugin Contract

**No exceptions.** Every plugin implements this interface. A plugin that cannot implement it cannot join the platform. The contract is designed as though every plugin were an external package — internal plugins get no shortcuts.

### 4.1 The interface (TypeScript source of truth)

```typescript
// src/platform/contracts/PluginContract.ts

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface PluginContract {
  // ─── Metadata ─────────────────────────────────────────────
  /** Unique slug — lowercase, kebab-case, immutable once shipped. */
  id: string;

  /** Human-readable name shown in the shell. Localised per country. */
  name: string;

  /** One-line description shown in Admin plugin catalogue. */
  description: string;

  /** Icon for primary/secondary rail. Lucide only. */
  icon: LucideIcon;

  /** Vendor identity — "trade-center" for internal, or third-party org slug. */
  vendor: string;

  /** Publish channel — determines where the plugin can be installed. */
  channel: "core" | "official" | "verified-partner" | "community";

  // ─── Versioning (Amendment 6) ─────────────────────────────
  /** Plugin semver — bumps for user-facing changes. */
  moduleVersion: string;

  /** API surface version — bumps when the contract's shape changes. */
  apiVersion: string;

  /** Database schema version — bumps for tc_{slug}.* schema changes. */
  schemaVersion: string;

  /** Migration head — the migration id this plugin expects live. */
  migrationVersion: string;

  /** Minimum platform version this plugin runs against. */
  minPlatformVersion: string;

  // ─── Capabilities the plugin needs (Amendment 2) ──────────
  /** Capabilities this plugin requires callers to hold. */
  requiredCapabilities: CapabilityKey[];

  /** Capabilities this plugin declares (that other plugins may check). */
  declaredCapabilities: CapabilityDeclaration[];

  // ─── Dependencies (Amendment 1) ───────────────────────────
  /** Other plugins this plugin depends on. Boot fails if unmet. */
  dependencies: PluginDependency[];

  // ─── Registrations into platform services ─────────────────
  /** Route specs — what URLs this plugin owns. */
  routes: RouteSpec[];

  /** How this plugin appears in primary + secondary navigation. */
  navigation: NavigationEntry;

  /** Actions this plugin contributes to the command palette. */
  commandPalette: CommandAction[];

  /** Search providers — registered with the platform's universal search (Amendment 4). */
  searchProviders?: SearchProvider[];

  /** Notification provider — what notifications this plugin emits + how they render. */
  notificationProvider?: NotificationProvider;

  /** Widgets for the Home dashboard + right panel slots (composed from Platform Design System — Amendment 9). */
  widgets: WidgetSpec[];

  /** Compute the plugin's sidebar state (badges, counts, unread). */
  sidebarState: (ctx: ShellContext) => Promise<SidebarState>;

  /** AI tools this plugin contributes to the platform AI dispatcher (Amendment 3). */
  aiTools: AITool[];

  /** Quick actions — small buttons that appear in specific shell contexts. */
  quickActions: QuickAction[];

  // ─── Event contracts (Amendment 5 — everything emits) ─────
  /** Events this plugin emits. MUST include every state change, not just user-facing ones. */
  eventEmissions: EventSchema[];

  /** Events this plugin subscribes to. */
  eventListeners: EventListener[];

  // ─── Workflow contributions (Amendment 10) ────────────────
  /** Workflows this plugin contributes triggers or steps to. */
  workflows: WorkflowContribution[];

  // ─── Governance ───────────────────────────────────────────
  /** Feature flags this plugin owns (Amendment 7). */
  featureFlags: FeatureFlagDefinition[];

  /** Custom telemetry emitted beyond the auto-instrumented baseline (Amendment 8). */
  telemetry: TelemetryContribution[];

  /** Keyboard shortcuts scoped to this plugin. */
  keyboardShortcuts: Shortcut[];

  /** Empty state specs — what to show when zero data. */
  emptyStates: EmptyStateSpec[];

  /** Availability — which tiers see this plugin. */
  availability: TierAvailability;

  /** Country availability — which countries this plugin runs in. */
  countries: CountryAvailability;

  /** Install hook — runs on registration; creates schema, seeds data. */
  onInstall?: (ctx: PluginInstallContext) => Promise<void>;

  /** Uninstall hook — runs on removal; scoped to plugin data only. */
  onUninstall?: (ctx: PluginInstallContext) => Promise<void>;

  /** Upgrade hook — runs when moduleVersion bumps. */
  onUpgrade?: (ctx: PluginUpgradeContext) => Promise<void>;
}

export interface RouteSpec {
  path: string;                          // "/marketplace/[trade]"
  handler: string;                       // plugin-relative import path
  auth: "public" | "authenticated" | "capability";
  requiredCapabilities?: CapabilityKey[]; // when auth === "capability"
  requiredTiers?: TierKey[];
  ssr: boolean;                          // server-rendered vs client-only
}

// ─── Capability system (Amendment 2) ─────────────────────

/** A capability is a fine-grained permission. Roles compose capabilities. */
export type CapabilityKey = string;      // e.g. "orders.approve_refund"

/** A plugin's capability declaration — surface for other plugins + admin UIs. */
export interface CapabilityDeclaration {
  key: CapabilityKey;                    // "marketplace.buy"
  description: string;                   // human-readable, admin-facing
  scope: "user" | "business" | "platform";
  defaultTiers: TierKey[];               // tiers that get this by default
  defaultRoles: string[];                // role bundles that get this by default
}

/** Plugin dependency — declared plugins that must be installed first. */
export interface PluginDependency {
  pluginId: string;                      // "marketplace"
  minVersion: string;                    // semver constraint
  optional?: boolean;                    // dependency missing degrades gracefully
}

/** Plugin install context — passed to lifecycle hooks. */
export interface PluginInstallContext {
  db: PlatformDbClient;                  // scoped to tc_{plugin.id}.* only
  eventBus: EventBusClient;
  featureFlags: FeatureFlagClient;
  telemetry: TelemetryClient;
  country: string;
}

export interface PluginUpgradeContext extends PluginInstallContext {
  fromVersion: string;
  toVersion: string;
}

// ─── Workflow contribution (Amendment 10) ─────────────────

export interface WorkflowContribution {
  /** Triggers this plugin exposes for workflows to start from. */
  triggers?: Array<{ event: string; description: string }>;

  /** Steps this plugin can execute as part of any workflow. */
  steps?: Array<{
    id: string;                          // "marketplace.enable_selling"
    description: string;
    handler: (input: unknown, ctx: WorkflowContext) => Promise<unknown>;
    idempotent: true;                    // MUST be idempotent
    inputSchema: JSONSchema;
    outputSchema: JSONSchema;
  }>;
}

export interface WorkflowContext {
  correlationId: string;
  actor: EventActor;
  business?: string;
  country: string;
}

// ─── Feature flags (Amendment 7 — plugin-owned) ───────────

export interface FeatureFlagDefinition {
  key: string;                           // "marketplace.compare_drawer"
  description: string;
  default: boolean;
  scope: "user" | "business" | "country" | "global";
  variants?: string[];                   // A/B keys, optional
}

// ─── Telemetry (Amendment 8 — first-class) ────────────────

export interface TelemetryContribution {
  /** Custom metric emitted by this plugin. Auto-baseline metrics are already captured. */
  metric: string;                        // "marketplace.compare.opened"
  kind: "counter" | "gauge" | "histogram";
  description: string;
  labels?: string[];                     // ["country", "tier"]
}

export interface NavigationEntry {
  primaryRail?: {                        // top-level rail slot
    position: number;                    // 1–9
    badgeSource?: () => Promise<number>; // live count
    shortcut?: string;                   // "g m"
  };
  secondaryRail?: {                      // rendered when this module is active
    rows: () => Promise<SecondaryRow[]>;
  };
}

export interface SecondaryRow {
  id: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  badge?: number;
  state?: "unread" | "pinned" | "recent" | "default";
  substate?: string;                     // "3 in basket", "arriving Tue"
}

export interface CommandAction {
  id: string;                            // "marketplace.reorder"
  label: string;                         // "Reorder last month's plaster"
  icon?: LucideIcon;
  shortcut?: string;
  group: "actions" | "products" | "merchants" | "categories" | "recent";
  handler: (ctx: ShellContext, args?: unknown) => Promise<CommandResult>;
  visibility?: (ctx: ShellContext) => boolean;
}

export interface SearchProvider {
  kind: "product" | "merchant" | "content" | "action";
  weight: number;                        // 0–1, contribution to global ranking
  query: (q: string, ctx: ShellContext) => Promise<SearchResult[]>;
}

export interface NotificationProvider {
  emit: (event: DomainEvent) => Promise<Notification[]>;
  render: (notification: Notification) => ReactNode;
  categories: string[];                  // "order.dispatched", "message.received"
}

export interface WidgetSpec {
  id: string;
  slot: "home.today" | "rightPanel" | "homeSecondary";
  render: (ctx: ShellContext) => ReactNode;
  fetch?: (ctx: ShellContext) => Promise<unknown>;
  refreshInterval?: number;              // ms
  order?: number;
}

export interface SidebarState {
  primaryBadge?: number;
  secondaryRows: SecondaryRow[];
  pinnedRows?: SecondaryRow[];
  recentRows?: SecondaryRow[];
}

export interface AITool {
  name: string;                          // "search_products"
  description: string;
  parameters: JSONSchema;
  handler: (args: unknown, ctx: ShellContext) => Promise<unknown>;
  requiredTier?: TierKey;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  slot: "productCard" | "merchantProfile" | "orderRow" | "messageThread" | "custom";
  handler: (ctx: ShellContext, target: unknown) => Promise<void>;
  visibility?: (ctx: ShellContext, target: unknown) => boolean;
}

export interface EventSchema {
  kind: string;                          // "order.dispatched"
  payloadSchema: JSONSchema;
  isPublic: boolean;                     // can other modules subscribe?
}

export interface EventListener {
  kind: string;
  handler: (event: DomainEvent) => Promise<void>;
  retryPolicy?: RetryPolicy;
}

export interface Shortcut {
  keys: string[];                        // ["cmd","k"] or ["g","m"]
  action: string;                        // command palette action id
  scope: "global" | "module" | "route";
}

export interface EmptyStateSpec {
  route: string;                         // pattern
  title: string;
  body: string;
  action?: { label: string; commandId: string };
}

export type TierKey = "free" | "professional" | "enterprise";

export interface TierAvailability {
  free: boolean;
  professional: boolean;
  enterprise: boolean;
  featureGates?: Partial<Record<TierKey, string[]>>;
}

export interface CountryAvailability {
  countries: ("uk" | "ie" | "au" | "us" | string)[];
  fallback: "hidden" | "wait-list" | "read-only";
}

export interface ShellContext {
  user: UserContext | null;
  business: BusinessContext | null;
  country: CountryContext;
  mode: "simple" | "workspace";
  activeModule: string | null;
  theme: "light" | "dark";
  density: "comfortable" | "compact";
}
```

### 4.2 Registration

Every plugin exports a default `PluginContract`:

```typescript
// src/plugins/marketplace/manifest.ts
import type { PluginContract } from "@/platform/contracts/PluginContract";
import { Store } from "lucide-react";

const marketplace: PluginContract = {
  id: "marketplace",
  name: "Marketplace",
  description: "The construction materials + tools marketplace",
  icon: Store,
  vendor: "trade-center",
  channel: "core",

  moduleVersion: "1.0.0",
  apiVersion: "1.0",
  schemaVersion: "1.0",
  migrationVersion: "20260711_000_marketplace_init",
  minPlatformVersion: "1.0.0",

  requiredCapabilities: [],
  declaredCapabilities: [
    { key: "marketplace.buy", description: "Place orders", scope: "user",
      defaultTiers: ["free","professional","enterprise"], defaultRoles: ["user","trade"] },
    { key: "marketplace.sell", description: "List products", scope: "business",
      defaultTiers: ["free","professional","enterprise"], defaultRoles: ["merchant"] }
  ],

  dependencies: [
    { pluginId: "merchants", minVersion: "1.0.0" },
    { pluginId: "reviews",   minVersion: "1.0.0", optional: true }
  ],

  routes: [/* ... */],
  navigation: { primaryRail: { position: 2, shortcut: "g m" } },
  commandPalette: [/* ... */],
  searchProviders: [/* ... */],
  notificationProvider: { /* ... */ },
  widgets: [/* ... */],
  sidebarState: async (ctx) => { /* ... */ },
  aiTools: [/* ... */],
  quickActions: [/* ... */],
  eventEmissions: [/* ... */],
  eventListeners: [/* ... */],
  workflows: [/* ... */],
  featureFlags: [/* ... */],
  telemetry: [/* ... */],
  keyboardShortcuts: [/* ... */],
  emptyStates: [/* ... */],
  availability: { free: true, professional: true, enterprise: true },
  countries: { countries: ["uk","ie","au","us"], fallback: "wait-list" }
};

export default marketplace;
```

The platform boot loader auto-discovers all `src/plugins/*/manifest.ts` files. No manual wiring. **Adding a new plugin = adding a new folder.**

### 4.3 Validation

At boot the platform validates every manifest:

- All required fields present
- `id` matches folder name; `id` matches `plugin.json` metadata envelope
- `moduleVersion` valid semver
- `apiVersion` supported by current platform
- `schemaVersion` present + migration reachable
- `migrationVersion` matches migrations directory head
- `minPlatformVersion` <= runtime platform version
- `dependencies[*]` resolve — dependent plugin installed at compatible version (or optional + degradation defined)
- `routes[*].path` don't collide across plugins
- `declaredCapabilities[*].key` unique across platform
- `requiredCapabilities[*]` refer to real declared capabilities
- `eventEmissions[*].kind` unique across platform (namespaced by plugin)
- `eventEmissions[*].version` present
- Every `eventListeners[*].kind` refers to a real emitter somewhere (or optional)
- `workflows[*].steps[*].idempotent` === `true` (compile-time literal check)
- `featureFlags[*].key` uses `{pluginId}.*` namespace
- `availability.free` false requires an upgrade path for Free users hitting the plugin's routes
- `countries.countries` non-empty
- No import from `../{other-plugin}/` (ESLint boundary rule)

Validation failures = build failure. A malformed manifest cannot ship.

### 4.4 Plugin install command

External plugins install via CLI:

```
$ trade-center install ./fleet-management-plugin
✓ manifest valid
✓ dependencies met (merchants@1.2.0, users@1.0.0)
✓ migrations applied (tc_fleet_management.*)
✓ capabilities declared: fleet.dispatch, fleet.track, fleet.manage
✓ registered with plugin registry
✓ boot integration test passed
Plugin fleet-management@1.0.0 installed.
```

Internal plugins go through the same command. **No shortcuts for internal.**

---

## 5. Event Architecture

### 5.1 Everything emits (Amendment 5)

**No state change happens silently.** Every mutation — user-facing or not — emits a domain event. This is not "nice-to-have observability"; it's the substrate for every downstream capability.

Emissions include (not exhaustive):

- User creates a saved list → `saved.list_created`
- User changes theme → `preferences.theme_changed`
- User marks a message read → `messages.read_advanced`
- User pins a merchant → `shell.merchant_pinned`
- Notification delivered → `notifications.delivered`
- Feature flag toggled → `flags.evaluated`
- Command palette action fired → `shell.command_executed`
- Search performed → `search.executed`
- AI tool called → `ai.tool_invoked`
- Preference persisted → `preferences.updated`

Analytics, audit, workflows, ML — **all downstream of events**. If a change doesn't emit, it doesn't exist for the platform.

### 5.2 Communication rules

- Cross-plugin coupling is via events. Not shared imports. Not shared DB reads.
- The event bus is the seam between Layer 2 (plugins) and Layer 3 (domain services).
- The workflow engine (§9) coordinates multi-plugin flows via events.

### 5.2 Event envelope

```typescript
interface DomainEvent {
  id: string;                     // UUID
  kind: string;                   // "order.dispatched"
  version: number;                // schema version, incremented on breaking changes
  actor: {
    kind: "user" | "system" | "merchant" | "admin";
    slug: string | null;
  };
  aggregate: {
    kind: string;                 // "order"
    id: string;
  };
  payload: unknown;               // schema-validated per event.kind
  occurredAt: string;             // ISO timestamp
  causationId?: string;           // id of event that caused this one
  correlationId?: string;         // groups events in a workflow
  metadata: {
    country: string;
    business?: string;
  };
}
```

### 5.3 Canonical events (v1)

Every module publishes lifecycle events. Sample list — not exhaustive:

```
merchant.verified
merchant.trust_score_changed
merchant.tier_changed
merchant.suspended

product.published
product.updated
product.archived
product.price_changed
product.stock_changed

order.placed
order.accepted
order.dispatched
order.delivered
order.cancelled
order.refunded

message.sent
message.read
thread.opened

quote.drafted
quote.sent
quote.viewed
quote.accepted
quote.declined
quote.converted_to_order

review.submitted
review.published
review.responded
review.disputed
review.moderated

saved_list.created
saved_list.item_added
saved_list.shared

canteen.member_joined
canteen.post_created
canteen.post_promoted

ai.estimate_completed
ai.recommendation_shown

delivery.dispatched
delivery.delayed
delivery.arrived

user.signed_up
user.tier_upgraded
user.country_switched

supplier.followed
supplier.unfollowed
```

Every event kind is registered by its owning module. Cross-module subscription is by kind, not by module.

### 5.4 Delivery guarantees

- **At-least-once delivery.** Handlers MUST be idempotent.
- **Ordering guarantees per aggregate.** Events for `order:{id}` arrive in causal order to any single subscriber.
- **No global ordering across aggregates** (would kill throughput).
- **Dead-letter queue** for handlers that fail 5x with exponential backoff — routed to `tc_shell.event_dlq` and a Slack alert.

### 5.5 Bus topology

Two channels working together:

- **Real-time channel** (Postgres LISTEN/NOTIFY → SSE to browser + WebSocket for services)
  - Low latency (< 50ms)
  - Fire-and-forget
  - For UI updates (order status, new message, notification)
- **Durable log** (`tc_shell.events` table)
  - Every event stored
  - Append-only
  - Enables event replay + read-model rebuild + audit
  - Long-term retention per compliance (24 months default)

Handlers subscribe via a manifest listener; the platform routes.

### 5.6 Sagas (cross-module workflows)

Multi-step workflows that span modules use the saga pattern:

```
1. Marketplace: user clicks "Book delivery" on a job list
2. Orders: creates order in pending → emits order.placed
3. Payments: listens for order.placed → creates Stripe Checkout Session → emits payment.session_created
4. Delivery: listens for payment.completed → schedules delivery window
5. Merchant Notifications: listens for order.placed → notifies merchant
6. Analytics: listens for order.placed → increments metrics
7. Notifications: listens for order.dispatched → notifies buyer
```

Each step is a handler. Each handler is idempotent. Failure of one handler does not block others. Correlation ID ties all steps for observability.

### 5.7 Rejected patterns

- ❌ Module A directly reads Module B's tables
- ❌ Module A imports Module B's code
- ❌ Synchronous cross-module HTTP calls for coupling ("Marketplace calls Orders' API to check something")
- ❌ Shared "utils" package that both modules mutate
- ❌ Events without a version number
- ❌ Handlers that assume ordering across aggregates
- ❌ Events emitted after DB commit failure ("optimistic emit")

---

## 6. Capabilities & Policies (Amendment 2)

Roles are difficult to maintain as the platform grows. **The platform models access as fine-grained capabilities, composed into named roles.**

### 6.1 Model

```
Capability   →  atomic permission (e.g. "orders.approve_refund")
Role         →  a named bundle of capabilities (e.g. "merchant_manager")
Policy       →  a rule that grants capabilities to actors in a scope
Scope        →  "user" | "business" | "platform"
```

### 6.2 Examples

**Capabilities:**
```
orders.create
orders.approve_refund
inventory.manage
users.invite
analytics.view
ai.access_enterprise_models
merchants.verify
marketplace.buy
marketplace.sell
messages.moderate
saved.share
canteen.moderate
business.manage_billing
business.manage_team
platform.admin
```

**Roles (composed):**
```yaml
user:
  capabilities: [marketplace.buy, saved.share, messages.send]
trade:
  extends: user
  capabilities: [reviews.write, canteen.post]
merchant:
  extends: trade
  capabilities: [marketplace.sell, inventory.manage, orders.approve_refund]
business_admin:
  extends: merchant
  capabilities: [users.invite, analytics.view, business.manage_team, business.manage_billing]
admin:
  capabilities: [platform.admin, merchants.verify, canteen.moderate, messages.moderate]
```

### 6.3 Runtime check

```typescript
if (!ctx.can("orders.approve_refund", { businessSlug })) {
  return forbidden();
}
```

Checked at three layers:
- Shell — rail slot / widget hidden if capability missing
- Route — 401/403 on access
- API — capability re-checked server-side on every mutating endpoint

### 6.4 Enterprise composition

Enterprise's team management becomes trivial: an Enterprise admin composes custom roles from the platform's capability inventory. No code change to add a new role. This is what makes Enterprise licensable — capabilities are the product.

### 6.5 Schema

```sql
CREATE SCHEMA tc_policy;

CREATE TABLE tc_policy.capabilities (
  key            text PRIMARY KEY,
  description    text NOT NULL,
  scope          text NOT NULL CHECK (scope IN ('user','business','platform')),
  declared_by    text NOT NULL,             -- plugin id
  declared_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tc_policy.roles (
  key            text PRIMARY KEY,          -- "merchant_manager"
  business_slug  text,                      -- NULL = platform-wide role
  display_name   text NOT NULL,
  description    text,
  extends        text[]                     -- role keys this extends
);

CREATE TABLE tc_policy.role_capabilities (
  role_key       text NOT NULL REFERENCES tc_policy.roles(key) ON DELETE CASCADE,
  capability_key text NOT NULL REFERENCES tc_policy.capabilities(key) ON DELETE CASCADE,
  PRIMARY KEY (role_key, capability_key)
);

CREATE TABLE tc_policy.user_roles (
  user_slug      text NOT NULL,
  business_slug  text,                      -- NULL = platform role
  role_key       text NOT NULL,
  granted_at     timestamptz NOT NULL DEFAULT now(),
  granted_by     text NOT NULL,
  PRIMARY KEY (user_slug, business_slug, role_key)
);
```

Capability inventory is live — plugins declare on install (`declaredCapabilities` in the manifest); admin UI reads from `tc_policy.capabilities` to build role composers.

---

## 7. AI Platform Service (Amendment 3)

**AI belongs to the platform, not to any plugin.** No plugin owns the copilot. No plugin owns the model routing. Plugins register **tools**; the platform's AI dispatcher discovers and calls them.

### 7.1 Architecture

```
User asks the copilot
    ↓
Shell forwards to Platform AI Dispatcher (/api/ai/dispatch)
    ↓
Dispatcher classifies intent + selects model per §19.5 of spec
    ↓
Dispatcher discovers registered tools across all installed plugins
    ↓
Model may call tools; each tool call is a registered plugin function
    ↓
Streaming response to shell → renders in right panel copilot
```

### 7.2 Tool registration

Every plugin's manifest lists `aiTools`. On boot, the dispatcher indexes them. Example:

```
Marketplace registers: compare_products, find_alternatives, explain_specification, search_products
Orders registers:      track_delivery, cancel_order, return_item
Projects registers:    estimate_materials, generate_quote, schedule_labour
Messages registers:    search_threads, send_message
Estimator registers:   calculate_area, calculate_volume, estimate_project
```

The dispatcher exposes all tools to the model via the standard tool-use interface. **A new plugin's tools are available to the copilot the moment it installs.** No changes to the copilot code.

### 7.3 The AI dispatcher endpoint

`POST /api/ai/dispatch` — single entrypoint for every AI call platform-wide.

Responsibilities:
- Cost routing (Haiku vs Opus vs Whisper) per §19.5 of spec
- Per-user quota enforcement (tier-scoped)
- Per-business quota enforcement (Enterprise)
- Tool discovery + call dispatch
- Conversation persistence in `tc_ai.conversations`
- Streaming response (SSE)
- Telemetry emission (`ai.tool_invoked`, `ai.completion`)

### 7.4 Why this makes AI infinitely expandable

Fleet Management installs → registers `dispatch_driver`, `find_nearest_van`, `schedule_maintenance`. Copilot immediately has these capabilities. No copilot code change. **The AI grows as the platform grows.**

---

## 8. Universal Search (Amendment 4)

**Search does not search products. Search searches everything.**

Spotlight-class. Windows Search-class. The universal search bar is the single query surface for the entire platform.

### 8.1 What's searchable

Every plugin can register any number of `SearchProvider`s:

- Products
- Merchants
- Messages
- Orders
- Projects
- Files (attachments across messages, quotes, estimates)
- Knowledge base articles
- Users (trades directory)
- Commands (⌘K actions)
- Plugins (Admin can search installed plugins)
- Documentation
- Saved lists
- Recent activity
- AI conversations
- Notifications
- Reviews
- Canteens

### 8.2 Provider registration

```typescript
interface SearchProvider {
  kind: string;                          // "product" | "merchant" | ...
  displayLabel: string;                  // "Products"
  displayLabelPluralised: string;        // "Products"
  weight: number;                        // 0–1, base ranking contribution
  query: (q: string, ctx: ShellContext) => Promise<SearchResult[]>;
  supportsSemanticSearch: boolean;       // uses pgvector if true
  supportsFuzzy: boolean;
  requiredCapability?: CapabilityKey;    // hide from results if caller lacks capability
  icon: LucideIcon;
}
```

Plugins register providers in `manifest.searchProviders[]`. Universal search dispatches to every registered provider in parallel + reranks results by intent + weight + freshness.

### 8.3 Result rendering

Global search grouping:
```
Actions      (from command palette — always first)
Products     (from Marketplace)
Merchants    (from Merchant plugin)
Messages     (from Messaging)
Orders       (from Orders)
Projects     (from Projects)
Documentation (from Knowledge)
Files        (from cross-plugin file registry)
Recent       (from tc_shell.recent)
Ask AI       (always last — hands off to copilot if no match)
```

Group order is configurable per-user via preferences. Empty groups hidden.

### 8.4 Backend

Behind universal search sits the search infrastructure per spec §9:
- Layer 1: `pg_trgm` + `tsvector` (keyword)
- Layer 2: `pgvector` (semantic)
- Layer 3: intent router (Haiku)

Each plugin's provider decides its own layer usage. Marketplace uses all three. Command actions use only keyword. Knowledge uses semantic.

### 8.5 Voice + image

Universal search accepts:
- Text (default)
- Voice (microphone → Whisper → text)
- Image (upload → CLIP → semantic search)

Any provider that opts in via `supportsSemanticSearch: true` can be queried by image.

---

## 9. Workflow Engine (Amendment 10)

**No plugin hardcodes a multi-step workflow.** The workflow engine runs orchestrations based on events. Plugins contribute triggers + steps.

### 9.1 Example — merchant verification

```yaml
workflow: merchant.verified
trigger: event(merchant.verification_completed)
steps:
  - id: send_welcome_email
    plugin: notifications
    input: { template: "merchant_welcome", to: "{merchant.email}" }
  - id: enable_marketplace_selling
    plugin: marketplace
    input: { merchant: "{merchant.slug}", capability: "marketplace.sell" }
  - id: unlock_ai_tier
    plugin: ai
    input: { merchant: "{merchant.slug}", tier: "professional" }
  - id: create_merchant_dashboard
    plugin: business
    input: { merchant: "{merchant.slug}" }
  - id: notify_admin
    plugin: notifications
    input: { channel: "admin_ops", message: "New merchant verified: {merchant.name}" }
  - id: index_search
    plugin: search
    input: { entity: "merchant", id: "{merchant.slug}" }
  - id: generate_merchant_profile
    plugin: studio
    input: { merchant: "{merchant.slug}", template: "starter" }
```

### 9.2 Design principles

- **Workflows are declarative** — YAML or JSON, stored in `tc_workflow.definitions`
- **Steps are contributed by plugins** — plugins expose steps via `manifest.workflows[]`
- **Every step is idempotent** — enforced by contract (`idempotent: true` literal)
- **Steps have retry policies** — configurable per step, defaults to exponential backoff
- **Correlation ID** flows through every step for observability
- **Compensating steps** — workflows can define rollback actions on failure
- **Human tasks** — workflows can pause for human input (approval, review) via the shell's task inbox

### 9.3 Runtime

```
1. Event fires on the event bus
2. Workflow engine matches event to workflow definitions
3. Workflow instance created in tc_workflow.instances
4. Steps executed in sequence (or in parallel where declared)
5. Each step call fires a plugin's registered handler
6. Handler results persisted; state machine advances
7. On failure: retry per policy → compensating step → dead-letter
8. On success: workflow.completed event emitted
```

### 9.4 Why this matters

Today Trade Center has ~5 lifecycle workflows. In three years it will have 500. Hardcoded workflows would drown us. **Declarative orchestration means the platform can automate any process without a code change.** Adding a new plugin doesn't just add features — it adds workflow contributions the engine can compose with existing steps.

### 9.5 Schema

```sql
CREATE SCHEMA tc_workflow;

CREATE TABLE tc_workflow.definitions (
  id                  text PRIMARY KEY,      -- "merchant.verified"
  version             text NOT NULL,
  trigger_event       text NOT NULL,         -- "merchant.verification_completed"
  definition          jsonb NOT NULL,        -- the YAML/JSON step chain
  authored_by         text NOT NULL,         -- plugin id
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tc_workflow.instances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id       text NOT NULL REFERENCES tc_workflow.definitions(id),
  correlation_id      uuid NOT NULL,
  state               text NOT NULL CHECK (state IN ('running','completed','failed','compensating')),
  current_step        text,
  context             jsonb NOT NULL,
  started_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);

CREATE TABLE tc_workflow.step_executions (
  id                  bigserial PRIMARY KEY,
  instance_id         uuid NOT NULL REFERENCES tc_workflow.instances(id) ON DELETE CASCADE,
  step_id             text NOT NULL,
  plugin_id           text NOT NULL,
  status              text NOT NULL CHECK (status IN ('pending','running','succeeded','failed','skipped')),
  attempts            int NOT NULL DEFAULT 0,
  input               jsonb,
  output              jsonb,
  error               jsonb,
  started_at          timestamptz,
  completed_at        timestamptz
);
```

---

## 10. Platform Design System (Amendment 9)

**No plugin owns UI primitives.** Buttons, cards, tables, lists, dialogs, panels, charts, forms — all live in the Platform Design System. Plugins compose these; plugins never build primitives.

### 10.1 What the PDS ships

- `<Button>` in every variant (primary, secondary, ghost, danger, link)
- `<Card>` with subcomponents (Header, Body, Footer, Actions)
- `<Table>` with sort, pagination, selection, virtualization
- `<List>` (compact, comfortable, actionable)
- `<Dialog>` / `<Sheet>` / `<Drawer>` / `<Popover>`
- `<Panel>` (right-panel slot renderer)
- `<Chart>` (line, bar, area, sparkline)
- `<Form>` with fields (`<TextField>`, `<Select>`, `<Checkbox>`, `<RadioGroup>`, `<DatePicker>`, `<FileUpload>`)
- `<StatTile>` / `<Chip>` / `<Badge>` / `<Avatar>` / `<Toast>`
- `<EmptyState>` (the teaching moment)
- `<StatusIndicator>` (unread, live, pinned, warning)
- `<TrustScore>` (renders the merchant trust composite)
- `<PriceBlock>` (retail / trade / bulk / business tiers)
- `<CommandRow>` (used in ⌘K + list contexts)
- `<CopilotBubble>` (streaming AI responses)
- Layout primitives: `<Stack>`, `<Row>`, `<Grid>`, `<Spacer>`, `<Divider>`

### 10.2 Composition rules

- Plugins **compose** PDS components — never fork them
- Plugin-specific styling MUST use design tokens; no raw hex, no custom fonts
- Custom PDS components require an amendment to this doc + a design review
- The PDS is versioned separately from plugins; PDS releases go through their own semver

### 10.3 Location

`src/platform/design-system/*` — imported by every plugin. Boundary rule: plugin components MAY import from `platform/design-system`. Plugin components MAY NOT define their own primitive shapes (button, card, dialog).

### 10.4 Why

Consistency = brand-from-layout (§13). If plugins own their own UI, Trade Center dissolves into a bag of Shopify themes. **The PDS is what makes Trade Center recognisable when the logo is removed.**

---

## 11. Telemetry & Observability (Amendment 8)

**Every plugin ships instrumented on day one.** No analytics is bolted on later.

### 11.1 The auto-instrumented baseline

Every plugin, on install, automatically emits:

| Metric | Kind | Labels |
|---|---|---|
| `plugin.request.count` | counter | plugin, route, status |
| `plugin.request.duration_ms` | histogram | plugin, route |
| `plugin.error.count` | counter | plugin, kind, severity |
| `plugin.usage.active_users` | gauge | plugin, tier, country |
| `plugin.event.emitted` | counter | plugin, kind |
| `plugin.event.handled` | counter | plugin, kind |
| `plugin.command.executed` | counter | plugin, command_id |
| `plugin.ai.tool_invoked` | counter | plugin, tool_name |
| `plugin.search.queried` | counter | plugin, provider_kind |
| `plugin.navigation.route` | counter | plugin, route |
| `plugin.workflow.step` | counter | plugin, step_id, status |
| `plugin.flag.evaluated` | counter | plugin, flag_key, variant |

Plugins get all of the above without writing a line of instrumentation code. It's part of the shell's wrapping of the plugin runtime.

### 11.2 Custom telemetry

Plugins may declare custom metrics in their manifest (`telemetry` field). Example:

```typescript
telemetry: [
  { metric: "marketplace.compare.opened", kind: "counter", description: "Compare drawer opens" },
  { metric: "marketplace.trade_price.shown", kind: "counter", description: "Trade price surfaced" }
]
```

Emitted via the `TelemetryClient` in `PluginInstallContext`.

### 11.3 Where it goes

- **Metrics**: emitted to a metrics pipeline (Vercel Analytics + Grafana or equivalent)
- **Events for analytics**: emitted to `tc_shell.events` (durable log) — every domain event is analytics-ready
- **Errors**: forwarded to Sentry with plugin + user + correlation ID
- **Traces**: OpenTelemetry, correlation ID across shell → plugin → domain service → DB
- **Custom dashboards**: per-plugin, per-module, per-country, per-tier

### 11.4 The rule

If a plugin does not emit an event on state change, or does not surface an error via the telemetry client, **it will not pass the boot validation test.** Telemetry is not optional.

---

## 12. Feature Flags Governance (Amendment 7)

**Feature flags belong to plugins, not to the shell.** The shell reads flags; plugins own them.

### 12.1 Ownership

- Every flag is declared in a plugin's manifest (`featureFlags[]`)
- Flag keys are namespaced: `{pluginId}.{feature}` (e.g. `marketplace.compare_drawer`)
- Flag definitions include default value + scope + optional variants
- Flags are stored in `tc_shell.feature_flags`
- Rollout rules (percent, allowlist, tier, country) applied by the platform Feature Flag Enforcer

### 12.2 No global flags by default

Cross-plugin flags are RARE and require an amendment. A shared "dark_mode" flag isn't a plugin concern — it's a user preference. A shared "beta_universal_search" flag isn't a plugin flag — it's a platform flag owned by the shell itself (in the `shell.*` namespace).

### 12.3 Evaluation

```typescript
if (await flags.isEnabled("marketplace.compare_drawer", { user, country, tier })) {
  // render compare drawer
}
```

Every evaluation emits `flags.evaluated` (per §5.1) for analytics.

### 12.4 Kill switch

Every flag can be killed instantly from the Admin console. Kill-switch changes propagate via edge cache invalidation in < 30 seconds.

---

## 13. Layer 3 — Domain Services

### 6.1 What is a domain service?

A domain service owns a **bounded context** — a slice of the business world with its own vocabulary, rules, and data.

| Service | Bounded context | Schema |
|---|---|---|
| Products | Product catalogue, variants, specs | `tc_marketplace` |
| Merchants | Merchant identity, verification, storefront | `tc_merchants` |
| Users | User identity, session, roles | `tc_users` |
| Orders | Order lifecycle | `tc_orders` |
| Inventory | Stock levels, availability | `tc_inventory` |
| Payments | Stripe integration, invoices | `tc_payments` |
| Delivery | Delivery zones, tracking | `tc_delivery` |
| Verification | Trust score computation, external checks | `tc_verification` |
| Messaging | Threads, messages | `tc_messages` |
| Search | Search index, embeddings, synonyms | `tc_search` |
| Analytics | Events, sessions, metrics | `tc_analytics` |
| Identity | Auth, sessions, 2FA | `tc_identity` |
| AI | Conversations, tool calls, usage | `tc_ai` |
| Media | Unified media objects | `tc_media` |

### 6.2 Rules

- Each service owns its schema. **No other service reads it directly.**
- Each service exposes:
  - A public read API (for queries other modules need)
  - Events (for cross-service coupling)
  - Migrations (versioned)
- Each service is **individually deployable** — the architecture must allow extraction to a dedicated service without touching consumers.
- Each service has its own test suite that runs in isolation.

### 6.3 CQRS-lite

- **Write side**: validated commands → domain logic → events emitted → transactional DB write
- **Read side**: pre-computed read models updated by event handlers; queries never join across 5 tables at request-time

Read models can be denormalized freely. Search index, sidebar state, home dashboard all read from read models built by event handlers.

### 6.4 Extraction path

When one service outgrows its home:

```
1. Move src/modules/{service} into its own package
2. Point its DB to a dedicated Postgres cluster
3. Rehost as a standalone HTTP service
4. Registry entry updates to point at the new host
5. Consumers don't change — event bus + public API unchanged
```

Postgres schemas mean `pg_dump --schema=tc_marketplace` gives you a portable extract on day one.

---

## 14. Layer 4 — Infrastructure

### 7.1 Primitives

| Primitive | Technology | Notes |
|---|---|---|
| API Gateway | Next.js API routes + edge middleware | Auth check + country detection in edge |
| Authentication | HMAC-signed session cookie (existing `xrated_trade_session`) | Extended with role claims + 2FA |
| Caching | Redis / Vercel KV | Hot reads: sidebar state, palette results, search |
| Storage | Supabase Storage | Existing `network-uploads` bucket + module-scoped buckets |
| Queues | Postgres queue (start) → BullMQ (scale) | Long-running jobs, delivery scheduling |
| Search Engine | Postgres + `pg_trgm` + `tsvector` + pgvector | Three-layer stack per spec §9 |
| AI Dispatcher | `/api/ai/dispatch` | Cost router per spec §19.5 |
| Image Processing | Supabase Image Transform | Edge cached |
| Email | Resend | Transactional + notifications |
| Push Notifications | Web Push API | Per-user subscriptions in `tc_notifications` |
| Logging | Structured JSON → Vercel + Sentry | Correlation ID follows requests |
| Monitoring | Sentry + Vercel Analytics + custom dashboards | SLO alerts on every module |
| Feature Flags | `tc_shell.feature_flags` + edge cache | Percent rollout + user allowlist |
| Audit Log | `tc_admin.audit_log` | Every admin action + PII access |

### 7.2 Infrastructure contracts

Every module accesses infrastructure through typed contracts (not raw SDKs):

```typescript
interface CacheClient      { get, set, invalidate, tags }
interface QueueClient      { enqueue, schedule, cancel }
interface StorageClient    { upload, delete, sign, list }
interface EmailClient      { send, template }
interface PushClient       { subscribe, send, unsubscribe }
interface FeatureFlagClient { isEnabled, variant, allValues }
interface AuditClient      { record }
```

Contracts hide the underlying provider. Replacing Resend with SES = one adapter change, zero module changes.

### 7.3 Country + tenancy at the edge

Edge middleware injects into every request:

- `country` — from domain (tradecenter.co.uk → `uk`)
- `currency` — from country
- `locale` — from country + Accept-Language
- `taxRegion` — from country
- `user` — from cookie
- `business` — from Company Switcher choice

Domain services never guess these; they're contract inputs.

---

## 15. Layer 5 — Presentation

### 8.1 Devices

Same shell + modules render across:

- **Desktop** (browser, primary)
- **Tablet** (browser, primary — trades on iPads on job sites)
- **Mobile** (browser + PWA)
- **PWA** (installable, offline-capable)
- **Native mobile app** (later — Capacitor or React Native wrapper of the same code)
- **Native desktop app** (later — Tauri or Electron wrapper)

### 8.2 Adaptation rules

Modules never fork by device. They:

1. Use responsive tokens (density, spacing)
2. Query a `useViewport()` hook for major breakpoints (mobile/tablet/desktop)
3. Render device-specific layouts only through named adapters (`MobileProductCard` vs `DesktopProductCard`) that share the same data hooks

The shell handles device-specific chrome (bottom tab bar vs sidebar). Modules see only the same slot API.

### 8.3 Offline story

- Shell + last 50 items cached by Service Worker
- Module manifests declare offline-friendly routes
- Drafts (quotes, estimates, messages) persist to IndexedDB
- Sync banner on reconnect shows pending queue
- Modules that require live data (search, checkout) show "reconnect" state

---

## 16. Cross-Cutting Concerns

### 9.1 Permissions

- Declared in `ModuleContract.permissions[]`
- Enforced at three layers:
  1. **Shell** — rail slot hidden if user lacks permission
  2. **Route** — 401/403 on access
  3. **API** — permission checked on every mutating endpoint
- Roles: `guest`, `user`, `trade`, `merchant`, `business_admin`, `admin`
- Tier gates: `free`, `professional`, `enterprise`

### 9.2 Notifications

- Every module registers a `NotificationProvider`
- Notifications land in `tc_notifications.notifications` + fire real-time SSE
- User preferences per channel per category (`tc_notifications.preferences`)
- Delivery channels: in-app, email, push, WhatsApp (future)
- Shell owns rendering; modules own content

### 9.3 Internationalisation

- Country-first (domain-detected)
- Language second (Accept-Language + user preference)
- Every user-facing string in module code goes through `t("key")` — no hardcoded strings
- Currency + date + number formatted via `Intl.*` scoped to country
- Verification bodies country-specific (Gas Safe UK, Master Plumbers AU, etc.)
- Trade taxonomy country-specific (Plasterer UK ≠ Drywaller US — different tools + terminology)

### 9.4 Multi-tenancy (Company Switcher)

- User may belong to multiple businesses (freelancer working for two companies)
- Shell has a Company Switcher in the top bar
- Active business scopes: dashboards, orders, quotes, invoices, team
- Personal scope: saved lists, canteen memberships, messages
- Enforced at API layer via `business_slug` claim on every write

### 9.5 Feature flags

- Every module can be flagged on/off
- Sub-features within a module can be flagged
- Rollouts by percent, allowlist, tier, country
- Cached at edge (5s TTL)
- Kill switch in Admin console

### 9.6 Observability

Every module ships:

- Structured logs (correlation ID, module, actor)
- Metrics (request rate, error rate, latency, event-processing lag)
- Traces (request → module → domain service → DB)
- Custom dashboards per module
- SLO alerts on TTFB, error rate, event backlog

### 9.7 Audit

Every admin action, every PII access, every permission override → `tc_admin.audit_log`. Immutable append-only. 7-year retention.

### 9.8 Testing

Every module has:

- Unit tests (domain logic)
- Integration tests (against a test DB with the module's schema)
- Contract tests (manifest validates)
- E2E smoke tests (routes render, palette actions fire)

Cross-module integration tests live in `tests/integration/` and use event bus mocks.

---

## 17. Workspace State — What Shell Owns

The shell owns state that spans modules:

- **Current module** (which one is active)
- **Sidebar collapsed** (persisted per device)
- **Right panel slot** (which panel is open, if any)
- **Command palette open** (transient)
- **Pinned items** (`tc_shell.pinned`)
- **Recent activity** (`tc_shell.recent`)
- **Notifications** (list, unread count, preferences)
- **Workspace mode** (Simple / Workspace, per spec §21)
- **Theme** (light / dark, per user preference)
- **Density** (comfortable / compact)
- **Keyboard shortcuts** (registered globally by modules)
- **User + business + country context** (auth-resolved)

Everything else belongs to modules. The shell never touches order data, product data, message data, or any domain concern.

**Sharp line: if you're not sure whether a state belongs to shell or module, it belongs to the module.**

---

## 18. Extension Model — Adding Plugin 51

The architecture must accept plugin 51 (Fleet Management, say) without shell rework.

Steps to add a new plugin:

```
1. Create src/plugins/fleet-management/ folder
2. Write manifest.ts implementing PluginContract (with version envelope)
3. Declare capabilities: fleet.dispatch, fleet.track, fleet.manage
4. Write migrations for tc_fleet_management.* schema
5. Register with plugin registry (auto-discovered)
6. Wire event listeners (subscribe to relevant emissions)
7. Contribute AI tools (dispatched by the platform AI service)
8. Contribute search providers (dispatched by universal search)
9. Contribute workflow steps (executed by the workflow engine)
10. Register widgets for home dashboard (composed from Platform Design System)
11. Declare feature flags (fleet-management-namespaced)
12. Declare telemetry contributions (beyond auto-baseline)
13. Register keyboard shortcuts
14. Write plugin tests
15. Pass Trade Center Design Principles gate (10 questions)
16. Run `trade-center install ./fleet-management`
17. Pass Platform Validation Test (§21)
18. Enable via feature flag
19. Rollout by tier / country / percent
```

**No shell code changes. No layer boundaries changed. No other plugin notified.** If a change to the shell is required to add a plugin, the shell was under-specified — file an amendment to this doc first.

---

## 19. Anti-Patterns (Rejected Architecture)

These are FORBIDDEN. PRs violating any of these are closed.

- **Plugin A imports from Plugin B** — cross-plugin imports outside a public manifest export are ejected by ESLint boundary rule
- **Cross-plugin DB reads** — Plugin A queries Plugin B's tables directly
- **Sync HTTP for cross-plugin coupling** — one plugin calls another's REST endpoint for a state check
- **Shared mutable state package** — a "utils" package both plugins mutate
- **Shell rewrites for plugin features** — a plugin needs a shell change to launch (means the manifest is insufficient)
- **Silent state changes** — any mutation that doesn't emit an event (Amendment 5). No exceptions, even for preferences and themes.
- **Country hardcoding** — `if country === "uk"` in plugin code
- **Currency hardcoding** — `£` in plugin code (`t("currency.symbol")` instead)
- **Business logic in shell** — shell knows a domain rule ("if reviews < 5 don't show trust score" — belongs in Verification service)
- **Events without version** — every event kind carries a `version` field
- **Handlers that assume ordering across aggregates** — only same-aggregate order is guaranteed
- **Shell renders inside a plugin** — plugins render inside the shell, never the reverse
- **Plugin owns UI primitives** — buttons/cards/dialogs/tables are the Platform Design System's; plugins compose them (Amendment 9)
- **Plugin owns AI dispatcher** — plugins contribute tools; the platform dispatches (Amendment 3)
- **Plugin owns search backend** — plugins contribute providers; universal search orchestrates (Amendment 4)
- **Plugin hardcodes cross-plugin workflow** — plugins contribute steps; the workflow engine orchestrates (Amendment 10)
- **Global feature flags by default** — flags are plugin-scoped; global flags require an amendment (Amendment 7)
- **Bolt-on analytics** — every plugin auto-instruments on install; retrofitting is not allowed (Amendment 8)
- **Role-based access checks** — checks are capability-based; roles are compositions (Amendment 2)
- **Uncomposable roles** — Enterprise's differentiation is composable roles; hardcoded role bundles kill it
- **Emitting events after uncommitted work** — always emit *after* transaction commit, or use outbox pattern
- **Bypassing feature flags for "just this once"** — if it's flagged, it's flagged
- **Studio ↔ Trade Center bleed** — they remain permanently separate apps per spec §19.6
- **Rebuilding the shell** — the shell is stable; extending is fine, restructuring is not
- **Internal-plugin shortcuts** — internal plugins go through the same install command + validation as external plugins (Amendment 1)

---

## 20. Design Rule — The Shell Is Immortal

The shell must never be rebuilt.

**Users build muscle memory around the shell.** Windows, macOS, Figma, VS Code, Slack, Notion — none of them rebuild their shell. They extend it. Their brand *is* the shell.

Modules can change forever. They can be added, removed, replaced, sunset. But the primary rail, command palette, top bar, sidebar contract, event bus, and module contract — these are permanent.

Every change to the shell requires an amendment to this doc + a 4-week deprecation window + a migration plan for every module that depends on the changed surface.

---

## 21. Roadmap — Week 0 Added (with Platform Validation Test)

Philip's directive: architecture must be locked before implementation.

### Week 0 — Architecture Lock

- Approve `TRADE_CENTER_2_SPEC.md` (canonical spec)
- Approve `TRADE_CENTER_DESIGN_PRINCIPLES.md` (constitution)
- Approve `TRADE_CENTER_PLATFORM_ARCHITECTURE.md` (this doc, v1.1 with amendments)
- Scaffold `src/platform/contracts/PluginContract.ts` and its supporting types
- Scaffold `src/platform/registry/` — plugin discovery + boot loader + version compatibility
- Scaffold `src/platform/eventBus/` — Postgres NOTIFY + durable log; emit-on-every-mutation enforcement
- Scaffold `src/platform/policy/` — capability system + role composition + runtime `can()` check
- Scaffold `src/platform/ai-dispatcher/` — model routing, tool discovery, quota enforcement
- Scaffold `src/platform/search/` — universal search orchestrator + provider registry
- Scaffold `src/platform/workflow/` — engine + definition loader + step dispatcher
- Scaffold `src/platform/design-system/` — PDS primitives + composition rules
- Scaffold `src/platform/telemetry/` — auto-instrumentation wrapper + custom metric emitter
- Scaffold `src/platform/flags/` — plugin-owned flag registry + edge-cached evaluator
- Scaffold `src/platform/install-cli/` — `trade-center install` command
- Ship migrations:
  - `tc_shell.*` (events, registry, pinned, recent, preferences, feature_flags)
  - `tc_users.*` (identity + roles)
  - `tc_policy.*` (capabilities, roles, role_capabilities, user_roles)
  - `tc_workflow.*` (definitions, instances, step_executions)
  - `tc_ai.*` (conversations, messages, usage)
  - `tc_search.*` (index, synonyms, analytics)
- ESLint boundary rules deployed — cross-plugin imports rejected at build
- Empty plugins for every launch plugin (marketplace, orders, messages, etc.) each with a valid manifest and the version envelope
- Boot integration test passes: platform starts, registry loads, palette opens, PDS renders

### Week 0 Exit Criterion — Platform Validation Test

Philip's added requirement: **prove modularity before any feature code ships.**

The test:

1. Generate a completely empty plugin scaffold via `trade-center create-plugin hello-world`
2. The scaffold has ONLY:
   - A valid `manifest.ts` implementing `PluginContract`
   - A single empty route `/hello-world`
   - No routes beyond that, no events, no widgets, no UI logic
3. Run `trade-center install ./hello-world`
4. Verify:
   - Installation succeeds without editing any existing code (grep for changes outside `src/plugins/hello-world/`)
   - Manifest validates against the platform contract
   - Plugin registry lists it as active
   - Primary rail shows its slot
   - The `/hello-world` route responds 200
   - Removing the plugin folder removes all traces after uninstall
   - No cross-plugin imports exist (build passes ESLint boundary rules)
   - Auto-baseline telemetry emits are captured (`plugin.request.count`, etc.)

If any step fails, the architecture is not modular yet and Week 1 does not begin.

**Exit criteria:** the platform boots empty. Every plugin manifest validates. Every architectural rule enforced by CI. The Platform Validation Test passes. No feature code yet.

### Week 1 — Shell Foundation

- Persistent sidebar rendered from plugin registry
- Top bar + breadcrumbs
- Command palette skeleton (actions register, none yet visible)
- Right panel scaffolding (no content)
- Design system tokens shipped (semantic layer + dark mode primitives)
- Platform Design System first-tier primitives live (Button, Card, Dialog, StatTile, Chip, Badge, EmptyState)

### Week 2 — Workspace Layer

- Today's Work strip on Home (widgets from plugins, all composed from PDS)
- Notifications system live (real-time bell, emits every delivery event)
- Recent activity feed
- Pinned merchants block
- Saved Lists plugin operational
- Live sidebar state (every plugin's `sidebarState()` computed on demand)
- Preferences plugin operational (theme, density, radius, notifications preferences — every change emits an event)

### Week 3 — Marketplace Integration

Marketplace becomes the FIRST plugin wired to the shell — proves the plugin contract works end-to-end.

- Marketplace manifest fully implemented against `PluginContract`
- Product cards v2 (merchant identity, trust layers, delivery, distance, trade discount, business pricing, comparison quick-add — composed from PDS)
- Category workspace with state-aware sidebar chips (row shows "3 in basket · 1 back in stock")
- Search provider registered → universal search returns products alongside merchants + categories + actions
- Command palette actions registered
- Home dashboard widget contributed by Marketplace
- Redirect layer: existing `/trade-off/yard/canteens/*` → `/community/*` (permanent 301 per spec §19.9)

### Week 4 — AI Integration

- Copilot right panel across shell (rendered by the platform AI service, not Marketplace)
- Command palette "Ask AI" group
- Cost router live at `/api/ai/dispatch`
- Plugin AI tools discovered and dispatched (Marketplace: `search_products`, `get_product`, `compare_products`; Orders: `track_delivery`; Messages: `search_threads`)
- Inline recommendations on product cards (real answers only, never decoration)
- The moment a new plugin lands after Week 4, its AI tools become available to the copilot with zero copilot changes

**Every week, every feature runs through the Trade Center Design Principles gate before merge.**

---

## 22. Amendment Process

This document is the master. Amendments require:

1. Written proposal with rationale (a PR against this doc)
2. Sign-off from Philip
3. If amending contract types (Section 4) or layer rules (Section 1.1): 4-week deprecation window for any dependent module
4. Version bump in the header
5. Prior version archived at `docs/architecture/history/v1.0.md`

No implementation may proceed against a stale architecture. If this doc is amended, in-flight work pauses until impact is assessed.

---

## 23. Referenced Docs

- `TRADE_CENTER_2_SPEC.md` — product specification (what we build)
- `TRADE_CENTER_DESIGN_PRINCIPLES.md` — constitution (what deserves to be built)
- `project_trade_center_is_os_not_ecommerce.md` — OS thesis memory
- `project_trade_center_design_principles_gate.md` — constitution memory
- `project_trade_center_platform_directives.md` — Philip's canonical directives memory
- `project_trade_center_platform_architecture.md` — this doc's memory pin (created alongside this)

---

**End of master architecture.**

*This document is the source of truth for HOW Trade Center is built. The spec doc defines WHAT we're building. The principles doc defines WHAT DESERVES to be built. This doc defines HOW ANYTHING PLUGS IN AT ALL.*

*Amendments cost weeks. Get this right once.*
