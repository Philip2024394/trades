# ADR-0030: Intelligence Layers Before Admin — the 6-level stack

Status: Accepted · **IMMUTABLE** · amends ADR-0027 Rule #6/#10 validator behaviour
Date: 2026-07-27

> **Preamble (loaded above every image-processing task):**
>
> **"You have permission to think. You are NOT restricted to the description field. You may use image pixels, collection intelligence, image relationships, collection DNA, material journeys, parent images, image families, Google descriptions, previous image intelligence, image inheritance, image geometry, collection confidence, and AI confidence scoring — to build intelligence automatically. NEVER ask the admin a question that NEX can answer itself. Admin review is the FINAL OPTION. Target: <5% admin intervention across all images."**

---

## Context

ADRs 0024-0029 built the intelligence primitives (DNA · manifest · matcher · Golden Rules · Constitution · Tagger Directive). The validator that ships flagged rows for admin review was implemented in a way that **short-circuited the entire intelligence stack**: as soon as the description was missing a MASTER AI PROMPT section, the row hard-flagged for admin — even when NEX had rich collection intelligence + parent image relationships + inferred DNA that could have generated a real MASTER AI PROMPT automatically.

This flipped the constitution on its head. Rules #7 (collection inheritance) and #12 (never lose knowledge) and the entire premise of Collection DNA existed precisely so admin review would be a **last resort**, not a first response to missing text.

Philip's directive (2026-07-27): *"Admin should be the LAST option not the FIRST option. If collection intelligence can determine the answer with 95% confidence, SAVE AUTOMATICALLY. Only flag when NEX cannot confidently determine the answer after exhausting ALL intelligence layers."*

## Decision

**Six-level intelligence stack. Admin review only fires at Level 6, after Levels 1-5 have all failed to reach the 85% confidence threshold.**

### Level 1 — Collection Intelligence
Compute aggregate DNA across all A+ rows in the target collection. If sample_size ≥ 3 AND per-field confidence ≥ 85%, inherit those fields into the new image's DNA. Boost the base DNA score by up to 30 points proportional to fields inherited.

### Level 2 — Image Intelligence
Run the base parser (`parseImageKnowledge()`) against whatever context is authored. Extracts tags · subject_domain · image_type · locked_attributes · material_journey · objects · nested DNA fields directly from the description text.

### Level 3 — Relationship Intelligence
Read `family_tree.parent_url` and sibling relationships. Children inherit parent DNA + locked attributes + collection membership. (Requires family_tree data — deferred until transformation pipelines populate it.)

### Level 4 — MASTER AI PROMPT Auto-Generator
When the row has no authored MASTER AI PROMPT, generate one by composing the inherited + inferred DNA fields into a natural-language template: *"Ultra {realism} {photographic style} of a {image_type}. {STYLE.primary}. In {MATERIALS.primary} with {MATERIALS.secondary}. Set in a {SETTING.primary}. Viewed from {CAMERA.view} at {CAMERA.height}. Under {LIGHTING.primary}. Features: {top tags}. Rendered in premium {QUALITY.rendering} quality."*

This is **not fabrication** — every field is a real value from Level 1-3 intelligence. Empty fields are simply omitted from the template. The result is a genuine recreation prompt that another AI can use.

### Level 5 — Vision Intelligence (deferred build)
Vision-model inspection of the actual image pixels to extract style / colours / composition / subject when the earlier layers can't. Requires vision-model API wiring. Deferred to a separate ADR/build.

### Level 6 — Admin Review (LAST RESORT)
Flag for admin **only when** overall_confidence (Levels 1-5 combined) is still below 85%. The flag lists exactly which layers failed and what the parser inferred so admin can efficiently accept / edit / reject.

### Confidence combination formula

```
overall_confidence =
  fields_inherited.length > 0
    ? (image_dna.score × 0.7) + (collection_intelligence.overall_confidence × 0.3)
    : image_dna.score
```

Auto-generated MASTER AI PROMPT contributes to overall_confidence only if the fields it composed from were themselves ≥85% confident.

### Bootstrap requirement

Level 1 (Collection Intelligence) needs a **minimum sample size of 3 A+ rows per collection** to fire. Below that threshold, the intelligence layers degrade to Level 2 (base parser only), and most rows will land flagged for admin. This is by design — collection intelligence can't be extrapolated from insufficient data without becoming a form of guessing.

**Bootstrap path:** for each major collection you want NEX to auto-classify, author 3-10 rich A+ rows manually. Once bootstrapped, subsequent rows in that collection inherit automatically.

### What must NEVER happen

- Fabricating a MASTER AI PROMPT from fields the parser did not actually extract.
- Inheriting fields from a collection where per-field confidence is below 85%.
- Skipping the intelligence stack and flagging admin as the first response.
- Silently marking a low-confidence auto-generated row as clean.

## Consequences

**Positive:**
- Admin intervention drops from *every unfamiliar image* to *only genuinely ambiguous images* — the <5% target.
- Collections compound: each properly-authored row raises Level 1 confidence for every subsequent row in the same collection.
- MASTER AI PROMPT auto-generation from inherited DNA means new images enter the system recreation-ready without manual authoring, when collection intelligence is sufficient.
- The constitution's Rule #7 (inheritance) and Rule #12 (never lose knowledge) finally have teeth.

**Negative:**
- Bootstrap is real — collections with fewer than 3 A+ rows can't benefit from inheritance. Early phase requires human authoring of seed rows per collection.
- Vision Intelligence (Level 5) is deferred — until it exists, images with zero authored context AND no collection to inherit from will still flag for admin.
- Overall confidence formula weights collection intelligence at 30% — deliberately conservative so a strong collection can't drown out a weak image, but also can't lift a weak image to clean status alone.

**Neutral:**
- Confidence bands from Rule #6 (99%/95%/85%/<85%) still hold. This ADR changes WHEN the bands apply (post-inheritance, not pre-) — not the bands themselves.

## Enforcement

- All calls to `validateImageKnowledge()` MUST pass `overall_confidence` from `parseWithInheritance()`. Bypassing this and validating on raw DNA score alone is a violation.
- `parseWithInheritance()` is the canonical parser entry point post-ADR-0030. Direct calls to `parseImageKnowledge()` are permitted only for tests and low-level tooling that must inspect base DNA without inheritance.
- `getCollectionIntelligence()` is the only source of truth for collection aggregates. Downstream surfaces (banner generation, hero selection, brain illustration) MUST consume it rather than recomputing aggregates.
- Any surface that flags an image for admin MUST report the specific layer(s) that failed and the fields the parser did successfully infer — so admin work is targeted, not from-scratch.

## Alternatives considered

- **Keep the pre-ADR-0030 validator** (flag on any missing MASTER AI PROMPT) — rejected explicitly by Philip's directive. Makes admin the first response and defeats collection intelligence.
- **Lower the confidence floor to 70% or 60%** — rejected. Violates Rule #6 bands and ships mediocre auto-classifications as if they were clean.
- **Skip Levels 1-4 entirely and only use vision intelligence** — rejected. Vision is expensive and unnecessary when collection intelligence can answer. Vision is Level 5 for a reason: use it only when cheaper layers fail.

## Related

- ADR-0027 v1.2 Rule #6/#10 — modified in the validator to respect `overall_confidence`
- ADR-0027 v1.2 Rule #7 (collection inheritance) — this ADR is its concrete mechanism
- ADR-0028 (Intelligence Constitution) — this ADR is the enforcement layer
- ADR-0029 (Image Tagger Directive) — this ADR flips "flagged if incomplete" to "flagged only if intelligence stack fails"
- Memory: `feedback_nex_intelligence_layers_before_admin.md`
- Trigger: Philip 2026-07-27 — full 6-level stack + <5% admin target + "you have permission to think" preamble
