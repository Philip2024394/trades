---
topic:               Top-tread reduced depth, trimmer connection, and floor-finish machining
source_type:         expert_observation
evidence_type:       workshop_observation              # Philip 2026-07-30 · Evidence Type schema
source_document:     (none — verification needed against BWF Design Guide 2)
source_person:       Junior Francis
authority_frame:     documented_workshop_experience   # NOT external_expert_citation. Philip 2026-07-30: "the authority comes from documented experience, not from claiming external expert status."
verification:        "Personally observed during staircase manufacture and installation."
source_date:         2026-07-29
source_transcript:   candidates/2026-07-29-chatgpt-session-dump.md
verification_status: verified                         # Philip 2026-07-30 — Verify + Author
review_decision:     verify_and_author
reviewed_by:         Philip O'Farrell
reviewed_at:         2026-07-30
layer_2_priority:    2                                 # Philip's priority sequence · authored second after Stopped Wedge
promoted_to_brain:   false
brain_module_target: staircase-top-landing-connection
phrasing_note:       "Layer 2 module MUST phrase as 'commonly manufactured' NOT 'always manufactured'. The 75-100mm range is workshop convention · construction may vary by manufacturer and specification. Philip 2026-07-30."
attribution_note:    "Author reassigned Philip O'Farrell → Junior Francis on Philip's direction 2026-07-30. Junior Francis is a workshop practitioner whose authority rests on personally-observed manufacture and installation — NOT credentialled external expertise. Layer 2 module should frame the citation as documented workshop experience per the `verification` field above."
confidence:
  level:             HIGH
  basis:
    - workshop_observation
    - repeated_manufacture
    - verified_by_author
    - documented_experience_of_named_practitioner
  limitations:
    - not_universal_across_all_UK_workshops
    - construction_may_vary_by_manufacturer_and_specification
    - numeric_ranges_are_workshop_convention_not_specification
---

## Claim

For a UK domestic housed timber staircase, the **top tread is not a normal tread**. Its manufacturing detail differs from the intermediate treads in three ways:

1. **Reduced front-to-back depth.** Typically 75–100 mm of visible tread depth behind the nosing, depending on stair design and trimmer position — much shorter than an intermediate tread.
2. **Sits partly over the trimming joist (trimmer).** The tread bears on the trimmer rather than being housed into the strings the way intermediate treads are.
3. **Top riser finishes against the face of the trimmer** — not against a housing in a string.

Structurally the top tread is a **transition detail** between the stair and the landing construction, not a load-bearing tread housed into two strings.

## Author's note (Philip · 2026-07-29)

Two important manufacturing consequences follow from this:

### For hard floor finishes (timber · engineered oak · laminate · tile)

The underside or rear of the top tread is often machined (rebated) to suit the exact finished floor thickness — for example:

- 15 mm engineered oak
- 18 mm solid timber
- 12 mm laminate + 3 mm underlay
- 20 mm porcelain tile

This allows the finished landing floor to sit flush with the tread nosing while keeping the stair geometry correct.

### For carpet + underlay

**Do not deeply rebate the top tread for carpet.** If you remove 12–15 mm from a top tread that may only have 75–100 mm of bearing over the trimmer, you weaken the tread and reduce the effective section.

The correct practice is one of:

- **Slightly haunch the top tread down into the trimmer**, or
- **Set the tread a few millimetres lower relative to the finished landing level**,

so the carpet and underlay finish flush without significantly reducing tread strength.

### Typical UK oak staircase reference values

| Element | Typical value |
|---|---|
| Intermediate tread thickness | 32 mm oak |
| Top tread projection over trimmer | 75–100 mm |
| Engineered floor rebate | 12–20 mm |
| Carpet allowance | 3–6 mm set-down / haunch (NOT deep rebate) |
| Tile allowance | to specified Finished Floor Level |

## Cross-references

- **Already partially captured** in the family record for the `SHELL_STRAIGHT_CLOSED` family: `data/nex-staircase-components/families/shell_straight_closed.yaml` §`top_landing_connection` carries `typical_depth_range_mm: { min: 75, max: 100 }` and `machining_supported: [timber_floor, laminate_floor, tile_floor, carpet_floor]`. The carpet-vs-hard-floor distinction here is the missing nuance those flags don't yet spell out.
- **Existing Reference Brain drafts** related to this topic: `docs/brains/staircase-refacing-materials-philip-2026-07-28.md` and `docs/brains/staircase-refacing-overview-philip-2026-07-28.md` mention flooring-transition considerations. The specific "don't over-machine for carpet" rule doesn't appear there yet.
- **Geometry Module** (`src/lib/nex/staircase-geometry/`) does not model top-tread depth today. The Reference Brain answers the customer question (*"can you machine the top tread for 18mm engineered oak?"*); the Geometry Module derives the numeric result once this expert knowledge is authored.

## Verification needed before Layer 2 promotion

- [ ] Confirm the 75–100 mm typical depth range against BWF Domestic Timber Stairs Design Guide (Guide 2) or equivalent trade body reference.
- [ ] Confirm the carpet-machining warning is standard workshop practice rather than one manufacturer's convention — survey ≥2 UK staircase manufacturers.
- [ ] Confirm the haunching approach is BWF-acknowledged rather than field-improvised.
- [ ] Cross-check the intermediate tread thickness reference (32 mm oak) against BWF Design Guide 2 engineering tables.
- [ ] Decide whether the specific numeric floor-finish allowances (15 mm, 18 mm, 12 mm laminate, 20 mm tile) are examples or intended as standards.

## Notes for the Layer 2 author

The rule *"don't over-machine the top tread for carpet"* is the exact kind of workshop knowledge Rule B protects — it's the received wisdom that keeps a staircase strong for decades. When authoring the Layer 2 module, keep the practical distinction between hard-finish machining (rebate to suit) and soft-finish accommodation (haunch, don't machine deep) as the central rule. The numeric examples are illustrative; the rule itself is what NEX quotes.

Cite this evidence file in the Layer 2 module's `origin_trace` (Rule C — attributable origin).
