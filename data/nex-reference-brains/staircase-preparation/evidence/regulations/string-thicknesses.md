---
topic:               UK staircase string thickness options and engineering basis
source_type:         trade_body_guidance
evidence_type:       industry_best_practice            # Philip 2026-07-30 · reclassified from trade_body — "dimensions are widely used but vary by manufacturer" so this is convention across the industry, not a single trade body specification
source_document:     BWF Domestic Timber Stairs Design Guide (see `bwf-design-guide-2.md`)
source_person:       —
source_date:         2026-07-29
source_transcript:   candidates/2026-07-29-chatgpt-session-dump.md
verification_status: awaiting_citation
review_decision:     send_for_citation                 # Philip 2026-07-30 — "the dimensions are widely used but vary by manufacturer; keep as evidence until fully sourced"
reviewed_by:         Philip O'Farrell
reviewed_at:         2026-07-30
layer_2_priority:    —                                 # Philip 2026-07-30 revised order does not include String Thicknesses in the top 8 Layer 2 modules — evidence still needed but not authored until a manufacturer or trade documentation citation is confirmed
promoted_to_brain:   false
brain_module_target: staircase-string-thickness-guidance
confidence:
  level:             MEDIUM
  basis:
    - widely_reported_UK_workshop_convention
    - internally_consistent_across_multiple_manufacturer_conversations
    - engineering_scaling_(housing_depth ↔ string_thickness)_is_self-consistent
  limitations:
    - awaiting_named_manufacturer_or_trade_body_citation
    - dimensions_vary_by_maker
    - domestic_vs_commercial_convention_may_differ
  status:            awaiting_external_reference
---

# String thickness options for UK domestic timber staircases

Not a regulation. An engineering choice governed by BWF Design Guide 2 tables — string thickness is selected against stair width, pitch, timber species, and expected loading.

## Claim

Part K is silent on string thickness. **No minimum or maximum thickness is written into Building Regulations.**

The BWF Design Guide 2 provides engineering options for domestic timber staircases at:

- **28 mm**
- **32 mm**
- **38 mm**
- **44 mm**

These are engineering options — the choice depends on:

- structural strength required
- stair width
- stair pitch
- timber grade
- loading requirements
- manufacturer's engineering calculations

## Typical UK domestic use

Not regulation. Common industry practice per the transcript:

| Staircase type | Common string thickness |
|---|---|
| Domestic painted staircase (softwood) | 32 mm |
| Domestic hardwood staircase | 32-38 mm |
| Premium / larger staircases | 38 mm |
| Heavy bespoke feature staircases | 44 mm or more |

**These figures represent common workshop convention, not a specification.** A manufacturer's engineering calculation may specify differently.

## Consequences for housing depth

Since BWF also specifies housing depth as *"12 mm or 0.4 × string thickness, whichever is greater"* (see `housing-depths.md`), thicker strings force deeper housings:

| String thickness | Minimum housing depth |
|---|---|
| 28 mm | 12 mm |
| 32 mm | 12.8 mm |
| 38 mm | 15.2 mm |
| 44 mm | 17.6 mm |

## Cross-references

- **Source spine:** `bwf-design-guide-2.md`
- **Housing depth scaling:** `housing-depths.md`
- **Question catalogue answered:** Q044, Q045, Q046 in `questions/02-construction-and-craft.md`.

## Verification needed before Layer 2 promotion

- [ ] Confirm the 28/32/38/44 mm option set is complete for the current BWF Design Guide edition (some editions may include intermediate sizes).
- [ ] Confirm the engineering tables in the Design Guide cover: stair width, pitch, and timber species vs each string thickness — Philip's transcript summary is high-level.
- [ ] Survey UK manufacturers to establish whether the "common use" table matches actual workshop defaults or whether it reflects one manufacturer's convention.
- [ ] Establish whether commercial staircase string thicknesses (typically thicker) follow BWF Design Guide 2 or a separate specification.

## Notes for the Layer 2 author

The Reference Brain answer to *"how thick should my string be?"* is NOT a single number. It is a decision framework:

1. Domestic + painted + standard width → 32 mm is the common default.
2. Domestic + hardwood + standard width → 32-38 mm range.
3. Larger stair, premium timber, or feature design → 38-44 mm.
4. Beyond that → engineering calculation required.

Avoid the trap of quoting *"the standard is 32 mm"* — the standard is the engineering process, and 32 mm is one of several outcomes.
