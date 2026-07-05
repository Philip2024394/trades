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
