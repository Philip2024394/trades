# Trade Center Migration Strategy

**Owner:** Philip O'Farrell
**Status:** Canonical — every architectural change must trace back to this document
**Version:** 1.0 · 2026-07-11
**Companion doc:** `TRADE_CENTER_PLATFORM_DELTA.md` (the audit that produced these decisions)

---

## 0. Purpose

This document answers four questions for every piece of the existing platform:

1. **What stays exactly as it is?**
2. **What gets extended?**
3. **What gets deprecated?**
4. **What gets replaced?**
5. **Why?**

Every future architectural change traces back to a row in one of these four tables. If it can't be traced here, it doesn't happen.

The default answer is always **stays**. The bar for **extend** is real added value. The bar for **deprecate** is a full ADR + 12-month notice. The bar for **replace** is one of four justifications (blocks growth / violates new principles / cannot be extended cleanly / debt outweighs migration cost).

---

## 1. Governing Rule

**Existing production-quality infrastructure has priority over replacement.**

Replacement is permitted only if ONE of these is true:

1. It blocks future growth
2. It violates the new Trade Center platform principles
3. It cannot be extended cleanly
4. Technical debt outweighs migration cost

Otherwise: **extend.** Otherwise: **leave alone.**

This rule is canonical in `project_protect_existing_platform_investment.md` and is not negotiable at PR level.

---

## 2. What Stays Exactly As It Is

**No changes. Adopt as-is. Reference in downstream docs. Any proposed change requires an ADR.**

| Component | Location | Why it stays |
|---|---|---|
| **Registry Kit** — `createRegistry`, validators, self-check, deep-freeze, search, describe, telemetry, analytics | `src/platform/registryKit/*` | Production-grade. 82% PMM score on Foundation dimension. 90% of registries already migrated to it. It IS the platform primitive layer. |
| **Registry Constitution v1 + 7 amendments** | `src/platform/registryKit/CONSTITUTION.md` | Canonical governance. Trade Center amendments land as new ADRs, not new constitutions. |
| **App Manifest schema (base fields)** | `src/platform/manifest/types.ts` | Correct shape. Additive fields land via ADR-033+ (see §3). Never rewrite. |
| **App Registry** (`appRegistry`) | `src/platform/registry.ts` | Same infrastructure as every other registry. Trade Center's "Marketplace as Plugin #1" is a registration into this registry, not a new registry. |
| **Runtime — event bus, event log, event replay, event discovery** | `src/platform/runtime/eventBus.ts` + `eventLog.ts` + `eventReplay.ts` + `eventDiscovery.ts` | Complete event architecture. Trade Center's "everything emits" rule (Amendment 5) is an application of existing infrastructure, not new infrastructure. |
| **Runtime — install / uninstall / packInstall** | `src/platform/runtime/install.ts` + `uninstall.ts` + `packInstall.ts` | Full lifecycle. Trade Center's plugin lifecycle IS this. |
| **Runtime — slots, hooks, navigation composer, page management, home layout seeder** | `src/platform/runtime/*` | All extension mechanisms Trade Center needs. |
| **SDK — permissions, analytics, storage, context, navigation, pages, slots, events, install** | `src/platform/sdk/*` | Complete public API for Apps. Trade Center extends specific SDK surfaces (see §3); the SDK itself stays. |
| **Design System — tokens, themes, primitive registrations** | `src/platform/design/*` | 60.5% PMM score. 100% primitives. Trade Center brand is an overlay pack, not a Design System rewrite. |
| **Design Constitution** (two visual worlds) | `src/platform/design/CONSTITUTION.md` | Correct governance. Trade Center adopts it. |
| **UI Kit** — 60+ primitives across 6 phases | `src/platform/ui/*` + `CATALOG.md` | 100% primitives. Phase 1-4 complete. Trade Center composes; never re-primitives. |
| **Business Operating System (18-layer stack)** | `src/platform/business/*` + Amendment 2 of Constitution | The Business OS framing IS what Trade Center wants. Adopt verbatim. |
| **Business Growth Intelligence** (playbooks, evidence, patterns, strategy resolver) | `src/platform/business/*` + ADR-027–ADR-030 | High-quality Trade Center-adjacent infrastructure. Extend where Trade Center's Trust Score integrates; don't rebuild. |
| **Business Operating Coach** | `src/platform/coach/*` + ADR-031 | Recommendation registry + transparency. Trade Center's Notebook overlaps but complements; do not replace. |
| **Booking engine** (4 flows) | `src/platform/booking/*` | Complete. Trade Center's delivery + scheduling reuses booking primitives. |
| **Forms framework** | `src/platform/forms/*` + Zod + React Hook Form | Standard framework. Adopt. |
| **Dashboard shell** (11 block types) | `src/platform/dashboard/*` | Business dashboard module reuses these blocks. Do not rebuild. |
| **Navigation registry** (8 patterns) | `src/platform/navigation/*` | Existing patterns cover primary + secondary rail. Trade Center registers a new "workspace" pattern (extension), not a new navigation system. |
| **Layout registry** | `src/platform/layouts/*` | Composes correctly with home layout seeder. Adopt. |
| **Button registry + payment processor registry** (~20 payment adapters) | `src/platform/buttons/*` | 100% payments PMM. Trade Center's checkout uses this. |
| **Existing 27 Apps** in `src/apps/*` | `src/apps/*` | All 19 material calculators + CRM + job diary + quote workspace + reviews + products + newsletter + trade connections + others — Trade Center adopts every one. Some (products, reviews, quote-workspace) become the foundation Trade Center wires into the shell as Plugin #1, #2, #3. |
| **Registry Kit governance docs** — ARCHITECTURE.md, ROADMAP.md, PLATFORM_DECISIONS.md, PLATFORM_MATURITY_MODEL.md, M3_PLATFORM_CORE.md, DEPENDENCY_GRAPH.md | `src/platform/registryKit/*.md` | Canonical source-of-truth docs. Trade Center's roadmap composes on top of ROADMAP.md — the two are not competitors. |
| **32 existing ADRs** | `src/platform/registryKit/PLATFORM_DECISIONS.md` | Append-only decision log. Trade Center amendments start at ADR-033. |
| **Platform Maturity Model** (12 dimensions, objective scoring) | `src/platform/registryKit/PLATFORM_MATURITY_MODEL.md` | Trade Center Week 4 exit criteria are stated as PMM dimension movements. |

**Total stays-as-is: 24 major components + 27 apps + 32 ADRs.**

**Change rule for stays-as-is:** any proposed change requires (1) an ADR entry, (2) explicit justification against one of the four Governing Rule criteria, (3) Philip sign-off, (4) preservation of backward compatibility for one full milestone cycle unless the ADR waives it.

---

## 3. What Gets Extended

**Additive changes only. Existing consumers unaffected. Each extension lands as an ADR.**

| Extension | Existing base | What's added | Landing ADR | Landing milestone |
|---|---|---|---|---|
| **Manifest version envelope** | `AppManifest.version: string` (one semver) | Distinct `apiVersion`, `schemaVersion`, `migrationVersion`, `minPlatformVersion` fields | ADR-033 | M3 (Trade Center Week 1) |
| **Manifest AI tool declarations** | `Capability.ai` enum | `aiTools: AITool[]` field so AI Dispatcher can discover per-App tools | ADR-034 | M3 (Trade Center Week 1) |
| **Manifest search provider declarations** | Per-registry `.search()` | `searchProviders: SearchProvider[]` field for Universal Search orchestrator fan-out | ADR-035 | M3 (Trade Center Week 2) |
| **Manifest workflow contributions** | Event bus | `workflows: WorkflowContribution[]` field (triggers + idempotent steps) for Workflow Engine | ADR-036 | M3 (Trade Center Week 4) |
| **Manifest feature flag declarations** | (none) | `featureFlags: FeatureFlagDefinition[]` field — plugin-owned, namespaced flags | ADR-037 | M3 (Trade Center Week 1) |
| **Manifest telemetry declarations** | Registry-level telemetry hooks | `telemetry: TelemetryContribution[]` field for custom metrics beyond auto-baseline | ADR-038 | M3 (Trade Center Week 1) |
| **Manifest capability declarations** | `Capability` enum | `declaredCapabilities: CapabilityDeclaration[]` field to expose to Admin role composers | ADR-039 | M3 (Trade Center Week 2) |
| **SDK — capability model + `can()` runtime** | `sdk/permissions.ts` (basic read/write) | Role composition + fine-grained capability check (`can(ctx, "orders.approve_refund")`) + `tc_policy.*` schema | ADR-040 | M3 (Trade Center Week 2) |
| **SDK — country / currency / locale context** | `sdk/context.ts` (merchant + brand) | `country`, `currency`, `locale`, `taxRegion` injected via edge middleware | ADR-041 | M3 (Trade Center Week 4) |
| **SDK — active business / Company Switcher context** | `sdk/context.ts` (merchant profile) | `activeBusiness` scope + business_slug claim for multi-tenancy | ADR-042 | M4 (Trade Center Week 5+) |
| **SDK — workspace state (pinned, recent, current-plugin, right-panel-slot)** | `sdk/context.ts` | Persisted per-user workspace state | ADR-043 | M3 (Trade Center Week 2) |
| **Runtime — auto-instrumented telemetry wrapper** | Registry Kit per-registry hooks | Runtime wraps every plugin call and auto-emits 12 baseline metrics (per Trade Center architecture §11.1) | ADR-044 | M3 (Trade Center Week 1) |
| **Runtime — "everything emits" enforcement pass** | Event bus | Audit every SDK mutation, add missing emissions (preferences, themes, favourites, pinned) | ADR-045 | M3 (Trade Center Week 4) |
| **Design System — Trade Center brand pack** | Design tokens + theme presets | Trade Center brand pack overlay (BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK canonical per existing memory) | ADR-046 | M3 (Trade Center Week 1) |
| **Navigation registry — workspace pattern** | 8 existing navigation patterns | New "workspace" pattern with 9-slot primary rail + context-sensitive secondary rail | ADR-047 | M3 (Trade Center Week 1) |

**Total extensions: 15 ADRs (ADR-033 through ADR-047).** All additive. All within M3.

**Extension rule:** every extension preserves backward compatibility. Old consumers of the extended surface continue to work. New fields are optional with sane defaults. No existing App breaks.

---

## 4. What Gets Deprecated

**Rare. Every deprecation is a formal ADR with a 12-month notice window.**

| Deprecation | Why | Notice window | Replacement | Landing ADR |
|---|---|---|---|---|
| _(none identified in Trade Center v1 → v2 migration)_ | The audit found zero existing platform infrastructure that conflicts with Trade Center v1.1 amendments. All differences are additive extensions or new features. | — | — | — |

**Zero deprecations proposed at this stage.**

**Future note:** the existing `aiGateway` (kept separate from Registry Kit per ADR-004) may eventually merge into the AI Dispatcher (new, §5 below). If that happens, `aiGateway` is deprecated with a 12-month notice per this doc's rules. That decision is deferred to M8+ per existing roadmap.

---

## 5. What Gets Replaced

**Rarest. Every replacement requires one of the four Governing Rule criteria + written justification + full ADR.**

| Replacement | Justification (which of the four criteria) | Old → New | Landing ADR |
|---|---|---|---|
| _(none identified in Trade Center v1 → v2 migration)_ | The audit found zero existing platform infrastructure that meets the Governing Rule criteria for replacement. | — | — |

**Zero replacements proposed.**

This is the single strongest signal that Path B (audit + reconcile) was correct. The competitive advantage of Trade Center is not built by tearing down; it's built by adding the 15 new features from `TRADE_CENTER_PLATFORM_DELTA.md §4.3`.

---

## 6. Reconciliation of the Four Trade Center Docs

The four Trade Center governance docs I wrote before the audit need reconciliation with the existing platform docs. Each gets a defined status.

| Trade Center doc | Status | Reconciliation actions |
|---|---|---|
| `TRADE_CENTER_2_SPEC.md` | **Keep** — product/UX overlay | Add header note: "Governance flows through `src/platform/registryKit/CONSTITUTION.md`. This doc is the product-level positioning of the Xrated Trades AI Platform for the construction industry." No content deletion required. |
| `TRADE_CENTER_DESIGN_PRINCIPLES.md` | **Keep** — feature approval gate | Add header note: "Feature gate. Complements (does not replace) `src/platform/design/CONSTITUTION.md` (UI-level) and `src/platform/registryKit/CONSTITUTION.md` (platform-level)." |
| `TRADE_CENTER_PLATFORM_ARCHITECTURE.md v1.1` | **Revise substantially — ADR-032a** | This doc originally acted as a would-be replacement for existing architecture. Refactor into a shorter overlay that: (a) references `src/platform/registryKit/ARCHITECTURE.md` as primary architecture, (b) retains only the sections that are Trade Center-specific amendments (universal search orchestrator, AI Dispatcher, Workflow Engine, capability model, workspace shell selector, trust score), (c) removes duplicated content on Registry Kit / Runtime / SDK / Design System / UI Kit. |
| `TRADE_CENTER_PLATFORM_ROADMAP_2035.md` | **Keep — strategic positioning overlay** | Add header note: "Strategic 10-year positioning overlay. Composes ON TOP of `src/platform/registryKit/ROADMAP.md` (M3–M10 execution). Phase 1 → M3–M4, Phase 2 → M5–M6, Phase 3 → M7–M8, Phase 4 → M9–M10, Phase 5 → post-M10." Add explicit milestone-to-phase mapping table. |
| `TRADE_CENTER_PLATFORM_DELTA.md` | **New — canonical reconciliation** | Landed as source of truth for terminology + health + delta. Referenced by every downstream doc. |
| `TRADE_CENTER_MIGRATION_STRATEGY.md` (this doc) | **New — canonical migration governance** | Every architectural change traces back here. Referenced by every downstream doc. |

**Reconciliation ADR:** ADR-032a lands under `PLATFORM_DECISIONS.md` capturing this reconciliation as a formal platform decision (the "a" suffix reflects that it's an insertion between existing ADR-032 and the new ADR-033+ series for Trade Center amendments).

---

## 7. Terminology Migration

Per `TRADE_CENTER_PLATFORM_DELTA.md §2`. Executed in this order:

- **Week 0** (this doc): Terminology mapping published in delta doc. Trade Center docs updated with mapping references.
- **Week 1**: All new code uses existing platform terminology (App, AppManifest, appRegistry, Business OS, SDK, Runtime).
- **Week 1**: Trade Center docs get a "Terminology" section pointing readers to the delta mapping table.
- **Week 2+**: Any refactor of existing Trade Center doc language ("Plugin" → "App", "PluginContract" → "AppManifest") happens opportunistically, not as a dedicated ship. Backward references remain valid (readers know both terms).

No code rename is required — the code already uses the correct terms.

---

## 8. Data Migration

No data migration is required for Trade Center v1 → v2 because Trade Center v2 is not replacing existing data — it's extending the existing platform.

Schema additions (all additive):

- `tc_policy.*` (capabilities, roles, user_roles) — from ADR-040
- `tc_workflow.*` (definitions, instances, step_executions) — from ADR-036
- `tc_flags.*` (feature flag registry) — from ADR-037
- `tc_shell.*` (workspace state, events log) — from ADR-043 + ADR-044
- `tc_merchants.verification` (trust score layers) — from Trade Center architecture §19.1
- `country_code` columns added to existing merchants + products + orders tables via non-blocking migration — from ADR-041

Existing tables (`hammerex_*`, `studio_*`, `app_*`) remain untouched. Their eventual migration to prefixed schemas is a future ADR, not part of this migration.

---

## 9. Documentation Migration

| Doc | Action | Owner | When |
|---|---|---|---|
| `TRADE_CENTER_2_SPEC.md` | Add reconciliation header note | Claude | Week 0 (immediately, this session or next) |
| `TRADE_CENTER_DESIGN_PRINCIPLES.md` | Add reconciliation header note | Claude | Week 0 |
| `TRADE_CENTER_PLATFORM_ARCHITECTURE.md` | Revise per §6 (major refactor into overlay) | Claude | Week 1 |
| `TRADE_CENTER_PLATFORM_ROADMAP_2035.md` | Add reconciliation header + phase-to-milestone mapping | Claude | Week 0 |
| `src/platform/registryKit/PLATFORM_DECISIONS.md` | Insert ADR-032a (reconciliation) + ADR-033–ADR-047 as Trade Center extensions land | Platform team + Claude | Week 1 onwards |
| `src/platform/registryKit/ROADMAP.md` | Update to reference `TRADE_CENTER_PLATFORM_ROADMAP_2035.md` as strategic positioning | Platform team | Week 1 |
| `src/platform/registryKit/PLATFORM_MATURITY_MODEL.md` | Add Trade Center Week 4 exit criteria as expected PMM dimension movements | Platform team + Claude | Week 4 |

---

## 10. Migration Governance

Every proposed architectural change follows this decision tree:

```
Is the change to existing platform infrastructure?
├── NO — it's a new feature from delta §4.3
│      └── Standard build. Follow Trade Center Design Principles gate.
│
└── YES
    ├── Is it in §2 "What Stays"?
    │      └── Requires ADR + Philip sign-off + one of four Governing Rule criteria.
    │           If not present: proposal rejected.
    │
    ├── Is it in §3 "What Gets Extended"?
    │      └── Follow the ADR-033+ pattern. Additive fields only. Backward compat preserved.
    │
    ├── Is it in §4 "What Gets Deprecated"?
    │      └── Formal 12-month notice. New ADR. Migration plan for consumers.
    │
    └── Is it in §5 "What Gets Replaced"?
           └── One of four Governing Rule criteria + written justification + Philip sign-off + full ADR + rollback plan.
```

The default answer at every branch is **conserve**. Only a very high-signal case moves through to extend, deprecate, or replace.

---

## 11. Amendment Process

This document is amended when:

1. A new stays-as-is component is discovered (e.g., a subsystem I missed in the audit)
2. A new extension lands (adds a row to §3)
3. A deprecation is proposed (adds a row to §4 with 12-month notice)
4. A replacement is proposed (adds a row to §5 with justification)
5. The Governing Rule itself is challenged (requires Philip sign-off + full ADR)

Amendments are versioned in the header. Prior versions archived at `docs/architecture/history/migration-strategy-v{n}.md`.

Every amendment references:
- The specific ADR that triggered it
- The specific delta doc row it affects
- The impact on Trade Center Week 1–4 backlog

---

## 12. Referenced Docs

- `TRADE_CENTER_PLATFORM_DELTA.md` — the audit that produced these decisions (companion doc)
- `TRADE_CENTER_2_SPEC.md` — product/UX overlay (kept with reconciliation header)
- `TRADE_CENTER_DESIGN_PRINCIPLES.md` — feature approval gate (kept with reconciliation header)
- `TRADE_CENTER_PLATFORM_ARCHITECTURE.md v1.1` — to be revised per §6
- `TRADE_CENTER_PLATFORM_ROADMAP_2035.md` — strategic positioning (kept with reconciliation header)
- `src/platform/registryKit/CONSTITUTION.md` — Platform Constitution (source of truth)
- `src/platform/registryKit/ARCHITECTURE.md` — Registry architecture (source of truth)
- `src/platform/registryKit/ROADMAP.md` — M3–M10 execution roadmap (source of truth)
- `src/platform/registryKit/PLATFORM_DECISIONS.md` — ADR log (where Trade Center ADRs land)
- `src/platform/registryKit/PLATFORM_MATURITY_MODEL.md` — objective scorecard (Trade Center exits map here)
- `src/platform/design/CONSTITUTION.md` — Design Constitution (source of truth)
- Memory pin: `project_protect_existing_platform_investment.md`

---

**End of migration strategy.**

*The strongest architectural decision is the one that leaves 24 major components + 27 apps + 32 ADRs untouched. Trade Center's competitive advantage is not built by tearing down. It's built by adding 15 new features to a platform that already ships 80% of what construction professionals need.*

*This document is the audit trail. Every future change traces back here.*
