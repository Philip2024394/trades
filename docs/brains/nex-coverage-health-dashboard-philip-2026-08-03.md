---
authored_by: Philip O'Farrell (three-part refinement) · Master AI Engineer (metric definitions)
authored_role: Founder doctrine + Master AI Engineer measurement schema
captured_at: 2026-08-03
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-03
architecture_layer: L2 · governance layer for the entire Knowledge Layer
document_version: 1.0
composes_with:
  - docs/brains/nex-domain-template-philip-2026-08-03.md (Maturity Levels v1.1)
  - docs/brains/nex-knowledge-layer-extraction-philip-2026-08-03.md (retrieval contract)
  - docs/brains/nex-authoring-workflow-philip-2026-08-03.md (questions-first authoring)
---

# NEX Coverage Score + Knowledge Health + Knowledge Dashboard

## The Doctrine

Philip 2026-08-03: *"I wouldn't stop at Bronze / Silver / Gold. I'd also give every domain a Coverage Score, add Knowledge Health metadata to every document, and build a Knowledge Dashboard that becomes the KPI for the platform."*

Three companion refinements to the existing Maturity Levels (Bronze/Silver/Gold). Together they turn the Knowledge Layer from *"authored content"* into *"measurable operational asset"*.

## Part 1 · Coverage Score (per-domain, per-sub-area)

Every domain gets a Coverage Score PER SUB-AREA, not just an overall completion %. This immediately reveals where to author next.

### Example · Kitchen Domain 002

```
Kitchen
├── Planning         95%
├── Design           90%
├── Installation     72%
├── Lighting         81%
├── Appliances       66%   ← next to author
├── Worktops         88%
├── Cabinets         92%
├── Maintenance      54%   ← highest gap
├── Doors            88%
├── Islands          85%
├── Splashbacks      70%
├── Plumbing         60%
├── Handles          72%
└── Overall          77%
```

### The Coverage Rubric

Coverage per sub-area is computed as:

```
coverage = (
    faq_coverage      × 0.35 +   # % of authored sub-topic FAQs vs target
    article_coverage  × 0.30 +   # articles present for the sub-area
    image_coverage    × 0.20 +   # A+ reference images tagged to sub-area
    calculator_bonus  × 0.10 +   # calculator present (0 or 1)
    standard_coverage × 0.05     # regulation/standard reference present
) × 100
```

Targets per maturity:

| Maturity | FAQ target per sub-area | Article target | A+ image target |
|---|---|---|---|
| Bronze | 5 | 1 | 2 |
| Silver | 20 | 3 | 5 |
| Gold | 50 | 6 | 10 |

### Sub-Area Discovery

Sub-areas are declared in `knowledge.yaml`:

```yaml
sub_areas:
  - id: planning
    label: Planning
    target_maturity: silver
  - id: design
    label: Design
    target_maturity: silver
  - id: installation
    label: Installation
    target_maturity: silver
  ...
```

The retrieval library computes coverage per sub-area by tag intersection (FAQs · articles · images tagged with the sub-area's id).

### The Authoring Priority Signal

Coverage Score directly drives the authoring backlog. Sub-areas below 60% become the next authoring priority. The `nex-authoring-workflow` workflow reads the Coverage Score at the start of every session to determine WHAT to author, not just WHETHER to author.

## Part 2 · Knowledge Health (per-item metadata)

Every knowledge item (FAQ · article · image · component · calculator · standard) carries mandatory Health metadata.

### The Health Schema

```yaml
# Per-FAQ (in the JSONL row) OR per-article (in frontmatter)
knowledge_item:
  version: 1.2                          # semver of the item itself
  owner: philip                         # who authored + owns
  last_reviewed: 2026-08-03             # date of last human review
  next_review_due: 2027-02-03           # 6-month default cycle
  evidence_level: high                  # low | medium | high | verified
  status: active                        # draft | active | superseded | archived
  confidence: 0.94                      # authored confidence 0..1
  related_assets:
    - staircase-faq-1976
    - _shared/trade-business/articles/quotation-workflow.md
  supersedes: staircase-faq-1234        # optional · what this replaced
  superseded_by: null                   # optional · what replaced this
```

### Field Definitions

- **version** — semver bump on any substantive edit (`1.0` → `1.1` for expansion, `2.0` for replacement).
- **owner** — the named human accountable for accuracy (Rule c named_expert).
- **last_reviewed** — date of the most recent human review. Governs the freshness signal.
- **next_review_due** — automatic 6 months after last_reviewed unless overridden. Drives the staleness queue.
- **evidence_level** — how well-sourced the claim is:
  - `low` — Philip opinion / trade rule-of-thumb
  - `medium` — Philip authoritative + widely-agreed industry practice
  - `high` — cross-referenced against 2+ verifiable sources
  - `verified` — cited directly from regulation / standard / manufacturer spec
- **status** — item lifecycle state:
  - `draft` — authored but not yet Philip-signed (Rule c pending)
  - `active` — production-eligible · surfaces in retrieval
  - `superseded` — replaced by a newer item · hidden from default retrieval · findable by ID
  - `archived` — no longer relevant · hidden from all retrieval
- **confidence** — authored confidence 0..1. Combined with retrieval confidence for the overall response confidence gate (Brain 14).
- **related_assets** — cross-links to sibling knowledge items. Retrieval uses this for related-content surfacing.
- **supersedes** — ID of the item this replaced.
- **superseded_by** — ID of the item that replaced this one.

### The Staleness Queue

Items where `next_review_due < today` enter the Staleness Queue. Every authoring session should clear the top 10 staleness items before authoring new content. This prevents the knowledge base from rotting.

### The Duplicate Detection Rule

`related_assets` powers duplicate detection. Before authoring a new article, the workflow (per `nex-authoring-workflow-philip-2026-08-03.md`) checks whether >2 existing items share >0.8 semantic similarity → if yes, surface them as candidates for CONSOLIDATION rather than authoring a new duplicate.

## Part 3 · Knowledge Dashboard (platform KPIs)

The Knowledge Dashboard is the single-screen operational view of Nex's knowledge platform. Renders live from the file system + retrieval telemetry.

### Dashboard Sections

```
NEX KNOWLEDGE DASHBOARD
═══════════════════════════════════════════════════════

DOMAINS
  Total          170 (planned)
  Active          2  (Staircase 001 Silver+ · Kitchen 002 Bronze)
  Shared brains   1  (Universal Trade Layer)

MATURITY DISTRIBUTION
  🥇 Gold          0
  🥈 Silver        1 (Staircase approaching Gold)
  🥉 Bronze        1 (Kitchen)
  ⚪ Pending     168

KNOWLEDGE VOLUME
  FAQs             2,022
  Articles           45
  Reference images 816 (26 A+)
  Components       5 families
  Calculators      0
  Standards        partial
  Videos           0
  Workflows        18 (shared)

COVERAGE
  Overall (across active domains)    77%
  Staircase overall                  88%
  Kitchen overall                    52% (Bronze target: 40% · exceeded)

KNOWLEDGE HEALTH
  Items with full Health metadata      42%   (rising as backfill continues)
  Items overdue for review             0
  Items in draft status                0
  Items superseded                     0
  Items archived                       0

RETRIEVAL PERFORMANCE
  Average retrieval confidence         0.71 (measured last 100 queries)
  Queries needing clarification (<0.7) 34%   (composes Brain 14)
  Zero-result queries                  8%
  Cross-domain queries served          12%

QUALITY GATES
  Rule c attribution rate              100%  (every item has named_expert)
  Rule a verification rate             100%
  Duplicate rate                       est. 4% (target <2%)

AUTHORING VELOCITY (rolling 7 days)
  FAQs added                           30    (kitchen bulk)
  Articles added                       8
  Images added                         6

TOP AUTHORING PRIORITIES
  1. Kitchen · Maintenance sub-area (54% coverage)
  2. Kitchen · Appliances sub-area (66% coverage)
  3. Kitchen · Plumbing sub-area (60% coverage)
  4. Staircase · Calculators (needed for Gold)
  5. Universal Trade Layer · 15 more shared articles

TOP STALENESS RISKS
  (none yet · all items authored 2026-08-03)
```

### Dashboard Auto-Refresh

The dashboard renders from:

- `data/nex-knowledge/*/knowledge.yaml` — domain declarations + coverage
- `data/nex-knowledge/*/faqs.jsonl` — FAQ counts + health
- `data/nex-knowledge/*/articles/*.md` — article counts + health frontmatter
- `data/nex-image-manifest.json` — image counts + A+ flags
- `data/nex-retrieval-telemetry.jsonl` — retrieval performance signals (write-only append log per query)

Regeneration script: `scripts/build-nex-knowledge-dashboard.mjs` (planned · follows the pattern of `scripts/build-nex-staircase-image-gallery.mjs`).

### The KPI Baseline

Once the dashboard is live, these become the platform's tracked KPIs:

| KPI | Target | Why |
|---|---|---|
| Total domains | 170 by 2028 | Scale target |
| Silver+ domains | 50 by 2027 · 100 by 2028 | Depth over breadth |
| Coverage % | 80%+ across active domains | Quality gate |
| Knowledge Health % | 95%+ full metadata | Governance discipline |
| Duplicate rate | <2% | Consolidation discipline |
| Avg retrieval confidence | 90%+ | User trust proxy |
| Rule c attribution | 100% | Non-negotiable |
| Stale items | 0 overdue | Review discipline |

## Composition

- **Domain Template v1.1** — Maturity Levels + Coverage Score work together; Maturity is the coarse tier, Coverage is the granular percentage.
- **Authoring Workflow** — Coverage Score drives the authoring backlog; Health metadata drives the review queue.
- **Retrieval Contract** — Health `status` filters what surfaces (active only by default); `confidence` combines with retrieval relevance for the overall gate.
- **Brain 14 (Never-Guess)** — dashboard's `queries needing clarification %` measures Brain 14 firing rate.
- **Rule c** — dashboard's `Rule c attribution rate` measures compliance.

## What This Fixes

Without Coverage Score → we know the domain exists but not what's missing.
Without Knowledge Health → items rot silently and no one notices.
Without Dashboard → we're flying blind on platform maturity.

With all three → Nex has an operational cockpit that turns knowledge from opinion into measurement.

## Enhancement Opportunity

Every AI competitor treats knowledge as opaque model weights. Nex is the first system where every item is measurable, attributable, refreshable, and dashboarded. This is what turns "an AI that knows things" into "a knowledge operating system with governance." **This is what will let Nex ship the same architecture across 170 domains without becoming chaotic.**

---

## Refinement · Coverage vs Quality (Philip 2026-08-03 evening)

Philip: *"Your Coverage Score is a useful planning metric, but remember it measures coverage, not necessarily quality. As the system grows, consider tracking additional dimensions alongside coverage."*

**Coverage is the first metric — it is not the only metric.** Below is the complete 5-metric model for measuring platform performance.

### The 5 Quality Metrics

| # | Metric | Question It Answers | How Measured |
|---|---|---|---|
| 1 | **Coverage** | How much of the domain is represented? | % of authored sub-areas + FAQ/article/image counts vs targets · Bronze/Silver/Gold gates |
| 2 | **Retrieval Accuracy** | Does the correct knowledge get selected for the query? | Golden-query set · human-scored per query · target ≥90% top-3 relevance |
| 3 | **Answer Quality** | Are responses technically correct and complete? | Sampled response audits · scored on accuracy · completeness · trade-correctness by Philip-approved reviewers |
| 4 | **Evidence Quality** | Can important claims be traced to authoritative sources? | % of factual claims with `related_assets` link to source · target 100% for numeric claims + regulations |
| 5 | **User Success** | Did the response help complete the user's task? | Session-level outcome tracking · did the user return with a follow-up · did they act on the recommendation · did they leave satisfied |

### Why All Five Matter Together

- **High Coverage + low Retrieval Accuracy** = the knowledge exists but the Router can't find it. Symptom: users report *"I know Nex has this info but it didn't come up."*
- **High Retrieval + low Answer Quality** = the right knowledge is retrieved but the response mis-frames it. Symptom: technical errors · misleading emphasis · missing caveats.
- **High Answer Quality + low Evidence Quality** = answers sound authoritative but claims can't be traced. Trust erodes when users try to verify.
- **All four high + low User Success** = the platform is technically excellent but doesn't actually help. Symptom: high bounce rate · users don't return · low conversion.

### Metric Priority Order (as Nex matures)

**0-12 months (2026):** Focus 1 (Coverage) + 4 (Evidence Quality). Get the knowledge in with attributable sources. This is where we are.

**12-24 months (2027):** Add 2 (Retrieval Accuracy). Once volume grows, the Router's ability to find the right item becomes the binding constraint. Requires telemetry (composes with Learning Loops per Refinement #7).

**24-36 months (2028):** Add 3 (Answer Quality). Once retrieval is solid, focus on how the retrieved items become responses. Composes with Foundation Brain quality gates + LLM assembly refinement.

**36+ months:** Add 5 (User Success). Once the first four are solid, close the loop on whether users actually accomplish their goals. This requires Workspace-scale telemetry (Phase F).

### Dashboard Section Additions

The Knowledge Dashboard (defined earlier in this doc) grows to include:

```
RETRIEVAL ACCURACY
  Golden-query set size                150
  Top-3 relevance rate                 87%  (target ≥90%)
  Zero-result queries                  8%
  Queries needing clarification        34%

ANSWER QUALITY
  Sampled responses audited (last 30d) 24
  Accuracy score                       94%
  Completeness score                   88%
  Missing-caveat rate                  3%

EVIDENCE QUALITY
  Factual claims with source links     92%  (target 100% for numeric/regulatory)
  Regulatory claims with citation      100%
  Unverified authoritative claims      6%

USER SUCCESS  (Phase F telemetry required)
  Return-visit rate                    72%
  Recommendation-acted-upon rate       —
  Session-outcome satisfaction         —
```

### The Metric Independence Rule

Each metric is INDEPENDENT — improving one does not automatically improve the others. Coverage is easy to inflate (author lots of thin content) but destroys the other four if done carelessly. **Rule of thumb: never optimise a single metric to the detriment of the other four.**

Composes with:
- Rule c (Attributable Origin) — evidence quality prerequisite.
- Brain 14 (Never-Guess) — evidence quality enforcement point.
- Learning Loops (Refinement #7) — retrieval accuracy improvement mechanism.
- ADR-0025 (Image Matcher Tiered Thresholds) — retrieval accuracy baseline.
- ADR-0033 (Quality Over Quantity) — coverage must not inflate at cost of quality.

### Enhancement Opportunity (updated)

**Coverage tells you how much you've built. The other four tell you whether what you built actually works.** Every competitor stops at "we have X pieces of content." Nex measures whether X pieces actually help. That gap is what turns Nex from a content database into a knowledge operating system with measurable outcomes.
