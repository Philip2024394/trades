---
title: Image Retrieval Patterns — first-class query type for [image_search] intents
provenance: philip-approved-2026-08-14
brain: staircase_brain
domain: STAIRCASE
authoritative: true
purpose: distinguish_image_retrieval_from_text_answer_and_route_appropriately
---

# Image Retrieval Patterns — first-class query-type routing

Some customer queries want images, not explanations. NEX must recognise them and route to visual retrieval against the manifest tag intersection — not to a text-only knowledge lookup.

## The three query types (LOCKED)

| Query type | What the customer wants | Retrieval | Response shape |
|---|---|---|---|
| **text_answer** | Explanation, definition, comparison, why-answer | Reference Brain knowledge docs | Text-first · explanation/recommendation |
| **image_retrieval** | Visual examples, "show me", inspiration | Manifest tag intersection (per ADR-0024) | Image-first · text second |
| **hybrid** | Recommendation + visual reference | Both: knowledge doc + manifest images | Image-first · then explanation · then options/clarification |

## Recognising image-retrieval queries

### Explicit signals
- Starts with "Show me..."
- Includes `[image_search]` tag (Philip's corpus annotation)
- Contains "examples of..." · "pictures of..." · "images of..." · "photos of..."
- Contains "what does X look like"

### Implicit signals
- Style-focused query with no answerable specifics ("what looks best?") — often hybrid
- Comparison of two visual styles ("modern vs traditional") — often hybrid
- Design inspiration ("give me ideas for...") — often hybrid

### False positives to avoid
- "Show me how to install X" — this is procedural text, not image retrieval
- "Tell me what X looks like" — usually text-answer (description), unless customer explicitly wants examples

## Retrieval mechanism

Per ADR-0024 (Image Manifest Rule), NEX retrieves images via **tag intersection** on the manifest, filtered by:
- `primary_brain: staircase_brain` (never cross into other brains without explicit routing)
- The concept-family tags matching the query
- Confidence thresholds per ADR-0025 (surface floors: directory 0.65 · brain chat 0.80 · marketing hero 0.90)

## Response shape templates

### Shape IR-01 · Direct image response
**Use when:** query is clearly image_retrieval + concept is clear
**Template:**
> "Here are examples of [concept]. [image grid]. [One-sentence contextual note about the images returned.]"

**Example:**
> Customer: "Show me different bullnose starting steps."
> NEX: "Here are bullnose starting-step examples from the reference library. [images: batch 9 §D img-16, 19-26] These vary in timber species — oak, pine, cherry, walnut, painted — showing how the same shape reads differently across materials. Want to see any in a specific style or timber?"

### Shape IR-02 · Image + explanation (hybrid)
**Use when:** query implies recommendation on top of images
**Template:**
> "[Brief interpretation of what they might be after.] [image grid]. [Explanation of what the images show and why.] [Follow-up option.]"

**Example:**
> Customer: "I want a floating staircase like the modern ones in magazines."
> NEX: "Modern floating staircases usually mean cantilever treads with either a full-glass balustrade or hidden steel spines. [images: batch 10 img-30 cantilever illustration + batch 7 floating scenes] These are two common variants — either fully wall-mounted cantilever with no side stringer, or a black steel spine stringer with treads floating off it. Which direction attracts you?"

### Shape IR-03 · Image request with insufficient retrieval
**Use when:** query is image_retrieval but no matching manifest tags exist
**Template:**
> "I don't have direct reference images for [specific request] in the current library. What I do have is [closest alternative]. [Optional: image grid of alternatives.] [Offer to describe or use a broader reference.]"

**Example:**
> Customer: "Show me art deco staircases with brass geometric railings."
> NEX: "I don't have art deco staircase references specifically in the current library. What I do have are mid-century modern staircases with brass accents (from batch 7) and traditional turned newels with brass caps — happy to share those if they'd help, or I can describe what an art deco balustrade normally looks like."

### Shape IR-04 · Ambiguous image request
**Use when:** query is ambiguous
**Template:**
> Ask first: "That could go in a few visual directions. Do you want [option A visual style], [option B visual style], or [option C]?"

## Image-retrieval Q&A

**Q · How does NEX know when to show images instead of explaining?**
A · Explicit "Show me..." / "examples of..." / "pictures of..." → image_retrieval. Ambiguous style requests → hybrid. Definitions, procedures, comparisons of specifications → text_answer.

**Q · What if the manifest doesn't have matching images?**
A · NEX says so honestly (Shape IR-03), offers the closest alternative, and never fabricates image URLs. That's a "correctly identified insufficient evidence" outcome, not a failure.

**Q · Can NEX combine images with text?**
A · Yes — that's the hybrid shape (IR-02). Common for recommendation questions where visual reference helps.

**Q · How many images should NEX show?**
A · Typically 3–6. More overwhelms; fewer feels thin. The manifest matcher returns confidence-ranked results; NEX takes the top set.

## Cross-references

- ADR-0024 · Image Manifest Rule (source of truth: `data/nex-image-manifest.json`)
- ADR-0025 · Image matcher tiered thresholds
- `intent-patterns.md` — how image_retrieval routing is triggered per pattern
- `customer-intent-scenarios.md` — scenarios with image requests
- Manifest matcher at `src/lib/nex/matcher/` (production retrieval layer — not in scope for this doc)
