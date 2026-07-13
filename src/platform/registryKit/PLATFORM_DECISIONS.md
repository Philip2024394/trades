# PLATFORM DECISIONS — ADR log

**Purpose.** An append-only log of every significant architectural
decision. Both humans and AI consult this file before any structural
change to avoid unwittingly undoing deliberate choices.

**Governance.** Ratified by Constitution Amendment 4 (2026-07-05).

**Rules:**
- Every ADR is append-only. Never edit; supersede via a new entry.
- Every ADR must include: id, date, problem, options considered,
  chosen solution, why chosen, trade-offs, impact, migration
  required, Constitution references, related milestones.
- Superseded ADRs are marked `Status: SUPERSEDED by ADR-NNN`.
- ADR-001 through ADR-010 are retroactive seeds capturing the M1–M2
  decisions made before the ADR log existed.

**Format template:**

```markdown
## ADR-NNN — <title>
- Status: PROPOSED | ACCEPTED | SUPERSEDED by ADR-XXX | REJECTED
- Date: YYYY-MM-DD
- Milestone: M<N>
- Constitution refs: <sections>

### Problem
<what forced the decision>

### Options considered
1. …
2. …

### Chosen solution
<one paragraph>

### Why chosen
<key reasons>

### Trade-offs
<what we give up>

### Impact
- Code:
- Performance:
- Scale:
- DX:
- AI:

### Migration required
<none | scope>

### Related
<milestones, ADRs>
```

---

## Index

| ADR | Title | Status | Milestone |
|---|---|---|---|
| 001 | Registry Kit uses composition, not inheritance | ACCEPTED | M1 |
| 002 | Registry migrations use facade pattern with zero breaking changes | ACCEPTED | M1 |
| 003 | RegistrationBase is extended only additively | ACCEPTED | M1 |
| 004 | AI Gateway stays outside registryKit (future AI Provider Manager) | ACCEPTED | M1 |
| 005 | shadcn/ui = implementation, Design Registry = catalogue | ACCEPTED | M2 |
| 006 | React Hook Form + Zod is the platform form standard | ACCEPTED | M2 |
| 007 | Business Operating System reframing supersedes "website builder" | ACCEPTED | M2 |
| 008 | Chief Platform Architect 5-phase batch process | ACCEPTED | M3 (prep) |
| 009 | Platform Maturity Model replaces feature-count reporting | ACCEPTED | M3 (prep) |
| 010 | Platform Review Board + Platform Health Report + ADR log | ACCEPTED | M3 (prep) |
| 011 | layoutRegistry = patterns; blueprintRegistry = instances | ACCEPTED | M3 B1 |
| 012 | Container scope focused on genuine layout primitives | ACCEPTED | M3 B2 |
| 013 | Container tier field required (layout / content / utility) | ACCEPTED | M3 B2 |
| 014 | themeRegistry ships now with brandRegistry migration path | ACCEPTED | M3 B2.5 |
| 015 | Registry Relationships (RGP-6) + 18-layer canonical model | ACCEPTED | M3 B2 |
| 016 | Business Growth Intelligence — 5-registry design | ACCEPTED | M3 B4.5 |
| 017 | Playbooks as reusable single-concern patterns with typed facets | ACCEPTED | M3 B4.5 |
| 018 | Website Recipes as lightweight orchestrators (no duplicated logic) | ACCEPTED | M3 B4.5 |
| 019 | StrategyResolver as separate service, not composer responsibility | ACCEPTED | M3 B4.5 |
| 020 | facetKindRegistry as extensibility mechanism for new subsystems | ACCEPTED | M3 B4.5 |
| 021 | Composer-as-assembler — one LLM call max (Step 1 classification) | ACCEPTED | M3 B4.5 |
| 022 | Evidence + Outcome + Merchant Preferences + Business Capability deferred to M5/M6 | ACCEPTED | M5/M6 planned |

---

## ADR-001 — Registry Kit uses composition, not inheritance
- Status: ACCEPTED
- Date: 2026-07-05
- Milestone: M1
- Constitution refs: Registry Rules; Code Standards

### Problem
9 hand-rolled registries had drifted apart. Extracting a shared base
was required. Do we use class inheritance (`class SectionRegistry
extends BaseRegistry`) or composition (`createRegistry<T>(config)`
factory returning an object)?

### Options considered
1. Class inheritance — every domain registry extends BaseRegistry.
2. Composition factory — `createRegistry<T>(config)` returns a typed
   object; domain-specific methods layer on via facade.
3. Do nothing — leave drift alone.

### Chosen solution
Composition factory. Each existing registry keeps its shape and adds
its unique methods (`.rank()`, `.resolveDependencies()`,
`.neighbours()`, `.resolve()`) by wrapping the factory output in a
facade.

### Why chosen
- TypeScript inference on domain-specific extensions is cleaner with
  object composition than class inheritance.
- Facades encapsulate legacy method names (`.require()` vs
  `.getOrThrow()`) without polluting the base.
- Additive migration path — 0 breaking changes for existing callers.

### Trade-offs
- Slightly more boilerplate per facade vs class extension.
- Two vocabularies (`inner` + facade) in each migrated registry.

### Impact
- Code: ~600 LOC new (`registryKit/`), ~40 LOC per registry facade.
- Performance: identical to hand-rolled Map lookup.
- Scale: unchanged — Map<string,T> scales to millions.
- DX: uniform 18-method surface across every registry.
- AI: `.describe()` + `.search()` universally available.

### Migration required
9 registries migrated via facade — none required consumer code changes.

### Related
Milestone 1. Related: ADR-002 (facade), ADR-003 (additive extensions).

---

## ADR-002 — Registry migrations use facade pattern with zero breaking changes
- Status: ACCEPTED
- Date: 2026-07-05
- Milestone: M1
- Constitution refs: Registry Rules; Code Standards

### Problem
Migrating 9 registries onto the kit could break 100+ consumer files.

### Options considered
1. Big-bang migration — change every consumer at once.
2. Facade — each registry's public API stays 1:1; the facade
   normalises raw manifests into `RegistrationBase`.
3. Parallel new registries — deprecate old ones over time.

### Chosen solution
Facade. Each existing registry's public API preserved verbatim. Raw
manifests (e.g. `PackManifest`, `PaymentProcessor`) are normalised
into `X & RegistrationBase` internally by a `normalise()` helper.

### Why chosen
- Zero consumer code change across ~100 files.
- Legacy `FrozenXManifest` type re-exports preserve type imports.
- Enrichment is opt-in — new files can pass full `RegistrationBase`
  fields.

### Trade-offs
- Legacy paths keep less-informative defaults (derived name from
  slug for payment processors, etc.) until each is enriched.

### Impact
- Code: 0 consumer changes.
- Performance: identical.
- DX: existing patterns keep working.

### Migration required
Additive per registry. Each migration is one file.

### Related
ADR-001, ADR-003.

---

## ADR-003 — RegistrationBase is extended only additively
- Status: ACCEPTED
- Date: 2026-07-05
- Milestone: M1 (initial) + M2 (Constitution v1 fields) + M2 (M2
  amendment fields)
- Constitution refs: Registry Rules

### Problem
The Registry Kit's `RegistrationBase` will accumulate fields over
time as the Constitution grows. Do we bump a major version each time,
or evolve additively?

### Options considered
1. Bump a kit major version + migrate every registry when
   `RegistrationBase` changes.
2. Every new field is optional; existing registrations remain valid.

### Chosen solution
Every new `RegistrationBase` field is optional. The kit's minor
version bumps on additions; major bumps only on removals.

### Why chosen
- Zero code churn per amendment.
- Enrichment is progressive per registration file.

### Trade-offs
- Over time, many registrations may carry sparsely-populated
  Constitution metadata.

### Impact
- Code: additive edits to `types.ts`.
- Migration: none per existing registry.

### Migration required
Never.

### Related
Constitution Amendments 1–2. Extended by Amendments 3–4.

---

## ADR-004 — AI Gateway stays outside registryKit
- Status: ACCEPTED
- Date: 2026-07-05
- Milestone: M1
- Constitution refs: AI Rules

### Problem
`aiGateway` is a provider router with register / list / pick / complete
methods. Structurally it looks like a registry. Should it be migrated?

### Options considered
1. Migrate `aiGateway` behind the same kit facade as the others.
2. Keep it separate — it's a different architectural concern (routing
   + health + budget + failover), not content cataloguing.

### Chosen solution
Keep separate. `aiGateway` will move to a dedicated **AI Provider
Manager** subsystem in a later milestone.

### Why chosen
- Registry Kit governs *content* metadata; AI Gateway governs
  *runtime provider selection*.
- Different concerns → different lifecycles.
- Avoids conflating content registries with routing infrastructure.

### Trade-offs
- Two "provider registration" patterns coexist until the AI Provider
  Manager ships.

### Impact
- Code: no change today.
- Future: dedicated AI Provider Manager milestone.

### Migration required
None today.

### Related
Future AI Provider Manager (post-M9).

---

## ADR-005 — shadcn/ui = implementation, Design Registry = catalogue
- Status: ACCEPTED
- Date: 2026-07-05
- Milestone: M2
- Constitution refs: Design System (§Amendment 1)

### Problem
Two parallel design systems existed:
- `src/components/ui/*` (7 shadcn files)
- `src/platform/design/components/*` (7 Design Registry entries)

The Constitution requires ONE source of truth.

### Options considered
1. Merge `ui/` into `platform/design/components/` — big refactor.
2. Make Design Registry the catalogue-of-record; every shadcn file
   also self-registers.
3. Deprecate one in favour of the other.

### Chosen solution
Option 2. shadcn files under `src/components/ui/*` stay untouched
(implementation). Companion registration files under
`src/platform/design/components/primitives/*` catalogue each shadcn
primitive with Constitution metadata. Consumers import from
`ui/`; AI + marketplace read from the Design Registry.

### Why chosen
- Zero consumer disruption.
- Design Registry becomes the AI-discoverable single source of truth.
- shadcn's per-file pattern preserved.

### Trade-offs
- Two files per primitive (implementation + registration). Enforced
  by convention; a linter check could enforce.

### Impact
- Code: registration wrappers under `primitives/`.
- Scale: 25 primitives registered; scales to 500+.
- AI: uniform `describe()` + `search()` across primitives.

### Migration required
Additive.

### Related
M2 Batch 9. Constitution Amendment 1.

---

## ADR-006 — React Hook Form + Zod is the platform form standard
- Status: ACCEPTED
- Date: 2026-07-05
- Milestone: M2
- Constitution refs: Approved Core Libraries (§Forms + §Validation)

### Problem
Sections used raw HTML `<input>` + `<textarea>` with no validation.
Constitution requires a form architecture. Which libraries?

### Options considered
1. React Hook Form + Zod (spec-named).
2. Formik + Yup.
3. TanStack Form + Zod.

### Chosen solution
React Hook Form + Zod + `@hookform/resolvers/zod`. Matches the
Constitution's approved library list verbatim.

### Why chosen
- Constitution-named.
- Small runtime footprint.
- Excellent shadcn/ui integration.
- Zod schemas double as documentation.

### Trade-offs
- Requires "use client" boundary on form-owning components.

### Impact
- Code: `<Form>` + `<FormField>` primitives + Zod schemas.
- Scale: schema-per-form; no shared runtime.
- DX: single form pattern across every section + app.

### Migration required
Per-section on their own schedule (contact.split_1 retrofit shipped
as reference).

### Related
M2 Batch 7. Related: ADR-005.

---

## ADR-007 — Business Operating System reframing supersedes "website builder"
- Status: ACCEPTED
- Date: 2026-07-05
- Milestone: M2 (adopted post-M2)
- Constitution refs: Amendment 2

### Problem
"AI website builder" ceiling matches Loveable. We aim higher.

### Options considered
1. Continue as "AI website builder"; add features until we match
   Loveable.
2. Reframe as a Business Operating System generator; every generated
   deliverable is a stack of Business → Brand → Theme → Tokens →
   Nav → Layouts → Containers → Sections → Components → Apps →
   CRM → Bookings → Payments → Analytics → SEO → Automation →
   Publishing.

### Chosen solution
Option 2. Constitution Amendment 2 codifies the 18-layer stack.

### Why chosen
- Different structural ceiling: Loveable generates interfaces; we
  generate business systems.
- Every layer becomes a versioned, marketplace-ready subsystem.
- AI composes from registries; no LLM generates layouts.

### Trade-offs
- Larger scope. M3 grew from 3–4 weeks to 12–16 weeks.
- Longer overall calendar.

### Impact
- Code: no direct impact on existing code.
- Roadmap: every subsequent milestone framed by "which layer are we
  completing?"
- AI: Composition Engine v2 walks the layer stack top-to-bottom.

### Migration required
Documentation only.

### Related
Constitution Amendment 2. Roadmap v1.1.

---

## ADR-008 — Chief Platform Architect 5-phase batch process
- Status: ACCEPTED
- Date: 2026-07-05
- Milestone: M3 (prep)
- Constitution refs: Amendment 3

### Problem
Batches were freeform. Silent architectural drift was possible.

### Options considered
1. Freeform batches — trust the engineer to review.
2. Mandatory 5-phase process — Architecture Review → Improvement
   Proposal → Batch Plan → Implementation → Batch Report.

### Chosen solution
Option 2. Every batch begins with Phase 1 and ends with Phase 5.
Skipping phases is a Constitutional violation.

### Why chosen
- Prevents silent architectural drift.
- Improvement proposals surface *before* implementation.
- Batch reports provide audit trail.

### Trade-offs
- Overhead per batch (~10-15% of time).

### Impact
- DX: every batch is inspectable end-to-end.
- Quality: architectural decisions surface before code.

### Migration required
Cultural — from Batch 1 of M3 onward.

### Related
Constitution Amendment 3.

---

## ADR-009 — Platform Maturity Model replaces feature-count reporting
- Status: ACCEPTED
- Date: 2026-07-05
- Milestone: M3 (prep)
- Constitution refs: Amendment 3

### Problem
"M3 is complete" tells nothing about platform readiness. Feature
counts don't measure production quality.

### Options considered
1. Feature-count reporting (current).
2. Platform Maturity Model — 12 dimensions × weighted sub-metrics.

### Chosen solution
Option 2. `PLATFORM_MATURITY_MODEL.md` is the reporting standard.
Every batch + milestone report cites PMM deltas.

### Why chosen
- Objective measurement.
- Forces honest reflection on production-readiness gaps.
- Governance tie-breaker: lift low-scoring dimensions first.

### Trade-offs
- Score methodology is arguable; sub-metric weights may need
  amendment over time.

### Impact
- Governance: all future milestone completion claims cite PMM.
- Scale: measurements defined per dimension against target scale.

### Migration required
Reporting only.

### Related
Constitution Amendment 3.

---

## ADR-010 — Platform Review Board + Platform Health Report + ADR log
- Status: ACCEPTED
- Date: 2026-07-05
- Milestone: M3 (prep)
- Constitution refs: Amendment 4

### Problem
The 5-phase process specifies *when* to review but not *what* to
review. Milestones close without a structured health check.

### Options considered
1. Leave Phase 1 freeform.
2. Formalise via PRB (per-batch structured questions) + PHR
   (per-milestone health report) + ADR log (append-only decisions).

### Chosen solution
Option 2. Constitution Amendment 4 codifies all three.

### Why chosen
- PRB questions force scale + enterprise + AI-determinism thinking
  every batch.
- PHR provides structured evidence a milestone is truly complete.
- ADR log preserves the "why" behind every architectural choice.

### Trade-offs
- More documentation. Judged worth it for a multi-year platform.

### Impact
- Governance: structured review gate.
- DX: any future engineer / AI can read the ADR log to understand
  design.

### Migration required
Governance only. First application: M3 B1.

### Related
Constitution Amendment 4.

---

## ADR-011 — `layoutRegistry` = layout patterns; `blueprintRegistry` = concrete instances
- Status: ACCEPTED
- Date: 2026-07-05
- Milestone: M3 Batch 1
- Constitution refs: Amendment 2 (Business OS §Layouts); Amendment 5
  (Registry Governance Principle §RGP-1)

### Problem
The original M3 plan proposed `layoutRegistry` as a new registry with
12 entries (Landing, Trades, Ecommerce…). But `blueprintRegistry`
already stores 52 concrete layouts — each a full page composition for
a specific trade. Without discipline, the two registries would
duplicate responsibility, violating RGP-1.

### Options considered
1. Ship `layoutRegistry` with 12 pattern entries + leave
   `blueprintRegistry` unchanged, no relationship between them.
2. Deprecate `blueprintRegistry` and re-encode every blueprint as a
   layout entry.
3. Two-tier abstraction: `layoutRegistry` = 12 abstract patterns
   ("what does a Trades page look like structurally?"),
   `blueprintRegistry` = 52 concrete instances ("what does an
   emergency plumber's Trades page look like specifically?"), with
   an optional `layoutId?` field on `BlueprintManifest` linking
   instances to patterns.

### Chosen solution
Option 3. `layoutRegistry` holds reusable Layout Patterns.
`blueprintRegistry` holds Blueprint Instances. Blueprints declare
`layoutId?: string` pointing at the layout pattern they instance-of.
`layoutId` is optional to preserve backward compatibility for the
52 existing blueprints.

### Why chosen
- **RGP-1 compliant.** No duplication — different abstraction levels.
- **Backward compatible.** All 52 existing blueprints keep working.
- **AI composition cleaner.** Composer step 4 selects a Layout
  Pattern from 12 candidates; step 5 filters Blueprints matching
  that layout + the trade.
- **Third-party friendly.** New blueprints can publish against
  existing layout patterns without inventing structural patterns.
- **Future dark-mode / mobile variants** attach to Layout Patterns,
  not per-blueprint (single source of variant strategy).

### Trade-offs
- Two registries to maintain rather than one.
- Blueprint authors must (eventually) declare `layoutId`. Optional
  today; may become required in a later ADR.

### Impact
- Code:
  - `BlueprintManifest` gains optional `layoutId?: string` field.
  - New `layoutRegistry` shipped empty in B1; populated in B4.
- Performance: negligible — one extra Map lookup per composition.
- Scale: `layoutRegistry` stays small (< 50 entries expected);
  `blueprintRegistry` scales without change.
- DX: pattern-then-instance is a familiar mental model
  (class/instance in OO, prototype/product elsewhere).
- AI: Composition Engine v2 step 4 becomes an explicit deterministic
  selector against 12 patterns rather than an implicit scan of 52
  blueprints.

### Migration required
- **B1:** add optional `layoutId?` field to `BlueprintManifest` type.
  Zero blueprints changed.
- **B4:** ship 12 Layout Pattern registrations + retrofit 52
  blueprints to declare their `layoutId`.
- **B8:** Composition Engine v2 walks both tiers.

### Related
Milestones: M3 B1 (this batch), B4 (population), B8 (AI wiring).
ADRs: ADR-001 (kit), ADR-002 (facade migrations).

---

## ADR-012 — Container scope focused on genuine layout primitives
- Status: ACCEPTED
- Date: 2026-07-05
- Milestone: M3 Batch 2
- Constitution refs: Amendment 1 §Container System; Amendment 5 §RGP-1

### Problem
The M3 plan originally listed 10 containers for B2: Timeline, Booking,
Pricing, Gallery, Portfolio, Comparison, Dashboard shell, Floating,
Accordion, Wizard. Phase 1 review found that 5 of these violate
RGP-1 (Uniqueness of Responsibility) — they duplicate work already
handled by other registries or achievable via composition.

### Options considered
1. Ship all 10 as originally planned.
2. Reclassify the 5 overlapping items to their proper registries
   and reduce B2 to 5 genuine containers.
3. Ship 10 with alias metadata pointing at the "real" component.

### Chosen solution
Option 2. B2 ships 5 focused containers: Timeline, Comparison,
Dashboard-shell, Floating, Wizard. The other 5 are reclassified:
- Booking → `bookingRegistry` flow templates (B7)
- Pricing → `pricing.three_tier_1` (existing section) + composition
- Gallery → `gallery.grid_1` (existing section) + composition via
  `containers.grid` + image children (with `gallery` as search alias)
- Portfolio → future portfolio section (M4) or composition via
  `containers.masonry` + case-study cards
- Accordion → `data-display.accordion` (existing shadcn primitive)
  + `faq.accordion_1` (existing section)

Search aliases added to `containers.grid`: `["gallery", "pricing"]`
so intent search still finds a valid answer.

### Why chosen
- Preserves RGP-1: no duplicated responsibility.
- Reduces client bundle by ~10 KB.
- Enterprise-defensible catalogue (a Fortune 500 architect would
  reject the duplicated widgets).
- AI composer has exactly one right answer for each intent.
- Composition already covers all 5 use cases.

### Trade-offs
- Merchants searching for "gallery container" or "pricing container"
  find `containers.grid` via alias — indirection. Documentation must
  make this obvious.
- Wizard becomes a joint deliverable with the Forms Framework (B5).

### Impact
- Code: 5 fewer container files. 2 alias entries on `containers.grid`.
- Performance: ~10 KB bundle reduction.
- Scale: catalogue stays at ~15 containers instead of 20.
- DX: cleaner picker; fewer questions.
- AI: fewer ambiguous overlaps to score.

### Migration required
None. Additive alias entries only.

### Related
Milestones: M3 B2 (this batch). ADRs: ADR-005 (Design Registry as
catalogue), ADR-013 (tier field).

---

## ADR-013 — Container tier field required (layout / content / utility)
- Status: ACCEPTED
- Date: 2026-07-05
- Milestone: M3 Batch 2
- Constitution refs: Amendment 1 §Container System; Amendment 6 §RGP-7

### Problem
The M3 architecture pack (§7) defines three container tiers (Layout /
Content / Utility) but only in prose. The Layout Engine at B4 needs
to enforce composition rules ("exactly one layout-tier root per
page", "utility tiers wrap without slotting"). Without a machine-
readable field, enforcement lives in human review.

### Options considered
1. Keep tier as prose documentation.
2. Add `tier` as a required field on container registrations,
   enforced by `validate` hook.
3. Encode tier in the container id prefix (e.g. `containers.l.hero`,
   `containers.c.grid`, `containers.u.overlay`).

### Chosen solution
Option 2. Container registrations declare `tier: "layout" | "content"
| "utility"`. Enforced by the `designSystemRegistry.validate` hook
when `category === "containers"`. Constitution Amendment 6 §RGP-7
codifies the rule.

### Why chosen
- Machine-readable → Layout Engine (B4) can validate at register
  time.
- AI composer performs a two-pass selection: tier-1 (root), then
  tier-2 (per slot).
- Studio picker groups containers by tier automatically.
- Constitutional; enforced platform-wide.

### Trade-offs
- Existing 10 container registrations must be backfilled with tier
  values (mechanical — one line each).
- Third-party container authors must declare tier or fail validation.

### Impact
- Code: `DesignComponentRegistration` type gains optional `tier`
  field; validate hook enforces required when category = containers.
- 10 existing container files gain one line each.
- Performance: neutral.
- Scale: enables 500+ containers with deterministic composition.
- AI: more deterministic composition (fewer ambiguous options).

### Migration required
Backfill 10 existing container files in B2 alongside the 5 new
containers.

### Related
ADR-012 (scope). ADR-011 (layout patterns reference containers by
id — now also by tier).

---

## ADR-014 — themeRegistry ships now with brandRegistry migration path
- Status: ACCEPTED
- Date: 2026-07-05
- Milestone: M3 Batch 2.5
- Constitution refs: Amendment 1 §Themes; Amendment 5 §RGP;
  Amendment 6 §RGP-6

### Problem
`themePresets.ts` is a hardcoded object with 6 entries. The updated
Scalability Rule (Master Prompt) targets 1,000+ themes. A hardcoded
object violates both the Scalability Rule and RGP-1 (no
REGISTRY_METADATA, no `.selfCheck()`, no `.search()`, no lifecycle).

### Options considered
1. Leave `themePresets.ts` as an object; migrate later.
2. Migrate to a dedicated `themeRegistry` today; risk future rework
   when brand system arrives.
3. Migrate to `themeRegistry` today; design it as a future child of
   `brandRegistry` (a broader Brand System registry planned for M4+)
   without breaking APIs.

### Chosen solution
Option 3. Ship `themeRegistry` under `src/platform/themes/` using
`createRegistry` from registryKit. Declare `futureParent:
"brandRegistry"` in its REGISTRY_METADATA. When `brandRegistry` lands
(M4+), themes become one facet of a Brand alongside typography, icon
packs, illustration packs, animation packs, gradients, shadows,
tokens, colour systems and brand overrides.

The migration path is preserved in the metadata itself — no future
API break required. Consumers use `themeRegistry.list()` today;
after brandRegistry lands, they use `brandRegistry.forActiveBrand().themes.list()`
which resolves internally to the same registry.

### Why chosen
- Scales to 1,000 themes today.
- Removes RGP violation.
- Preserves a clean migration path via `futureParent` metadata field
  (introduced by Amendment 6 §RGP-6).
- All Constitution API surface available immediately.

### Trade-offs
- Requires a second migration when brandRegistry lands.
- Existing `themePresets` callers see the same API via a thin
  facade (M1 pattern proven).

### Impact
- Code: new registry under `src/platform/themes/`. Existing
  `themePresets.ts` becomes a facade re-exporting from
  `themeRegistry`. Six existing presets registered at module load.
  `suggestThemeForTrade()` becomes `themeRegistry.rank()` with the
  existing scoring formula preserved.
- Performance: identical.
- Scale: unlocks 1,000+ theme roadmap.
- DX: consistent registry API across every Business OS layer.

### Migration required
- **B2.5** (approved batch): ship themeRegistry + facade. Zero
  consumer changes.
- **Future** (M4+ when brandRegistry lands): themes become a child of
  brandRegistry. Facade layer absorbs the change; consumers unaffected.

### Related
ADR-011 (facade pattern). ADR-015 (relationship metadata makes future
migration explicit).

---

## ADR-015 — Registry Relationships (RGP-6) + 18-layer canonical model
- Status: ACCEPTED
- Date: 2026-07-05
- Milestone: M3 Batch 2
- Constitution refs: Amendment 2 §Business OS; Amendment 6 §RGP-6

### Problem
Registries have grown to 15 (10 pre-M3 + 5 in B1). Each declares
`REGISTRY_METADATA` (owner, purpose, lifecycle, PMM impact) but
nothing about how it sits in the platform graph. Missing metadata:
- Which Business OS layer does it back?
- Which registries does it depend on?
- Which registries depend on it?
- Is it composed into a larger registry, or standalone?
- Is it plugin-compatible?

Without this, AI reasoning about cross-registry composition is
implicit. Dependency validation is impossible. Plugin loading and
marketplace packaging have no schema to work against. Lazy loading
cannot be automated.

### Options considered
1. Leave relationships implicit; humans track dependencies via ADRs.
2. Add a `relationships` object to every registry's
   `REGISTRY_METADATA`.
3. Build a separate `platformDependencyGraph.ts` file listing
   relationships centrally.

### Chosen solution
Option 2. Every registry's `REGISTRY_METADATA` gains a
`relationships` object with:
- `businessOsLayer: number` — 1..18 per Amendment 6 canonical list
- `upstreamDependencies: string[]` — registries this reads from
- `downstreamDependents: string[]` — registries that consume this
- `composition: "root" | "intermediate" | "leaf" | "standalone"`
- `pluginCompatible: boolean` — third-party extensibility
- `futureParent?: string` — planned parent registry migration path

Backfill applies to all 15 existing registries in M3 B2.5 alongside
the themeRegistry migration.

### Why chosen
- Metadata lives with the code it describes (Option 3's central file
  drifts).
- AI composition can walk the graph deterministically (upstream →
  downstream) — no LLM required for dependency chains.
- Marketplace packaging becomes automatic: installing an App declares
  what it depends on; the platform can auto-install missing pieces
  from the relationship graph.
- Plugin loading gains a native compatibility check
  (`pluginCompatible: true` = accepts third-party registrations).
- Lazy loading strategy becomes explicit ("this leaf registry is
  never needed at cold boot").
- Enterprise onboarding — new engineers read the graph, not code.

### Trade-offs
- 15 existing registries backfill in B2.5 (mechanical).
- Every future registry must declare relationships or fail RGP
  compliance.

### Impact
- Code: `REGISTRY_METADATA` type gains `relationships` object.
- Data: 15 existing files updated with declared relationships.
- Performance: neutral.
- Scale: foundation for automatic dependency-aware install / lazy
  load / plugin lifecycle at 500+ registries.
- AI: composer walks a graph, not a bag.
- DX: dependency graph is discoverable via
  `platformDependencyGraph.ts` (auto-generated from metadata).

### Migration required
- **B2.5**: backfill all 15 existing REGISTRY_METADATAs with
  `relationships` object. Type extension in registryKit types.ts.
- **Future registries**: declare relationships at creation.

### Related
Amendment 6 (adopts canonical 18-layer model + declares relationship
fields). ADR-011 (layouts / blueprints). ADR-014 (themeRegistry
futureParent migration path).

---

## ADR-023 — Booking is strategy-aware; four flow shapes cover the market

**Status:** accepted · **Date:** 2026-07-05 · **Batch:** M3 B7

### Context
Booking is where the CUSTOMER first experiences the merchant's
strategy. A carpenter selling doors and an emergency plumber
should never see the same flow. But we cannot ship a bespoke flow
per merchant — it must be strategy-driven, not hand-built.

### Decision
`bookingRegistry` extends `consumesFacets[]` and gains
`rank(strategy)` + `recommend(strategy)`. Four seed flows cover
the market:

1. **simple-service-booking** — pick service → date → info → confirm.
2. **emergency-callout** — Emergency? gate → Call Now / Book Emergency Visit.
3. **consultation-appointment** — showroom → budget → style → optional deposit.
4. **quote-only** — single-page quote request, no calendar.

Playbooks now contribute booking facets:
- `quote-driven` → `booking.flowKind: simple`, `depositPolicy: none`, `availability: next-available`.
- `emergency-response` → `booking.flowKind: emergency`, `gate: emergency`, `availability: callback-only`.
- `premium-luxury` → `booking.flowKind: consultation`, `depositPolicy: optional`, `availability: consultation`.

Runtime = `<StrategyAwareBookingFlow strategy={resolved} />`.

### Consequences
- Same engine, different customer experience per merchant.
- Adding a fifth flow (installment-plan, subscription, etc.) is one
  file + one facet — no changes to the runtime shell.
- Non-M3 booking integrations (Stripe deposit, Google/Outlook calendar)
  are hung off `requiresIntegration` step fields; the integrations
  themselves ship as adapters in a future batch.

### Related
Amendment 7 (Business Growth Intelligence). ADR-021 (Composer as
assembler).

---

## ADR-024 — Strategy Explainer is a merchant-facing service, not a registry

**Status:** accepted · **Date:** 2026-07-05 · **Batch:** M3 B7

### Context
Merchants distrust systems they cannot see through. The Platform
was accumulating decisions (CTA labels, dashboard tiles, hero
styles, booking flows) with no way for the merchant to answer
"why is my website built this way?"

We considered a full `explanationRegistry` — but the answer is
already in ResolvedStrategy's provenance. Merchants don't need
another registry; they need vocabulary translating facet slugs
into English.

### Decision
`strategyExplainer` service (`src/platform/business/explainer/`):

- **Types**: `StrategyExplanation` (summary + context + provenance + decisions).
- **Vocabulary**: static `PHRASE_RULES` array mapping `(domain, field, value)` → human sentence + bucket.
- **explain(strategy)**: pure function; no LLM; walks phrase rules against ResolvedStrategy.
- **StrategyExplainerPanel**: React UI grouped by bucket (Website / Booking / Dashboard / SEO / Marketing / Trust / Content), collapsible, cites playbooks with confidence %.

Skipping unknown facets silently — vocabulary grows without breaking.

### Consequences
- Merchant transparency ships in one batch.
- Playbook provenance becomes user-facing — accountability for the
  Platform's decisions is visible.
- The vocabulary is the single point of natural-language expansion.
  When a new facet kind is registered, one phrase rule = one
  merchant-visible sentence.
- Prepares the ground for M6's evidenceRegistry — the explainer
  already surfaces `confidence` and can absorb evidence dimensions
  without an API break.

### Related
Amendment 7 §Playbooks + Provenance. ADR-016 (5-registry business
intelligence). ADR-021 (Composer as assembler).

---

## ADR-025 — Trade Intelligence Registry is the moat, not another facet

**Status:** accepted · **Date:** 2026-07-05 · **Batch:** M3 B8 (Phase 1)

### Context
Every website builder can render sections and prompt an LLM. What
they cannot easily copy is **trade-specific business knowledge**:
that carpenters make money from fire doors and lose it on small
repairs; that electricians live and die on emergency response
time; that kitchen companies hide prices and sell showroom visits.

Encoding that as prompts is brittle. Encoding it as data —
structured, versioned, evidence-tracked — is the moat.

### Decision
`tradeIntelligenceRegistry` at Business OS Layer 1. Each entry
declares: business goals, service economics (margin bands, survey
requirements, regulation flags), trust builders, image strategy
(priority order + gallery mix + minimum photo counts), pricing
presentation, primary CTA, content flow, SEO keyword templates,
common FAQs + objections, buying journey, seasonality, positioning
modifiers (emergency / luxury / commercial / residential /
premium / budget overrides), and compliance requirements.

Every seed carries `TradeEvidence { confidence, strength,
sampleSize, marketsValidated, sources, lastReviewed }`. v1 seeds
ship at `strength: "anecdotal"`, `confidence: 60`, `sampleSize: 0`
— honest by construction. Numbers that cannot be sourced (e.g.
average job value) are OMITTED rather than fabricated.

Phase 2 (Industry Research Framework) upgrades strength to
`measured`. Phase 5 (Evidence & Outcome Engine) upgrades to
`validated` based on merchant outcomes.

### Consequences
- Trade knowledge becomes discoverable, versioned, and auditable.
- Adding a new trade = one file. Adding a new *country* for an
  existing trade = one entry in `countries[]` + localised
  positioning overrides.
- Restaurants + hospitality fit the same manifest — the schema is
  business-elastic without needing a hospitality schema.
- Evidence honesty prevents the "confident-sounding but made-up"
  failure mode that has plagued LLM-authored content.

### Related
Phase 2 (Industry Research Framework). Phase 5 (Evidence &
Outcome Engine). Amendment 7. ADR-016.

---

## ADR-026 — Trade → Playbook cascade: trade contributes first

**Status:** accepted · **Date:** 2026-07-05 · **Batch:** M3 B8 (Phase 1)

### Context
Facet merging previously ran over `recipe.playbooks` only. Now
that Trade Intelligence contributes facets too, the resolver needs
an unambiguous order.

### Decision
StrategyResolver folds facet contributions in this fixed order:

1. **Trade Intelligence base** — derived from the merchant's
   `profile.trade`. Sets defaults for CTA, pricing, gallery mix,
   trust builders, and sections emphasis.
2. **Playbooks in recipe order** — recipe-declared playbooks
   layer over trade defaults.
3. **Positioning-triggered extra playbooks** — trade's positioning
   modifier (e.g. `luxury` → `premium-luxury` playbook) folds in
   next.
4. **Recipe overrides** — always win last.

Per-facet merge strategy still governs how contributions combine
(override / union / intersection / highest-confidence / custom).

Trade contributions are attributed to `trade:<slug>` in
provenance; positioning-extra playbooks carry their normal slug.

### Consequences
- Every ResolvedStrategy has a base cascade even when the recipe
  has zero playbooks — never a blank site.
- Provenance is fully traceable: the explainer can say "gallery
  mix comes from your trade" vs "CTA overridden by
  emergency-response playbook".
- Playbooks can be more surgical — they only override the trade
  where they genuinely add value, not restate defaults.
- Adding a new trade automatically improves every recipe that uses
  it. No recipe author has to know about new trades.

### Related
ADR-025 (Trade Intelligence). ADR-021 (Composer as assembler).

---

## ADR-027 — Business Evidence Framework, not "Industry Research"

**Status:** accepted · **Date:** 2026-07-05 · **Batch:** M3 B8 (Phase 2)

### Context
Phase 2 of the Business Growth Intelligence direction. Previous
name "Industry Research Framework" implied an internal
documentation system. The reality is a live **evidence engine**
that consumes multiple input types and produces confidence
increments.

### Decision
Rename to **Business Evidence Framework**. Ship two registries at
Layer 1 (Business OS):

**`evidenceRegistry`** — Stage 1 raw findings. Each finding is a
structured, atomic observation with typed source (
`competitor-research | merchant-interview | a-b-test |
measured-outcome | industry-report | academic-study |
expert-opinion | internal-analysis`), typed scope (trade / country
/ goal / profileFlag), a validation lifecycle (
`draft → reviewed → approved → a-b-tested → measured → proven`),
corroboration count, and a reviewer audit trail. `draft` findings
have weight 0; only `proven` findings carry weight 1.

**`patternRegistry`** — Stage 2 aggregated conclusions extracted
from multiple findings ("82% of high-performing UK carpenter
sites…"). Candidacy lifecycle (
`proposed → adopted → rejected → superseded`). **Confidence is
derived** from underlying evidence via a fixed formula
(`EVIDENCE_STATE_WEIGHT` weighted mean + corroboration boost),
never hand-set. This is the honesty guarantee.

Stage 3 (Validation) is the lifecycle machinery baked into both
registries. Stage 4 (Outcome Feedback) lands in Phase 4 —
`studio_measured_outcomes` table shipped now with the consent flag
so the schema is ready.

Migrations:
`20260705170000_business_evidence.sql` — three tables with RLS:
`studio_evidence_findings`, `studio_evidence_patterns`,
`studio_measured_outcomes` (private-per-merchant, consent required
to publish for platform-wide learning).

### Consequences
- Confidence is honest by construction — no fabricated numbers.
  A pattern citing only `draft` evidence has confidence 0.
- Anyone can add a finding; nothing changes on the merchant surface
  until the finding progresses through the lifecycle.
- Phase 4 outcome data drops into the same schema — the loop
  becomes self-improving without an API break.
- Explainer can cite evidence (not just playbooks) — the merchant
  sees which observations back a recommendation.

### Related
ADR-025 (Trade Intelligence). ADR-028 (Playbook Rationale). Phase
4 (Outcome Feedback Engine).

---

## ADR-028 — Every playbook declares a Rationale — the "Why?" surface

**Status:** accepted · **Date:** 2026-07-05 · **Batch:** M3 B8 (Phase 2)

### Context
Merchants distrust systems they cannot see through. Playbooks
were confident but opaque — the merchant could not click
"Why is this recommended?" and get a real answer.

### Decision
`PlaybookManifest.rationale` — optional on legacy playbooks,
expected on all new playbooks. Shape:

```ts
{
  statement: string;              // "Why this playbook works" one-liner
  reasoning: string;              // Plain-English WHY, present tense
  citesPatterns?: string[];       // patternRegistry slugs
  citesEvidence?: string[];       // evidenceRegistry slugs
}
```

Playbook registry validation cross-checks every cited pattern and
evidence slug exists at load time — dangling citations fail loudly
in dev.

`explainDecision(strategy, domain, field)` API returns a
`DecisionExplanation` with the recommendation, reasoning, cited
playbooks, cited patterns with derived confidence, cited evidence
with lifecycle state, and an overall strength band
(`insufficient / emerging / moderate / high / very-high`) mapped
to a human sentence ("High — supported by platform research and
reviewed evidence").

Four playbooks backfilled with rationale in this batch:
`trust-first`, `quote-driven`, `premium-luxury`,
`emergency-response`. Rest to be backfilled progressively —
missing rationales fall back to synthesised reasoning.

### Consequences
- Every AI recommendation on the merchant surface can answer
  "Why?"
- Rationales cite structured evidence, not prompts.
- The evidence lifecycle drives the strength band — as evidence
  moves `draft → measured → proven`, the merchant sees the
  strength label improve without any code change.
- New playbooks without rationale won't fail — but reviewers can
  reject them at PR time. Cultural, not enforced.

### Related
ADR-027 (Business Evidence Framework). Amendment 7 §Playbooks.
Phase 3 (AI Composition Engine v2) will consume `rationale` when
composing AI-authored copy.

---

## ADR-029 — AI Composition Engine v2 is a Creative Director, not a page generator

**Status:** accepted · **Date:** 2026-07-05 · **Batch:** M3 B8 (Phase 3)

### Context
"AI Composition Engine v2" was originally scoped as a page
generator. That framing pushes it back into "decide layout +
theme + strategy + copy at once" — which we've already
disaggregated across ResolvedStrategy + Trade Intelligence +
Layouts + Blueprints.

The composer should NEVER decide anything it doesn't have to. It
receives a fully resolved brief and produces STRUCTURED CONTENT.

### Decision
The composer is renamed and reframed as the **AI Creative
Director**. It:

1. Accepts a `CreativeBrief` = ResolvedStrategy + brandVoice +
   projects + pageSlugs + outputMedium.
2. Dispatches to **four specialist composers** registered in a
   `composerRegistry` at Business OS Layer 15:
   - `copy` — hero, service-list, value-props, trust-copy, faq
   - `project-story` — case studies from photo metadata
   - `seo` — page structures from trade SEO templates
   - `brand-voice` — personality profile (feeds LLM adapter later)
3. Assembles output into a `ContentManifest` with typed pages +
   sections + blocks.
4. Returns deterministically. Never invents intent, layout, or
   strategy — those are inputs.

Composer specialists declare `supportedBlockKinds`,
`supportedOutputMedia`, and `backend: "template" | "llm" |
"hybrid"`. Multiple composers may register for the same slug
(template + LLM implementations); the director picks per plan
tier and cost budget. v1 ships template backends across all four.

### Consequences
- Output medium is a first-class dimension: same intelligence can
  produce a website, quote document, email campaign, Google
  Business post, brochure, SMS follow-up — v1 ships `website`;
  the shape supports the rest without schema changes.
- Adding a new content type (e.g. `case-study-summary` for LinkedIn
  posts) = one composer + one block kind. Everything else is
  reusable.
- LLM backends drop in without changes to the director — they
  register alongside template backends at the same slug.
- The registry is the single source of "what generators exist" —
  discoverable, versioned, plan-gate-able.

### Related
ADR-030 (Content Manifest with provenance). ADR-021 (Composer as
assembler). ADR-025 (Trade Intelligence). Amendment 7.

---

## ADR-030 — Every content block carries a Content Manifest with provenance

**Status:** accepted · **Date:** 2026-07-05 · **Batch:** M3 B8 (Phase 3)

### Context
Merchants regenerating an entire page to fix one hero is wasteful
and destructive of merchant edits. The alternative — free-text
LLM outputs with no addressability — makes targeted regeneration
impossible.

We also want the merchant "Why is this on my page?" button to
work for ANY block, not only the top-level strategy decisions.

### Decision
Every `ContentBlock` in a `ContentManifest` carries:

**Provenance** (`ContentProvenance`):
- `generatedBy` (composer slug) + `generatorVersion` +
  `generatorBackend` (template / llm / hybrid)
- `sources`: profile / strategy / recipe / trade / playbooks /
  patterns / evidence / knowledgeRefs
- `purpose` (trust / conversion / seo / education / reassurance /
  showcase / engagement / compliance / brand-voice)
- `audience` (optional)
- `primaryGoal` (the merchant's current growth goal)
- `confidenceBand` (inherited from strongest cited playbook)
- `generatedAt` (ISO timestamp)

**Regeneration hints** (`RegenerationHints`):
- `scopes` (block / section / page / manifest)
- `editableFields` (which fields can be edited inline without regen)
- `invalidatedBy` (which upstream sources invalidate this block)
- `regenerationHint` (merchant-facing description of what a re-run
  would achieve)

Output is STRUCTURED — never HTML or markdown. Rendering happens
later. This gives us versioning, editing, translation, analytics,
and A/B testing without redesigning the system.

`CreativeDirector.regenerate(manifest, brief, request)` supports
targeted regeneration at `block`, `section`, `page`, or `manifest`
scope; blocks outside the target set are preserved bit-for-bit
including any merchant edits.

Migration `20260705180000_content_manifests.sql` — three tables
with RLS: `studio_content_manifests`, `studio_content_blocks`
(denormalised for query + targeted regen), `studio_content_regenerations`
(audit trail).

### Consequences
- Merchant can say "regenerate the hero" and only the hero changes.
- Merchant can say "keep the strategy but make the hero more
  premium" — `overrides.brandVoice = "luxury"` re-runs only
  hero-producing composers with the new brand voice.
- Every block can answer "Why is this on my page?" — same
  explainer machinery as strategy-level decisions.
- Analytics can filter by `purpose`, `audience`, `generatedBy`,
  `generatorBackend` — cost + performance analysis is derivable,
  not bolted on.
- Same content model supports future outputs: quote docs, emails,
  ads, brochures, SMS, AI-assistant responses, portal messaging.
  The website is one output.

### Related
ADR-029 (Creative Director). ADR-024 (Explainer). ADR-027
(Evidence). ADR-028 (Playbook Rationale).

---

## ADR-031 — Business Operating Coach, not Business Advisor

**Status:** accepted · **Date:** 2026-07-05 · **Batch:** M3 B8 (Phase 4)

### Context
An advisor waits until asked. A coach watches what's happening
and proactively tells the merchant what to do next. That
distinction was surfaced by the user during Phase 4 planning.

### Decision
Ship the **Business Operating Coach** — a pure service at
Business OS Layer 16 that:

1. Consumes a `CoachContext` = ResolvedStrategy + optional
   ContentManifest + projectCount + reviewCount + certifications
   + lastStrategyReviewAt + metricValues + outputMedium.
2. Walks every registered recommendation, evaluates its condition
   against the context, and returns triggered items.
3. Groups triggered recommendations into a `BusinessHealthScore`
   across six transparent dimensions:
   Strategy Alignment / Trust / Local SEO / Portfolio /
   Conversion / Content Quality.
4. Emits a prioritised backlog ordered by (priority DESC,
   impact-weight DESC) — a **roadmap, not tips**.

Every recommendation, dimension score, and backlog item is
transparent: it cites the playbooks, patterns, and evidence
that produced it. The merchant can always ask "why is this on
my list?" and get a structured answer.

Filter for future work: **"Will this help a tradesperson win
more work, save time, or make more money?"** If a proposed
feature doesn't answer yes, it doesn't ship here.

### Consequences
- Coaching becomes data-driven, not prompt-driven.
- Adding a new coaching rule = one registered recommendation
  (condition function + rationale + provenance). No changes
  to the coach service.
- Dimension scores are traceable — merchants distrust opaque
  scores; transparent ones build trust.
- The scorecard + backlog become the primary Studio surface.
  Everything else (editors, wizards, autoFix handlers) exists
  to serve the backlog.
- Same architecture supports future outputs (quote docs,
  emails, ads) — coach recommendations can scope by
  `outputMedium`.

### Related
ADR-032 (Recommendation Registry). ADR-027 (Evidence). ADR-028
(Playbook Rationale). ADR-030 (Content Manifest — coach reads
manifests to detect content gaps).

---

## ADR-032 — Recommendation Registry: playbooks say HOW to build; recommendations say WHAT to do next

**Status:** accepted · **Date:** 2026-07-05 · **Batch:** M3 B8 (Phase 4)

### Context
The playbook registry answers "how do we build this kind of
site?" It does not answer "what's the highest-impact action for
this merchant, this week?" Attempting to encode coaching rules
as playbooks would conflate build-time patterns with runtime
diagnostics.

### Decision
`recommendationRegistry` at Business OS Layer 16. Each entry
declares:

- `dimension` — which health dimension it affects
- `category` — grouping label (strategy / trust / seo / …)
- `scope` — trades / countries / goals / profileFlags
- `condition` — pure function `(ctx: CoachContext) => RecommendationEvaluation`
- `action` — merchant-facing label + optional `autoFix.handler` slug
- `priority` (1-5) + `estimatedImpact` (high/medium/low)
- `citesPlaybooks / citesPatterns / citesEvidence` (validated at
  registration — dangling citations fail loudly)
- `rationale` — `whyItMatters` + `expectedOutcome`

Conditions are code, not data — they need to inspect ContentManifest
structure, walk facets, count items. Trying to serialise them as
JSON would either be too weak or reinvent a DSL.

The 10 seed recommendations cover the six dimensions:
Portfolio (project count vs trade minimum), Local SEO (missing
service pages + missing town pages), Trust (missing certifications
+ reviews below benchmark), Conversion (CTA mismatch with goal +
missing response-time promise for emergency trades),
Content Quality (unanswered FAQs + missing customer quotes),
Strategy Alignment (90-day review nudge).

Scoring: each dimension starts at 100 and deducts
IMPACT_WEIGHT[impact] per triggered recommendation
(high=18, medium=10, low=4), floored at 0. Overall = mean of
dimensions.

Migrations: `20260705190000_business_coach.sql` — three tables
with RLS: `studio_coach_assessments` (score snapshots),
`studio_coach_backlog_items` (persistent items with status),
`studio_coach_actions` (audit trail).

### Consequences
- Coaching rules are data-driven, discoverable, versionable.
- Same registry pattern as playbooks / patterns / evidence /
  composers — consistent developer ergonomics across the
  platform.
- AutoFix handlers form a natural extension point: Studio maps
  handler slugs to routes / wizards / regeneration calls. As
  the platform grows, more recommendations get auto-fixes;
  fewer stay "manual action."
- Evidence-cited recommendations move up in priority
  automatically as their backing evidence progresses through
  the lifecycle (Phase 2 loop closes here).

### Related
ADR-031 (Business Operating Coach). ADR-027 (Evidence).
ADR-028 (Playbook Rationale). ADR-030 (Content Manifest).

---

## ADR-032a — Trade Center overlay reconciliation with the existing platform

**Date:** 2026-07-11
**Status:** Accepted
**Category:** Governance
**Related:** All Week 0 audit findings; ADRs 033–047 that follow.

### Context
The Trade Center 2.0 positioning docs (`TRADE_CENTER_2_SPEC.md`,
`TRADE_CENTER_DESIGN_PRINCIPLES.md`, `TRADE_CENTER_PLATFORM_ARCHITECTURE.md`,
`TRADE_CENTER_PLATFORM_ROADMAP_2035.md`) were drafted assuming a
greenfield build. Week 0 audit found the existing Xrated Trades AI
Platform already implements ~80% of the proposed architecture:
Registry Kit (Foundation 82%), Runtime (event bus / install /
slots / hooks), SDK (permissions / analytics / storage / context),
Design System (60.5%, 100% primitives), UI Kit (60+ primitives),
Business OS 18-layer stack, 32 prior ADRs, Platform Maturity Model
(baseline 35.7%).

Building parallel infrastructure would violate the
"not a rebuild from scratch" directive and duplicate production-
grade code.

### Decision
Trade Center is not a new platform. Trade Center is a positioning +
overlay layer on the existing Xrated Trades AI Platform. The four
Trade Center docs are RE-CLASSIFIED as follows:

- `TRADE_CENTER_2_SPEC.md` — product/UX overlay (keep).
- `TRADE_CENTER_DESIGN_PRINCIPLES.md` — feature approval gate
  (keep; complements the existing Constitution + Design
  Constitution).
- `TRADE_CENTER_PLATFORM_ARCHITECTURE.md v1.1` — refactor into
  overlay-only content. Duplicated sections on Registry Kit /
  Runtime / SDK / Design System / UI Kit REMOVED. Existing docs
  become primary references.
- `TRADE_CENTER_PLATFORM_ROADMAP_2035.md` — strategic 10-year
  positioning (keep). Phase→Milestone mapping added:
  Phase 1 → M3–M4, Phase 2 → M5–M6, Phase 3 → M7–M8,
  Phase 4 → M9–M10, Phase 5 → post-M10.

The `TRADE_CENTER_PLATFORM_DELTA.md` and
`TRADE_CENTER_MIGRATION_STRATEGY.md` docs (new, Week 0) become
canonical for terminology mapping + delta analysis + migration
governance.

Trade Center-specific platform features land as ADRs-033
through ADR-047+ under this decision log — never as parallel
documents.

### Consequences
- One source of truth for platform architecture. Trade Center
  amendments land inline with all prior platform decisions.
- Existing 45+ platform components + 27 apps + 32 ADRs preserved.
- Zero deprecations, zero replacements required by Trade Center
  v1 → v2 transition.
- All Week 1–4 implementation traces to a specific ADR row in
  this file (starting at ADR-033).

### Related
`TRADE_CENTER_PLATFORM_DELTA.md`,
`TRADE_CENTER_MIGRATION_STRATEGY.md`.

---

## ADR-033 — Manifest version envelope: apiVersion / schemaVersion / migrationVersion / minPlatformVersion

**Date:** 2026-07-11
**Status:** Accepted
**Category:** Extension
**Related:** ADR-003 (RegistrationBase extends additively).

### Context
AppManifest currently carries a single `version: string` semver
field. Trade Center's platform maturation, cross-App upgrades,
and future third-party plugin sandbox all need finer-grained
version tracking:
- Which manifest surface version does the App target?
- Which DB schema does the App's tables assume?
- Which migration head must be live before the App runs?
- Which minimum platform version does the App support?

### Decision
Add an optional `platformCompat` block to `AppManifest`:
```
platformCompat?: {
  apiVersion?: string;
  schemaVersion?: string;
  migrationVersion?: string;
  minPlatformVersion?: string;
}
```
All fields optional. Existing manifests continue to validate.
Populated Apps get richer upgrade tracking + boot-time
compatibility checks (added in wave 2).

### Consequences
- Purely additive. Zero existing App breaks.
- Boot loader gains ability to refuse mismatched Apps (future).
- Migration tooling has a durable "expected head" per App.

### Related
`src/platform/manifest/types.ts` — PlatformCompat type.

---

## ADR-034 — AI tool declarations on AppManifest (Dispatcher discovery)

**Date:** 2026-07-11
**Status:** Accepted
**Category:** Extension + New Subsystem
**Related:** ADR-004 (AI Gateway kept separate); to be superseded
by ADR-034b (streaming Dispatcher) when the copilot UI lands.

### Context
The platform AI Dispatcher (planned) must expose EVERY App's AI
tools to the copilot via the standard tool-use interface, without
hard-coding App slugs. Discovery must be pure projection over the
App Registry.

### Decision
Add optional `aiTools?: AIToolDeclaration[]` to `AppManifest`.
Each declaration carries name (namespaced `<slug>.<tool>`),
description, JSON Schema parameters, optional handler module
path, tier gate, and cost bucket. Discovery happens via
`discoverAITools()` in `src/platform/aiTools/discovery.ts` —
returns tools tagged with source App.

The AI Dispatcher (Week 4) imports `catalogueAITools()` from
`src/platform/aiTools/dispatcher.ts` and presents to Claude.

### Consequences
- Every App becomes copilot-callable the moment it registers.
- Zero App-specific wiring in the Dispatcher.
- Cost routing (Haiku vs Opus) preserved via `cost?` bucket.

### Related
`src/platform/aiTools/discovery.ts`,
`src/platform/aiTools/dispatcher.ts`.

---

## ADR-037 — Plugin-scoped feature flags (namespaced, declared by App)

**Date:** 2026-07-11
**Status:** Accepted
**Category:** Extension + New Subsystem
**Related:** ADR-034 (discovery pattern parallel).

### Context
Feature flags must belong to the App that owns them (never to
the shell). Uniform enforcement, but authored per-App. Cross-App
flags are rare and require an amendment.

### Decision
Add optional `featureFlags?: FeatureFlagDeclaration[]` to
`AppManifest`. Each declaration carries key (namespaced
`<slug>.<flag>`), description, default boolean, evaluation scope
(user / business / country / global), and optional A/B variants.

Discovery happens via `discoverFeatureFlags()` in
`src/platform/featureFlags/discovery.ts`. Runtime evaluator with
percent rollout + kill switch lands as ADR-037b in Week 2.

### Consequences
- Every App becomes gated via a uniform flag runtime.
- Namespace prefix enforced at register time — no collisions.
- Kill switches propagate through edge cache (future).

### Related
`src/platform/featureFlags/discovery.ts`.

---

## ADR-038 — Custom telemetry declarations on AppManifest

**Date:** 2026-07-11
**Status:** Accepted
**Category:** Extension

### Context
Every App gets 12 baseline metrics auto-emitted by the runtime
wrapper (ADR-044). Apps that emit domain-specific metrics beyond
the baseline need a declarative surface so the metric name +
allowed labels can be validated at emission time.

### Decision
Add optional `telemetry?: TelemetryDeclaration[]` to
`AppManifest`. Each declaration carries metric (namespaced),
kind (counter / gauge / histogram), description, and allowed
label dimensions. `emitTelemetry()` validates against the
declaration and drops invalid emissions with a dev warning.

### Consequences
- Custom telemetry contracts documented in the manifest.
- Prod emissions guaranteed to conform to schema.
- Discoverable via `discoverTelemetry()` for observability
  dashboards.

### Related
`src/platform/telemetry/baseline.ts`.

---

## ADR-044 — Runtime auto-instrumented telemetry wrapper (12 baseline metrics)

**Date:** 2026-07-11
**Status:** Accepted
**Category:** Extension

### Context
Every App must emit baseline observability metrics
(`plugin.request.count`, `plugin.request.duration_ms`,
`plugin.error.count`, `plugin.usage.active_users`,
`plugin.event.emitted`, `plugin.event.handled`,
`plugin.command.executed`, `plugin.ai.tool_invoked`,
`plugin.search.queried`, `plugin.navigation.route`,
`plugin.workflow.step`, `plugin.flag.evaluated`) without
per-App instrumentation code.

### Decision
Ship a runtime wrapper in `src/platform/telemetry/baseline.ts`
that:
- Exposes a swappable sink (`setSink()` — console in dev,
  Sentry breadcrumb + OTel exporter in prod).
- Provides `emitBaseline(metric, value, labels)` for the
  runtime to call around every App invocation.
- Provides `emitTelemetry(appSlug, metric, value, labels)` for
  Apps' custom emissions (validated against ADR-038 declarations).

Later waves wrap the runtime install / navigation / event
handlers so Apps opt in to the baseline automatically.

### Consequences
- Uniform observability from day one.
- Sink swap deploys metric pipeline changes without App code
  changes.
- 12 baseline metrics are the platform contract with SRE.

### Related
`src/platform/telemetry/baseline.ts`.

---

## ADR-046 — Trade Center brand pack as `DesignTokenSet`

**Date:** 2026-07-11
**Status:** Accepted
**Category:** Extension (Design System)
**Related:** Design Constitution v1 Amendment 1 (Token System).

### Context
Trade Center's brand (BRAND_YELLOW #FFB300, BRAND_BLACK #0A0A0A,
BRAND_AMBER #F59E0B, BRAND_GREEN_DARK #166534, off-white
#FBF6EC) must apply platform-wide without any App-level change,
per Amendment 9 (UI as Platform Asset) and
`feedback_platform_offwhite_canonical.md`.

### Decision
Ship the Trade Center brand as a `DesignTokenSet` registered
into the existing `designTokenRegistry`. `applyBrandPack(packId)`
swaps the active resolver set id and emits
`preferences.theme_changed` (Amendment 5 — everything emits).

Every component consuming tokens via `resolveToken()` picks up
the new values on next render. Apps stay unchanged.

### Consequences
- Brand swaps at runtime with zero App code changes.
- All memory-canonical colours codified once, referenced
  everywhere.
- Path clear for future brand packs (per-country, per-tenant,
  seasonal).

### Related
`src/platform/design/tokens/tradeCenterBrand.ts`.

---

## ADR-047 — Command Palette (⌘K): commands declared per App, palette owned by shell

**Date:** 2026-07-11
**Status:** Accepted
**Category:** Extension + New Shell Primitive
**Related:** ADR-034 (discovery pattern parallel).

### Context
The workspace shell needs a universal ⌘K palette. Commands must
come from every App that opts in, not from hard-coded shell
lists. Muscle memory demands one palette across every workspace
route.

### Decision
Add optional `commands?: CommandDeclaration[]` to `AppManifest`.
Each declaration carries id (namespaced), label, group
(`actions` / `products` / `merchants` / `categories` / `recent`),
optional keyboard shortcut, optional handler module path,
optional lucide icon name.

Discovery happens via `discoverCommands()` +
`discoverCommandsGrouped()` in `src/platform/commands/discovery.ts`.
Shell renders through `<CommandPalette>` in
`src/platform/shell/CommandPalette.tsx` using existing UI Kit
primitives (no new UI primitives shipped, per Amendment 9).

### Consequences
- Every App contributes commands without touching shell code.
- Palette groups + shortcuts uniform across the workspace.
- Recent-command tracking + AI-search integration land in Week 2
  as ADR-047b.

### Related
`src/platform/commands/discovery.ts`,
`src/platform/shell/CommandPalette.tsx`.

---

## ADR-040 — Capability-based policies + can() runtime

**Date:** 2026-07-11
**Status:** Accepted
**Category:** New Subsystem
**Related:** ADR-034 (discovery pattern parallel). Existing
`sdk/permissions.ts` is orthogonal — coarse-grained App-level
assertion, unchanged.

### Context
Roles alone become difficult to maintain as the platform grows.
Trade Center's Enterprise tier promises composable roles — Admin
composes a custom role from the platform's capability inventory
without code changes. Runtime access checks (`can(ctx, key)`) must
be uniform across every App and every service.

### Decision
Introduce a new subsystem at `src/platform/policy/*`. Every App
mints fine-grained capabilities via
`declaredCapabilities?: PolicyCapabilityDeclaration[]` on
`AppManifest`. Capabilities are namespaced `<appSlug>.<local-key>`.
Roles compose capabilities (transitively via `extends[]`). Grants
bind users to roles with optional business scope. The runtime
`can(ctx, capabilityKey)` walks the user's grants and returns
boolean; every check emits `plugin.flag.evaluated` for observability.

Storage (Wave 2): `tc_policy.capabilities` (mirrors declarations),
`tc_policy.roles`, `tc_policy.role_capabilities`, `tc_policy.user_roles`.
Week 2 ships in-memory engine — the API surface is identical so the
persistent backend swaps without any consumer change.

### Consequences
- Enterprise-differentiating capability composition ships behind
  the same `can()` API used by every route + widget + service.
- Every App's minted capabilities are discoverable and composable.
- Existing `sdk/permissions.ts` (App-level manifest assertion)
  remains untouched — orthogonal concerns.

### Related
`src/platform/policy/engine.ts`,
`src/platform/manifest/types.ts` (PolicyCapabilityDeclaration).

---

## ADR-041 — Universal Search orchestrator (cross-App fan-out + provider registry)

**Date:** 2026-07-11
**Status:** Accepted
**Category:** New Subsystem
**Related:** Existing per-registry `.search()` unchanged — the
orchestrator composes over them + App-registered providers.

### Context
Universal search returns results across every kind — products,
merchants, messages, orders, projects, files, users, commands.
Per-registry `.search()` handles individual kinds but no
cross-App orchestrator exists.

### Decision
Introduce `src/platform/search/orchestrator.ts` with:
- Discovery: reads `searchProviders?: SearchProviderDeclaration[]`
  from every registered App.
- Fan-out: `universalSearch(q)` invokes every discovered provider
  in parallel, weights each result by declared provider weight,
  groups by kind, sorts by score desc, caps at 5 per group.
- Handlers register via `registerProviderHandler(id, fn)` — in
  production the runtime resolves lazily from the manifest's
  `handler` module path.
- Timings + telemetry recorded per invocation.

Intent classification (Haiku routing) lands as ADR-041b in Week 3
alongside voice + image search.

### Consequences
- One search bar covers every registered App.
- Adding a new App with a search provider surfaces its results
  immediately with zero shell code changes.
- Foundation for Command Palette + Copilot search integration.

### Related
`src/platform/search/orchestrator.ts`,
`src/platform/manifest/types.ts` (SearchProviderDeclaration).

---

## ADR-043 — Workspace state in the SDK (pinned / recent / current-App / right-panel)

**Date:** 2026-07-11
**Status:** Accepted
**Category:** Extension (Platform SDK)

### Context
The workspace shell needs cross-App state that persists per user:
pinned items, recent visits, current App, right-panel slot, mode,
theme, density. Existing `sdk/context.ts` is App-scoped
(manifest + merchantId + brandId), not workspace-scoped.

### Decision
Add `src/platform/sdk/workspaceState.ts` as a separate module.
Every mutation runs through `commit(next, eventKind, payload)`
which persists + emits an event + baselines telemetry. Storage:
in-memory + localStorage on client for Week 2; Wave 2 wires
`tc_shell_workspace_state` for server-side persistence.

### Consequences
- Every mutation emits an event (Amendment 5 — "everything
  emits") — analytics/audit/telemetry get workspace-state
  observability for free.
- The AppContext remains focused on App-scope; workspace state
  is a distinct user-scope concern.

### Related
`src/platform/sdk/workspaceState.ts`.

---

## ADR-048 — Widget declarations on AppManifest (Home Today's Work + right panel)

**Date:** 2026-07-11
**Status:** Accepted
**Category:** Extension

### Context
The Home dashboard's "Today's Work" strip and the workspace right
panel are shell surfaces that render contributions from every
App. Hard-coding widget lists in shell code fragments the shell
per App.

### Decision
Add `widgets?: WidgetDeclaration[]` to `AppManifest`. Each
declaration includes id (namespaced), slot (`home.today` |
`home.secondary` | `right-panel`), label, optional order hint,
handler module path, optional refresh interval, optional tier
gate. Discovery via `src/platform/widgets/discovery.ts`. Shell
BFF endpoint (Wave 2) collapses N widget fetches into 1 call.

### Consequences
- Home dashboard evolves as Apps register — no shell code change.
- Widget slots become the composable primitive for cross-App
  surfaces.

### Related
`src/platform/widgets/discovery.ts`,
`src/platform/manifest/types.ts` (WidgetDeclaration).

---

## ADR-049 — Notifications platform service (registry + delivery inbox)

**Date:** 2026-07-11
**Status:** Accepted
**Category:** New Subsystem

### Context
Notification delivery must be uniform across Apps. Users configure
preferences once for every App (in-app / email / push). Each App
declares its notification kinds; the platform routes.

### Decision
Add `notificationKinds?: NotificationKindDeclaration[]` to
`AppManifest`. Each declaration includes kind (namespaced),
category, description, default channels, optional severity.

`src/platform/notifications/discovery.ts` ships:
- Discovery: every kind declared by every App.
- In-memory inbox: `deliver()` accepts declared kinds, rejects
  undeclared ones with a dev warning.
- Read-tracking: `unreadCountForUser()`, `markRead()`.

Real channel delivery (SSE, Resend email, Web Push) lands as
ADR-049b once `tc_notifications_*` schema is live.

### Consequences
- Zero App-level notification pipelines.
- User preferences apply uniformly across Apps.
- The bell UI reads unread count from a single source.

### Related
`src/platform/notifications/discovery.ts`,
`src/platform/manifest/types.ts` (NotificationKindDeclaration).

---

## ADR-050 — Simple ↔ Workspace mode selector (no user-facing toggle)

**Date:** 2026-07-11
**Status:** Accepted
**Category:** New Subsystem
**Related:** TRADE_CENTER_2_SPEC.md §21.

### Context
Trade Center's onboarding thesis: not every user wants a full
workspace on day one. Anonymous browsers + first-visit users
see Simple Mode. Users graduate to Workspace Mode on their first
workspace action; silently downgrade after 30 days of inactivity.
No user-facing toggle — mode is derived from activity signals.

### Decision
Add `src/platform/shell/modeSelector.ts` with:
- `classify(input)` — pure function of last-workspace-action
  timestamp. Under 30 days = Workspace, else Simple.
- `promoteToWorkspaceMode()` — called when a
  `PROMOTION_EVENT_KINDS` event fires
  (`saved.list_created`, `quote.drafted`, `quote.sent`,
  `estimator.project_created`, `orders.placed`,
  `community.post_created`).
- `downgradeIfInactive(input)` — daily job checks activity;
  silent downgrade when threshold crossed.

The selector uses `readWorkspaceState()` + `setMode()` — no new
persistence. Event bus fan-out to the promotion events lands as
ADR-050b in Week 3.

### Consequences
- Onboarding surface stays lightweight; workspace unlocks
  organically.
- Six promotion event kinds are the platform's "user is
  workflow-active" signal set.
- Downgrade is silent (per spec §21.4) — no shame, no friction.

### Related
`src/platform/shell/modeSelector.ts`,
`src/platform/sdk/workspaceState.ts`.

---

## ADR-051 — Marketplace App is Plugin #1 (reference implementation)

**Date:** 2026-07-11
**Status:** Accepted
**Category:** New App (reference implementation)
**Related:** ADRs 033-050 (Marketplace opts into every declaration
slice shipped Weeks 1-2).

### Context
The Marketplace App is Trade Center's Plugin #1 per
`TRADE_CENTER_PLATFORM_ROADMAP_2035.md` Phase 1. Its purpose is
twofold:

1. Provide the reference implementation of AppManifest v1.1 for
   every future App to mirror (Orders, Messages, Projects, Fleet,
   Insurance, Finance, Recruitment, Training).
2. Prove the platform services shipped Weeks 1-2 compose end-to-end
   without any special-case shell code.

### Decision
Ship `src/apps/marketplace/` with:

- `manifest.ts` implementing `AppManifest` and opting into every
  Week 1-2 declaration slice: `platformCompat`, `aiTools` (4),
  `featureFlags` (4), `telemetry` (4), `commands` (5),
  `declaredCapabilities` (5), `searchProviders` (3), `widgets` (3),
  `notificationKinds` (3).
- `data/` — 12 product fixtures + 4 merchant fixtures with
  8-layer trust scores per spec §19.1.
- `handlers/` — search provider handlers wired into
  `registerProviderHandler()` at bootstrap.
- `components/` — `ProductCard.tsx` (v2 with merchant chip,
  trust score, delivery, distance, trade + business pricing),
  `TrustScoreChip.tsx`.
- `CategoryWorkspace.tsx` — category-scoped grid with
  sub-category filter chips and compare bar.
- `register.ts` — idempotent bootstrap wiring called from
  `src/platform/bootstrap.ts`.

Routes at `src/app/tc/marketplace/*` render the shell + marketplace
UI.

### Consequences
- Every future App has a working reference. New App = fork this
  manifest, swap the domain data.
- The 4 declaration slices ship exercised end-to-end: universal
  search returns products AND merchants AND categories; the
  copilot can invoke `marketplace.search_products` /
  `marketplace.compare_products` / `marketplace.find_alternatives`;
  the palette shows 5 Marketplace commands; the Home Today's Work
  strip has 2 Marketplace widgets discoverable.
- Trust scores render on every product card without any DB round-
  trip in Week 3 — the primitive is ready for `tc_merchants.
  verification` in Wave 2.
- Zero existing platform code changed. Zero cross-App imports.
  Every mutation emits.

### Related
`src/apps/marketplace/manifest.ts`,
`src/apps/marketplace/CategoryWorkspace.tsx`,
`src/apps/marketplace/components/ProductCard.tsx`,
`src/app/tc/marketplace/page.tsx`,
`scripts/verify-week3-demos.ts`.

---

## ADR-052 — AI Dispatcher runtime (cost router + transport + tool invocation)

**Date:** 2026-07-11
**Status:** Accepted
**Category:** New Subsystem (Platform Service)
**Related:** ADR-034 (AI tool declarations), ADR-044 (telemetry
auto-instrumentation).

### Context
Week 1 shipped AI tool DECLARATIONS on `AppManifest`. What was
still missing:
1. A runtime that RUNS dispatch — routes → invokes tool handlers
   → returns result.
2. Cost routing per §19.5 (Haiku vs Opus vs Whisper vs image).
3. Swappable transport so Anthropic ↔ OpenAI ↔ local Llama swap
   at platform level.
4. HTTP entrypoint at `/api/ai/dispatch`.
5. Tool handler registry — `registerToolHandler(name, fn)`.

### Decision
Ship at `src/platform/aiTools/`:
- `router.ts` — `classifyTaskClass()` + `route()`. Heuristic
  classifier for Week 4. Real Haiku-based classifier lands as
  ADR-052b.
- `transport.ts` — `cannedTransport` (dev/test synthesises tool
  calls from prompt keywords + parameter schema) + `setTransport()`
  swap point. Production Anthropic transport lands as ADR-052c.
- `dispatcher.ts` — `dispatch(input)` runs full loop, emits
  `plugin.ai.tool_invoked` + `plugin.request.duration_ms`.
- `src/app/api/ai/dispatch/route.ts` — Next.js POST route.
- `src/platform/shell/Copilot.tsx` — right-panel client. Listens
  to `AI_SEED_EVENT`; palette's Ask AI group fires it; Product
  Card v2's "Find alternatives" chip fires `askAI()`.

Marketplace tool handlers registered in `registerMarketplaceApp()`.

### Consequences
- Every App's tools become copilot-callable the moment the App
  registers. Zero shell code changes.
- Cost routing enforceable at platform boundary — Free tier
  never hits Opus regardless of App declarations.
- SSE streaming + Anthropic transport swap under `setTransport()`
  without any App-level change.
- Verification runs fully offline via canned transport — no API
  keys needed for CI.

### Related
`src/platform/aiTools/router.ts`,
`src/platform/aiTools/transport.ts`,
`src/platform/aiTools/dispatcher.ts`,
`src/app/api/ai/dispatch/route.ts`,
`src/platform/shell/Copilot.tsx`,
`scripts/verify-week4-demos.ts`.

---

## ADR-053 — Canteens URL migration: /trade-off/yard/canteens/* → /community/*

**Date:** 2026-07-11
**Status:** Accepted
**Category:** URL Migration
**Related:** TRADE_CENTER_2_SPEC.md §19.9.

### Context
Trade Center v1 canteens live under `/trade-off/yard/canteens/*`.
The v2 positioning places them as the Community plugin under
`/community/*`. Bookmarks + backlinks must survive forever.

### Decision
Two permanent (301) redirects in `next.config.mjs`:
- `/trade-off/yard/canteens → /community`
- `/trade-off/yard/canteens/:path* → /community/:path*`

### Consequences
- Bookmark preservation forever.
- Zero middleware complexity — the existing custom-domain
  routing middleware is untouched.
- Community App itself ships in a later wave; the 301 is stable
  regardless of when the destination becomes live.

### Related
`next.config.mjs`.

---

## ADR-054 — Widget handler runtime + canonical shell renderer

**Date:** 2026-07-11
**Status:** Accepted
**Category:** New Subsystem (Platform Service)
**Related:** ADR-048 (widget declarations on AppManifest).

### Context
Week 1-2 shipped widget DECLARATIONS on `AppManifest`. Week 5
needs the runtime that (a) invokes a registered handler per
widget id, (b) returns a typed payload, and (c) canonically
renders that payload in the shell — so every widget on Home,
regardless of which App produced it, has the same visual
signature.

### Decision
Ship at `src/platform/widgets/`:
- `runtime.ts` — `registerWidgetHandler(id, fn)`,
  `resolveWidgetHandler()`, `renderWidgetPayload()`. Handlers
  return a typed `WidgetPayload` (headline / chips / rows /
  emptyLabel / href). Chips union kinds: count / distance /
  money / eta / info / warn / good.
- `src/platform/shell/WidgetTile.tsx` — canonical renderer.
  Walks the payload, renders through Platform Design System
  primitives (Amendment 9). Apps cannot ship their own layouts.

`src/app/tc/page.tsx` walks
`discoverWidgetsForSlot("home.today")`, invokes handlers in
parallel, renders each via `WidgetTile`. Zero hard-coded App
slugs. Adding a new App with a `widgets` declaration + widget
handler makes it appear on Home with no shell edit.

### Consequences
- Home dashboard evolves as Apps register.
- Visual signature stays consistent as Apps proliferate.
- Widget handler telemetry (`plugin.request.duration_ms`,
  `plugin.error.count`) shipped via existing auto-instrumentation
  (ADR-044).

### Related
`src/platform/widgets/runtime.ts`,
`src/platform/shell/WidgetTile.tsx`,
`src/app/tc/page.tsx`,
`scripts/verify-week5-demos.ts`.

---

## ADR-055 — Orders App is Plugin #2 (second reference implementation)

**Date:** 2026-07-11
**Status:** Accepted
**Category:** New App
**Related:** ADR-051 (Marketplace as Plugin #1). Proves the
platform is genuinely App-agnostic: Plugin #2 lands with zero
platform code changes.

### Context
Plugin #1 (Marketplace) exercised every Week 1-2 declaration
slice for the first time. A single reference implementation
doesn't prove App-agnosticism; a second unrelated App landing
without touching platform primitives does.

### Decision
Ship `src/apps/orders/` with:
- `manifest.ts` — full `AppManifest` opting into 3 aiTools + 2
  featureFlags + 3 telemetry + 3 commands + 3 declaredCapabilities
  + 1 searchProvider + 2 widgets + 4 notificationKinds. Declares
  `marketplace` as a dependency (proving cross-App dependency
  works).
- `data/orders.ts` — 4 order fixtures across placed / accepted /
  dispatched / delivered.
- `handlers/aiToolHandlers.ts` — `track_order`, `list_recent`,
  `cancel_order`.
- `handlers/widgetHandlers.ts` — `arriving_today`,
  `awaiting_confirmation`.
- `handlers/searchOrders.ts` — content search provider.
- `register.ts` — idempotent bootstrap wiring.

Route at `src/app/tc/orders/page.tsx` renders a 4-column Kanban
grouping orders by status. Reuses Marketplace's merchant fixtures
for trust score display.

The ONLY platform code change was adding `registerOrdersApp()`
to `src/platform/bootstrap.ts` — the same one-line addition
Marketplace required, matching the established pattern.

### Consequences
- Home dashboard's Today's Work strip now surfaces widgets from
  BOTH Marketplace AND Orders. Zero shell code change required.
- Universal Search returns products AND orders in one query,
  grouped by kind, without any orchestrator update.
- Command Palette surfaces commands from BOTH Apps in one merged
  list.
- The Dispatcher sees 7 AI tools across 2 Apps — the copilot
  gained Orders-specific abilities (`track_order`, `cancel_order`,
  `list_recent`) with zero copilot code change.
- App-agnostic thesis proven twice.

### Related
`src/apps/orders/manifest.ts`,
`src/apps/orders/register.ts`,
`src/app/tc/orders/page.tsx`,
`src/platform/bootstrap.ts`,
`scripts/verify-week5-demos.ts`.
