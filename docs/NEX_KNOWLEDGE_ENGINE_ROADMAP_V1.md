# NEX Knowledge Engine — Roadmap V1

Philip 2026-07-27. Roadmap document (not an ADR — a delivery plan). Locks the sequence of capabilities being built, does not add new immutable rules.

## The philosophy win (Phase 1 · closed)

> *"Score = amount of knowledge extracted, not the value of the image."*

Every image is knowledge. Every image is classified. Nothing is rejected. The manifest is a knowledge graph, not a curated gallery. ADRs 0022-0035 built this.

## Phase 2 — User understanding (in delivery)

Priority order:

1. **USER INTENT TOKENS per image** — every manifest row carries structured tokens that map its content to the vocabulary users search with:
   - Materials (European oak · Walnut · Pine · Sapele · Ash · MDF)
   - Components (Handrail · Newel post · Volute · Baluster · String · Tread · Riser)
   - Styles (Victorian · Georgian · Contemporary · Modern · Traditional · Industrial · Cottage)
   - Construction (Straight flight · Winder · Quarter turn · Curved · Helical · Floating · Cantilever)
   - Applications (Luxury residence · Hotel · Commercial · Renovation · New-build · Cottage · Loft)
   - Search phrases (natural-language queries that would match this image)

2. **Query Decomposer** — parses a user query into intent fragments:
   ```
   "European oak Victorian monkey tail volute pink runner"
   →
   [
     { fragment: "European oak", category: "material", confidence: 100% },
     { fragment: "Victorian", category: "style", confidence: 100% },
     { fragment: "monkey tail volute", category: "component", confidence: 100% },
     { fragment: "pink runner", category: "accessory", confidence: 100% }
   ]
   ```

3. **Multi-image reasoning** — no single image needs to match perfectly:
   ```
   "No single image matches perfectly.
    Based on the knowledge graph, these 3 images collectively cover 96% of your request:
    - Image A: European oak ✓ · Victorian ✓ · Handrail ✓ (Good band, 78%)
    - Image B: Monkey tail volute ✓ · Victorian ✓ (Specialist band, 68%)
    - Image C: Pink runner ✓ (Reference band, 52%)"
   ```

4. **Understanding confidence** per fragment (never just one overall score):
   ```
   Materials: 100% · Style: 94% · Construction: 100% · Components: 87%
   Overall understanding: 96%
   ```

## Phase 3 — Knowledge Graph

Explicit graph structure connecting images to their concepts:
- Images ↔ Materials
- Images ↔ Components
- Images ↔ Styles
- Images ↔ Manufacturing methods
- Images ↔ Regulations
- Images ↔ Collections

Queries traverse the graph, not just the manifest rows.

## Phase 4 — Generation Support

When no exact match exists AND multi-image reasoning still leaves gaps, NEX packages what it DOES know into a structured brief that ChatGPT (or another image generator) can turn into a new faithful image:

```
GENERATION BRIEF
Style: Victorian luxury (94% confident)
Materials: European oak handrail · pink runner
Components: Monkey tail volute · turned balusters
Layout: Straight flight · three floor townhouse
Reference images: [best-match subsets]
```

Every generated image comes back through the Global Intelligence Pipeline, joins the manifest classified, and becomes NEX knowledge going forward.

## What NOT to do

- Do not spend cycles lifting Limited/Visual band rows into Good/Master unless a specific user query proves it's needed. Distribution reflects the data; time is better spent building Phase 2 capabilities.
- Do not add more constitution ADRs. The 34 that exist cover the philosophy. Phase 2-4 are DELIVERY, not policy.
- Do not build vision-model auto-authoring as a top priority. Phase 2 delivers more user-visible value per hour of build effort than Phase 5 vision would.

## Success measurement

Phase 2 is successful when NEX can respond to a specific user query like *"European oak Victorian monkey tail volute pink runner luxury townhouse"* with:

1. Decomposed understanding (per-fragment confidence)
2. Multi-image evidence combining
3. Coverage percentage even when no perfect image exists
4. A structured knowledge response that never says *"0 results"*

## References

- ADR-0034 (Knowledge Engine + Gold Standard) — the identity Phase 2 delivers on
- ADR-0035 (Classify Never Reject) — the input state that makes Phase 2 possible
- Trigger: Philip 2026-07-27 — full roadmap + priority ordering
