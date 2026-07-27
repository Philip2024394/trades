# ADR-0033: Quality Over Quantity + Brain Isolation — NEX must be difficult to teach

Status: Accepted · **IMMUTABLE** · overrides ADR-0031 "save everything at Pass 7" behaviour for below-threshold rows
Date: 2026-07-27

> **Philip's directive (2026-07-27):** *"NEX should be difficult to teach. If NEX is easy to teach, it will become inaccurate over time. If NEX is strict about what enters its intelligence layer, its knowledge base will remain much more reliable."*

## Context

ADRs 0028-0032 built the intelligence system. ADR-0031's Pass-7 atomic write ended up saving 981 rows including 856 with MASTER SCORE <50 (poor) and 113 with score 50-69 (marginal). Under Philip's new Golden Rules those rows **do not meet the intelligence standard** and are polluting the manifest. Better to have 250 excellent rows than 950 partially-correct rows.

Additionally, without brain isolation an oak-door image can drift into the Staircase Brain, degrading its quality forever. Brains must be strictly scoped by primary subject.

## Decision — The Seven Golden Rules of NEX Quality

### Rule #1 — NEX MUST NEVER GUESS

If confidence is low, DO NOT:
- auto-complete
- inherit incorrectly
- move collections
- assign brains

Instead: **return "ADMIN REVIEW REQUIRED"**. No guessing is ever rewarded.

### Rule #2 — Quality Over Quantity

- **WRONG:** 950 completed
- **RIGHT:** 250 completed · 100% correct

300 excellent images > 950 partial images. Every dashboard and report must reflect this.

### Rule #3 — Poor images MUST NOT enter NEX intelligence

If an image cannot reach the intelligence standard, it is **not eligible** to become part of NEX intelligence. Two acceptable disposals:

- **SAVE DISABLED** — return error, do not persist
- **SAVE AS DRAFT ONLY** — persist with `draft_only: true` flag; filtered out of every downstream intelligence query

Tagger UI shows the specific missing fields and recommends admin action.

### Rule #4 — Brains are completely isolated

- **STAIRCASE BRAIN** knows ONLY: staircases · regulations · balusters · handrails · volutes · strings · treads · risers · interiors containing staircases · staircase renders · staircase products
- **DOOR BRAIN** knows ONLY: doors · frames · hinges · locks · glazing · etc.
- **INTERIOR BRAIN** knows ONLY: interiors · lighting · composition · furniture · etc.
- **TOOLS BRAIN** knows ONLY: construction tools · machinery · power tools · PPE
- **TIMBER BRAIN** knows ONLY: timber species · wood grain · lumber
- **KITCHEN BRAIN** · **BATHROOM BRAIN** · **FLOORING BRAIN** · **LIGHTING BRAIN** · **ROOFING BRAIN** · **MARKETING BRAIN** — each strictly scoped.

No cross-contamination. Ever. `oak-door.jpg` never enters STAIRCASE BRAIN. `bathroom.jpg` never becomes `luxury staircase`. `modern staircase.jpg` never enters DOOR BRAIN.

### Rule #5 — No General Brain

Never build one huge brain containing everything. The architecture is:

```
NEX AI
   |
CLASSIFIER
   |
   +── staircase_brain
   +── door_brain
   +── interior_brain
   +── kitchen_brain
   +── bathroom_brain
   +── tools_brain
   +── timber_brain
   +── flooring_brain
   +── lighting_brain
   +── roofing_brain
   +── marketing_brain
```

The classifier decides where an image belongs. Only then is it allowed into the correct brain.

### Rule #6 — Multi-collection, single primary_brain

Images can belong to multiple **collections** but only ONE **primary_brain**.

Example: *modern walnut staircase* belongs to collections `staircases · luxury_interiors · walnut_samples · hero_images · ai_renders` — but its `primary_brain` is `staircase_brain`. NOT door_brain. NOT tools_brain.

The Staircase Brain may INHERIT knowledge from other collections without those collections taking OWNERSHIP of the image.

### Rule #7 — Save must refuse low-quality intelligence

When admin presses Save:

```
IF master_image_score < 70
  RETURN save_failed
  reason: "This image does not currently meet the minimum NEX intelligence requirements."
  Missing: [material, style, purpose, collection intelligence, primary_brain]
  Action Required: update tags · assign collection · assign material · assign purpose · confirm primary_brain
```

Only after the row reaches the required threshold is `SAVE TO INTELLIGENCE` allowed.

## Thresholds (immutable)

| MASTER SCORE | Disposition | Enters NEX intelligence? |
|---:|---|---|
| ≥ 70 | Clean save. Enters intelligence. | **YES** |
| 50-69 | Draft only. `draft_only: true` flag. Filtered from all intelligence queries. | NO |
| < 50 | **SAVE FAILED.** Return error listing missing fields. Admin must resolve first. | NO |

Additionally: **any row assigned `primary_brain: null` fails save** regardless of score. If NEX cannot confidently classify the primary brain, the row cannot enter intelligence.

## Consequences

**Positive:**
- Manifest becomes a **trusted knowledge base** — every row has been through the quality gate.
- Brains stay pure — no drift from cross-contamination.
- The library gets smaller before it gets bigger — but everything in it is real intelligence.
- Long-term accuracy protected — the harder it is to add junk, the less junk accumulates.
- Every downstream surface (matcher, brain answers, banner generation) can trust manifest content.

**Negative:**
- Auto-completion counter drops sharply — 981 → ~12-30 rows initially eligible.
- Admin review workload rises upfront — the "poor" rows need real authoring or explicit rejection, not silent low-quality save.
- Bulk imports become a much smaller yield — most auto-classified content gets refused.

**Neutral:**
- ADR-0031's 7-pass pipeline still runs — the change is at Pass 7 (the save decision), not the intelligence-building passes.
- Draft rows can exist for admin triage, they just don't participate in intelligence.

## Enforcement

- **`master_image_score < 70` = SAVE REFUSED** — save endpoint returns 422 with the missing-fields list.
- **`master_image_score 50-69` = optional draft save** — client explicitly opts in via `?as_draft=1` param. Row persists with `draft_only: true`; filtered out of every read path unless a caller explicitly queries `include_drafts: true` (admin surfaces only).
- **`primary_brain: null` = SAVE REFUSED** regardless of score.
- Existing bulk-processor + `run-global-intelligence-pipeline.mjs` must respect the gate — only rows scoring ≥70 with a valid primary_brain enter the manifest.
- The 856+113 currently-polluting rows in the manifest MUST be purged as part of enforcing this ADR. Script: `scripts/purge-below-threshold.mjs`. Only rows scoring ≥70 with a valid primary_brain (plus manually-authored rows) survive the purge.
- Tagger UI shows a red "SAVE DISABLED · below intelligence threshold" state when the current draft scores <70. Save button greyed out until threshold met, or an explicit "Save as draft" button appears for 50-69 scores.

## Alternatives considered

- **Keep saving everything with confidence flags** — rejected explicitly. Even flagged rows pollute matchers and brain queries. The whole point is a clean intelligence layer.
- **Lower the intelligence threshold to 50** — rejected. Marginal rows are exactly the ones that erode brain accuracy over time.
- **Allow a "general brain" as fallback** — rejected explicitly (Rule #5). Cross-domain contamination is the exact failure mode we're preventing.

## Related

- ADR-0032 (Chief Intelligence Officer) — this ADR sharpens the CIO's quality mandate.
- ADR-0031 (Global Intelligence Bootstrap) — Pass 7 behaviour amended by this ADR.
- ADR-0030 (Intelligence Layers) — the 6-level stack still applies; this ADR adds a hard threshold on the OUTPUT of the stack.
- ADR-0028 (Intelligence Constitution) — this ADR is the practical enforcement layer.
- Memory: `feedback_nex_quality_over_quantity_and_brain_isolation.md`
- Trigger: Philip 2026-07-27 — "NEX should be difficult to teach. Never lower standards to increase auto-completion. The goal is not maximum completion rates — the goal is maximum intelligence accuracy."
