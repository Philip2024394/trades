# ADR-0026: NEX Image Knowledge System — parser-derived structured knowledge

Status: Accepted
Date: 2026-07-27

## Context

ADR-0024 established the image manifest. ADR-0025 established a tiered matcher. Together they solved "know what each image depicts" and "pick the right one for a surface." But saving a 3,000-word MASTER IMAGE DESCRIPTION per image with only a handful of structured fields alongside it leaves NEX with two systemic problems:

1. **Token cost at scale.** Every query that touches image metadata loads the full description string. Across 50,000 images at 3k words each, this is unusable — every chat answer, every card render, every recreation query pays the cost of parsing 150M words.

2. **No structured intelligence.** "Show me the next stage after this one" · "make it blue" (but the red door is locked) · "show me images similar to this one" — none of these are answerable without either loading every description and semantically parsing, or storing the answer as first-class structured data. The manifest currently stores text and expects LLMs to reason over it.

The systemic fix is to keep the authored inputs small (2 fields: MASTER DESCRIPTION + MASTER AI PROMPT) and derive everything else automatically via a parser that runs at save time. The derived data — IMAGE DNA, AI INTENT, LOCKED ATTRIBUTES, MATERIAL JOURNEY, DNA HASH — becomes the primary lookup path. The 3,000-word MASTER DESCRIPTION is a fallback for when structured data isn't enough.

## Decision

**Two-input, many-output image knowledge architecture.**

### User authors only two fields

- `master_description` — the rich 3,000-word MASTER IMAGE DESCRIPTION (multi-section format per Philip's spec)
- `master_ai_prompt` — the ~500-word ready-to-paste AI regeneration prompt

Everything else on the manifest row is **parser-derived** at save time.

### Parser output (all auto-generated at save)

Fields written to each `data/nex-image-manifest.json` row:

**IMAGE DNA (nested, versioned)**
```
image_dna: {
  version: 1,
  score: 97,  // 0-100 confidence in the extraction
  hash: 3246648845,  // deterministic 32-bit hash of key DNA fields
  STYLE:    { primary, secondary, photographic },
  CAMERA:   { view, lens, orientation, height },
  MATERIALS:{ primary, secondary, roof },
  LIGHTING: { primary, characteristics[] },
  QUALITY:  { resolution, realism, rendering },
  SETTING:  { primary, secondary }
}
```

**AI INTENT**
```
ai_intent: {
  purpose,             // material_journey | sales_image | installation_guide | education | ...
  role,                // stage_N | hero | detail | ...
  collection,          // luxury_staircase | garden_cabin | ...
  user_use_cases[]     // education, recreation, modification, sales, installation, ...
}
```

**LOCKED ATTRIBUTES**
```
locked_attributes: {
  must_keep[],         // extracted from "MUST KEEP" section
  editable[],          // extracted from "ALLOWED MODIFICATIONS"
  never_change[]       // extracted from "DO NOT CHANGE"
}
```

**MATERIAL JOURNEY (graph nodes)**
```
material_journey: {
  id,                  // e.g. "staircase_material_001"
  stage,               // integer, e.g. 3
  stage_name,          // e.g. "Precision Timber Machining"
  total_stages,        // integer, e.g. 14
  previous_stage_id,
  next_stage_id,
  previous_stage_name,
  next_stage_name
}
```

**Existing fields kept:** `tags[]` · `setting` · `mood` · `view_type` · `colour_palette` · `subject_domain` · `a_plus` · `excluded` · `created_at` · `created_by` · `source` · `notes`.

### DNA HASH

Deterministic 32-bit hash generated from the concatenation of key DNA fields:
`hash(STYLE.primary + CAMERA.view + MATERIALS.primary + LIGHTING.primary + SETTING.primary + QUALITY.rendering + STYLE.photographic)`

Enables similarity matching via bitwise or per-field hash comparison — orders of magnitude cheaper than tag/description search. Two images with identical hashes are visually near-identical; small hash distances = similar images.

### DNA SCORE

0-100 confidence in the auto-extraction, computed as the percentage of DNA nested fields the parser could confidently fill from the source material. Below 70 shows a warning in the tagger:

> "Low confidence detected. Would you like to review the automatically generated IMAGE DNA?"

### Versioning

IMAGE DNA is versioned (`image_dna.version: 1`). When the parser algorithm improves, incrementing the version number allows selective regeneration of DNA blocks without touching authored fields.

### 3-Layer Retrieval

Consumers query in escalating cost order:
1. **IMAGE DNA** (~50 tokens) — 90% of queries answered here
2. **MASTER AI PROMPT** (~500 tokens) — recreation queries
3. **MASTER DESCRIPTION** (~3000 tokens) — full context, rare

Matcher (ADR-0025) upgraded: adds DNA HASH similarity as a fourth scoring signal, weighted 0.3 (redistributing existing weights: 0.3 tag intersection + 0.3 description overlap + 0.1 structured field + 0.3 DNA hash overlap).

### Optional Review

After the parser runs, the tagger shows the extracted knowledge with an edit button. User correction is optional — the whole point is zero manual maintenance. Corrections write back to the manifest and set a `dna_edited_by_user: true` flag so future re-parser runs don't overwrite manual edits.

## Consequences

**Positive:**
- Authoring stays at 2 fields per image — sustainable at 50,000 images.
- Structured retrieval means most queries hit DNA (~50 tokens) not MASTER DESCRIPTION (~3000 tokens). ~60× token cost reduction on the common path.
- DNA HASH enables "similar images" as a first-class query — orders of magnitude faster than tag/text search.
- Material Journey as a graph turns "show me the next stage" into a lookup, not a semantic guess.
- Locked Attributes turn "make it blue" into a rule check (red door is locked → refuse or clarify) instead of trusting the LLM to remember.
- AI INTENT means images render differently per surface (a sales_image gets marketing framing, an installation_guide gets step-by-step framing) without extra plumbing.
- Parser versioning means the extraction algorithm can improve without breaking existing manifest data.
- Zero manual field maintenance at scale.

**Negative:**
- Parser is the load-bearing element. If parser regex misses a section, that image's DNA is degraded. Mitigated by DNA SCORE surfacing low-confidence extractions for review.
- Schema is much richer, so tooling that reads the manifest must handle nested objects and null-safe traversal.
- Parser needs updating when new MASTER DESCRIPTION section formats emerge.
- The single row already saved (`ChatGPT Image Jul 26, 2026, 06_12_28 PM.png`) must be migrated to the new shape.

**Neutral:**
- User can still manually add tags or edit any parser output via the review button. Nothing is enforced-immutable.
- Existing matcher (ADR-0025) continues to work on old rows — new DNA HASH signal is additive, not replacement.

## Enforcement

- New manifest schema documented in this ADR and mirrored in `data/nex-image-manifest.json` header comment.
- Parser lives at `src/lib/nex/images/knowledgeParser.ts` — single source of truth for auto-extraction.
- Any component or matcher reading the manifest should prefer DNA / structured fields; fall back to MASTER AI PROMPT; last resort MASTER DESCRIPTION.
- Any new authored field beyond MASTER DESCRIPTION + MASTER AI PROMPT is a violation of this ADR — everything else should be parser-derived.
- Parser regressions caught by DNA SCORE monitoring: any batch of images with average score <75 triggers a parser audit.

## Alternatives considered

- **User authors IMAGE DNA directly** — rejected. Philip's explicit call: doesn't scale to 50k images, users hate maintaining redundant metadata that could be computed.
- **LLM-derived DNA at query time** — rejected. Every query would pay LLM cost + latency; caching would be complex; DNA HASH couldn't be used for similarity search since it'd never be stable across LLM re-runs.
- **Flat IMAGE DNA (single-level fields, no nesting)** — rejected per Philip's spec. Nested structure captures multi-dimensional style (`STYLE.primary` vs `STYLE.photographic` vs `STYLE.secondary`) which flat schema loses.
- **Ship without DNA HASH** — considered. Rejected because similarity queries are one of the most valuable emergent features once the manifest grows past 500 images, and adding it later requires re-hashing every existing row.

## Related

- ADR-0024 (Image manifest rule) — this extends the manifest schema and refines the "no user field beyond core" principle.
- ADR-0025 (Image matcher tiered thresholds) — matcher upgraded to consume DNA HASH as a fourth signal.
- Memory: `feedback_nex_image_knowledge_system_adr_0026.md`
- Parser location: `src/lib/nex/images/knowledgeParser.ts`
- Trigger: Philip 2026-07-27 — full architecture proposal with 8 upgrades culminating in "IMAGE DNA is a COMPUTED FIELD, versioned, with confidence score + hash, nested not flat."
