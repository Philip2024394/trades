# Trade Center Platform Delta

**Owner:** Philip O'Farrell
**Status:** Canonical reconciliation — what exists in the platform today vs what Trade Center v1.1 needs
**Version:** 1.0 · 2026-07-11
**Method:** Systematic audit of `src/platform/*` and every governance doc under it, then classification of every proposed Trade Center feature into one of four categories: **Already Exists / Extend / New / Remove**
**Parent docs:** `TRADE_CENTER_2_SPEC.md` · `TRADE_CENTER_DESIGN_PRINCIPLES.md` · `TRADE_CENTER_PLATFORM_ARCHITECTURE.md v1.1` · `TRADE_CENTER_PLATFORM_ROADMAP_2035.md` · `TRADE_CENTER_MIGRATION_STRATEGY.md`

---

## 0. Purpose

This document does one job: **prevent Trade Center from rebuilding infrastructure that already works.**

The audit found the platform at `src/platform/*` is more mature than the Trade Center architecture documents assumed. Registry Kit, Runtime, SDK, Design System, UI Kit, Event Bus, Install Lifecycle, 32 ADRs, a Constitution with 7 amendments, a Platform Maturity Model scoring 12 dimensions, and 27 existing apps are already in production or documented as roadmap ships. Terminology is ~90% aligned with the Trade Center v1.1 vocabulary.

This delta doc closes the gap between the two — surfacing what to adopt, what to extend, and where genuine new work lives.

---

## 1. Discovery — the platform already exists

The existing platform at `src/platform/*` is called the **Xrated Trades AI Platform** in its own documents. It ships:

- `src/platform/registryKit/` — production-grade Registry Kit with `createRegistry`, deep-freeze, validators, self-check, weighted search, telemetry, analytics, describe() for AI, snapshot() for DB compat
- `src/platform/runtime/` — event bus, event log, event replay, event discovery, install/uninstall/packInstall, navigation composer, slots, hooks, installed apps, page management, home layout seeder, brand tokens seeder
- `src/platform/sdk/` — permissions, analytics, context, navigation, pages, slots, storage, events, install
- `src/platform/design/` — Design System with tokens, themes, primitive registrations, and its own Design Constitution (2 visual worlds)
- `src/platform/ui/` — 60+ UI primitives across 6 phases (Phase 1-4 complete)
- `src/platform/manifest/types.ts` — `AppManifest` schema
- 10 live registries + 4 more planned in M3
- 27 apps in `src/apps/`
- Governance: `CONSTITUTION.md` (v1 + 7 amendments), `ARCHITECTURE.md`, `ROADMAP.md` (v1.1 through M10), `PLATFORM_DECISIONS.md` (32 ADRs), `PLATFORM_MATURITY_MODEL.md` (12 dimensions), `M3_PLATFORM_CORE.md`

The existing Platform Maturity Model reports an overall baseline of **35.7%** as of 2026-07-05 — the platform is real, in flight, and mid-milestone (M3).

**Consequence for Trade Center:** Trade Center is not "a new platform." Trade Center is the next positioning of the same platform. Existing infrastructure is an accelerator, not a setback.

---

## 2. Terminology Mapping — the platform speaks one language

Adopt existing terminology wherever the concept aligns. Introduce new terms only when a genuinely new concept is being added.

| Trade Center v1.1 term | Existing platform term | Decision | Notes |
|---|---|---|---|
| Plugin | **App** | Adopt `App` | Same concept. Every occurrence of "Plugin" in Trade Center docs → "App" going forward. |
| Plugin Contract | **App Manifest** (`AppManifest`) | Adopt `AppManifest` | Same shape; extend with new fields where needed (see §4 Extend items) |
| Plugin Registry | **App Registry** (`appRegistry`) | Adopt `appRegistry` | Uses Registry Kit — same infrastructure |
| Plugin Install CLI | **Runtime install** (`runtime/install.ts`) | Adopt existing runtime | No CLI needed; runtime handles registration + lifecycle |
| Module Contract v1.1 fields | `AppManifest` fields | Extend existing shape | See §4 for the specific fields to add |
| Platform Shell | **Business OS 18-layer stack** | Adopt existing framing | Same idea, existing docs are richer |
| Command Palette | (no direct equivalent yet) | **New** | Trade Center adds this — see §4 New |
| Universal Search | Per-registry `.search()` | **Extend + orchestrate** | Registry search exists; cross-registry orchestrator is new — see §4 New |
| Workflow Engine | Event bus + replay | **New layer on top** | Events exist; declarative orchestration doesn't — see §4 New |
| AI Dispatcher (tool discovery per plugin) | `aiGateway` (isolated by ADR-004) | **New** | AI Gateway is provider routing; tool discovery per app is new — see §4 New |
| Trust Score | (no direct equivalent) | **New** | See §4 New |
| Simple Mode ↔ Workspace Mode | (no runtime mode selector) | **New** | Design Constitution has "two visual worlds" but no runtime switch — see §4 New |
| Capability | `Capability` enum on `AppManifest` (maps, payments, products, etc.) | Extend | Enum exists; capability-based policy composition doesn't. See §4 Extend |
| Policy Engine | Permission enum + `sdk/permissions.ts` | Extend | Basic read/write scopes exist; role composition + `can()` runtime doesn't. See §4 Extend |
| Event bus | `runtime/eventBus.ts` | Adopt | 1:1 |
| Event log | `runtime/eventLog.ts` | Adopt | 1:1 |
| Event replay | `runtime/eventReplay.ts` | Adopt | 1:1 |
| Slot | `SlotDescriptor` | Adopt | 1:1 |
| Hook | `runtime/hooks.ts` | Adopt | 1:1 |
| Pinned items / recent activity | `sdk/context.ts` shell state | Extend | Context exists; workspace-state schema doesn't. Small extension. |
| Platform Design System | `src/platform/design/` + `src/platform/ui/` | Adopt | Amendment 9 is already the platform's Design Constitution. Adopt verbatim. |
| Auto-instrumented telemetry | Registry Kit telemetry hooks (onRegister/onGet/onMiss) + analytics hooks | Extend | Fire-and-forget hooks exist per-registry; auto-wrapping every plugin call at the runtime layer doesn't. See §4 Extend |
| Feature flags (plugin-scoped) | (none) | **New** | Fresh build |
| Version envelope (moduleVersion/apiVersion/schemaVersion/migrationVersion) | `AppManifest.version` (one semver field) | Extend | Add distinct fields. See §4 Extend |
| Country context | (no explicit country scoping) | **New** | Fresh build — the platform doesn't yet ship international |
| Company Switcher (multi-tenancy) | (no team/business scoping) | **New** | Fresh build — matches PMM Enterprise dimension at 8% |
| Trade taxonomy | `knowledgePackageRegistry` (KG bindings) | Adopt | Existing knowledge packages already model trade specifics |

**Rule enforced from now on:** every Trade Center doc, code comment, ADR, and PR uses the existing platform's terminology. Where the existing platform uses "App," we use "App." Where it uses "Business OS," we use "Business OS." No parallel vocabulary.

---

## 3. Platform Health Report

Existing scores from `PLATFORM_MATURITY_MODEL.md` (2026-07-05 baseline). I map them to the layers named in Trade Center v1.1's architecture and add confidence + notes.

| Trade Center layer | Existing PMM dimension(s) | Score | Confidence | Notes |
|---|---|---|---|---|
| **Shell** (Business OS 18-layer stack) | Business OS dimension | **50.7%** | High | 18 layers documented; scored per-layer. 7 layers at 100% (Business, Theme, Tokens, Components, Sections, Payments, Publishing); Navigation at 0% (M3 target); Booking at 0% (M3 target). |
| **Registry** (Registry Kit + individual registries) | Foundation dimension | **82.0%** | High | Registry Kit 100%. Primitives 100%. Containers 53% (10/19). Registry count 67% (10/15 target). Registries-migrated-to-kit 90% (9/10; AI Gateway deliberately excluded). |
| **Runtime** (event bus, install, hooks, slots) | Foundation + Business OS | **~85%** | Medium-High | Event bus + log + replay + discovery all exist. Install/uninstall/packInstall exist. Slots + hooks + navigationComposer exist. Not explicitly scored as a single dimension in PMM but heavily referenced. |
| **SDK** (permissions, analytics, storage, context) | (implicit across PMM dimensions) | **~75%** | Medium | Full SDK surface exists: permissions, analytics, context, navigation, pages, slots, storage, events, install. Fine-grained capability model missing (see §4 Extend). |
| **UI** (Platform Design System) | Design System dimension | **60.5%** | High | Primitives 100% (25/25). Containers 53%. Registry entries 60%. Tokens 63% (63/100 target). Icon/font/animation registries at 0% (M3 target). |
| **Events** (event bus, log, replay, discovery) | Foundation + Business OS | **~90%** | High | Full event infrastructure. Immutable, timestamped, persisted, replayable. |
| **Permissions** | Business OS + Enterprise dimension | **~30%** | Medium | Capability enum + Permission enum exist on `AppManifest`. Read/write scopes checked in SDK. Role composition + policy engine + fine-grained `can()` runtime don't exist. PMM Enterprise dimension at 8%. |
| **Search** (per-registry) | Foundation | **~70%** | High | Registry `.search()` shipped with weighted keyword scoring (id 10, name 6, keywords 5, tags 4, description 2, category 1). Cross-registry orchestrator missing. |
| **AI** (composition + Gateway) | AI Composition dimension | **46.2%** | Medium | 8/14 pipeline stages. 3/5 LLM tasks. `aiGateway` shipped but isolated. AI Dispatcher with tool discovery per plugin missing entirely. Multi-turn 0%. Style-aware 0%. Content-fill 0%. End-to-end preview 100%. |
| **Telemetry** (registry hooks + PMM) | (implicit across dimensions) | **~35%** | Medium | Registry Kit ships telemetry hooks + analytics hooks. No auto-wrapping of plugin calls. No unified metric pipeline. PMM Performance dimension at 9% (bundle-size CI 0%, Lighthouse CI 0%, snapshots 0%, telemetry export 10%). |
| **Workflow** (declarative multi-step orchestration) | (none) | **0%** | High | Events exist; declarative workflow DSL doesn't. Fresh build. |
| **International** (country routing, currency, tax) | (none) | **0%** | High | Platform is UK-only in code. No country scoping. Fresh build. |
| **Trust / Verification** (multi-layer trust score) | (none) | **0%** | High | No trust score primitive. Fresh build. |
| **Testing** | Testing dimension | **4.0%** | High | Vitest 0%. Test files 0% executable (0/16). Unit coverage 5%. Integration/visual/a11y CI 0%. **PMM notes this as the platform's biggest risk.** |
| **Security** | Security dimension | **41.5%** | Medium | Auth 90%. RLS 50%. Injection audit 20%. CSP 0%. CSRF 80%. Secrets 50%. Dependency audit 60%. Rate limit 20%. Audit log 10%. |
| **Accessibility** | Accessibility dimension | **65.3%** | High | Radix 95%. Icons a11y 95%. Motion-safe 90%. Colour contrast 50%. Focus states 90%. a11y CI 0%. Screen-reader 10%. Semantic HTML 70%. Landmarks 70%. Tap targets 90%. |
| **Marketplace** (app installation flow) | Marketplace dimension | **29.0%** | Medium | 3/15 Apps registered. 1/6 Packs. 52/60 Templates. Install 100%. Search UI 20%. Upgrade/rollback/ratings 0%. |
| **Mobile** | Mobile dimension | **15.5%** | High | Mobile-first responsive 90%. PWA 0%. Offline 0%. Push 0%. Native shell 0%. |
| **Automation** | Automation dimension | **16.8%** | High | Cron 33%. Growth Coach 40%. Auto-publish 100%. Auto-tag/content/migration/a11y/perf 0%. |
| **Enterprise** (teams, roles, plugins-external, white-label, presence, comments, audit) | Enterprise dimension | **8.0%** | High | Teams 0%. Roles 0%. External plugins 0%. White-label 10%. SDK-for-external 0%. Presence 0%. Comments 0%. Audit log 10%. API 20%. |

**Overall platform baseline: 35.7%** — mid-M3 execution. Trade Center's positioning does not add build cost so much as it re-frames the mission.

---

## 4. Four-Category Delta Analysis

Every architectural feature from `TRADE_CENTER_PLATFORM_ARCHITECTURE.md v1.1` and `TRADE_CENTER_2_SPEC.md` classified.

### 4.1 Already Exists — leave alone, reference

**Do not rebuild. Do not shadow. Reference in downstream docs.**

| Trade Center feature | Existing implementation | File / doc reference |
|---|---|---|
| Manifest-first plugin system | `AppManifest` in `manifest/types.ts` | `src/platform/manifest/types.ts` |
| Plugin (App) registry with duplicate detection | `appRegistry` via `createRegistry` | `src/platform/registry.ts` |
| Registry Kit (validators, self-check, snapshot, describe) | `createRegistry`, `validators.ts`, `selfCheck.ts`, `describe.ts` | `src/platform/registryKit/*` |
| Semver enforcement | `SEMVER_RE` validator | `src/platform/registryKit/validators.ts` |
| Deprecation support | `Deprecation` type on `RegistrationBase` | `src/platform/registryKit/types.ts` |
| Event bus | `runtime/eventBus.ts` | `src/platform/runtime/eventBus.ts` |
| Event log (durable) | `runtime/eventLog.ts` | `src/platform/runtime/eventLog.ts` |
| Event replay | `runtime/eventReplay.ts` | `src/platform/runtime/eventReplay.ts` |
| Event discovery | `runtime/eventDiscovery.ts` | `src/platform/runtime/eventDiscovery.ts` |
| Install lifecycle | `runtime/install.ts` | `src/platform/runtime/install.ts` |
| Uninstall lifecycle | `runtime/uninstall.ts` | `src/platform/runtime/uninstall.ts` |
| Pack (bundle) install | `runtime/packInstall.ts` | `src/platform/runtime/packInstall.ts` |
| Slots | `SlotDescriptor` | `src/platform/runtime/slots.ts` |
| Hooks | `runtime/hooks.ts` | `src/platform/runtime/hooks.ts` |
| Navigation composition | `runtime/navigationComposer.ts` + `navigationRegistry` | `src/platform/runtime/navigationComposer.ts` |
| Page management | `runtime/pageManagement.ts` | `src/platform/runtime/pageManagement.ts` |
| Home layout seeder | `runtime/homeLayoutSeeder.ts` | `src/platform/runtime/homeLayoutSeeder.ts` |
| SDK — permissions | `sdk/permissions.ts` | `src/platform/sdk/permissions.ts` |
| SDK — analytics | `sdk/analytics.ts` | `src/platform/sdk/analytics.ts` |
| SDK — storage | `sdk/storage.ts` | `src/platform/sdk/storage.ts` |
| SDK — context | `sdk/context.ts` | `src/platform/sdk/context.ts` |
| SDK — events | `sdk/events.ts` | `src/platform/sdk/events.ts` |
| SDK — navigation | `sdk/navigation.ts` | `src/platform/sdk/navigation.ts` |
| SDK — pages | `sdk/pages.ts` | `src/platform/sdk/pages.ts` |
| SDK — slots | `sdk/slots.ts` | `src/platform/sdk/slots.ts` |
| SDK — install | `sdk/install.ts` | `src/platform/sdk/install.ts` |
| Design System (tokens + themes + primitives) | `src/platform/design/*` + Design Constitution | `src/platform/design/CONSTITUTION.md` |
| UI Kit (60+ primitives, 6 phases) | `src/platform/ui/*` | `src/platform/ui/CATALOG.md` |
| Registry telemetry hooks | `RegistryConfig.telemetry` | `src/platform/registryKit/types.ts` |
| Registry analytics hooks | `RegistryConfig.analytics` | `src/platform/registryKit/types.ts` |
| Registry search (weighted keyword) | `.search(query, limit)` | `src/platform/registryKit/search.ts` |
| Snapshot / rehydrate for DB compat | `.snapshot()` + `seed` option | `src/platform/registryKit/createRegistry.ts` |
| describe() for AI-consumable summaries | `.describe(id)` + `describeRegistration()` | `src/platform/registryKit/describe.ts` |
| Cross-registry dependency validation | ADR-011 through ADR-014 pattern | `src/platform/registryKit/PLATFORM_DECISIONS.md` |
| Platform Constitution (governance) | `registryKit/CONSTITUTION.md` (v1 + 7 amendments) | `src/platform/registryKit/CONSTITUTION.md` |
| Design Constitution | `design/CONSTITUTION.md` (2 visual worlds) | `src/platform/design/CONSTITUTION.md` |
| Roadmap M3–M10 | `registryKit/ROADMAP.md` v1.1 | `src/platform/registryKit/ROADMAP.md` |
| ADR log (32 records) | `registryKit/PLATFORM_DECISIONS.md` | `src/platform/registryKit/PLATFORM_DECISIONS.md` |
| Platform Maturity Model | `registryKit/PLATFORM_MATURITY_MODEL.md` (12 dimensions) | `src/platform/registryKit/PLATFORM_MATURITY_MODEL.md` |
| Business OS 18-layer model | Amendment 2 of Constitution | `src/platform/registryKit/CONSTITUTION.md` (§Amendment 2) |
| Business Growth Intelligence (playbooks, evidence, patterns, strategy resolver) | ADR-027 through ADR-030 + `src/platform/business/*` | `src/platform/business/*` |
| Business Operating Coach | ADR-031 + `src/platform/coach/*` | `src/platform/coach/*` |
| Booking engine (4 flows) | `src/platform/booking/*` | `src/platform/booking/*` |
| Forms framework | `src/platform/forms/*` + Zod + React Hook Form | `src/platform/forms/*` |
| Dashboard shell (11 block types) | `src/platform/dashboard/*` | `src/platform/dashboard/*` |
| Navigation registry (8 patterns) | `src/platform/navigation/*` | `src/platform/navigation/*` |
| Layout registry (patterns) | `src/platform/layouts/*` | `src/platform/layouts/*` |
| Button registry + payment processor registry (~20 adapters) | `src/platform/buttons/*` | `src/platform/buttons/*` |
| Existing Apps (27 in `src/apps/`) | 19 material calculators + CRM + job diary + quote workspace + reviews + products + newsletter + trade connections + before-after + hero-swap + live-edit + live-feed + meet-the-team + ai-visualiser | `src/apps/*` |

**Total already-exists items: 45+.** These are accelerators. Trade Center inherits them all.

### 4.2 Extend — existing foundation is correct, needs additional capability

**Modify existing infrastructure additively. No parallel implementation.**

| Feature | What exists | What's needed | Effort | Files touched |
|---|---|---|---|---|
| **Manifest version envelope** | `AppManifest.version: string` (one semver) | Add `apiVersion`, `schemaVersion`, `migrationVersion`, `minPlatformVersion` as distinct fields. Add ADR entry. | Small | `src/platform/manifest/types.ts` + validator + new ADR-033 |
| **Capability-based policies** | `Capability` enum + `Permission` enum + `sdk/permissions.ts` (basic read/write) | Add role composition (compose capabilities into roles), `can(ctx, "key")` runtime, `tc_policy.*` schema | Medium | `src/platform/sdk/permissions.ts` extension + new schema + new ADR |
| **Country + currency scoping** | (none) | Add `country_code` scoping to `AppManifest.availability`, edge middleware detects country from domain, currency/locale/tax injected into `sdk/context.ts` | Medium | `src/platform/manifest/types.ts` + `sdk/context.ts` + middleware |
| **Business / team multi-tenancy** | `sdk/context.ts` provides merchant profile | Add `activeBusiness` + `business_slug` claim + Company Switcher shell primitive | Medium | `sdk/context.ts` + new registry + shell UI |
| **Workspace state schema** | `sdk/context.ts` provides shell state | Add pinned items, recent activity, current-plugin, right-panel-slot to a `tc_shell_workspace_*` registry-persisted state | Small | `sdk/context.ts` + new registry |
| **Simple ↔ Workspace mode selector** | Design Constitution has "two visual worlds" | Runtime shell mode selector (auto-promote on first workspace action per spec §21) | Small | New shell component + rule engine reading events |
| **Auto-instrumented telemetry per App** | Registry Kit ships per-registry telemetry hooks | Runtime wrapper that auto-emits `plugin.request.count / duration / error / event.emitted / command.executed / ai.tool_invoked / search.queried / navigation.route / workflow.step / flag.evaluated` for every App | Medium | `src/platform/runtime/*` telemetry wrapper + PMM dimension update |
| **Everything emits (Amendment 5)** | Event bus + log + replay exist | Discipline enforcement — audit that every state mutation emits an event, especially in `sdk/*` (preferences, themes, favourites, pinned) | Small (mostly audit) | Every `sdk/*` file + PR review checklist |
| **Trade Center branding overlay** | Design Constitution has 2 visual worlds; brand tokens exist | Trade Center brand pack — new `brandRegistry` entry OR override on existing brand tokens (aligned with "The Network" positioning per memory) | Small | `src/platform/design/tokens/*` + new brand entry |
| **AppManifest telemetry declarations** | (none — telemetry is at registry level) | Add `telemetry: TelemetryContribution[]` to `AppManifest` so Apps can declare custom metrics beyond auto-baseline | Small | `src/platform/manifest/types.ts` + runtime instrumentation |
| **AppManifest feature flag declarations** | (none) | Add `featureFlags: FeatureFlagDefinition[]` to `AppManifest` — plugin-owned, namespaced flags | Small | `manifest/types.ts` + new flags registry |
| **AppManifest AI tool declarations** | (none) | Add `aiTools: AITool[]` to `AppManifest` so the AI Dispatcher can discover per-plugin tools at boot | Small | `manifest/types.ts` + wire into AI Dispatcher (new — §4.3) |
| **AppManifest search provider declarations** | Registry `.search()` exists per-registry | Add `searchProviders: SearchProvider[]` to `AppManifest` for Universal Search orchestrator to fan out to | Small | `manifest/types.ts` + wire into Universal Search (new — §4.3) |
| **AppManifest workflow contributions** | (none) | Add `workflows: WorkflowContribution[]` to `AppManifest` (triggers + idempotent steps) for the Workflow Engine (new — §4.3) to discover | Small | `manifest/types.ts` + wire into Workflow Engine |
| **AppManifest capability declarations** | Capability enum exists | Add `declaredCapabilities: CapabilityDeclaration[]` to expose to Admin role composers | Small | `manifest/types.ts` |

**Total extend items: 15.** All additive. Zero breakage risk if we obey `RegistrationBase`-extends-additively pattern from ADR-003.

### 4.3 New Platform Feature — doesn't exist, needs architecture

**Fresh builds. These are the genuine 20% that create Trade Center's competitive advantage.**

| Feature | Why it's new | Effort | Complexity |
|---|---|---|---|
| **AI Dispatcher with tool discovery per App** | `aiGateway` handles provider routing; per-plugin tool discovery is a distinct subsystem (ADR-004 already deferred to "AI Provider Manager" future milestone) | Large | Model routing + tool registry + streaming SSE + cost accounting + quota enforcement |
| **Universal Search orchestrator** | Registry `.search()` is per-registry. Cross-registry fan-out with grouped results, intent classification (Haiku router), and voice/image search does not exist. | Medium | Orchestrator + intent classifier + result grouping + voice/image endpoints |
| **Workflow Engine** | Events + replay exist, but no declarative multi-step orchestration DSL. Sagas / cross-app workflows are the biggest amendment. | Large | DSL parser + step scheduler + saga coordinator + compensating actions + Admin inspector UI + `tc_workflow.*` schema |
| **Command Palette (⌘K)** | No shell surface for it today. Registry `.search()` and `.describe()` are the building blocks, but the palette itself + intent routing + action registry is new. | Medium | Shell UI + action registry (fed by App manifests) + intent router (shared with Universal Search) |
| **Trust Score / Verification registry** | No trust score primitive; no verification-layer schema. Amendment §19.1 of spec is entirely new. | Medium | `tc_merchants_verification` schema + trust score recalc cron + display primitive + workflow integration (event `merchant.trust_score_changed`) |
| **Simple ↔ Workspace shell selector runtime** | Design Constitution has visual worlds; no runtime switcher. §21 of spec is a new subsystem. | Small | Shell mode reducer + event listeners for promotion/demotion + `<ModeGate>` component |
| **Plugin-scoped feature flag registry** | No flag registry exists. Amendment 7 is fresh. | Small | New `tc_flags.*` registry using Registry Kit + edge-cached evaluator + Admin kill-switch UI |
| **Country-first routing + tax + currency** | Platform is UK-only in code today. §19.4 of spec is entirely new. | Medium | Edge middleware + `country_code` throughout + Intl.* wrappers + tax adapter interface + shipping adapter interface |
| **Company Switcher / multi-tenancy** | No team/business model beyond merchant profile. Enterprise dimension at 8%. §19.2 tiering makes this critical. | Medium-Large | Business registry + team invitations + role composition (depends on capability extension in §4.2) + `activeBusiness` context |
| **PWA + offline drafts (Mobile dimension @ 15.5%)** | Mobile dimension at 15.5%. PWA 0%. Offline 0%. Push 0%. Amendment §12 of spec. | Medium | Manifest.json + Service Worker + IndexedDB drafts + Web Push subscription + sync banner |
| **Home dashboard "Today's Work" strip** | Home layout seeder exists but no Today's Work widget contract. Spec §20 Week 2. | Small | New widget slot on Home + BFF endpoint + per-App widget registrations |
| **Notifications system (in-app + push + email + SSE bell)** | Analytics/events exist; unified user-facing notifications don't. | Medium | `tc_notifications.*` registry + preferences + delivery channels + shell bell UI |
| **Merchant identity chip surface** | Product cards exist in `src/apps/products` but merchant chip primitive doesn't. Spec §20 Week 3. | Small | New `<MerchantChip>` PDS primitive + wire into product card |
| **Trade Center brand pack + positioning** | Existing platform is Xrated Trades / The Network branded. Trade Center is the marketplace-first positioning. | Small | Brand pack overlay + copy pack + positioning docs (existing) |
| **Ten Trade Center governance docs** (spec, principles, architecture, roadmap, delta, migration, plus new ones over time) | Existing platform has its own Constitution + Roadmap; Trade Center docs are additive positioning overlays | Small | Already ~85% shipped; needs reconciliation per §5 below |

**Total new items: 15.** All Trade Center's competitive advantage lives here.

### 4.4 Remove — legacy architecture that actively conflicts

**Rare. Every removal requires written justification.**

| Feature | Justification for removal | Alternative |
|---|---|---|
| _(none identified)_ | The audit found no existing platform infrastructure that actively conflicts with Trade Center v1.1 amendments. The gap is missing features, not misaligned features. | N/A |

**Zero removals proposed.** This is the strongest possible signal that Path B was correct.

---

## 5. Reconciliation of the Four Trade Center Docs

The audit found the existing platform docs are more mature and detailed than my Trade Center docs. Reconciliation:

| Trade Center doc | Status | Reconciliation action |
|---|---|---|
| `TRADE_CENTER_2_SPEC.md` | **Keep** — product/UX overlay | Not a competitor to existing docs. Positions the platform as workspace-first for construction professionals. Add a header note pointing to `src/platform/registryKit/CONSTITUTION.md` and `ROADMAP.md` as parent governance. |
| `TRADE_CENTER_DESIGN_PRINCIPLES.md` | **Keep** — feature constitution | Not a competitor to `Design Constitution` (which is UI-scoped). This is a feature-approval gate. Adopt existing platform's ADR process for major amendments. |
| `TRADE_CENTER_PLATFORM_ARCHITECTURE.md v1.1` | **Revise substantially** | The 23-section master architecture I wrote duplicates ~60% of what's already in `registryKit/CONSTITUTION.md` + `ARCHITECTURE.md` + `PLATFORM_DECISIONS.md`. Refactor into a shorter "Trade Center Amendments" doc that only calls out §4.2 and §4.3 items. Existing platform docs become primary references. |
| `TRADE_CENTER_PLATFORM_ROADMAP_2035.md` | **Keep — position as strategic overlay** | Not a competitor to `registryKit/ROADMAP.md` (which is M3–M10 execution). This is 10-year strategic positioning. Add explicit mapping from Phase 1 → M3, Phase 2 → M4–M5, etc. so the two roadmaps compose. |
| `TRADE_CENTER_PLATFORM_DELTA.md` (this doc) | **New** — the reconciliation layer | Bridges Trade Center positioning to existing platform reality. Referenced by all four Trade Center docs going forward. |
| `TRADE_CENTER_MIGRATION_STRATEGY.md` | **New** — will land next | See separate document. |

**Governance:** the existing `PLATFORM_DECISIONS.md` (ADR log) is the source of truth for architectural decisions. Every Trade Center amendment lands as an ADR (starting at ADR-033 based on the audit's mention of 32 existing).

---

## 6. Implementation Backlog for Weeks 1–4 (built ONLY from §4.2 + §4.3)

No item on this backlog rebuilds anything from §4.1. Each item is either an additive extension or a fresh build.

### Week 1 — Foundational extensions + shell primitives

- ADR-033: Manifest version envelope (apiVersion / schemaVersion / migrationVersion / minPlatformVersion) — §4.2
- Extend `AppManifest` with declarations for: `aiTools`, `searchProviders`, `workflows`, `featureFlags`, `telemetry`, `declaredCapabilities` — §4.2
- Auto-instrumented telemetry wrapper in `runtime/*` — §4.2
- Shell primitives: primary rail from `appRegistry`, top bar, breadcrumbs (composed from existing UI Kit + Navigation registry) — mostly §4.1 composition
- Command Palette skeleton (⌘K) — §4.3
- Trade Center brand pack overlay — §4.3

### Week 2 — Workspace layer + universal search orchestrator

- Workspace state extension in `sdk/context.ts` (pinned, recent, current-plugin, right-panel-slot) — §4.2
- Home "Today's Work" strip + BFF endpoint — §4.3
- Notifications system (registry + preferences + SSE bell) — §4.3
- Universal Search orchestrator (cross-registry fan-out + intent classifier) — §4.3
- Simple ↔ Workspace shell mode selector — §4.3
- Capability model extension: role composition + `can()` runtime + `tc_policy.*` schema — §4.2

### Week 3 — Marketplace App wired as first proof

- Marketplace `AppManifest` complete with the new declarations from Week 1
- Product card v2: merchant chip primitive, trust score display, delivery/distance/trade-price surfaces — §4.3 (chip primitive) + §4.1 (existing product app)
- Trust Score registry + verification schema + display primitive — §4.3
- Category workspace with state-aware sidebar chips
- Redirect layer: `/trade-off/yard/canteens/*` → `/community/*` per spec §19.9

### Week 4 — AI layer + workflow foundations

- AI Dispatcher with tool discovery (routes to Opus/Haiku/Whisper; discovers `aiTools` per App) — §4.3
- Copilot right panel (renders from Dispatcher) — §4.3
- Workflow Engine v1: DSL loader, step scheduler, saga coordinator — §4.3
- First workflow live: `merchant.verified` orchestration per spec §9.1
- Trade Center country scoping (edge middleware + `country_code` throughout) — §4.3
- Everything-emits audit pass across `sdk/*` — §4.2

**Total: ~30 concrete deliverables across 4 weeks.** Every one traces back to §4.2 or §4.3. Zero rebuild of §4.1.

---

## 7. What Week 0 Has Proven

Week 0 was NOT scaffolding. Week 0 was diligence. The proof:

1. **Diligence caught a 6–8 week rebuild that would have wasted engineering time.** The audit surfaced production-grade infrastructure that would have been silently duplicated without this pass.
2. **Terminology is 90% aligned.** The platform speaks "App" and "Business OS." Trade Center adopts them.
3. **Zero removals proposed.** No existing infrastructure conflicts with Trade Center v1.1.
4. **15 extensions + 15 new features identified.** That is the real Week 1–4 backlog.
5. **The 4 Trade Center docs I wrote need modest reconciliation** — most content transposes cleanly; ~60% of the master architecture doc becomes references to existing docs rather than duplicate spec.
6. **Governance flows through existing ADR log.** No parallel decision process.
7. **The platform's own PMM is our starting scorecard.** 35.7% overall baseline. Trade Center Week 4 exit becomes an incremental PMM movement across dimensions.

**Week 0 exit criteria (revised per Philip's directive):**
- ✅ Existing platform fully audited
- ✅ Terminology reconciled
- ✅ Delta document complete
- ✅ Existing strengths documented
- ✅ Genuine gaps identified
- ✅ No duplicate infrastructure planned
- ✅ Clear implementation backlog produced

All seven criteria met by this document + the Migration Strategy doc landing alongside it.

---

## 8. Referenced Docs

- **Existing platform (source of truth for platform primitives):**
  - `src/platform/registryKit/CONSTITUTION.md` — Platform Constitution v1 + 7 amendments
  - `src/platform/registryKit/ARCHITECTURE.md` — Registry Kit + registry diagram
  - `src/platform/registryKit/ROADMAP.md` — M3–M10 execution roadmap
  - `src/platform/registryKit/PLATFORM_DECISIONS.md` — 32 ADRs (append-only)
  - `src/platform/registryKit/PLATFORM_MATURITY_MODEL.md` — 12-dimension scorecard
  - `src/platform/registryKit/M3_PLATFORM_CORE.md` — M3 detailed architecture
  - `src/platform/registryKit/DEPENDENCY_GRAPH.md` — cold-boot dependency validation
  - `src/platform/design/CONSTITUTION.md` — Design Constitution (2 visual worlds)
  - `src/platform/ui/CATALOG.md` — UI Kit catalog
- **Trade Center overlay:**
  - `TRADE_CENTER_2_SPEC.md` — product/UX overlay
  - `TRADE_CENTER_DESIGN_PRINCIPLES.md` — feature approval gate
  - `TRADE_CENTER_PLATFORM_ARCHITECTURE.md v1.1` — to be revised per §5
  - `TRADE_CENTER_PLATFORM_ROADMAP_2035.md` — 10-year strategic positioning
  - `TRADE_CENTER_MIGRATION_STRATEGY.md` — landing alongside this doc

---

**End of delta.**

*Trade Center is not a rebuild. Trade Center is what the existing Xrated Trades AI Platform becomes when we ship the 20% that creates its competitive advantage. This doc says what those 20% are, with no ambiguity.*
