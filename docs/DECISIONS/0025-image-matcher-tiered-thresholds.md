# ADR-0025: Tiered thresholds for the NEX image matcher

Status: Accepted
Date: 2026-07-27

## Context

Once the image manifest (ADR-0024) has enough tagged rows, NEX will surface images across many surfaces: directory cards, chat answers from the staircase brain, marketing hero art, banner recommendations, workshop diagrams, etc. Every surface needs to answer the same question — *given a user query or a listing's metadata, which manifest image is the right one?* — but the acceptable quality bar is very different by surface.

A single global similarity threshold either produces silence on low-stakes surfaces (bad UX — user gets a gradient placeholder when a decent image was available) or produces embarrassing mismatches on high-stakes surfaces (a Victorian traditional stair image on a floating-glass marketing hero — trust damage). Either way the platform's image intelligence looks stupid.

We also need to avoid the failure mode where NEX confidently returns the wrong image with no signal. When the confidence is genuinely mid-range, the honest thing is to caveat it and invite correction. When it's low, the honest thing is to ask a clarifying question, not guess.

## Decision

**Per-surface thresholds** with a **three-band response model**, tuned separately by consuming surface.

### Score formula (starting point, subject to iteration once telemetry lands)

Match score is a weighted sum of three signals, normalised to 0.0–1.0:

- **Tag intersection** (weight 0.4): fraction of image's tags that appear in the query / listing tags.
- **Description keyword overlap** (weight 0.4): TF-IDF-style keyword match between the image's `description` field and the query text (or the listing's `services` + `description`).
- **Structured field agreement** (weight 0.2): +1 if `subject_domain` matches, +0.5 each for `setting` / `mood` / `view_type` / `colour_palette` matches, capped at 1.0.

Images with `excluded: true` or `a_plus: false` are hard-filtered out before scoring (a_plus filter is optional per surface — some surfaces accept non-A+).

### Three response bands (universal)

| Score | Band | Behaviour |
|---|---|---|
| ≥ 0.85 | **Confident** | Surface the image with no caveat |
| 0.70 – 0.85 | **Soft caveat** | Surface with a small "closest match — tell me more if this isn't right" label |
| < 0.70 | **Clarify** | Do NOT surface. Ask a targeted follow-up question. Example: *"Want to see felted or torch-on roof examples?" · "Traditional or contemporary?" · "Timber, glass, or steel balustrade?"* |

The clarifying question is derived from whichever high-cardinality dimension had the biggest score-improvement potential across the top 3 candidates. If two candidates are close but differ on `mood` (rustic vs modern), ask about mood. If they differ on `setting`, ask about setting.

### Per-surface thresholds

Each consumer surface picks a **confident floor**. Below the confident floor, the response falls to Soft caveat or Clarify per the band table above.

| Surface | Confident floor | Rationale |
|---|---:|---|
| **Directory cards** (`/nex-app/centre`) | 0.65 | Fallback placeholder always exists; generic staircase on a stair company card is contextually right even if not perfectly matched. |
| **Brain chat illustration** | 0.80 | Wrong image undermines the answer's authority. |
| **Marketing hero art** | 0.90 | Public-facing, permanent, sets brand impression. |
| **Banner recommendations** | 0.75 | Editable by merchant afterward, so slight mismatch is recoverable. |
| **Workshop diagram inserts** | 0.85 | Wrong diagram = wrong build. |
| **Search results grid** | 0.60 | Multiple results shown; user picks. |

Any new surface consuming the matcher must document its floor + rationale in this ADR.

### Corpus-size tuning

Thresholds are **not fixed forever**. They tighten as the manifest grows:

- **Corpus < 100 tagged images:** stick with the floors above. Below 100, demanding 0.85 for the confident band means most queries silence — bad experience.
- **Corpus 100 – 500:** raise every floor by 0.05.
- **Corpus > 500:** raise every floor by 0.10 from the starting point. Confident band on marketing tightens to 0.95.

The trigger is manifest row count (`Object.keys(nex-image-manifest.json.images).length`), checked at matcher init and logged.

### Telemetry (required from day one)

Every match attempt writes to `hammerex_nex_image_match_log` with:

- `query` (user text OR structured JSON of the listing metadata used)
- `surface` (which consuming surface asked)
- `top_3_matches` (URL + score for each)
- `chosen_band` (`confident` / `soft-caveat` / `clarify`)
- `chosen_image_url` (null if band was `clarify`)
- `follow_up_asked` (the clarifying question, if any)
- `user_reasked` (populated in a follow-up event when the user reformulates the query — signals the match was wrong)
- `created_at`

Weekly review: for each surface, compute (a) % of queries reaching Confident, (b) % reaching Clarify, (c) `user_reasked` rate for Confident matches. If Clarify rate > 30% on any surface, threshold is too high or vocab is too narrow. If `user_reasked` rate > 15% on Confident, threshold is too low.

## Consequences

**Positive:**
- Every surface gets the right precision/recall trade-off for its stakes — no one-size compromise.
- The Clarify band turns "we don't know" into a smart conversational prompt — feels like NEX is thinking, not failing.
- Telemetry gives evidence-based threshold tuning; no gut-based tinkering.
- Corpus-size scaling means we can ship early with a small tagged set without silence, then tighten as quality corpus grows.
- The confident/caveat/clarify pattern is user-facing self-explanatory — the caveat text itself teaches users that NEX is uncertain and invites correction.

**Negative:**
- More consuming code (each surface must pick its floor + display the band-appropriate caveat).
- The `user_reasked` signal requires a follow-up-tracker in the chat/query event stream — small extra plumbing.
- Threshold-per-surface means more test surface area when tuning.
- The clarifying-question generation is a small heuristic today — will need to improve as coverage grows (probably becomes a small model call for A/B).

**Neutral:**
- Non-staircase domains will need their own vocab expansions to hit the same match quality. The framework is domain-agnostic, but the tag vocabulary is currently staircase-heavy.

## Alternatives considered

- **Single global threshold** — rejected. Same wrong-image mismatch problem across surfaces, or same silence problem depending on where the number lands.
- **Two bands (match / no-match)** — rejected. Loses the honest middle band where NEX can offer a soft-caveat match and get correction data.
- **Vector embeddings for description-to-query similarity** — deferred. TF-IDF-style keyword overlap is enough for the current corpus; embeddings become worthwhile at 500+ images when the vocab richness genuinely differentiates. Add later without changing the tiered framework.
- **Let the merchant pick their own card image** — orthogonal, not conflicting. Post-claim merchants absolutely should upload their own; the matcher is for pre-claim + brain + marketing surfaces where there's no merchant to ask.

## Related

- ADR-0022 (No third-party image copy) — matcher only picks from NEX-owned manifest rows.
- ADR-0023 (Directory import rules) — the 37 directory cards are the first matcher consumer.
- ADR-0024 (Image manifest rule) — the matcher's source of truth.
- Memory: `feedback_nex_image_manifest_rule.md`
- Trigger: Philip 2026-07-27 "or do you think we can go higher for match advice?"
