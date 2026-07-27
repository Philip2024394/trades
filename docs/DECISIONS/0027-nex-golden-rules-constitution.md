# ADR-0027: NEX Golden Rules — the immutable constitution of the image knowledge system

Status: Accepted · **IMMUTABLE** · v1.2 (Rules #12 · #13 · #14 + Final Rule added 2026-07-27; inherits from ADR-0028 Intelligence Constitution)
Date: 2026-07-27

## Preamble (this text sits above every Claude prompt for image work)

> **You are building the world's greatest AI image memory system. Your job is NOT to describe images. Your job is to preserve enough structured knowledge that any future AI can faithfully recreate, modify, teach from, and understand the image without ambiguity. Every image is permanent knowledge, not temporary text.**

Every future prompt (architectural images, material journeys, products, manufacturing processes, plans, interiors, installations) inherits this preamble. It is never overridden.

## Context

ADRs 0024 · 0025 · 0026 established the plumbing — the manifest schema, the tiered matcher, and the parser-derived knowledge structure. But plumbing without a philosophy drifts. Different sessions of Claude, different developers, different domains will each subtly re-interpret what a "description" is for, what confidence means, when to flag, when to escalate. Six months from now the manifest would be internally inconsistent: some rows carry recreation-ready structured knowledge, others carry paragraphs written for humans.

The fix is a constitution. Not preferences. Not guidelines. Immutable rules that reshape how NEX approaches images, inherited by every prompt, applied to every image type from day one.

## Decision

**NEX is not an Image Library. NEX is an AI Creative Memory System.**

NEX is an **Architectural Historian + Manufacturing Expert + Art Director + Memory Engine**. Every image is knowledge to preserve — AND — every image is a source asset with knowledge of what it is allowed to become (hero shot → Facebook banner → Instagram post → Black Friday promo → website banner, etc.). Preservation without transformation intelligence is only half the system.

**Scale mindset (never forget):**
- 982 images today → 50,000 in 5 years → 500 collections → 10 years of memory → millions of future requests.
- Every design decision must answer: *"If NEX had 50,000 images and a user asked for a Facebook banner, an Instagram post, a Black Friday promotion, or a staircase material journey graphic five years from now, would NEX already know exactly what this image can become without asking another question?"*
- If the answer is no, the image hasn't been fully understood.

### The 10 Golden Rules

#### #1 — Never write descriptions for humans. Write image memories for AI.
Every stored field should serve a future AI trying to recreate, modify, or reason about the image. Prose that reads well to a human but loses structure fails the objective.

#### #2 — Never save paragraphs if they can become structured knowledge.
- ✓ Good: `materials: oak · lighting: natural daylight`
- ✗ Bad: *"The image appears to have some oak wood which is illuminated by daylight."*

Any information that CAN be a field MUST be a field.

#### #3 — Every image must answer WHAT / WHY / WHERE / HOW / WHEN / CAN IT CHANGE / WHAT CAN CHANGE / WHAT MUST NEVER CHANGE.
Every one. If any of the eight questions is unanswerable from the manifest row, the row is incomplete and must be flagged for review.

#### #4 — Every image MUST belong to:
- a **collection**
- a **purpose**
- an **image DNA profile**
- a **confidence score**
- a **material journey** (if applicable)
- a **relationship tree**

Orphan images with none of the above are a schema violation.

#### #5 — The MASTER DESCRIPTION is NEVER the primary memory.
Retrieval hierarchy is strictly:
1. **IMAGE DNA** (~50 tokens) — primary memory
2. **MASTER AI PROMPT** (~500 tokens) — secondary memory
3. **MASTER DESCRIPTION** (~3000 tokens) — tertiary memory

Consumers try DNA first. Escalate only when DNA can't answer. MASTER DESCRIPTION is a fallback of last resort.

#### #6 — When uncertainty exists, NEVER guess. Provide a confidence score.
Confidence bands (immutable):
- **99%** = Very High
- **95%** = High
- **85%** = Good
- **< 85%** = **Flag for human review**

Any DNA extraction, matcher result, or auto-inference below 85% must surface a flag in the tagger and in any downstream consumer that reads it. A wrong image with high confidence is worse than no image with clear reason.

#### #7 — Images inherit intelligence from their collection.
If 300 Luxury Staircase images exist in a collection, new images entering that collection inherit the collection's aggregate DNA baseline (dominant style · materials · lighting · setting). The parser pre-populates from the collection average; the user overrides where needed. Collections continuously teach NEX.

#### #8 — Every image MUST be future-proof.
Assume that in 10 years:
- another AI will recreate it (needs MASTER AI PROMPT)
- another AI will modify it (needs LOCKED ATTRIBUTES)
- another AI will search it (needs DNA HASH + tags)
- another AI will teach from it (needs collection + material journey)
- another AI will build relationships from it (needs previous/next stage IDs)

If any of the above is impossible from a manifest row alone, NEX has failed its objective for that image.

#### #9 — NEX must think in this exact order:
1. **IMAGE ANALYSIS** — what's in the image?
2. **COLLECTION MATCHING** — does this belong to an existing collection?
3. **IMAGE DNA** — nested structured knowledge
4. **AI INTENT** — purpose · role · collection · use cases
5. **LOCKED ATTRIBUTES** — must_keep · editable · never_change
6. **MATERIAL JOURNEY** — where does this sit in a sequence?
7. **IMAGE RELATIONSHIPS** — previous · next · siblings · alternatives
8. **MASTER AI PROMPT** — the recreation instruction
9. **MASTER DESCRIPTION** — the fallback tertiary memory
10. **CONFIDENCE SCORE** — assess before saving
11. **HUMAN REVIEW (IF REQUIRED)** — if any field <85% confident, flag
12. **SAVE**

No shortcuts. No re-ordering. This is the thinking sequence for every image processed by NEX.

#### #10 — Never ask "what should I write?" Always ask:

> **"What information would another AI require to recreate this image with 95-100% accuracy ten years from now?"**

If that information has not been saved, NEX has failed its objective.

#### #11 (v1.1 addition) — Every image MUST know what it is allowed to become.

Every manifest row carries an `image_type` (hero_image · facebook_banner · instagram_banner · construction_banner · transparent_asset · website_banner · marketing_banner · educational_banner · installation_banner · material_journey_stage · product_shot · avatar · logo · diagram · …) and an `image_purpose` (nested: primary · secondary · tertiary).

Every image type carries its own transformation ruleset — what it MUST HAVE, MAY HAVE, and MUST NOT HAVE:

**Hero Image** (source asset) — MUST HAVE: no text · no prices · no phone · no logo · maximum quality · AI-modification-friendly · website-safe aspect ratios. MAY BECOME: Facebook Banner · Instagram Banner · Website Banner · Marketing Banner · Black Friday / Christmas / New Arrival Banner.

**Facebook Banner** — MAY HAVE: text · prices · promotions · CTA buttons. Sizes: 1200×630, 1080×1080.

**Instagram Banner** — MAY HAVE: text · logo · prices · offers · QR codes · WhatsApp number. Sizes: 1080×1080, 1080×1350.

**Construction Banner** — MAY HAVE: large text areas · offer areas · price areas · telephone areas · logos · blank layout zones.

**Transparent Asset** — MUST HAVE: transparent background · isolated object · no text · no shadows unless requested. MAY BECOME: Product Image · Website Graphic · Educational Graphic · Installation Graphic.

**Material Journey Image** — MAY BECOME: Educational Banner · Manufacturing Banner · Collection Banner · Website Content.

If NEX cannot determine what an image is allowed to become, the image has failed validation.

#### #12 (v1.2) — NEX NEVER LOSES KNOWLEDGE.

Every image · every collection · every request · every modification · every relationship · every material journey · every banner · every user interaction MUST teach NEX something new.

Every manifest row carries a `learning_signals` array capturing user transformations, requested materials, requested outputs, alternative interpretations. Collections aggregate these over time to teach future images.

After 100,000 requests, NEX has learnt: *"Luxury Staircases commonly become hero images · Facebook banners · Instagram banners · walnut variants · oak variants · luxury interiors · educational images · material journeys."* This aggregate becomes the pre-population baseline for new images entering the collection.

NEX must become smarter EVERY SINGLE DAY.

#### #13 (v1.2) — NEX MUST PRESERVE GEOMETRY.

Unless explicitly requested, NEVER change: proportions · geometry · outlines · architectural details · dimensions · relationships · composition · perspective · material journey structure.

**When modifications are requested, preserve 95% of the original image intelligence. Change only what was requested — no more.**

Example: user says *"change this staircase to walnut"* → AIs should NOT generate a brand-new staircase. They should preserve the geometry, composition, camera, lighting, and only swap the material. 95% preserved · 5% changed.

Every manifest row carries a `geometry_preservation` block with `preserve_by_default: true`, `allowed_modifications[]` (material · colour · background · lighting · text overlay · aspect crop), and `never_change_without_explicit_request[]` (geometry · proportions · architectural details · object relationships).

#### #14 (v1.2) — EVERY IMAGE HAS A FAMILY TREE.

An image is not an island. Original images may become: transparent PNG · mask · depth map · plan drawing · black and white · Facebook banner · Instagram post · Christmas banner · Black Friday banner · website hero · video · animation · 3D version · educational version · installation version · material journey version.

**These are NOT separate images. They are children of the original image and inherit its intelligence.**

Every manifest row carries a `family_tree` block:
```
family_tree: {
  parent_url: <URL of the source image if this is a child>,
  children: [
    { type: "facebook_banner", url: "...", generated_at: "..." },
    { type: "instagram_banner", url: "...", generated_at: "..." },
    { type: "transparent_png", url: "...", generated_at: "..." },
    …
  ]
}
```

When a user asks *"show me all versions of this staircase"*, NEX does not search — it returns the family tree in one lookup. Takes 0.02 seconds.

Children inherit: collection_id · locked_attributes · material_journey · original camera geometry · brand identity — from the parent. They override only what makes them a distinct type (text · logo · CTA · aspect ratio · overlay for banners).

#### FINAL RULE (v1.2) — NEX IS NEVER FINISHED.

If NEX knows today what it knew yesterday, then NEX has FAILED.

Every image, every collection, every conversation, every user request must make NEX more intelligent. Rules #12 + #14 make this a first-class engineering concern, not a nice-to-have. Rules #6 + #10 + #11 make current-day quality auditable. The Final Rule makes tomorrow's quality obligatory.

**COLLECTION DNA** — every collection carries its own transformation policy:

```
COLLECTION DNA · Luxury Staircases
{
  allowed_types: [hero_image, facebook, instagram, website_banner, video, material_journey]
  default_sizes: [1920x1080, 1200x800, 1080x1080, 1080x1350, 1200x600]
  allows_text: true
  allows_prices: true
  allows_whatsapp: true
  allows_logo: true
  requires_transparent: false
}
```

When a user asks *"make me a hero image"* for the Luxury Staircases collection, NEX loads: `NO TEXT · NO PRICES · NO LOGOS · NO WHATSAPP · MAXIMUM QUALITY · 1920×1080` — zero questions asked.

When a user asks *"make me a Black Friday advert"*, NEX loads: `TEXT YES · PRICES YES · WHATSAPP YES · LOGOS YES · CTA YES · 1080×1080` — zero questions asked.

**Collection DNA is authored once per collection, inherited by every image in it, and overridable per-image only when the image genuinely needs different rules.**

## Consequences

**Positive:**
- Every image ends up with structured, recreation-ready knowledge — never orphaned text.
- Confidence flags mean the manifest can be trusted at scale — no silently wrong rows.
- Retrieval hierarchy means 90% of queries pay ~50 tokens, not ~3000.
- Collection inheritance turns 300 tagged images into a moat: every new tag benefits from the collective knowledge.
- Every future prompt inherits the constitution — no drift between sessions or domains.
- The preamble makes Claude re-optimise from "readable description" to "preservation of knowledge" — measurably different output.

**Negative:**
- Higher confidence floor (85% flags vs previous 70% warn) means more items need review early on when the parser is still learning. Trade-off: fewer wrong rows land silently.
- Slightly more manifest storage per row (nested DNA · locked attributes · material journey · relationships).
- Parser complexity grows to support Rule #7 collection inheritance.
- Requires discipline: prose fields are tempting shortcuts and must be resisted.

**Neutral:**
- Existing rows (the one Philip has saved) don't need re-authoring — the parser handles them.
- The constitution is domain-agnostic: applies equally to staircases, gardens, logos, product shots, any future domain.

## Enforcement

- Preamble is added to `CLAUDE.md` and loaded at the start of every Claude session.
- ADR-0027 is marked **IMMUTABLE** — cannot be superseded, only extended.
- The 12-step thinking order (Rule #9) is codified in the parser: `parseImageKnowledge()` executes them in sequence, and any downstream consumer of the manifest that skips steps violates the rule.
- Confidence flag (Rule #6): DNA SCORE < 85 triggers a visible flag in the tagger and in any matcher / feed / brain consumer that surfaces the image. Below 70 also refuses auto-usage per ADR-0025 (Clarify band).
- Collection inheritance (Rule #7) requires a small aggregator: `getCollectionAverageDNA(collection_id)` that returns the dominant DNA values across all images in that collection. Parser pre-populates from this average.
- **Rule #11 enforcement:** No manifest row can save without: `image_type`, `image_purpose { primary, secondary?, tertiary? }`, and `can_become[]` (allowed transformations derived from image_type + collection DNA). Missing any = flag.
- **Collection DNA lives at `data/nex-collection-dna.json`** — one entry per collection, authored/edited by the tagger's collection editor. When a new image joins a collection, the parser reads Collection DNA to determine what the image can become.
- No manifest row can save without: `image_dna` · `ai_intent` · `locked_attributes` · a `collection` field · a confidence score · `image_type` · `can_become[]`. Missing any of these = flag.

## Alternatives considered

- **Guidelines instead of immutable rules** — rejected. Guidelines drift; constitution holds.
- **Human-facing description as primary memory** — rejected explicitly by Rule #5. The whole point is that MASTER DESCRIPTION is fallback, not primary.
- **Lower confidence flag threshold** — rejected. 85% is where "high" ends per Rule #6 bands; lower would let mediocre extractions ship silently.
- **Skip the preamble** — rejected. Claude's default is to describe images; the preamble is what re-orients the optimisation target.

## Related

- ADR-0024 (Image manifest rule) — this is the data foundation
- ADR-0025 (Image matcher tiered thresholds) — Rule #6 confidence bands align with matcher bands
- ADR-0026 (Image knowledge system) — this is the schema; ADR-0027 is the philosophy
- Memory: `feedback_nex_golden_rules_constitution.md`
- Trigger: Philip 2026-07-27 — full constitution delivered with 10 rules + preamble + 12-step thinking order
