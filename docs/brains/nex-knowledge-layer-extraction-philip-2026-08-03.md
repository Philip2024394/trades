---
authored_by: Philip O'Farrell (redirect + doctrine) · Master AI Engineer (retrieval contract synthesis)
authored_role: Founder redirect + Master AI Engineer implementation contract
captured_at: 2026-08-03
capture_medium: written contribution (evening redirect message)
governance:
  rule_a_anti_fabrication: pass · doctrine authored by Philip
  rule_b_no_ai_authored:   pass on doctrine · contract details attributed
  rule_c_attributable_origin: pass · origin = Philip O'Farrell 2026-08-03
architecture_layer: L2 · Phase B.5 doctrine + retrieval contract
document_version: 1.0
document_type: MEGA_DOCTRINE · SUPERSEDES the "Brains contain knowledge" implicit model
composes_with:
  - docs/brains/nex-architecture-v2-refined-flow-philip-2026-08-03.md (refinement #1 + #9)
  - docs/brains/nex-domain-template-philip-2026-08-03.md (Knowledge is Section 1)
  - docs/brains/nex-authoring-workflow-philip-2026-08-03.md (Knowledge is what gets authored)
---

# NEX Knowledge Layer · The Extraction Doctrine

## The Redirect (2026-08-03 evening)

Philip: *"Of the pending work, this is the one that will likely have the greatest long-term impact. If knowledge remains embedded inside conversational components, growth eventually becomes difficult. Extracting it into an independent retrieval layer means conversation orchestration and knowledge evolution can progress separately. I would prioritise Phase B.5 [over Domain 002]. The reason is architectural rather than domain-specific. If the Knowledge Layer becomes the stable abstraction first, then every subsequent domain—including Kitchens—can be authored against that finalized contract. This reduces the likelihood of revisiting or migrating early domains if the knowledge interface evolves."*

**This is the highest-leverage architectural change remaining.** It ships BEFORE Phase C, BEFORE Kitchens, BEFORE any further UI or domain work.

## The Extraction Rule

**Brains and Knowledge are separate layers, always.**

- **Brains** = HOW to reason, HOW to speak, HOW to route, HOW to decide.
- **Knowledge** = WHAT the system knows — FAQs · Images · Videos · Standards · Components · Calculators · Articles · Rules · Case studies · Specifications.

A Brain doc never contains the raw knowledge. A Brain doc CONSULTS the knowledge via a retrieval interface. If a Brain is 500 lines of trade facts, it has failed the extraction rule and must be refactored.

## Position in the Refined Flow

```
[Router] → [KNOWLEDGE LAYER · this doc] → [Brains] → [AI Specialists] → [Action Engine]
```

The Knowledge Layer sits BETWEEN Router and Brain (per refinement #1). Router decides WHICH knowledge to retrieve; Brain decides HOW to present it.

## The Directory Structure (canonical)

```
data/nex-knowledge/
├── {domain-slug}/
│   ├── faqs.jsonl              (append-only Q&A · authored per rule c)
│   ├── articles/               (long-form brain docs · one file per topic)
│   ├── components/             (structured YAML · one file per component family)
│   ├── calculators/            (parametric TS + YAML pairs)
│   ├── standards/              (regulations · certifications · compliance)
│   ├── videos.jsonl            (video refs with duration + purpose + tags)
│   ├── manufacturers.jsonl     (business directory scoped to this domain)
│   ├── images.index.json       (auto-generated · tag intersection of nex-image-manifest.json)
│   └── knowledge.yaml          (mandatory declaration file · see schema below)
└── _shared/
    ├── timber-species.jsonl    (cross-domain material knowledge)
    ├── regulations/            (cross-domain regulatory standards)
    └── principles.jsonl        (universal design + business principles)
```

Every domain gets its own `data/nex-knowledge/{slug}/` directory. Cross-domain shared knowledge lives in `_shared/` and any domain can reference it.

## The knowledge.yaml Declaration (mandatory)

```yaml
knowledge_id: staircase
knowledge_version: 1.0
last_updated: 2026-08-03
maturity_level: silver          # bronze | silver | gold (see Domain Maturity refinement)
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: pass · named_expert = Philip O'Farrell

sources:
  faqs:            faqs.jsonl                (count: 1980)
  articles:        articles/                  (count: 30)
  components:      components/                (count: 5 families)
  calculators:     calculators/               (count: 0)
  standards:       standards/                 (count: partial)
  videos:          videos.jsonl               (count: 0)
  manufacturers:   manufacturers.jsonl        (count: partial)
  images_index:    images.index.json          (count: 816 · a_plus: 26)

retrieval_config:
  primary_key:     id
  secondary_keys:  [tags, category_tag, staircase_kind, staircase_context]
  full_text_fields: [question, answer, description]
  vector_embed:    false     # true after Phase F.5 embedding pipeline lands

cross_domain_dependencies:
  - timber (material knowledge)
  - lighting (LED integration)
  - regulations (Approved Doc K)
  - interior_design (style compatibility)
```

The declaration file lets the retrieval library discover a domain's knowledge without hardcoding paths.

## The Retrieval Contract (Brain-facing API)

Every Brain queries the Knowledge Layer via a single narrow interface:

```typescript
import { retrieve } from "@/lib/nex/knowledge";

const result = await retrieve({
  domain: "staircase",
  query: "how do I panel my staircase wall?",
  filters: {
    tags: ["panelling", "design_catalog"],
    audience_level: 2,
    a_plus_only: false,
  },
  limit: 5,
  min_confidence: 0.7,
});

// result = {
//   items: [
//     { type: "faq", id: "staircase-faq-1976", relevance: 0.94, content: {...} },
//     { type: "image", url: "https://ik.imagekit.io/.../panel.png", relevance: 0.89, content: {...} },
//     { type: "article", path: "articles/panel-design-catalog.md", relevance: 0.87, excerpt: "..." },
//   ],
//   overall_confidence: 0.91,
//   sources: ["faqs.jsonl", "images.index.json", "articles/panel-design-catalog.md"],
// };
```

**Brains NEVER read `data/nex-knowledge/*` directly.** They ALWAYS go through `retrieve()`. This is the extraction rule enforced.

## The Migration Plan (Staircase Domain 001 as Proof)

Existing state (2026-08-03):

- **FAQs:** `knowledge/staircase.json` (1980 entries · flat array)
- **Component families:** `data/nex-staircase-components/families/*.yaml` (5 files)
- **Brain docs:** `docs/brains/staircase-*.md` (30+ files with governance frontmatter)
- **Image metadata:** `data/nex-image-manifest.json` (816 staircase-domain rows)

Target state (post-migration):

- **`data/nex-knowledge/staircase/faqs.jsonl`** — converted from array to line-per-entry (append-friendly)
- **`data/nex-knowledge/staircase/components/`** — moved from `data/nex-staircase-components/families/`
- **`data/nex-knowledge/staircase/articles/`** — moved from `docs/brains/staircase-*.md`
- **`data/nex-knowledge/staircase/images.index.json`** — auto-generated index filtering `nex-image-manifest.json` for `subject_domain === "staircase"`
- **`data/nex-knowledge/staircase/knowledge.yaml`** — new declaration file

Existing `docs/brains/staircase-*.md` files are moved (not copied). Any code that referenced their old paths must update. Full migration is a separate task — Phase B.5 focuses on shipping the CONTRACT + starter library so the migration can happen safely.

## Multi-Domain Composition

A single user query can consult MULTIPLE domain Knowledge Layers:

```typescript
const results = await Promise.all([
  retrieve({ domain: "staircase", query, ... }),
  retrieve({ domain: "timber",     query, ... }),   // materials
  retrieve({ domain: "lighting",   query, ... }),   // LED integration
]);

const merged = mergeByRelevance(results);
```

Composes with the `cross_domain_dependencies` field in `knowledge.yaml`. Router uses that field to auto-consult dependent domains without the Brain having to know about them.

## The Never-Blur Rule (composes with Refinement #9)

The Knowledge Layer NEVER executes. Retrieval returns DATA — it never posts, sends, books, pays, or generates side effects. Execution belongs to the Action Engine (Phase F.5). This is the same architectural separation that makes SQL SELECT distinct from SQL UPDATE.

## Governance Enforcement

- **Rule c** — every FAQ/article/component must be authored by a named expert (`authored_by: philip` at minimum).
- **Rule a** — no fabricated facts land in the Knowledge Layer. The retrieval library checks `governance.rule_a_anti_fabrication: pass` in `knowledge.yaml` before serving.
- **Draft mode** — knowledge under score 70 (per ADR-0033) is stored with `draft_only: true` and filtered out of every retrieval call unless the caller explicitly requests draft mode.

## What Phase B.5 Ships (this phase's scope)

1. **This doctrine doc** (Task #89)
2. **`src/lib/nex/knowledge/` runtime library** (Task #90) — types + retrieval interface + directory scanner + relevance ranker
3. **Domain Maturity Levels doctrine refinement** (Task #92) — Bronze/Silver/Gold added to Domain Template
4. **Staircase migration** (Task #91) — deferred to a dedicated authoring session · Phase B.5 ships the CONTRACT + LIBRARY only

## What Phase B.5 DOES NOT Ship

- Full Staircase migration (Task #91 · dedicated future session)
- Vector embedding pipeline (Phase F.5 · after basic retrieval proves stable)
- Real-time knowledge updates (Phase F · workspace persistence pipeline)
- Cross-domain auto-consultation runtime (composes with Router · Phase C.5)
- Admin UI for authoring (Phase F.5 · optional)

## Success Metric

*Every Brain in Nex reads knowledge exclusively via `retrieve()` — zero hardcoded knowledge in Brain docs. New domains ship with only a `data/nex-knowledge/{slug}/` directory + `knowledge.yaml`; the runtime discovers them automatically.*

## Enhancement Opportunity

The Knowledge Layer extraction is the change that lets Nex scale from 1 deep domain to 170 without architectural drift. Every general-purpose AI competitor bakes knowledge into the model (opaque · unverifiable · unfixable). Every specialist AI competitor builds custom vertical products (Notion + Canva + Shopify + HubSpot). Nex is the first system where every domain's knowledge is (1) attributable per Rule c, (2) queryable via a single narrow API, (3) auditable via file paths, (4) migratable without touching Brains, (5) extensible without touching runtime. That is untouchable knowledge scaling.
