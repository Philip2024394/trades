# ADR-0031: Global Intelligence Bootstrap + The Golden Rule of NEX

Status: Accepted · **IMMUTABLE** · supersedes the "≥3 A+ rows bootstrap" clause of ADR-0030
Date: 2026-07-27

## THE GOLDEN RULE OF NEX (IMMUTABLE · TOP-LEVEL)

> **NEX MUST NEVER ASK THE ADMIN A QUESTION WHICH CAN BE ANSWERED BY ANOTHER IMAGE.**
>
> If one image knows the answer, all images should inherit that intelligence.
>
> If 900 images collectively know the answer, then NEX already knows the answer.
>
> Images do not exist individually. Collections do not exist individually. Everything belongs to the NEX intelligence layer.
>
> No image should be processed in isolation unless explicitly required.
>
> Admin Review is the FINAL OPTION.
>
> The objective is NOT to process 982 images. The objective is to make image number 500,000 more intelligent because image number 1 existed.
>
> **THIS RULE IS IMMUTABLE.**

---

## Context

ADR-0030 introduced the 6-level intelligence stack, but implemented Collection Intelligence with a "≥3 A+ rows" bootstrap floor. Philip's directive (2026-07-27): **that floor is wrong**. Every image is intelligence — even one. And more importantly, images shouldn't be processed individually at all. They should be processed as a collective across multiple passes, where each image benefits from every other image before anything is saved.

The old model:
```
Image 1 → parse → save → next image → parse → save → …
```

The correct model:
```
All 982 images → Pass 1 (collections) → Pass 2 (relationships) → Pass 3 (material journeys) →
Pass 4 (DNA patterns) → Pass 5 (auto-prompts) → Pass 6 (confidence) → Pass 7 (SAVE EVERYTHING)
```

By Pass 7, image #1 has taught NEX something that image #982 uses, and vice versa. The library becomes an intelligence graph, not a linear pile.

## Decision

**Every batch import runs through the 7-pass Global Intelligence Pipeline. Nothing is saved until Pass 7.**

### The Seven Passes

**Pass 1 — Collection Intelligence.**
Read every candidate URL. Cluster by inferred collection (using filename patterns, referring-file paths, existing context blobs, subject-domain hints). Produce a `collections[]` graph with URL membership + provisional collection identity. NO SAVES.

**Pass 2 — Relationship Intelligence.**
Read all URLs again with Pass 1's collection membership in hand. Detect:
- Timestamp-adjacent siblings (same generation session)
- Filename-family siblings (same base filename with variants)
- Family-tree parent/child inference (transparent PNG of X → X is parent)
- Wood-gallery peer relationships
Produce a `relationships[]` graph. NO SAVES.

**Pass 3 — Material Journey Intelligence.**
Read all URLs looking for stage markers (Stage N of M, Previous Stage, Next Stage, THIS IMAGE tags). Cross-reference across the whole set to detect journey sequences that span multiple images. NO SAVES.

**Pass 4 — DNA Intelligence.**
For every URL, run the base parser to extract whatever DNA fields it can from available context. Then compute cross-collection patterns: *"73% of images in Luxury Staircases collection have SETTING=residential"* · *"91% of wood-gallery images have STYLE.photographic=architectural"*. These patterns become the per-collection aggregates. NO SAVES.

**Pass 5 — MASTER AI PROMPT Generation.**
For each URL, compose the MASTER AI PROMPT using: (a) whatever the base parser extracted directly, plus (b) collection aggregates from Pass 4, plus (c) relationship-inherited fields from Pass 2, plus (d) material-journey context from Pass 3. Every field composed is a real value — no fabrication. NO SAVES.

**Pass 6 — Confidence Scoring.**
For every URL compute:
```
overall_confidence =
  (base_dna_score × 0.4) +
  (collection_pattern_confidence × 0.3) +
  (relationship_confidence × 0.15) +
  (journey_confidence × 0.15)
```
NO SAVES.

**Pass 7 — SAVE.**
Write the entire manifest atomically. Every row now carries the full 7-pass intelligence. Rows with `overall_confidence >= 85%` are clean. Rows with `70-85%` are soft-caveat. Rows below `70%` are flagged for admin review.

### The "≥3 A+ rows" bootstrap floor from ADR-0030 is removed

Replaced by: **every image contributes to intelligence, even one**. Sample size affects confidence — a pattern detected from 1 image contributes 10% confidence weight, from 10 images 50%, from 100 images ~90%. But no image is excluded from teaching NEX simply because it's alone.

### Never process images individually

Any code that reads one image at a time and saves it before consulting the rest of the manifest violates this ADR. Bulk imports go through the pipeline. Single admin edits (one image tagged by human) trigger a pipeline re-run in the background so subsequent imports benefit from the new intelligence.

## Consequences

**Positive:**
- **Global intelligence emerges from collective evidence** — no chicken-and-egg bootstrap problem.
- Every image teaches every other image. The library becomes a graph, not a pile.
- Admin intervention target (< 5%) becomes achievable because Pass 6 confidence uses the entire library as evidence.
- Runtime cost is a small constant per pass × N images — much cheaper than per-image vision inspection.
- The pipeline is re-runnable — as new images arrive, re-run passes to keep intelligence fresh.
- Image #500,000 is measurably more intelligent because image #1 existed.

**Negative:**
- 7-pass pipeline is more complex than per-image save. Requires an orchestrator + in-memory intelligence graph.
- Atomic Pass-7 write means the manifest is either fully current-generation OR fully previous-generation. No partial states.
- Debugging: if Pass 3 misclassifies, every downstream pass carries the error — need per-pass audit logs.

**Neutral:**
- Existing single-image save endpoint (`/api/admin/image-tagger/save`) still works for manual authoring. It just triggers a background pipeline re-run so the collection intelligence updates.

## Enforcement

- New pipeline lives at `src/lib/nex/images/globalIntelligencePipeline.ts`.
- Bulk import script uses `runGlobalIntelligencePipeline()` — direct per-URL `parseImageKnowledge()` calls in bulk paths are a violation.
- Manual save endpoint stays but appends a `pipeline_rerun_pending: true` flag; a background worker (deferred build) runs the pipeline periodically to keep intelligence fresh.
- Per-pass logs written to `data/nex-pipeline-audit/{timestamp}.json` so any misclassification can be traced to the pass that introduced it.
- ADR-0030's "≥3 A+ rows" clause is superseded by this ADR's "every image contributes" principle.

## Related

- ADR-0030 (Intelligence Layers) — this ADR provides the orchestration model for the 6 layers.
- ADR-0028 (Intelligence Constitution) — this ADR is the mechanism that makes the constitution's "images become knowledge" real.
- ADR-0027 v1.2 (Golden Rules 1-14) — this ADR adds THE GOLDEN RULE OF NEX as the top-level immutable directive.
- ADR-0026 (Image Knowledge System) — schema unchanged; this ADR changes how rows get populated.
- Memory: `feedback_nex_global_intelligence_bootstrap.md`
- Trigger: Philip 2026-07-27 — "982 images. NO SAVING. NO TAGGING. NO QUESTIONS. BUILD COLLECTION INTELLIGENCE FIRST. …SAVE EVERYTHING at Pass 7."
