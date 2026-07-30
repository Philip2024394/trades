---
topic:               Housing depth for treads and risers in housed-string staircases
source_type:         trade_body_guidance
evidence_type:       trade_body                        # Philip 2026-07-30 · Evidence Type schema
source_document:     BWF Domestic Timber Stairs Design Guide (see `bwf-design-guide-2.md`)
source_person:       —
source_date:         2026-07-29
source_transcript:   candidates/2026-07-29-chatgpt-session-dump.md
verification_status: awaiting_citation
review_decision:     send_for_citation                 # Philip 2026-07-30 — "the 12mm or 0.4×t rule needs the exact published source and wording before it becomes canonical"
reviewed_by:         Philip O'Farrell
reviewed_at:         2026-07-30
layer_2_priority:    3                                 # Philip 2026-07-30 revised order — "String housings" is now Layer 2 module #3 (after Stopped Wedge #1 and Top Tread Machining #2)
promoted_to_brain:   false
brain_module_target: staircase-housing-depth
confidence:
  level:             MEDIUM
  basis:
    - trade_body_guidance_citation_pending
    - widely_stated_in_UK_workshop_conversation
    - internally_consistent_with_string_thickness_engineering
  limitations:
    - awaiting_exact_BWF_edition_paragraph_reference
    - 12mm_number_may_be_minimum_not_universal_standard
    - some_manufacturers_may_use_more_or_less
  status:            awaiting_external_reference
---

# Housing depth for treads and risers

The routed groove in each string that receives the tread and riser. Not covered by Approved Document K — a workshop-practice + trade-body dimension.

## Claim

Per BWF guidance:

> *"Strings should be housed to receive the treads and risers to a depth of **12 mm or 0.4 × the string thickness, whichever is greater**. The housings should be tapered to receive wedges to support the tread and riser. The wedges should be fitted with adhesive to form a rigid joint."*

**Consequence — tread/riser length calculation:**

Because both treads and risers are housed into both strings, they must be cut LONGER than the clear inside width by the depth of the housing on each side.

```
tread_length = clear_inside_width + 2 × housing_depth
riser_length = clear_inside_width + 2 × housing_depth
```

At the minimum 12 mm housing on each side, that's 24 mm total added length.

Example: clear inside width 800 mm → tread blank 824 mm.

**Consequence — housing depth scales with string thickness:**

| String thickness | 0.4 × thickness | Effective housing depth (min) |
|---|---|---|
| 28 mm | 11.2 mm | 12 mm (12 wins) |
| 32 mm | 12.8 mm | 12.8 mm |
| 38 mm | 15.2 mm | 15.2 mm |
| 44 mm | 17.6 mm | 17.6 mm |

Deeper housings require correspondingly longer treads and risers.

## Author's note

The tapered housing detail is what receives the wedge. The tapered geometry + wedge + adhesive is what turns three loose components (tread, riser, wedge) into a rigid joint. This is the setup Philip's stopped-wedge principle (`stopped-wedge-principle.md`) refers to — the wedge that stops moving isn't proof the tread has fully seated in the housing shoulder.

## Cross-references

- **Source spine:** `bwf-design-guide-2.md` — the reference document being cited here.
- **Companion evidence:** `string-thicknesses.md` — the string thickness options this rule scales against.
- **Companion evidence:** `stopped-wedge-principle.md` — the wedge behaviour inside the housing.
- **Question catalogue answered:** Q050, Q051, Q052, Q053 in `questions/02-construction-and-craft.md`.
- **Existing family record:** the SHELL_STRAIGHT_CLOSED family in `data/nex-staircase-components/families/shell_straight_closed.yaml` uses `construction: housed_closed` and would consume this rule at Phase 2 (dimensioned build-out).

## Verification needed before Layer 2 promotion

- [ ] Confirm the "12 mm or 0.4 × string thickness" wording against the actual BWF Design Guide.
- [ ] Confirm whether the 0.4 factor is a hard specification or a guidance minimum that some manufacturers exceed.
- [ ] Establish whether any UK manufacturers routinely use less than 12 mm housing depth (would indicate the BWF value is a minimum, not universal practice).
- [ ] Confirm the tapered geometry angle (transcript mentions 6-8° in practice — needs verification).
- [ ] Confirm the tread/riser length formula (clear width + 2 × housing depth) matches manufacturer cutting-list practice at multiple UK shops.

## Notes for the Layer 2 author

If a customer or trade user asks *"how deep is the housing?"*, the honest answer is the BWF rule PLUS the string-thickness scaling. Avoid quoting *"12 mm"* as a universal number — it's the minimum, not the standard, once string thickness exceeds ~30 mm.
