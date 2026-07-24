# Nex Brain Platform + Engine · V1 Consolidation Reference

**Reference document · 2026-07-23**
**Purpose:** single navigational reference composing all authoritative Brain specifications and closing the 4 genuine gaps not yet specified anywhere. This document is a MAP, not new architecture. Where a section is authoritative in another spec, this document REFERENCES rather than duplicates (single source of truth per ES-02 §1.1). Where a genuine gap exists, this document specifies.

**Reading order:** Part 1 explains what the Platform is. Part 2 explains what the Engine is. Part 3 is the crosswalk table (which spec owns each concern). Part 4 specifies the 4 genuine gaps. Part 5 sequences the milestone path.

**Related ADRs (both blocking):** ADR-0017 (Trade Brain Contract) · ADR-0021 (Intelligence Domain Separation).

---

## Part 1 · The Brain Platform (how Brains are created)

The Brain Platform is the **operating system for specialist construction intelligence**. It is the composed system that lets Nex produce a new Trade Brain (Staircase, Electrical, Plumbing, Roofing, Carpentry, Landscaping, and beyond) without rebuilding the architecture each time.

The Platform is not a single module. It is the composition of:

- Contract (what a Brain is): **ADR-0017**
- Separation (how a Brain stays scoped): **ADR-0021**
- Registry (where a Brain is catalogued): pending migration `brain_content_v0.sql`
- Storage (where Brain assets live): `NEX_INTELLIGENCE_STORAGE_ARCHITECTURE.md`
- Author workflow (how humans write Brain content): `TRADE_BRAIN_AUTHOR_TOOLING_SPEC.md` + `TRADE_BRAIN_AUTHOR_RECRUITMENT_PACKAGE.md`
- Testing framework (how a Brain is validated): `ES-05_TESTING_AND_AI_EVALUATION_V1.md` §Trade Brain accuracy framework
- Learning loop (how a Brain improves): ADR-0017 §8
- Reference implementation: `docs/brains/staircase-brain-specification.md`

Every new Brain instantiates the same shape. Adding a Brain is authoring work, not engineering work. That is what "Platform" means here.

---

## Part 2 · The Brain Engine (how Brains operate)

The Brain Engine is the **runtime intelligence layer** that activates a Trade Brain and lets Nex reason using specialist construction knowledge. It is not a chatbot. It is a specialist inference pipeline.

Every merchant-facing intelligence surface (Chat, Estimator, Vision analysis, Workflow guidance, Compliance check) enters the Engine. The Engine:

1. Classifies the request
2. Selects the correct Brain(s) via ADR-0021 retrieval router
3. Loads only the relevant modules within those Brains
4. Composes with Memory (Phase 26) and Vision (Phase 13) as required
5. Returns a structured response with confidence and provenance

The Engine is the composition of:

- Runtime + module loader: `src/lib/nex/orch/catalog.ts` (Phase 24) extended with the Phase 27 Brain loader
- Retrieval router: ADR-0021 §retrieval API contracts
- Context management: Phase 26 Memory V1 (7 layers)
- Vision layer: Phase 13 Construction Vision (shipped) + Phase 28 §Vision integration
- Estimator layer: **Phase 28 AI Estimator Engine blueprint**
- Learning layer: ADR-0017 §8 + `hammerex_nex_brain_field_outcomes` / `hammerex_nex_brain_learning_signals`
- Expert validation: `TRADE_BRAIN_AUTHOR_RECRUITMENT_PACKAGE.md` + ES-05

The Engine is model-agnostic per ES-01 §7 (`ai/` orchestration layer). Provider swaps ship in one sprint.

---

## Part 3 · Crosswalk (which spec owns each concern)

| Concern | Authoritative spec |
|---------|--------------------|
| Brain registry table + status lifecycle | `pending-migrations/brain_content_v0.sql` (`hammerex_nex_brains`) + Phase 27 blueprint |
| 10-module schema · 6 V1 required · 4 V2 deferred | **ADR-0017 §1-§3** |
| JSON pack file format under `src/lib/nex/brains/<slug>/` | ADR-0017 §2 |
| Zod schemas per module | `src/lib/nex/brains/_schema/` (per ADR-0017) |
| Named Author authority + editorial control | ADR-0017 §4 |
| Correction chain (`hammerex_nex_brain_corrections`) | ADR-0017 §5 + pending migration |
| Semver + rollback pathway | ADR-0017 §6 |
| Author recruitment framework + honoraria | `TRADE_BRAIN_AUTHOR_RECRUITMENT_PACKAGE.md` |
| Author editing tool (dashboard, module editors, no JSON exposure) | `TRADE_BRAIN_AUTHOR_TOOLING_SPEC.md` |
| Domain separation (namespace · schema · storage · retrieval · ownership) | **ADR-0021 §1-§5** |
| Retrieval API contracts (`retrieveFromBrain`, default-deny cross-domain) | ADR-0021 §retrieval API contracts |
| Storage bucket structure per domain | `NEX_INTELLIGENCE_STORAGE_ARCHITECTURE.md` |
| PostgreSQL domain scoping + pgvector scoping + Redis prefixes | ADR-0021 §PostgreSQL/pgvector/Redis |
| CI enforcement (ESLint rule blocks non-scoped retrieval) | ADR-0021 §CI enforcement |
| Runtime mesh + agent catalog | `src/lib/nex/orch/catalog.ts` (Phase 24) |
| Memory context (7 layers: user/company/project/trade/region/industry/market) | Phase 26 blueprint + `MEMORY_V1_TECHNICAL_DESIGN.md` |
| Vision engine (image → detection → assessment) | Phase 13 CV (shipped) |
| Estimator composition (Vision + Doc + Brains + Memory + BOS) | **Phase 28 AI Estimator Engine blueprint** |
| Field Learning Loop (6 mechanisms · prediction vs actual · K-anon rollup) | **ADR-0017 §8** + `hammerex_nex_brain_field_outcomes` / `hammerex_nex_brain_learning_signals` |
| Testing framework (100-scenario accuracy · Author scenario suite · advisory panel) | ES-05 §Trade Brain accuracy framework |
| Reference implementation covering wood/metal/concrete | `docs/brains/staircase-brain-specification.md` |
| Master roadmap · sequence to Commercial GA | `NEX_MASTER_ARCHITECTURE_V1.md` + `NEX_IMPLEMENTATION_ROADMAP_V2.md` |

---

## Part 4 · The 4 Genuine Gaps · Specified Here

Four items were requested that no existing spec covers. They are specified below at ADR-compatible depth.

### Gap 1 · Public Brain API contracts

Endpoint surface exposed to first-party callers (Estimator UI · Chat · Vision uploader · Author Studio · internal cron jobs). All endpoints are POST unless noted. All require merchant session or service-role JWT. All return `{ status, data, confidence, provenance }` envelopes.

```
POST /api/brain/query
Body: {
  brain_slugs: string[],       // REQUIRED · no wildcards · per ADR-0021
  query: string,
  modules?: BrainModule[],     // optional narrowing
  region?: string,
  context?: {                  // Memory hints (Phase 26 layer references)
    project_id?: string,
    merchant_id?: string
  },
  limit?: number
}
Returns: {
  status: 'ok' | 'not_found' | 'insufficient_confidence',
  data: BrainQueryResult[],
  confidence: 'low' | 'medium' | 'high',
  provenance: {
    brain_versions: Record<slug, version>,
    modules_consulted: string[],
    author_attribution: string[]
  }
}
```

```
POST /api/brain/analyse-image
Body: { brain_slugs: string[], image_url: string, context?: {...} }
Returns: {
  detections: VisionDetection[],
  assessments: ConditionAssessment[],
  recommendations: Recommendation[],
  confidence: number,           // 0..1 per Gap 4 math
  provenance: {...}
}
```

```
POST /api/brain/estimate
Body: {
  brain_slug: string,           // single Brain for scope · compound scopes call multiple times
  scope: EstimatorScope,        // per Phase 28 blueprint
  region: string
}
Returns: EstimatorResponse      // per Phase 28 blueprint · 3-price model
```

```
POST /api/brain/learn
Body: {
  brain_slug: string,
  prediction_subject: string,
  predicted_value: JSONValue,
  actual_value: JSONValue,
  project_id?: string,
  merchant_id: string,
  deviation_reason?: string,
  contributes_to_rollup: boolean   // consent per ADR-0016
}
Returns: { status: 'recorded', outcome_id: uuid }
Writes: hammerex_nex_brain_field_outcomes (per ADR-0017 §8)
```

```
GET  /api/brain/registry
Returns: BrainRegistryEntry[]  // slug · category · version · status · author · confidence · last_reviewed_at

GET  /api/brain/:slug/confidence?subject=<subject>&region=<region>
Returns: { subject, region, tier: 'low'|'medium'|'high', sample_size, computed_at }
```

**Enforcement:** every endpoint validates `brain_slugs` against the registry, refuses wildcards, and logs `context_domains` per ADR-0021 audit requirement.

### Gap 2 · Knowledge Graph Brain edges

Phase 25 `bos/graph.ts` shipped with 13 edge types over a general node graph. Extend to Brain-scoped edges via the existing `hammerex_nex_graph_edges` table (no new table needed). Add these edge types:

- `brain_covers_scope` — Brain → construction scope node (Staircase Brain covers `scope.staircase_install`)
- `brain_depends_on_brain` — declared cross-Brain dependency (Staircase Brain depends on Carpentry for wood-specific defects · sanctioned per ADR-0021 adjacency edges)
- `brain_touches_regulation` — Brain → regulation node (Staircase Brain touches Part K + Part B)
- `brain_uses_material_family` — Brain → material family node
- `brain_shares_defect_family` — sanctioned cross-Brain defect analogy

Every Brain edge carries `from_domain` + `to_domain` + `sanctioned_by_adr` metadata per ADR-0021 §PostgreSQL scoping. Cross-Brain reads via graph edges are the ONLY sanctioned cross-domain retrieval mechanism (direct queries remain default-deny).

### Gap 3 · vision_examples + estimate_rules tables

Two Brain-support tables not yet in the pending migration.

```sql
CREATE TABLE IF NOT EXISTS public.hammerex_nex_brain_vision_examples (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_slug            TEXT NOT NULL REFERENCES public.hammerex_nex_brains(slug),
  category              TEXT NOT NULL,           -- e.g. 'staircase.tread_wear', 'staircase.baluster_defect'
  image_url             TEXT NOT NULL,           -- Supabase Storage domain-prefixed path
  ground_truth          JSONB NOT NULL,          -- Author-labelled measurements/labels
  vision_model_version  TEXT,                    -- Version used at label time
  author_id             UUID REFERENCES auth.users(id),
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'author_approved', 'published', 'retired')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vision_examples_brain_category
  ON public.hammerex_nex_brain_vision_examples (brain_slug, category, status);

CREATE TABLE IF NOT EXISTS public.hammerex_nex_brain_estimate_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_slug            TEXT NOT NULL REFERENCES public.hammerex_nex_brains(slug),
  rule_key              TEXT NOT NULL,           -- e.g. 'labour.per_riser.oak'
  applies_when          JSONB NOT NULL,          -- Predicate over EstimatorScope
  formula               JSONB NOT NULL,          -- Structured expression (no arbitrary code)
  unit                  TEXT NOT NULL,           -- 'hours', 'gbp', 'metres', 'each'
  region_code           TEXT,                    -- NULL for national default
  confidence_tier       TEXT NOT NULL CHECK (confidence_tier IN ('low', 'medium', 'high')),
  authored_by           UUID REFERENCES auth.users(id),
  version               TEXT NOT NULL,
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (brain_slug, rule_key, region_code, version)
);

CREATE INDEX IF NOT EXISTS idx_estimate_rules_lookup
  ON public.hammerex_nex_brain_estimate_rules (brain_slug, rule_key, region_code)
  WHERE active = TRUE;
```

Both tables land in a follow-on migration file `brain_vision_and_estimate_rules_v0.sql` alongside `brain_content_v0.sql` (kept separate for staged rollout — Vision examples land only after Vision integration ships).

### Gap 4 · Confidence-score computation math

Confidence is computed per `(brain_slug, subject, region)` triple, on demand, from these inputs:

```
base       = Author-set confidence per fact per ADR-0017 §3 (low=0.5, medium=0.7, high=0.9)
sample     = min(1.0, sample_size / K_target)              // K_target = ADR-0016 threshold per subject class
variance   = 1.0 - min(1.0, p95_delta_pct / 100)            // Field-outcome variance penalty
freshness  = max(0, 1.0 - months_since_last_review / 12)   // Regulation currency
```

The composed confidence score:

```
raw   = base * (0.4 + 0.3 * sample + 0.2 * variance + 0.1 * freshness)
tier  = 'high'   if raw >= 0.80
        'medium' if raw >= 0.60
        'low'    otherwise
```

Weights (0.4 base · 0.3 sample · 0.2 variance · 0.1 freshness) express: Author expertise dominates when field data is thin; field variance takes over as sample grows; freshness caps everything if the Brain has not been reviewed within a year.

Rules for consumers:

- Every `/api/brain/*` response includes both the tier and the raw score
- `insufficient_confidence` response status when `raw < 0.60` and the caller did not opt-in to low-confidence answers
- Confidence tiers are cached in Redis with 15-minute TTL keyed `brain:<slug>:conf:<subject>:<region>` per ADR-0021 §Redis
- Recomputation triggered on: new `hammerex_nex_brain_learning_signals` row · Brain version bump · quarterly Author review completion

Author cannot override the computed tier directly. Author overrides land as an `applies_when` rule change or a Learning Loop version bump per ADR-0017 §8 — the score follows the content, not the Author's opinion of the score.

---

## Part 5 · Milestone Path

The Platform + Engine exist as specifications now. The path from spec to production intelligence:

- **Milestone 1 · Platform specifications** — this document + all specs listed in Part 3. **Complete on ADR-0017 + ADR-0021 signoff.**
- **Milestone 2 · Runtime substrate** — Phase 24 mesh already ships. Extend catalog with Brain loader. Wire retrieval router per ADR-0021. Land `brain_content_v0.sql` + `brain_vision_and_estimate_rules_v0.sql`. (Phase 0 Week 4 → Phase 1 Week 6.)
- **Milestone 3 · First production Brain** — Staircase Brain V0 built against the substrate per `docs/brains/staircase-brain-specification.md`. Reference implementation proves the Platform is real. (Phase 1 Sprint 2.)
- **Milestone 4 · Author Studio** — `TRADE_BRAIN_AUTHOR_TOOLING_SPEC.md` shipped. First 4 Authors (Electrician · Plumber · Roofer · Carpenter) begin V1 authoring. (Phase 1 Sprint 3.)
- **Milestone 5 · Brain Marketplace** — deferred to Y3+ per ES-10. Not a Y1 concern. Requires cross-tenant data quality Memory V3+ supports.

The strategic shift the Platform enables: **one intelligence platform, thousands of specialist Brains** — each Brain owned by a named human Author, each Brain scoped to its domain, each Brain measurably improving through the Learning Loop. This is the architecture that makes Nex uncopyable.

---

## Amendments this document requires

- Add `brain_vision_and_estimate_rules_v0.sql` to `docs/implementation/pending-migrations/` before Milestone 2 begins
- Add `POST /api/brain/*` endpoints to Phase 28 Estimator API surface reference
- Extend Phase 25 `bos/graph.ts` edge type catalog with the 5 Brain edge types in Gap 2
- Update `docs/features/index.md` with new Brain Platform + Engine entry pointing at this reference

---

**End of Nex Brain Platform + Engine V1 Consolidation Reference.**

*No new architecture invented here. Existing authoritative specs referenced. Four genuine gaps closed. Single source of truth preserved.*
