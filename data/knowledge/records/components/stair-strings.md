---
record_id: components_stair_strings_v1
record_version: 1.0.0
created: 2026-08-06
last_reviewed: 2026-08-06
reviewed_by: "Research Claude session 2026-08-06 · Philip authorised · self-review pass inline during authoring"
supersedes: []
status: AUTHORITATIVE
review_due: 2027-08-06

title: Stair Strings
category: NEX Components · Staircase · Primary structural member
subcategory: Inclined structural beam that carries the treads, risers, and balustrade of a flight
primary_audience: manufacturer
alt_audiences: [homeowner, engineer]

constitutional_status:
  gold_standard_v1_pattern: true
  first_of_type: false
  clauses_exercised: [1, 2, 3, 4, 5, 6, 7, 8]
  tree_growth_tier: component
  cluster: stair_components
  cycle: rhythm_cycle_4
  cycle_slot: component
  unblocks: system_records_can_now_compose_full_flight

knowledge_level: verified

owner:
  canonical_owner: NEX Staircase · Components sub-cluster
  authored_by: Research Claude
  authorised_by: Philip

voice_law: "no 'At NEX, we…' phrasing per HARD LAW 2026-07-27"
---

# Stair Strings

## Summary

Strings (also called stringers) are the primary structural members of a staircase — the inclined beams, one on each side of the flight, that carry the treads and risers and to which the balustrade newels are anchored. Strings do the structural work of the entire flight and are the single most load-bearing timber components in the staircase system. Two construction traditions dominate: the **closed string** (NEX branded **NexString™**), in which the treads and risers are housed into the inside face of the string and no tread or riser edge is visible from the side; and the **cut string** (also called open string), in which the top edge of the string is profiled to reveal the tread and riser silhouette. Strings, treads, risers, newels, balusters, and handrails together compose the full flight — Straight, Quarter-Landing, Half-Landing, Winder, Curved, Spiral, or Helical geometries all rest on strings.

---

## Structured Knowledge

### The Structural Role

The string is the beam of the staircase. Treads and risers rest on it; balustrade newels are secured to it; the top and bottom of every flight lands on structural framing that transfers the flight load through the strings into the floor structure above and below. If any component of the staircase fails, the string typically fails last — most staircase failures are of the treads, risers, or balustrade, not the strings themselves.

There are typically two strings per flight — the **wall string** (against the wall) and the **outer string** (on the balustrade side). In some architectural specifications a third intermediate string is added under the centre of very wide flights.

Load path (simplified): Live load (foot traffic) → tread → string housings or notches → string beam bending → string end supports (into floor joists or landing headers) → floor structure.

### The Two Construction Traditions

**Closed string (NexString™)** — the treads and risers are **housed** (mortised, dado-cut) into the inside face of the string, so nothing shows on the outside face. The string reads as a single continuous inclined beam. Sometimes called "closed housed string" in engineering documentation. This is the NEX branded construction — NexString™ is the customer-facing name; closed string is the engineering term. See `project_nex_nexstring_brand_terminology_2026_08_05.md`.

Advantages:
- Clean single-plane silhouette from the outside — nothing interrupts the string line.
- Traditional Georgian, Victorian, Edwardian, and 20th-century UK domestic default.
- All tread and riser joints concealed from view.
- Compatible with every historical era and every Connected Staircase™ tier.

**Cut string (open string)** — the top edge of the string is profiled (cut) to follow the tread nosings and riser edges, so the flight reads as a series of visible steps carved from the string. Sometimes called "sawn string" or "open string."

Advantages:
- Visible tread ends can be finished decoratively (nosings return, moulded end profiles, decorative brackets under each tread).
- Contemporary and Signature specifications where the geometry of the flight is a design signature.
- Common in North American colonial-era and Federal-era interior specifications.

Two-string mix is legitimate: **wall string closed + outer string cut** is a very common configuration (the wall string is concealed against the wall so has no visual benefit from being cut; the outer string is visible and benefits from the cut-string aesthetic).

### Types of String by Position

- **Wall string** — the string against the wall. Usually plain, hidden by skirting or wall panelling, or run behind wall finishes.
- **Outer string** — the visible string on the balustrade side. This is the design-critical string.
- **Intermediate / centre string** — a third string under the centre of very wide flights. Uncommon in UK domestic; more common in commercial and grand Signature specifications.
- **Curtail string** — the very bottom-of-flight section on a curved starting step (volute or curtail step); custom-shaped joinery meeting the volute detail.

### Types of String by Construction Method

- **Solid single-plank string** — cut from one substantial solid timber board (typical 32-40mm × 300-350mm section). Traditional highest-quality construction. Uses considerable timber. Common Heritage specification.
- **Laminated / built-up string** — multiple thinner timbers laminated (glued) to build up the required section. Modern engineered approach; more efficient with timber; extremely rigid. Common in mid-tier and Contemporary specifications.
- **Ply-cored veneered string** — a birch or hardwood plywood core faced with hardwood veneer. Cost-efficient; used in some Contemporary and Signature specifications where the finished face is what matters.
- **Metal string** — steel channel or plate string (usually with a timber tread cover). Contemporary industrial specification; often paired with slim metal balusters and glass panels.

### Materials

Strings are made in the same range of timbers as the rest of the visible balustrade — see the Materials cluster for detail per species:

- `materials_american_black_walnut_v1` — Signature tier outer string.
- `materials_american_white_oak_v1` — Classic through Signature tier; the workhorse UK string material.
- `materials_european_oak_v1` — Heritage tier UK-provenance choice.
- `materials_ash_v1` — Contemporary tier pale-timber option (sustainability alert applies).
- `materials_maple_v1` — Contemporary tier pale hard alternative.
- `materials_beech_v1` — Continental European specification; less common in UK.
- `materials_sapele_v1` — Heritage tier mahogany-family warmth (CITES documentation required).

**Softwood strings (Essentials tier)** — pine, redwood, or Douglas fir strings with the visible face painted are the low-cost specification. Structurally sound; the paint finish accepts the D1 Selective Material Placement pattern where the softwood string sits alongside hardwood treads.

### Sizing (typical UK domestic)

- **String section:** 32-40mm × 250-320mm (solid) — depth depends on flight length and load; longer flights need deeper strings.
- **Wall string:** slightly smaller section acceptable where the wall provides continuous support.
- **Outer string:** full section — no lateral support behind.
- **Housed depths (closed string):** typically 10-15mm housings for treads and risers, cut into the inside face of the string.

Structural sizing must be verified against the flight geometry, timber species, span, and load requirements. Deep flights (e.g. 14+ treads) or wide flights (1.2m+) may require deeper string sections. Consult a structural specialist for non-standard geometries.

### Fixing to the Floor Structure

- **Top end** — housed into or bolted to the landing header / trimmer joist. Traditional: mortise-and-tenon or housed joint. Contemporary: joist hanger + screwed joint.
- **Bottom end** — housed onto the floor structure with a plinth block, or newel-post connection where the starting newel completes the load path.
- **Landing intersections** (quarter-landing, half-landing) — the flight strings meet the landing strings via mitred or mortise-and-tenon joints; the landing sits on trimmer joists carrying the intersection load.
- **Wall fixing (wall string)** — typically screwed into wall studs or masonry through packer blocks. Not a primary load-transfer point on modern construction (the string is the beam; the wall provides lateral restraint).

### Regulations and Compliance (UK)

- **Approved Document K** governs the flight geometry (rise + going + nosing overlap + pitch + headroom + balustrade requirements) — the string carries the geometry. See `regulations_approved_document_k_v1`.
- **Approved Document A (structure)** applies to the string as a structural element. Loading calculations are typically per BS 6399 or the current published successor documents.
- **BS 5395** (Stairs, ladders and walkways, various parts) — detailed guidance on staircase design.
- **CE / UKCA marking** for structural timber components — applies where the string is a structural element in some commercial specifications.

Confirm all values against the current published Approved Doc K and related standards.

### Common Configurations by Tier

- **Essentials** — softwood closed string, painted. Straight flight geometry.
- **Classic** — solid oak closed string (NexString™), oil or lacquer finish. Straight or Quarter-Landing.
- **Heritage** — European Oak character-grade closed string (NexString™) OR wall-closed + outer-cut string with decorative moulded tread returns. Straight, Quarter-Landing, or Half-Landing.
- **Contemporary** — walnut or oak cut string OR laminated engineered string with steel or timber balustrade. Straight or feature curved geometry.
- **Signature** — solid American Black Walnut cut string with decorative returns and continuous handrail with wreaths OR sculpted curved-flight strings. Curved or Feature Straight geometry.
- **NEX Premium™** — architectural-grade curved or helical strings, precision-fitted, hand-rubbed oil finish, invisible structural fixings.

### Historical Style Reference

- **Georgian (1714-1830)** — plain closed strings, elegant moulded skirting profile at the string-to-wall junction.
- **Victorian (1837-1901)** — heavier closed strings, sometimes with a moulded top edge; decorative tread returns on cut-string outer strings in higher-status townhouses.
- **Edwardian (1901-1910)** — moderated Victorian; strings similar with lighter mouldings.
- **Arts and Crafts (1880-1920)** — visible joinery, honest construction; cut-string outer strings with pegged joints occasionally exposed.
- **Craftsman / American Prairie** — heavy fumed-oak strings, either closed or with decorative cut-string tread returns.
- **Contemporary (1950-present)** — plain closed or cut strings, sometimes plywood-cored veneered; metal strings in industrial specifications.

### Manufacturing Notes

- **Timber selection** — the outer string is a very visible timber component; specify prime grade for feature outer strings. The wall string can be lower grade since it's hidden.
- **Housing accuracy (closed string / NexString™)** — housing depths and positions determine the tread rise and going; setout must be precise. Typical setout error tolerance is ±0.5mm on housed positions.
- **Kiln drying and moisture content** — strings must be at target interior moisture content (8-12% UK) before machining. Strings are large-section timber; movement is significant if moisture is wrong. See `processes_kiln_drying_v1` and `processes_moisture_content_verification_v1`.
- **Finishing** — apply finish to all faces including concealed faces before installation.
- **Handling** — a full-flight string is heavy and awkward to install. Two-person minimum for installation.

---

## Advantages

- **The structural beam of the flight** — strings do the load transfer that lets the entire staircase perform.
- **Wide range of construction options** — solid, laminated, veneered, metal.
- **Two visual traditions to choose from** — closed (NexString™) for continuous silhouette, cut for visible step geometry.
- **Compatible with every Connected Staircase™ tier and every geometry** (Straight, Quarter-Landing, Half-Landing, Winder, Curved, Spiral, Helical).
- **Mix-and-match legitimate** — wall-closed + outer-cut is a canonical UK specification.
- **Enables the D1 Selective Material Placement doctrine** — painted softwood string + hardwood treads and handrail is a classic cost-managing Signature pattern.

## Considerations

- **Structural loading is real** — under-specified strings fail structurally, not just aesthetically.
- **Dimensional stability matters at large sections** — a 32×300mm solid oak string will move significantly if moisture content is wrong.
- **Fixing to the floor structure requires engineering** — cosmetic-only string fixings will fail Approved Doc K load tests.
- **Geometry housed into the string is not easily changed** — post-manufacture rise-and-going adjustments require re-machining the string.
- **Cost of solid deep-section strings** — a solid Signature-tier walnut outer string is one of the most expensive individual components in the staircase.

## Common Mistakes

- **Under-specifying string depth** — 200mm depth on a 3.5m flight is inadequate; deeper flights need deeper strings.
- **Ignoring wall support assumptions** — the wall string is not a primary load-transfer element; the outer string carries most of the load, so it must be sized correctly for solo-beam performance.
- **Installing at high moisture content** — the string is a large section; movement is significant if moisture is wrong.
- **Assuming closed and cut strings are interchangeable** — the housing detail is fundamentally different; you cannot convert a closed string to a cut string after manufacture.
- **Under-specifying end-fixings** — the top and bottom of the string are the primary load-transfer points; connections must be engineered.
- **Mixing incompatible string styles** with the flight geometry — a Contemporary cut string on a Victorian house looks jarring.

## Setup and Installation Notes

- **Confirm the geometry** (rise, going, flight length, headroom, landing dimensions) against Approved Doc K before machining.
- **Set out the string on paper (or CAD)** to full-size at least for the housed positions on a closed string.
- **Machine housings before finishing** — housings are shaped to fit the tread and riser at specific angles; get the geometry right first.
- **Dry-fit the full flight** — assemble strings, treads, risers, and newels in a dry fit to verify geometry before glue-up.
- **Finish before installation** — apply finish to all faces including concealed faces.
- **Install top and bottom fixings first** — the string must be structurally anchored before other components are added.
- **Add balustrade after the flight is fixed** — the newels connect to the string, so the string must be in place first.

## Maintenance (finished strings)

- **Oil-finished:** re-oil annually with the treads and handrail (unified maintenance cycle).
- **Lacquer-finished:** wipe clean; refinishing requires sanding to bare timber.
- **Painted (Essentials tier softwood string):** repaint every 5-10 years or as needed.
- **Structural inspection:** annually check for any visible cracks, splits, loosening of end fixings, or gaps at the string-to-wall junction (which can indicate string movement).

## Search Keywords

stair string, staircase stringer, wall string, outer string, closed string, cut string, open string, nexstring, closed housed string, housed string, sawn string, veneered string, laminated string, metal string, curtail string, string material, oak string, walnut string, softwood string, painted string, string sizing, string depth, string section, string housing, string dimensions, approved document k string, structural string, string load requirements, string fixing to floor, string top fixing, string bottom fixing, string to wall fixing, string kiln drying, string moisture content, string material selection, connected staircase string, straight flight string, quarter landing string, half landing string, winder string, curved staircase string, spiral staircase string, helical staircase string

---

## Concepts

### Industry Knowledge

- **Closed string vs cut string** — the two construction traditions.
- **Wall string vs outer string** — the two positions per flight.
- **Housed joint** — the mortise-and-dado joint that locks treads and risers into a closed string.
- **String setout** — the geometric layout of housing positions determining rise and going.
- **Structural load transfer through strings** — the beam performance the string provides.
- **BS 5395 / BS 6399 / Approved Doc K / Approved Doc A** — regulatory context for string design.

### NEX Concepts

- **NexString™** — the NEX customer-facing brand name for closed-string construction.
- **String as the structural beam of the flight** — NEX framing that emphasises the string's load role.
- **D1 Selective Material Placement** applied to strings — painted softwood wall string + hardwood outer string is a legitimate cost-managing pattern; walnut treads + painted softwood strings is a canonical Signature pattern.
- **Connected Staircase™ tier specifications for strings** — Essentials → NEX Premium™ vocabulary.
- **Design responses to space** — string sections and constructions adjust to the specific flight geometry per NEX Staircases Designed Around Space doctrine.

---

## Claims (Structured with Evidence)

- claim: "The string is the primary structural beam of a staircase flight; treads and risers rest on the string, balustrade newels connect to the string, and the string transfers the flight load to the floor structure at top and bottom."
  classification: established_practice
  confidence: high
  source_type: industry_standard
  source_ref: "Standard staircase construction · BS 5395 · Approved Doc A · joinery reference texts"
  verification_date: 2026-08-06
  rationale: "Definitional structural role of the string."

- claim: "Closed string (NexString™) construction houses treads and risers into the inside face of the string so no tread or riser edge is visible externally; cut string construction profiles the top edge of the string to reveal each tread and riser silhouette."
  classification: established_practice
  confidence: high
  source_type: industry_standard
  source_ref: "Standard joinery vocabulary · project_nex_nexstring_brand_terminology_2026_08_05.md"
  verification_date: 2026-08-06
  rationale: "Well-established construction distinction; NEX brand mapping documented separately."

- claim: "The wall-closed + outer-cut string mix is a legitimate and common UK specification: the wall string carries no visual benefit from being cut (it's concealed against the wall), while the outer string benefits aesthetically from the cut-string tread-return detail."
  classification: industry_consensus
  confidence: high
  source_type: trade_reference
  source_ref: "Standard UK joinery practice · Victorian and Edwardian townhouse specifications"
  verification_date: 2026-08-06
  rationale: "Widely-documented UK convention."

- claim: "String depth (section height) must be sized to the flight length, load, and timber species; under-specified strings fail structurally under Approved Doc A load requirements."
  classification: established_practice
  confidence: high
  source_type: industry_standard
  source_ref: "BS 5395 · Approved Doc A · standard structural engineering references for timber beams"
  verification_date: 2026-08-06
  rationale: "Basic structural principle; specific values require project-specific engineering."

- claim: "The D1 Selective Material Placement doctrine applies to strings — a painted softwood string can sit legitimately alongside hardwood treads and handrail as a canonical Signature-tier cost pattern."
  classification: NEX_concept
  confidence: high
  source_type: NEX_authored
  source_ref: "project_nex_connected_staircase_family_and_tiers_2026_08_05.md · D1 doctrine"
  verification_date: 2026-08-06
  rationale: "Consistent application of D1 to string specifications."

- claim: "A solid 32×300mm oak string at 12% moisture content will move approximately 3-6mm across the section width if it dries to 8% (interior heated) — hence the requirement to install at target interior moisture content, verified per moisture content verification process."
  classification: established_practice
  confidence: medium
  source_type: industry_standard
  source_ref: "USDA Wood Handbook shrinkage tables · Wood Database species-specific movement values · composes with processes_moisture_content_verification_v1"
  verification_date: 2026-08-06
  rationale: "Approximate calculation from standard oak shrinkage percentages; specific movement values vary with individual board."

- claim: "The Nex Newel™ Split Base Design connects structurally to the string at the starting-newel position; the newel-to-string joint must be engineered to complete the balustrade load path."
  classification: NEX_concept
  confidence: high
  source_type: NEX_authored
  source_ref: "project_nex_split_newel_brand_terminology_2026_08_05.md · composes with components_newel_posts_v1"
  verification_date: 2026-08-06
  rationale: "Consistent structural framing for the Nex Newel design in context of the flight."

---

## Relationships (Typed Graph Edges · Constitutional Clause 6)

```yaml
part_of:
  - stair_components_cluster
  - primary_structural_components

composes_material:
  - materials_american_black_walnut_v1
  - materials_american_white_oak_v1
  - materials_european_oak_v1
  - materials_ash_v1
  - materials_maple_v1
  - materials_beech_v1
  - materials_sapele_v1

processes_used:
  - processes_kiln_drying_v1
  - processes_moisture_content_verification_v1
  - processes_ammonia_fuming_v1                  # for Craftsman/Heritage fumed-oak strings
  - processes_lamination                          # to be authored
  - processes_veneering                           # to be authored
  - processes_finishing_oil                       # to be authored
  - processes_finishing_lacquer                   # to be authored

regulated_by:
  - regulations_approved_document_k_v1
  - regulations_approved_document_a               # to be authored (structure)
  - regulations_bs_5395                           # to be authored

composes_with:                                   # strings compose with these
  - components_stair_treads_v1
  - components_stair_handrails_v1
  - components_newel_posts_v1
  - components_stair_balusters_v1
  - components_stair_risers                       # to be authored
  - components_stair_landings                     # to be authored

used_in_systems:                                 # every flight geometry composes strings
  - system_straight_flight_staircase              # to be authored (NEXT CYCLE unblocked)
  - system_quarter_landing_staircase              # to be authored
  - system_half_landing_staircase                 # to be authored
  - system_winder_staircase                       # to be authored
  - system_curved_staircase                       # to be authored
  - system_spiral_staircase                       # to be authored
  - system_helical_staircase                      # to be authored

alternative_constructions:
  - construction_closed_string                    # NexString™
  - construction_cut_string
  - construction_wall_closed_outer_cut            # canonical UK mix
  - construction_laminated_engineered
  - construction_veneered_plywood_core
  - construction_metal_channel_string

references_doctrine:
  - doctrine_selective_material_placement_d1
  - project_nex_nexstring_brand_terminology_2026_08_05
  - project_nex_connected_staircase_family_and_tiers_2026_08_05
  - project_nex_staircases_designed_around_available_space_2026_08_05

audience_variants:
  homeowner_version: guidance_painted_vs_natural_finish_v1   # (this cycle Guidance slot)
  manufacturer_version: this_record

specialist_brains_that_consume:
  - staircase_brain
  - configurator_brain
  - master_aggregator

brand_associations:
  - brand_nexstring                               # closed-string construction
  - brand_connected_staircase
  - brand_nex_premium
```

---

## Canonical Q&A (Auto-Generated From Structured Knowledge · Constitutional Clause 7)

**Q1 · What is a stair string?**
A: The inclined structural beam that runs the length of a flight of stairs, carrying the treads and risers and providing the anchor for the balustrade newels. There are typically two strings per flight — the wall string (against the wall) and the outer string (on the balustrade side).

**Q2 · What's the difference between closed string and cut string?**
A: Closed string (NexString™) houses treads and risers into the inside face of the string, so nothing shows externally — the string reads as a single continuous inclined beam. Cut string profiles the top edge of the string to reveal each tread and riser silhouette, so the flight reads as a series of visible steps.

**Q3 · Is NexString™ the same as a closed string?**
A: Yes — NexString™ is the customer-facing brand name for closed-string construction. Engineering documentation and technical drawings continue to use "closed string" or "closed housed string" as the technical term. Same thing, two vocabularies.

**Q4 · Can I have one string closed and the other cut?**
A: Yes — the wall-closed + outer-cut mix is a legitimate and common UK specification. The wall string is concealed against the wall so has no visual benefit from being cut; the outer string benefits aesthetically from the cut-string tread-return detail.

**Q5 · How thick should a string be?**
A: Typical UK domestic: 32-40mm × 250-320mm section (solid). Depth depends on flight length and load — longer flights need deeper strings. Wall strings can be slightly smaller since the wall provides continuous lateral restraint; outer strings need full section. Confirm against Approved Doc A / BS 5395 for the specific flight.

**Q6 · What material should the string be?**
A: Match the design intent. Signature: solid walnut or oak. Heritage: solid European Oak character-grade. Classic: solid American White Oak. Contemporary: oak, walnut, or veneered engineered. Essentials: painted softwood (D1 Selective Material Placement pattern with hardwood treads).

**Q7 · Can I paint the string while staining the treads?**
A: Yes — this is the D1 Selective Material Placement doctrine and a canonical Signature-tier cost-managing pattern. Walnut treads and handrail with painted white string, risers, and minor newels concentrates the premium material where seen and touched.

**Q8 · How is the string fixed to the floor?**
A: Top end: housed into or bolted to the landing header / trimmer joist. Bottom end: housed onto the floor structure with a plinth block, or via the starting newel. The connections are structural, not cosmetic — a cosmetic-only string fixing fails Approved Doc A load tests.

**Q9 · Does the wall string carry as much load as the outer string?**
A: Not usually — the wall provides continuous lateral restraint to the wall string, so the outer string typically carries the majority of the flight load. This is why the outer string needs full structural section.

**Q10 · Can I use a laminated string?**
A: Yes — laminated (built-up) strings are legitimate modern engineered construction. They use timber more efficiently, are extremely rigid, and suit Contemporary and mid-tier specifications. Solid single-plank strings remain the highest-quality Heritage and Signature specification.

**Q11 · What is a curtail string?**
A: A custom-shaped short section of string at the very bottom of a curved starting step (volute or curtail step). It meets the volute detail on the balustrade and requires specialist joinery. Signature and Heritage feature.

**Q12 · Can strings be curved or spiral?**
A: Yes — curved, spiral, and helical staircase geometries require curved strings. Curved strings are made either by steam-bending (thin laminates), laminated construction (glued build-up around a form), or sculpted solid timber (very high-cost specialist joinery). All Signature or NEX Premium™ specifications.

**Q13 · What's the difference between a string and a stringer?**
A: They mean the same thing in most modern UK usage — the inclined structural beam of the staircase flight. "String" is more common in UK joinery; "stringer" is more common in North American joinery and engineering usage. Some traditions reserve "stringer" for the load-bearing member and "string" for the outer decorative face.

**Q14 · How wide can a flight be before I need an intermediate string?**
A: For most UK domestic flights (up to about 1.2m wide) two strings (wall + outer) are sufficient. Wider flights (grand Signature specifications, 1.5m+, or commercial specifications) may need an intermediate centre string under the middle of the flight to prevent tread deflection.

**Q15 · Are strings safe if I hear them creak?**
A: Occasional creaking on old staircases is often from tread-to-string housing joints loosening over decades, not from string failure. Persistent creaking under normal load, visible movement of the string, gaps opening at the wall, or visible cracks in the string require a joiner or structural specialist inspection.

**Q16 · Can I use metal strings?**
A: Yes — steel channel or plate strings (usually with a timber tread cover) are legitimate Contemporary industrial specifications, often paired with slim metal balusters and glass panels. Metal strings are engineered differently from timber strings but perform the same structural role.

**Q17 · What era is a cut string typical of?**
A: North American colonial and Federal-era interiors used cut outer strings widely with decorative tread returns. Some Victorian and Edwardian UK townhouses used cut outer strings for the visible-side flight. Contemporary specifications freely use either. Cut string is not a period-exclusive detail.

**Q18 · Does the string material need to match the tread material?**
A: No — this is often where the D1 Selective Material Placement doctrine is applied. Walnut treads with painted softwood strings, oak treads with dark-stained oak strings, or maple treads with light-oak strings are all legitimate. The outer string is the more visible one; specify it more carefully than the wall string.

**Q19 · How is a curved string manufactured?**
A: Three main methods: (1) laminated — multiple thin layers of timber glued around a form to a permanent curve; (2) steam-bent — a solid section softened by steam and bent to shape; (3) sculpted from solid — cut from a large timber block. Laminated is the most common modern approach for curved strings.

**Q20 · Can the string be finished after the flight is installed?**
A: Yes, but not recommended — sanding and refinishing an installed flight is difficult, especially on the concealed inside face of a closed string. Finish before installation. Site touch-up of exposed nosings, treads, and newels is possible but the string itself is best finished at the workshop.

---

## Related Records

**Foundation cluster:**
- materials_american_black_walnut_v1
- materials_american_white_oak_v1
- materials_european_oak_v1
- materials_ash_v1
- materials_maple_v1
- materials_beech_v1
- materials_sapele_v1

**Processes cluster:**
- processes_kiln_drying_v1
- processes_moisture_content_verification_v1
- processes_ammonia_fuming_v1

**Regulations cluster:**
- regulations_approved_document_k_v1

**Component peers:**
- components_stair_treads_v1
- components_stair_handrails_v1
- components_newel_posts_v1
- components_stair_balusters_v1

**Customer Guidance:**
- guidance_choosing_staircase_materials_v1
- guidance_refurbishment_vs_replacement_v1
- guidance_glass_vs_timber_balustrades_v1
- guidance_painted_vs_natural_finish_v1 (this cycle Guidance slot)

**Doctrines referenced:**
- project_nex_nexstring_brand_terminology_2026_08_05.md
- project_nex_connected_staircase_family_and_tiers_2026_08_05.md
- project_nex_staircases_designed_around_available_space_2026_08_05.md
- project_nex_split_newel_brand_terminology_2026_08_05.md
