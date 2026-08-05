---
record_id: components_stair_balusters_v1
record_version: 1.0.0
created: 2026-08-06
last_reviewed: 2026-08-06
reviewed_by: "Research Claude session 2026-08-06 · Philip authorised · self-review pass inline during authoring"
supersedes: []
status: AUTHORITATIVE
review_due: 2027-08-06

title: Stair Balusters
category: NEX Components · Staircase · Balustrade infill
subcategory: Vertical infill members between newel posts, supporting the handrail and closing the balustrade against fall-through
primary_audience: manufacturer
alt_audiences: [homeowner, engineer]

constitutional_status:
  gold_standard_v1_pattern: true
  first_of_type: false
  clauses_exercised: [1, 2, 3, 4, 5, 6, 7, 8]
  tree_growth_tier: component
  cluster: stair_components
  cycle: rhythm_cycle_3
  cycle_slot: component
  unblocks: system_records_that_need_full_balustrade_composition

knowledge_level: verified

owner:
  canonical_owner: NEX Staircase · Components sub-cluster
  authored_by: Research Claude
  authorised_by: Philip

voice_law: "no 'At NEX, we…' phrasing per HARD LAW 2026-07-27"
---

# Stair Balusters

## Summary

Balusters — also called spindles — are the vertical infill members that run between newel posts, supporting the handrail and closing the balustrade to prevent fall-through. They combine two functions inseparably: a **safety infill** governed by the Approved Document K 100mm sphere rule, and an **aesthetic rhythm** that sets much of the visual character of the staircase. Traditional turned timber balusters, square timber balusters, slim metal balusters, wrought iron, and glass panels are all legitimate balustrade infill options — each maps to a Connected Staircase™ tier and to a specific era or design intent. Alongside the newel posts and handrail, balusters complete the three-component balustrade system.

---

## Structured Knowledge

### The Safety Rule (Approved Document K)

Under Approved Document K, the balustrade infill (whether individual balusters or a glass panel) must resist the passage of a 100mm sphere at any point. In practice this means:

- **Timber and metal balusters:** centres typically 90-99mm apart, giving a clear gap of 80-90mm depending on baluster width.
- **Glass panels:** the panel must be structurally continuous across the opening with no fixing gap exceeding 99mm.
- **Height requirements:** the top of the handrail must be at least 900mm above the nosing of each tread (domestic staircase) and 1,100mm above the finished landing floor. The balusters must span this full height between base rail and handrail.

Confirm all values against the current published Approved Document K text (`regulations_approved_document_k_v1` · deferral to authoritative text discipline). Regulations may have been amended.

### Types of Baluster by Material

**Turned timber balusters** — the classical Victorian and Edwardian specification. Lathe-turned from solid hardwood (oak, ash, beech, sapele, walnut) to a decorative profile. Typical section 32-45mm at the widest point, tapered up and down. Historic profiles: turned-ball-and-column, spindle, urn, spiral, reeded.

**Square timber balusters** — Georgian, Arts and Crafts, Craftsman, and Contemporary specifications. Solid hardwood machined to a plain square profile, typically 25-40mm section. Chamfered edges (Georgian), stopped-chamfer detail (Arts and Crafts), or plain square (Contemporary).

**Slim steel balusters** — the canonical Contemporary tier specification. Round rod (typically 12-16mm diameter) or square-section (12-16mm), powder-coated matte black, brushed stainless, or brass finish. Slim profile allows for closer visual centres while remaining above the 100mm sphere rule.

**Wrought iron balusters** — historic traditional specification, particularly in Georgian and Victorian townhouses and in country-house specifications. Individual hand-forged decorative shapes (scrolls, basket weaves, twisted-and-collared elements). Modern reproduction cast iron is more common than genuine hand-forged wrought iron.

**Cast iron balusters** — Victorian mass-produced alternative to wrought iron. Uniform decorative profiles produced from moulds. Still widely available in reproduction.

**Glass panels** — Contemporary and Signature tier alternative to individual balusters. Toughened or laminated glass panels fit between newels (or into channels along the string and beneath the handrail), providing balustrade infill without visible vertical members. See `components_glass_panels` (to be authored).

**Metal wire / cable balustrade** — Contemporary specification using horizontal tensioned cables between newels. Must be closely spaced to satisfy the 100mm sphere rule; often ruled out on domestic staircases by the Approved Document K sphere rule as horizontal cables can be climbed by children (some jurisdictions specifically prohibit horizontal-line balustrades on child-accessible staircases — check current published Approved Doc K).

### Types of Baluster by Profile (Timber)

- **Turned spindle** — the traditional Victorian and Edwardian silhouette. Symmetric or asymmetric turning with decorative rings, urns, and knops.
- **Turned ball-and-column** — a variant emphasising a central turned ball with column sections above and below. Victorian.
- **Turned twist / spiral** — a spiralled profile produced by lathe with off-centre or specialist tooling. Signature and Heritage details.
- **Square plain** — the Contemporary and Arts-and-Crafts silhouette. Plain square section, top to bottom.
- **Square chamfered** — Georgian silhouette. Square section with chamfered edges, often stopped-chamfer.
- **Square with knop / boss** — Arts and Crafts variant. Square section with a decorative central boss or knop.
- **Tapered** — square or turned baluster tapering from bottom to top (or top to bottom). A restrained design element.

### Sizing (typical UK domestic)

- **Timber baluster section:** 32-45mm at widest (turned); 25-40mm (square)
- **Metal baluster section:** 12-16mm diameter (round) or 12-16mm square
- **Height (visible run between base rail and handrail underside):** typically 800-900mm
- **Spacing (centres):** 90-99mm for 32-45mm timber balusters; 105-115mm for 12-16mm metal balusters — always maintaining the 100mm sphere rule
- **Base rail:** timber horizontal running along the string, typically 25-35mm × 45-55mm section
- **Handrail underside:** balusters fit into a rebate along the handrail's underside, matching the baluster section

### Types of Baluster by Fixing

- **Mortised into tread (traditional cut-string)** — each baluster individually mortised into the tread, with the newel post capturing the ends. Traditional highest-quality construction. Two balusters per tread is the classical specification.
- **Base rail with capping fillets** — balusters slot into a base rail along the string; capping fillets close between them from above. Standard Victorian and Edwardian construction.
- **Pinned to string, mortised into handrail** — contemporary construction where balusters are fixed at the base to the string face and mortised at the top into the handrail's underside rebate.
- **Bolted metal balusters** — slim metal balusters typically screw into a threaded receiver in the tread and handrail. Concealed fixings.
- **Channel-fixed glass** — glass panels sit in aluminium channels along the string top and beneath the handrail.

### Materials

Balusters are made in the same range of timbers as the rest of the balustrade — see the Materials cluster for detail on each:

- `materials_american_black_walnut_v1` — Signature tier turned or square balusters, chocolate-brown warmth.
- `materials_american_white_oak_v1` — Classic through Signature tier, hard-wearing, wide grade availability.
- `materials_european_oak_v1` — Heritage tier character-grade turned balusters, UK provenance.
- `materials_ash_v1` — pale-timber Contemporary tier, alongside beech and maple.
- `materials_maple_v1` — pale Contemporary tier, hard and hard-wearing.
- `materials_beech_v1` — pale, fine-textured, excellent turning; canonical Continental European baluster material.
- `materials_sapele_v1` — Heritage or Signature tier where mahogany-family warmth is intended; turned sapele suits reproduction Georgian and Regency work.

Metal balusters: mild steel (powder-coated), stainless steel, brass, wrought iron reproduction. Cost bands increase from powder-coated steel to stainless to brass.

### Regulations and Compliance (UK)

- **Approved Document K** governs the 100mm sphere rule, minimum handrail heights, and balustrade load capacity. See `regulations_approved_document_k_v1`.
- **Balustrade load requirements** — domestic 0.36 kN/m horizontal line load at handrail height + 0.5 kN concentrated point load. The balusters must transfer these loads from the handrail to the string and to the newels. Undersized or under-fixed balusters fail this test.
- **Fire behaviour** — untreated hardwood balusters have Euroclass D-s2, d0 typical. Fire-retardant treatment available for specifications requiring higher class.
- **Historic balustrade in period property refurbishment** — original balustrades often fail the 100mm sphere rule (Victorian balusters were spaced further apart). Refurbishment must bring the balustrade into compliance — see `guidance_refurbishment_vs_replacement_v1`.

### Common Configurations by Tier

- **Essentials** — softwood turned balusters or plain-square timber, painted white. 32-40mm section, 90-99mm centres.
- **Classic** — solid oak turned balusters (traditional aesthetic) or plain-square oak balusters (contemporary aesthetic), oil or lacquer finish.
- **Heritage** — European Oak character-grade turned balusters, historic profile (spindle, ball-and-column, or period reproduction), often two balusters per tread. Sometimes wrought-iron reproduction where the era supports.
- **Contemporary** — slim matte-black steel balusters (12-14mm round rod) at 105-115mm centres, or plain-square oak/walnut balusters. Frameless glass panels an alternative.
- **Signature** — turned solid walnut or sapele balusters with continuous handrail and wreath detail, or slim brushed-stainless-steel balusters with LED integration. Frameless toughened glass panels a Signature Contemporary alternative.
- **NEX Premium™** — architectural-grade balusters (turned in figured timber, or brushed brass, or laminated frameless glass with polished edges), precision-fitted, hand-rubbed oil finish or invisible fixings.

### Historical Style Reference

- **Georgian (1714-1830)** — plain-square timber balusters, often with stopped-chamfer detail. Wrought iron in townhouses. Restrained.
- **Victorian (1837-1901)** — heavily turned timber balusters (ball-and-column, spindle, urn), often oak or mahogany. Cast iron in reproduction townhouses.
- **Edwardian (1901-1910)** — moderated Victorian; lighter turned profiles.
- **Arts and Crafts (1880-1920)** — square timber balusters with visible joinery and knop or boss detail, oak or ash common.
- **Craftsman / American Prairie** — heavy square balusters, often ammonia-fumed oak.
- **Contemporary (1950-present)** — slim metal balusters or glass panels. Nex Newel™ Split Base Design pairs canonically with slim matte-black steel balusters.

### Manufacturing Notes

- **Turning production** — for Heritage and Signature specifications with 30-50 turned balusters per staircase, batch turning to a reference profile is standard. See `processes_turning` (to be authored).
- **Timber selection** — turned balusters show grain across the profile; specify prime grade for feature balustrades. Beech, sapele, and walnut turn particularly cleanly.
- **Metal baluster production** — pre-cut to length in the workshop, or supplied by a specialist metal balustrade supplier. Powder-coated at the finishing stage.
- **Consistency of finish** — all balusters on a flight should be turned or machined together and finished together, or subtle profile and colour variations will show under close inspection.

---

## Advantages

- **Complete the balustrade safety infill** — the 100mm sphere rule requirement is what the balusters (or equivalent glass panel) exist to satisfy.
- **Set much of the aesthetic character** of the staircase alongside the newels and handrail.
- **Wide range of materials and profiles** — from Victorian turned oak to Contemporary matte-black steel to Signature frameless glass.
- **Historically appropriate specifications available** for period property restoration.
- **Compatible with the D1 Selective Material Placement doctrine** — expensive turned newels + painted plain-square balusters is a legitimate cost-managing Signature pattern.

## Considerations

- **The 100mm sphere rule is strict** — original Victorian balustrades often fail it and must be replaced or supplemented.
- **Handrail load transfer through balusters is real** — the balustrade load test requires balusters to be adequately sized and fixed.
- **Baluster count adds up** — 40+ balusters on a domestic flight; the per-unit cost of turned or figured balusters is significant at scale.
- **Consistency of finish requires disciplined workshop production** — batch turning and batch finishing preferred.
- **Metal balusters need a finish that will not chip** — powder coating is standard; site touch-up is difficult if damaged.
- **Glass panels have their own regulations** (toughening, laminated safety glass, edge treatment) — see `components_glass_panels` (to be authored).

## Common Mistakes

- **Spacing balusters at 100mm+ centres and failing the sphere test** — the rule is that no sphere of 100mm diameter should pass at any point, which means centres of 90-99mm depending on baluster width.
- **Undersizing metal balusters** — a 10mm round rod may satisfy the sphere rule but is visibly flimsy on a Signature staircase; 12-16mm reads correctly.
- **Mixing incompatible profiles** — a Victorian turned baluster with a Contemporary square baluster on the same flight looks incoherent unless there is a specific design intent.
- **Preserving non-compliant original balusters** in a Heritage restoration — the balustrade is a safety feature; period aesthetic must satisfy the current 100mm sphere rule (typically by specifying period-appropriate new balusters at compliant centres).
- **Painted metal balusters chipping** — cheap paint on steel is a maintenance headache; powder coating is the correct finish.
- **Ignoring the base rail** — timber balusters usually need a base rail; balusters mortised directly into the string can look odd and reduce flexibility of construction.

## Setup and Installation Notes

- **Set out the baluster centres** from the newel positions, ensuring the sphere rule is satisfied along the full flight length.
- **Fit the base rail first** onto the string, level and true.
- **Set balusters in dry-fit** before final glue and fix — check alignment along the full flight.
- **Handrail is fitted last**, capturing the top of each baluster into its underside rebate.
- **Metal balusters** are typically fitted before the handrail is set, with the receivers in the handrail dropping onto the top of each baluster.
- **Glass panels** are fitted last, into pre-set channels along string top and handrail underside.

## Maintenance

- **Oil-finished timber balusters:** re-oil annually with the treads and handrail (unified maintenance cycle).
- **Lacquer-finished:** wipe clean; refinishing requires disassembly and repainting.
- **Powder-coated metal:** wipe clean; touch-up any scratches with matching powder-coat paint (specialist supplier).
- **Brushed stainless steel:** wipe with a stainless-steel cleaner; fingerprints show and require periodic wipe.
- **Glass panels:** clean with standard glass cleaner; check the channel fixings periodically.
- **Check baluster-to-tread fixings** annually for any loose balusters (Heritage specifications with mortise-and-tenon joints occasionally loosen with age).

## Search Keywords

stair baluster, stair balusters, staircase balusters, spindles, stair spindles, turned baluster, square baluster, metal baluster, matte black baluster, stainless steel baluster, wrought iron baluster, cast iron baluster, glass balustrade, glass panel balustrade, victorian baluster, edwardian baluster, georgian baluster, arts and crafts baluster, craftsman baluster, contemporary baluster, baluster spacing, baluster centres, 100mm sphere rule, approved document k baluster, baluster height, baluster material, oak baluster, walnut baluster, ash baluster, sapele baluster, beech baluster, maple baluster, base rail, handrail baluster fixing, mortise baluster into tread, connected staircase balustrade, nex newel with balusters, cable balustrade, wire balustrade

---

## Concepts

### Industry Knowledge

- **100mm sphere rule** — the Approved Document K balustrade infill safety requirement.
- **Turned vs square baluster profiles** — traditional joinery vocabulary.
- **Base rail with capping fillets** — Victorian and Edwardian construction detail.
- **Mortise-and-tenon into tread** — traditional highest-quality timber baluster fixing.
- **Wrought vs cast iron balusters** — the historic distinction between hand-forged and mould-produced.
- **Toughened / laminated safety glass** — regulatory requirements for glass balustrade panels.
- **NHLA / character grade timber for balusters** — figure and grain selection at scale.

### NEX Concepts

- **Balustrade three-component system** — newels + balusters + handrail as an integrated system.
- **D1 Selective Material Placement** applied to balusters — inexpensive plain balusters + feature newels + premium handrail is a legitimate Signature-tier cost pattern.
- **Nex Newel™ + slim matte-black steel balusters** — canonical Contemporary tier pairing.
- **Continuous handrail + turned balusters at two per tread** — canonical Heritage and Signature specification.
- **Glass panel alternative to individual balusters** — Contemporary and Signature tier substitution.

---

## Claims (Structured with Evidence)

- claim: "Under Approved Document K the balustrade infill must resist the passage of a 100mm sphere at any point; the specific values must be verified against the current published text."
  classification: established_practice
  confidence: high
  source_type: industry_standard
  source_ref: "Approved Document K (deferral to authoritative text applies per regulations_approved_document_k_v1)"
  verification_date: 2026-08-06
  rationale: "The 100mm sphere rule is the standard domestic requirement; regulations may be amended so verify against current published Approved Doc K."

- claim: "Original Victorian and Edwardian timber balustrades often fail the modern 100mm sphere rule because historic centres exceeded 100mm; refurbishment of period staircases must bring the balustrade into current compliance, typically by specifying period-appropriate new balusters at compliant centres."
  classification: industry_consensus
  confidence: high
  source_type: trade_reference
  source_ref: "Standard UK joinery experience with Victorian and Edwardian staircase restoration · composes with guidance_refurbishment_vs_replacement_v1"
  verification_date: 2026-08-06
  rationale: "Well-documented pattern in UK staircase joinery practice."

- claim: "Slim metal balusters (12-16mm round or square section, powder-coated matte black most common) are the canonical Contemporary tier specification, often paired with Nex Newel™ Split Base Design."
  classification: NEX_concept
  confidence: high
  source_type: NEX_authored
  source_ref: "project_nex_connected_staircase_family_and_tiers_2026_08_05.md · Contemporary tier specification patterns"
  verification_date: 2026-08-06
  rationale: "Established Contemporary tier vocabulary."

- claim: "Turned timber balusters at two balusters per tread is the classical Heritage and Signature specification, typically with continuous handrail and wreath detail at newels."
  classification: industry_consensus
  confidence: high
  source_type: trade_reference
  source_ref: "Standard Victorian and Edwardian staircase construction · composes with components_stair_handrails_v1"
  verification_date: 2026-08-06
  rationale: "Widely-documented traditional specification."

- claim: "Frameless toughened or laminated glass panels are a Contemporary and Signature tier alternative to individual balusters; they must satisfy the 100mm sphere rule at every point along their edges."
  classification: established_practice
  confidence: high
  source_type: industry_standard
  source_ref: "BS 6180 (protective barriers) · glass balustrade fabrication standards · Approved Document K infill requirements"
  verification_date: 2026-08-06
  rationale: "Standard specification pathway well documented."

- claim: "Horizontal cable or wire balustrade specifications can fail domestic Approved Document K balustrade requirements because horizontal lines can be climbed by children; some jurisdictions specifically prohibit them on child-accessible staircases."
  classification: industry_consensus
  confidence: medium
  source_type: industry_standard
  source_ref: "Composed with regulations_approved_document_k_v1 · deferral to authoritative text applies; verify against current published Approved Doc K"
  verification_date: 2026-08-06
  rationale: "Widely-flagged specification risk; specific regulatory position must be verified against current published text."

- claim: "Balusters are one of three inseparable components of the balustrade system (newels + balusters + handrail); the balustrade must be designed as a system to satisfy structural load and safety infill requirements together."
  classification: NEX_concept
  confidence: high
  source_type: NEX_authored
  source_ref: "Standard NEX balustrade specification framing · composes with components_newel_posts_v1 and components_stair_handrails_v1"
  verification_date: 2026-08-06
  rationale: "System-level framing consistent with NEX component composition doctrine."

---

## Relationships (Typed Graph Edges · Constitutional Clause 6)

```yaml
part_of:
  - stair_components_cluster
  - balustrade_subsystem

composes_material:                              # balusters use these timbers
  - materials_american_black_walnut_v1
  - materials_american_white_oak_v1
  - materials_european_oak_v1
  - materials_ash_v1
  - materials_maple_v1
  - materials_beech_v1
  - materials_sapele_v1

composes_with:                                  # balusters compose with these components
  - components_newel_posts_v1
  - components_stair_handrails_v1
  - components_stair_treads_v1
  - components_stair_strings                    # to be authored
  - components_glass_panels                     # to be authored (glass alternative to timber/metal balusters)
  - components_base_rails                       # to be authored (baluster base rail)

processes_used:
  - processes_kiln_drying_v1
  - processes_moisture_content_verification_v1
  - processes_turning                           # to be authored
  - processes_powder_coating                    # to be authored (metal balusters)
  - processes_ammonia_fuming                    # to be authored (fumed-oak balusters)

regulated_by:
  - regulations_approved_document_k_v1
  - regulations_bs_6180                         # to be authored (protective barriers)
  - regulations_bs_en_12600                     # to be authored (glass safety, for glass panels)

used_in_systems:                                # systems that compose balusters
  - system_straight_flight_staircase            # to be authored
  - system_quarter_landing_staircase            # to be authored
  - system_half_landing_staircase               # to be authored
  - system_winder_staircase                     # to be authored
  - system_curved_staircase                     # to be authored
  - system_spiral_staircase                     # to be authored
  - system_helical_staircase                    # to be authored

alternative_infill:                             # non-baluster balustrade infills
  - components_glass_panels                     # to be authored

references_doctrine:
  - doctrine_selective_material_placement_d1
  - project_nex_connected_staircase_family_and_tiers_2026_08_05
  - project_nex_split_newel_brand_terminology_2026_08_05

audience_variants:
  homeowner_version: guidance_glass_vs_timber_balustrades_v1  # (this cycle Guidance slot)
  manufacturer_version: this_record

specialist_brains_that_consume:
  - staircase_brain
  - configurator_brain
  - master_aggregator

brand_associations:
  - brand_connected_staircase
  - brand_nex_newel                             # canonically paired with slim metal balusters
  - brand_nex_premium                           # architectural-grade balusters at NEX Premium™ specification
```

---

## Canonical Q&A (Auto-Generated From Structured Knowledge · Constitutional Clause 7)

**Q1 · What are stair balusters?**
A: Vertical infill members running between newel posts, supporting the handrail and closing the balustrade against fall-through. Also called spindles. They satisfy both a safety function (100mm sphere rule under Approved Document K) and an aesthetic function (visual rhythm of the balustrade).

**Q2 · How far apart should balusters be spaced?**
A: The 100mm sphere rule under Approved Document K governs: no sphere of 100mm diameter should be able to pass through the balustrade at any point. In practice this means centres of 90-99mm for typical 32-45mm timber balusters, or 105-115mm for 12-16mm slim metal balusters. Confirm against current published Approved Doc K.

**Q3 · What's the difference between turned and square balusters?**
A: Turned balusters are lathe-machined to decorative profiles (spindles, ball-and-column, urn) — the classical Victorian and Edwardian silhouette. Square balusters are plain-section timber (with optional chamfer or knop detail) — the Georgian, Arts and Crafts, Craftsman, and Contemporary silhouette.

**Q4 · Can I use slim metal balusters?**
A: Yes — slim matte-black steel balusters (12-14mm round rod) are the canonical Contemporary tier specification, often paired with Nex Newel™ Split Base Design. Brushed stainless steel and brass are alternatives. Powder coating is the standard finish for steel.

**Q5 · Can I use glass panels instead of balusters?**
A: Yes — toughened or laminated frameless glass panels between newels are a Contemporary and Signature tier alternative. The glass must be safety-rated and must satisfy the 100mm sphere rule at all edges. See `components_glass_panels` (to be authored).

**Q6 · My Victorian house has widely-spaced original balusters — can I keep them?**
A: The balustrade is a safety feature. If the original balusters fail the modern 100mm sphere rule, they must be replaced or supplemented. The correct Heritage-tier approach is to specify period-appropriate new balusters (matching the original turned profile) at compliant centres, preserving the visual character while achieving compliance.

**Q7 · How many balusters does a staircase need?**
A: Depends on flight length and baluster centres. A typical UK domestic straight flight (12-14 treads) with turned timber balusters at 95mm centres and two balusters per tread will need 25-30 balusters. Metal balusters at 110mm centres reduce the count.

**Q8 · What material should my balusters be?**
A: Match the design intent. Heritage: turned European Oak or Ash. Contemporary: slim matte-black steel or plain-square oak/walnut. Signature: turned walnut or sapele with continuous handrail. Essentials: painted softwood turned balusters. See `guidance_choosing_staircase_materials_v1` and the balusters' Materials cluster references.

**Q9 · Do balusters carry any load?**
A: Yes — they transfer the balustrade load (0.36 kN/m horizontal line load + 0.5 kN point load under Approved Doc K) from the handrail to the string. Undersized or under-fixed balusters fail this test. Confirm current published values.

**Q10 · What's a base rail?**
A: A horizontal timber running along the string top that balusters slot into at their base. It provides a fixing for balusters and closes the geometry between string and balustrade. Typical section 25-35mm × 45-55mm.

**Q11 · Can I have cable balustrade instead of balusters?**
A: Horizontal cable balustrade is a Contemporary specification but often fails the Approved Document K balustrade requirements for domestic staircases because horizontal lines can be climbed by children. Verify the current published Approved Doc K text. Vertical cable balustrade is compliant if the sphere rule is met.

**Q12 · How are timber balusters fixed?**
A: Traditional: mortised into the tread with the newel post capturing the ends (highest-quality construction). Standard: slotted into a base rail on top of the string, mortised into the handrail underside. Contemporary metal: threaded receivers in the tread and handrail. Contemporary glass: aluminium channels along string and handrail.

**Q13 · How thick should timber balusters be?**
A: Turned balusters: 32-45mm at widest point. Square balusters: 25-40mm section. Slim metal alternatives: 12-16mm. The section must be adequate for the balustrade load requirement — undersized balusters fail structural tests.

**Q14 · Do metal balusters rust?**
A: Powder-coated mild steel resists rust well and does not chip like paint. Stainless steel does not rust. Wrought iron and cast iron reproduction can rust if the coating is damaged; periodic inspection and re-coating is the maintenance. Interior installations rarely have moisture problems.

**Q15 · Can I paint the balusters while staining the treads?**
A: Yes — a canonical D1 Selective Material Placement pattern. Painted (white) balusters with natural walnut or oak treads and handrail concentrates cost on the visible timber components. It reads as a Signature specification at Contemporary cost.

**Q16 · Are wrought iron balusters still used?**
A: Reproduction cast iron balusters (mould-produced) are still specified for Heritage restoration in Victorian and Georgian townhouses. Genuine hand-forged wrought iron is rare and specialist. Both are legitimate for heritage-authentic specifications.

**Q17 · How do baluster profiles vary by historical period?**
A: Georgian: plain square with stopped-chamfer. Victorian: heavily turned (ball-and-column, spindle, urn). Edwardian: moderated Victorian turning. Arts and Crafts: square with visible joinery and knop. Craftsman: heavy fumed-oak square. Contemporary: slim metal or plain square.

**Q18 · Can I mix baluster types on the same staircase?**
A: Usually not, unless a specific design intent supports it. A Signature specification might mix turned newels with plain-square balusters (D1 Selective Material Placement); a Heritage specification might combine wrought iron balusters with a turned oak handrail. Free-form mixing tends to look incoherent.

**Q19 · What finish for timber balusters?**
A: Match the treads and handrail finish. Oil finish (annual maintenance), lacquer (long-term durability), wax (heritage). Painted (Essentials or D1 Selective Material Placement). Ammonia-fumed (Craftsman/dark-oak specifications with European Oak).

**Q20 · Are the balusters, newels, and handrail one system?**
A: Yes — the balustrade is a three-component system that must be designed together to satisfy structural load, safety infill, and aesthetic coherence. Specifying balusters in isolation from newel and handrail choices produces incoherent results.

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

**Regulations cluster:**
- regulations_approved_document_k_v1

**Component peers:**
- components_stair_treads_v1
- components_stair_handrails_v1
- components_newel_posts_v1

**Customer Guidance:**
- guidance_choosing_staircase_materials_v1
- guidance_refurbishment_vs_replacement_v1
- guidance_glass_vs_timber_balustrades_v1 (this cycle Guidance slot)

**Doctrines referenced:**
- project_nex_connected_staircase_family_and_tiers_2026_08_05.md
- project_nex_split_newel_brand_terminology_2026_08_05.md
