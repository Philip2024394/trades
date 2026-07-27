# ADR-0035: The Two Laws of NEX — Classify Never Reject

Status: Accepted · **IMMUTABLE** · supersedes the save-refusal behaviour of ADR-0033
Date: 2026-07-27

> **Philip's correction (2026-07-27):** *"If 98.8% of your images are failing, I don't immediately assume the images are poor. I start questioning the measurement system."*
>
> ADR-0033 introduced a hard quality gate that refused saves below score 70. Result: 969 of 981 images (98.8%) got rejected. That's the measurement system failing, not the images. A 31% "poor" score on the only monkey tail volute image in the library is INCREDIBLY VALUABLE — precisely when a user asks for a monkey tail volute. The rejection gate was wrong.

## Context

The NEX Knowledge Engine (ADR-0034) exists to extract every piece of knowledge from every image. A hard gate that refuses images below an arbitrary threshold is antithetical to knowledge extraction — it discards knowledge that would be uniquely valuable in specific queries. A "specialist knowledge" score of 31% on a rare subject beats a "master knowledge" score of 97% on a generic hero shot when the user's query targets the rare subject.

The correction is not to lower the threshold. The correction is to **eliminate the concept of rejection** and replace it with **classification bands**. Every image saves. Every image is classified honestly. The consuming surface decides which bands to surface for which queries.

## Decision

### THE FIRST LAW OF NEX (immutable)

> **NO IMAGE IS STUPID. EVERY IMAGE HAS KNOWLEDGE.**

An image may teach 1 thing or 1000 things. Both have value.

NEX must NEVER ask *"Is this image good enough?"*
NEX must ALWAYS ask *"What can I learn from this image?"*

An image must never receive 0 knowledge. If only one piece of knowledge exists, that knowledge must be saved.

### THE SECOND LAW OF NEX (immutable)

> **KNOWLEDGE IS NEVER REJECTED. IT IS ONLY CLASSIFIED.**

Every image saves into the manifest with a classification band based on its Knowledge Extraction Score:

| Score | Band | Meaning |
|---:|---|---|
| 97-100 | **Master Knowledge** | Fully-extracted, comprehensive intelligence |
| 90-96 | **Excellent Knowledge** | Rich, near-complete extraction |
| 75-89 | **Good Knowledge** | Strong extraction with minor gaps |
| 60-74 | **Specialist Knowledge** | Narrow but deep on its domain |
| 40-59 | **Reference Knowledge** | Useful references, limited depth |
| 20-39 | **Limited Knowledge** | Minimal extraction, still cataloguable |
| 1-19 | **Visual Knowledge** | Visual reference only, minimal metadata |

The score does NOT represent the value of the image. The score represents the amount of knowledge currently extracted from the image. Every image has value.

### The Third Rule — user intent is the destination

> **THE IMAGE IS NEVER THE PRODUCT.**
> **THE KNOWLEDGE IS THE PRODUCT.**
> **THE USER'S INTENT IS THE DESTINATION.**
>
> If NEX understands the user's intent, then NEX has succeeded.

This is the highest rule of the NEX Knowledge Engine.

### What this changes concretely

- **Save endpoint** — no longer returns 422 for low-score rows. Every save succeeds. Response includes the classification band + score breakdown. Client renders the band on the card.
- **Pipeline Pass 7** — no longer drops sub-70 rows. Every image saves with its band. The `rejected` counter is removed; replaced with per-band counters.
- **`draft_only: true` flag** — REMOVED. There is no draft state. Every image is real, classified, saveable knowledge.
- **`primary_brain: null` refusal** — REMOVED. A row without a confidently classified brain is classified as `Reference Knowledge` or lower with `primary_brain: null` and stays in the manifest. The classifier can be re-run later when more collection intelligence exists.
- **Search / matcher surfaces** — read from ALL bands by default. Callers can filter by band (`min_band: "good"` etc.) when they need higher-quality-only. The Gold Standard (ADR-0034) still applies — zero-result queries decompose per fragment, but they now search across all 7 bands before falling back.

### The 969 rows come back

The pipeline is re-run under ADR-0035 rules. All 981 URLs save with honest classifications. Expected distribution (from earlier pipeline run):

- **Master + Excellent (≥90):** ~0-12
- **Good (75-89):** ~11-30
- **Specialist (60-74):** ~50-100
- **Reference (40-59):** ~150-250
- **Limited (20-39):** ~300-450
- **Visual (1-19):** ~150-400

Every one of them is knowledge NEX can surface when the query matches.

### ADR-0033 amendment

ADR-0033's brain isolation rules stay in force:
- Brains are still isolated (no cross-contamination)
- Multi-collection but single `primary_brain` per image
- Never guess a brain — if unclassifiable, `primary_brain: null` and that row surfaces only when its band is queried without brain filter

But ADR-0033's:
- ~~"Save disabled below 70"~~ — REMOVED
- ~~"Poor images do not enter intelligence"~~ — REVERSED (poor images ARE intelligence, classified as Visual/Limited)
- ~~"Save refuses low-quality intelligence"~~ — REVERSED (save always succeeds, classifies)

## Consequences

**Positive:**
- Manifest becomes the FULL knowledge library — nothing lost to statistical rejection.
- Specialist images (31% score on rare subjects) become surfaceable when their subject is queried.
- Users experience NEX as an engine that "always knows something" — no dead ends.
- Knowledge extraction yield grows monotonically over time — every image contributes.
- The Gold Standard (ADR-0034 · never say "0 results") becomes easier to hit because the library is fuller.

**Negative:**
- Manifest is larger — from ~12 rows to ~981 rows overnight.
- Surface queries need to consciously filter by band when they want quality-only.
- Some brains (staircase, timber, etc.) will have many low-band rows alongside their few high-band ones — retrieval logic must weight appropriately.

**Neutral:**
- Brain isolation, geometry preservation, DNA schema, all prior structural decisions stay in force. ADR-0035 changes the SAVE decision only; it doesn't change what a row contains.

## Enforcement

- Save endpoint always returns 200 with the classification band. Never 422 for low score.
- Pipeline Pass 7 saves every processed row regardless of score.
- Client UI (`CircularScore` component) shows the 7-band label in the ring — never "SAVE FAILED".
- Search endpoints accept `min_band` parameter (default: `visual` = surface everything) so callers can raise quality bar when needed.
- Every image's row includes `knowledge_band: string` alongside `master_image_score: number` for direct filtering.
- Removal notes: `draft_only` flag deprecated; `save_refused` and `save_marginal_needs_draft_flag` error codes removed from the save endpoint.

## Related

- ADR-0034 (Knowledge Engine + Gold Standard) — this ADR completes the philosophy by ensuring the knowledge base is FULL, not gated.
- ADR-0033 (Quality Over Quantity) — save-refusal clauses reversed; brain isolation clauses retained.
- ADR-0032 (CIO + MASTER IMAGE SCORE) — scoring formula unchanged; only the ACTION on the score changes.
- ADR-0028 (Intelligence Constitution) — the Third Rule ("user's intent is the destination") extends the Constitution's highest rule.
- Memory: `feedback_nex_two_laws_classify_never_reject.md`
- Trigger: Philip 2026-07-27 — "If 98.8% of your images are failing, question the measurement system, not the images. Knowledge is never rejected — it is only classified."
