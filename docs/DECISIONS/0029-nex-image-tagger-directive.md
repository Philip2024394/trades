# ADR-0029: NEX Image Tagger Directive — operational law for the tagger

Status: Accepted · **IMMUTABLE** · inherits from ADR-0028 Intelligence Constitution
Date: 2026-07-27

> **Preamble (loaded at top of every Claude session before any tagger work):**
>
> **"You have permission to spend more time building intelligence than building descriptions. A perfectly structured image memory with 200 words is more valuable than a 3,000-word description with poor relationships. Always optimize for future intelligence, inheritance, and image recreation."**

---

## Context

ADR-0028 (Intelligence Constitution) declared NEX an AI Creative Memory System. ADR-0027 (Golden Rules 1-14) enumerated the philosophy. ADRs 0024-0026 gave the schema and retrieval. **This ADR locks in HOW the Image Tagger operationally behaves — the mindset, the counters, the flagged-image handling, the auto-cover logic, and the non-negotiables.**

The most common failure mode we're guarding against: Claude drifting into "process 982 images and stop" thinking. That mindset produces 982 hand-crafted rows and zero architecture for image #983 through image #500,000. The correct mindset is *"I am building the intelligence layer that will process every future image automatically. If I get the architecture right now, image 250,000 works exactly the same as image 1."*

## Decision

### Mindset

**Do NOT stop at 982 images.**

- WRONG: *"My job is to process 982 images."*
- RIGHT: *"My job is to build the intelligence layer for the next 500,000 images."*

Every architectural decision must scale to image 500,000 as cleanly as it works for image 1.

### The tagger's job order

When NEX Image Tagger loads, the system MUST process every image through this sequence (per ADR-0028 12-step order):

```
982 IMAGES
    ↓
Image Analysis
    ↓
IMAGE DNA
    ↓
MASTER AI PROMPT
    ↓
AI INTENT
    ↓
IMAGE TYPE
    ↓
IMAGE PURPOSE
    ↓
COLLECTION MATCHING
    ↓
LOCKED ATTRIBUTES
    ↓
MATERIAL JOURNEY
    ↓
IMAGE RELATIONSHIPS
    ↓
IMAGE FAMILY TREE
    ↓
GEOMETRY RULES
    ↓
CONFIDENCE SCORE
    ↓
SAVE
    ↓
NEXT IMAGE
```

### Header counters (mandatory · always visible · continuously updating)

The NEX Image Tagger header MUST display 8 counters at all times:

- **Total Images Found**
- **Completed**
- **Remaining**
- **Flagged**
- **Collections Updated** (any collection whose aggregate DNA changed this session)
- **Material Journeys Created** (any new material_journey_id introduced)
- **Cover Images Applied** (any Trade Centre / Pinterest / directory card that received a matched cover)
- **Admin Reviews Required** (equal to Flagged; broken out for clarity)

When `Remaining = 0` the batch is complete. When `Flagged > 0` processing is complete but admin review is required.

### Flagged images — never skip

Images MUST be automatically flagged when:

- DNA score is below 85% (per ADR-0027 Rule #6)
- Geometry confidence is low
- Collection matching fails
- Purpose cannot be determined
- Materials cannot be determined
- Image relationships are unclear
- Master AI prompt generation fails
- Any Rule #4 required field is missing
- Any Rule #11 image_type / can_become / collection_id mismatch

**Flagged images MUST NEVER be skipped.** Flow is:

```
Flag Image
    ↓
Leave Image OPEN in editor (do not remove from tagger view)
    ↓
Display Reason (specific — not just "flagged")
    ↓
Show Suggested Values (parser's best guess)
    ↓
Await Admin Confirmation: [Accept] · [Edit] · [Reject]
```

Example UI copy:

> **REVIEW REQUIRED**
>
> Reason:
> - Collection could not be determined
> - DNA score 72%
> - Staircase geometry unclear
>
> Suggested Collection: Luxury Staircases
>
> Accept? · Edit · Reject

### Collection inheritance (Rule #7 + Rule #12)

Collections MUST automatically inherit accumulated intelligence. When a new image enters an existing collection, the parser MUST first read:

- Collection DNA (`data/nex-collection-dna.json`) for transformation policy
- Aggregate DNA across all A+ images in the collection (dominant STYLE / MATERIALS / LIGHTING / CAMERA / QUALITY / SETTING)
- Aggregate learning signals across the collection (common transformations, common alternative materials, common banner types requested)

These become the pre-population baseline. The parser fills fields it can extract from the specific image, and inherits from the collection for anything ambiguous. Confidence score reflects how much came from the image versus inheritance.

### Trade Centre auto-cover (priority order)

Immediately begin populating Trade Centre cards with cover images from the NEX Image Library. Priority order per card category:

1. Existing **Collection Image** for that category
2. Existing **Hero Image** for that category
3. Existing **Marketing Image** for that category
4. Existing **Educational Image** for that category
5. Existing **Website Banner** for that category
6. Existing **Transparent Asset** for that category
7. **Leave blank** — no image found

Applies to all trade categories: Staircases · Joinery · Timber · Mouldings · Ironmongery · Kitchens · Roofing · … whatever categories exist in the directory data.

### Pinterest-style pages

All Pinterest-style collection pages MUST attempt to inherit cover images from their parent collection automatically:

```
Luxury Staircases → Luxury Staircase Hero Image Found → Apply Automatically
Joinery Collection → Matching Cover Image Found → Apply Automatically
NO IMAGE FOUND → Leave Blank → flag "Admin Create Required"
```

### Never fake

**NEVER create placeholder information.**
**NEVER guess.**
**NEVER create fake images.**

If confidence is low → flag for review.
If no matching image exists in the library → leave blank and flag "Admin image required."

Silently falling back to a generic placeholder is a violation of this directive AND ADR-0028's Immutable Rule.

### Every image teaches NEX

Each completed image MUST:

- teach NEX something new
- update collection intelligence (aggregated DNA)
- update image relationships
- update material journeys
- update confidence scoring
- update inheritance rules

Collections MUST continuously become more intelligent.

### Non-negotiables

1. Preserve knowledge.
2. Preserve geometry.
3. Preserve relationships.
4. Continuously improve collection intelligence.
5. NEVER stop at 982 images. Build the architecture that will process 500,000.
6. NEVER skip flagged images.
7. NEVER fake images or placeholders.
8. When in doubt, preserve MORE (per ADR-0028 optimisation directive).

## Consequences

**Positive:**
- Tagger operationally consistent every session — Claude, admin, and Philip see the same 8 counters and the same flagged-image workflow.
- 500,000-image mindset means the architecture holds up; no throwaway "just for this batch" hacks.
- Auto-cover for Trade Centre + Pinterest pages happens the moment a matching image lands in the manifest — zero manual mapping.
- Flagged images stay in the tagger view — no silent skips, no debt accumulating in the manifest.
- Collection inheritance closes the loop between tagging effort and future automation.

**Negative:**
- Header must render 8 live counters — small perf cost, worth it.
- Flagged-image UI is larger than a normal card (reason banner + suggested values + 3 buttons) — screen real-estate cost.
- Trade Centre auto-cover requires the matcher to run per card on every feed load; caching required at scale.

**Neutral:**
- The "500,000 mindset" is a discipline more than a technical constraint — the reminder in this ADR is the enforcement mechanism.

## Enforcement

- Loaded at top of every Claude session via `CLAUDE.md` after the ADR-0028 Intelligence Constitution.
- Tagger header component MUST render all 8 counters (`Total · Completed · Remaining · Flagged · Collections Updated · Material Journeys Created · Cover Images Applied · Admin Reviews Required`).
- Flagged rows in the tagger MUST render with a red border, a "REVIEW REQUIRED" banner listing every specific reason, suggested values from the parser, and `Accept / Edit / Reject` action buttons.
- Trade Centre + Pinterest auto-cover flows MUST consume `matchImage()` with the ADR-0029 priority order — never hardcode a generic placeholder.
- Any code path that silently falls back to a generic placeholder image when the matcher returns null violates this ADR unless the fallback is explicitly marked "leave blank + flag admin_image_required."

## Related

- ADR-0028 (Intelligence Constitution) — the philosophical parent
- ADR-0027 v1.2 (Golden Rules 1-14) — the enumerated rules
- ADR-0026 (Image Knowledge System) — the schema
- ADR-0025 (Image Matcher) — the retrieval that auto-cover consumes
- ADR-0024 (Manifest Rule) — the storage foundation
- Memory: `feedback_nex_image_tagger_directive.md`
- Trigger: Philip 2026-07-27 — full NEX Image Tagger Directive + "500,000 mindset" + optimisation permission preamble
