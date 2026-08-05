---
record_id: components_stair_treads_v1
record_version: 1.0.0
created: 2026-08-06
last_reviewed: 2026-08-06
reviewed_by: "Research Claude session 2026-08-06 · Philip authorised · self-review pass inline during authoring"
supersedes: []
status: AUTHORITATIVE
review_due: 2027-08-06

title: Stair Treads
category: NEX Trade Knowledge · Components · Staircase Components
subcategory: Structural + wear surface · walking surface of a staircase flight
primary_audience: manufacturer
alt_audiences: [homeowner, engineer]

constitutional_status:
  gold_standard_v1_pattern: true
  pattern_source_record: business_nex_digital_identity_v1
  first_of_type: components
  clauses_exercised: [1, 2, 3, 4, 5, 6, 7, 8]
  tree_growth_tier: component
  cluster: staircase_components
  parallel_growth_demonstration: true
  cross_cluster_composition: [materials, regulations, processes]

owner:
  canonical_owner: NEX Product · Trade Knowledge team · Staircase Components specialty
  authored_by: Research Claude
  authorised_by: Philip

voice_law: "no 'At NEX, we…' phrasing per HARD LAW 2026-07-27"
---

# Stair Treads

## Summary

A stair tread is the horizontal walking surface of each step in a staircase — the part your foot lands on as you climb or descend. Every staircase in NEX specifications has a specified tread material (referenced via the Materials cluster), specified dimensions compliant with the applicable regulation (referenced via the Regulations cluster), and specified preparation and installation processes (referenced via the Processes cluster). This record composes with all three Foundation clusters simultaneously.

---

## Structured Knowledge

### What a Stair Tread Is

A stair tread is the horizontal component of each step that carries the user's weight as they walk up or down a staircase. Together with the riser (the vertical component between successive treads), the tread defines the fundamental geometry of the staircase: the *going* (the horizontal walking distance per step, defined by the tread's depth) and, by height difference between treads, the *rise* (defined by the riser). Rise and going are the two dimensions that make a staircase safe, comfortable, and regulation-compliant.

The tread is both a **structural component** (it must support user weight, transfer load to the strings, and remain rigid over decades) and a **wear surface** (it is the part of the staircase most frequently touched, and its finish is critical to appearance and safety). This dual role means tread specification and manufacture require attention to both engineering and aesthetics.

Every staircase has treads. Every NEX staircase specification includes a tread specification calling out material (from the Materials cluster), thickness, dimensions compliant with the applicable regulation (from the Regulations cluster), and preparation processes (from the Processes cluster). This record is the canonical Component that the material, regulation, and process records feed into for staircase applications.

### Anatomy of a Tread

A stair tread has several distinct features:

- **Top face** — the walking surface. Sees the highest wear; typically the highest-quality face of the material.
- **Nosing** — the projecting front edge of the tread. The nosing profile is a design choice (see Nosing Profiles below) with regulation-relevant implications (contrast and visibility).
- **Front edge** — the leading edge of the tread as viewed from above; usually the nosing.
- **Back edge** — the trailing edge; often housed into or rests against the next riser or the string.
- **Ends** — the left and right edges of the tread; typically housed into the strings (closed-string construction) or exposed (cut-string construction).
- **Underside** — the bottom face; typically hidden from view. Not required to be the highest quality face.
- **Housings, rebates, and joints** — where the tread meets the riser (typically a rebated joint) and the strings (typically a housing into which the tread is glued and wedged).

Solid timber treads are typically supplied over-thickness and finished after cutting to size. Engineered treads (a hardwood veneer on a softer core) are supplied to size and factory-finished; they cost less than solid treads but do not tolerate refinishing.

### Dimensional Requirements (Regulation-Referenced)

Tread dimensions are constrained by the applicable stair regulation. For staircases in England, the applicable regulation is Approved Document K (see canonical record `regulations_approved_document_k_v1`). Key dimensional requirements from Approved Document K1:

- **Going (Category 1 Private stair):** 220mm minimum. This is the horizontal walking depth of each tread, measured on the walking line. The tread itself is typically slightly deeper than the going because the nosing overhangs the riser below by approximately 20-25mm.
- **Nosing overhang:** typically 20-25mm; not itself specified in Approved Doc K but a design convention that produces the correct going for a given tread depth.
- **Rise (Category 1 Private stair):** 150mm minimum to 220mm maximum. This is the riser height, not a tread specification, but it constrains tread thickness and joint design.
- **Consistency:** all treads in a single flight must have equal going. Variation increases trip risk.

For Category 2 (General Access) and Category 3 (Utility) stairs, different values apply — see the canonical Approved Doc K record.

**Deferral to authoritative source:** the exact current values in this record are derived from published trade guidance summarising Approved Document K. The current published Approved Document K text is the authoritative legal source; any tread specification should be verified against the current text at project time. This is consistent with the deferral discipline established in `regulations_approved_document_k_v1`.

### Materials Commonly Used (Materials-Referenced)

The material specification for a stair tread is drawn from the Materials cluster. NEX-authored material records currently include:

- **American Black Walnut** (`materials_american_black_walnut_v1`) — Signature tier premium specification.
- **American White Oak** (`materials_american_white_oak_v1`) — the most commonly specified tread material across Classic, Heritage, Contemporary, and Signature tiers.
- **European Oak** (`materials_european_oak_v1`) — UK / European provenance alternative to American White Oak.
- **Ash** (`materials_ash_v1`) — for contemporary and Scandinavian aesthetics; note active sustainability alert.

Materials to be authored (Materials Sprint 1 remaining): Maple · Beech · Sapele. Global timber library will extend further to Iroko · Sapele · Merbau · Kempas · and many others.

**Selection guidance by tier (per Connected Staircase™ tier hierarchy):**
- **Essentials tier:** typically painted softwood (pine, redwood) or engineered timber core with a hardwood veneer nosing. Not a hardwood tread by material specification.
- **Classic tier:** oak (American White Oak or European Oak) at 32mm typical. Sometimes ash for a paler aesthetic.
- **Heritage tier:** European Oak with UK provenance where possible, character grade for authentic UK aesthetic. 40mm treads at Signature end.
- **Contemporary tier:** oak or walnut, often with LED tread lighting integration.
- **Signature tier:** solid walnut or solid oak at 40mm minimum, FAS-grade, kiln-dried to 8-10% MC, acclimatised before machining.

Material substitutions may apply where availability is constrained. The current Ash sustainability alert should be noted for any specification calling for solid ash treads on a long-lead project.

### Construction Methods

Several tread construction methods are in common use:

- **Housed and wedged (closed string):** the standard traditional method. The tread is housed into a rebate machined into the string, glued, and secured with a hardwood wedge driven from underneath. The riser is similarly housed. This produces a rigid, quiet, long-lasting staircase.
- **Cut string / open string:** the string is cut to the shape of each step and the tread rests on top. Cut strings expose the tread ends; each tread is a piece of the staircase's decorative appearance rather than being concealed. Cut-string tread ends may be shaped, moulded, or scrolled.
- **NexString™ construction:** NEX's canonical closed-string design (see the Nex Constitution). Treads are housed into a continuous flush architectural string face.
- **Cantilever floating:** the tread projects from a hidden structural support (concealed steel spine, concealed housing in a supporting wall). The tread appears to float without visible support. Requires engineered structural design.
- **Bracket-supported:** the tread rests on metal brackets fixed to a supporting wall or spine beam. Contemporary industrial aesthetic.
- **Stone or concrete over timber sub-tread:** for exterior or high-wear applications; not typical NEX interior joinery.

The construction method interacts with tread thickness, material choice, and installation method. A cantilever floating stair typically uses thicker treads (50-60mm) to provide the visual mass consistent with the floating effect; a housed-and-wedged domestic stair typically uses 32-40mm.

### Nosing Profiles

The front edge of the tread — the nosing — is a design choice with practical implications:

- **Square edge** — a simple 90° corner. Minimalist contemporary aesthetic. Slightly higher risk of chip if impacted.
- **Bullnose (rounded)** — a rounded edge. Traditional and comfortable underfoot; softer visual impression. The bullnose starting step (a broader, curved-plan first step) is a canonical NEX heritage feature.
- **Ovolo / quarter-round** — a quarter-circle profile. Traditional decorative moulding.
- **Chamfered** — a 45° bevel. Contemporary; provides visual line without full round.
- **Torus** — a fuller rounded profile than bullnose. Traditional.
- **Groove and slot for LED** — a specific profile machined to accept an integrated LED strip below the nosing.
- **Anti-slip inserts** — grooves or inserts of contrasting material (typically for commercial or wet-area applications, less common in domestic interior work).

Nosing profile affects contrast for accessibility (see Approved Document M interaction below), wear pattern, and aesthetic character.

### Bullnose Starting Steps

The **bullnose starting step** is a canonical NEX heritage feature: a broader, curved-plan first step at the bottom of a flight. It projects into the hallway floor, welcomes the user onto the staircase with a broader tread than the standard flight, and typically has a rounded (bullnose) profile that gives the feature its name.

Bullnose starting steps require slightly more complex joinery — the tread is often built up from multiple pieces to achieve the curved plan, and the newel post interacts with the curved edge. Signature tier and Heritage tier staircases commonly include a bullnose starting step.

### Winder Treads (Tapered)

Winder treads are tapered — narrower at one end (the newel end) and wider at the other. They are used to turn a stair through 90° or 180° without an intermediate landing. Approved Document K1 specifies how the going of a winder is measured (at the centre of the stair for stairs less than 1000mm wide; at 270mm from the inside face for stairs 1000mm or wider) and constrains how narrow the tread can be at the newel end.

Kite winders (three winders that turn a stair 90°) are a common space-saving configuration. Winder treads require more complex machining than straight treads and can be visually distinctive when done well.

### Curved / Radiused Treads

For curved and helical staircases, each tread follows a curved plan. Each tread is unique (its curvature, width at inner and outer ends, and tapered depth all follow the staircase's centreline geometry). Curved treads require CNC machining or highly specialised hand joinery.

BS 5395-2 (referenced from Approved Doc K) provides design guidance for helical and spiral stairs including curved tread requirements.

### Manufacturing Process (Processes-Referenced)

Standard tread manufacture uses multiple processes from the Processes cluster:

- **Timber selection and grading** — FAS or better for premium visible work.
- **Kiln drying** (see `processes_kiln_drying_v1`) — 8-12% moisture content for UK interior joinery.
- **Moisture content verification** (see `processes_moisture_content_verification_v1`) — verify on delivery and after acclimatisation.
- **Acclimatisation** — 1-2 weeks in the workshop before machining.
- **Machining** — thicknessing, planing, ripping to width, cross-cutting to length, edge machining for nosing profile, end machining for housings and joints. CNC-machined for consistency in production runs.
- **Sanding** — progressive grits (typically 120 → 180 → 240 for premium work).
- **Finishing** — oil finish, UV-cured lacquer, traditional lacquer, or stain-and-lacquer per specification.
- **Quality control** — dimensional check against tread schedule, visual check against grade specification.

**Cross-cluster composition demonstrated:** this record references materials (via `composes_material`), regulations (via `regulated_by`), and processes (via `processes_used`) — three separate Foundation clusters converge into one Component. This is the parallel-growth doctrine operational.

### Installation

Installation follows the construction method. For the standard housed-and-wedged closed-string domestic staircase:

1. Treads pre-finished (where possible) to protect against installation damage.
2. Housings in the strings are typically machined to receive wedges from below.
3. The tread is fitted dry to check alignment.
4. Adhesive (typically PVA or polyurethane) is applied to the housings and the wedges.
5. The wedges are driven from below to lock the tread against the string.
6. Glue blocks may be added under the front edge for additional rigidity and to prevent squeaking.
7. The riser above (housed into the back of the tread and the front of the next tread up) is fitted similarly.

Post-installation acclimatisation to the installed environment is minimal if the tread was correctly kiln-dried and acclimatised in the workshop.

### Finishes

Tread finishing depends on the material specification. Common finish specifications by material:

- **Walnut** — oil finish (Danish oil, hardwax oil) preserves the natural warm colour; UV-cured lacquer for higher wear resistance in Signature tier.
- **Oak (European or American White)** — oil finish for natural look, UV-cured lacquer for durability, stained finish where a darker colour is desired.
- **Ash** — oil or clear lacquer; ash's pale colour is often the specified aesthetic and stains are less common.

Under-tread LED lighting is a common contemporary feature: a warm-white LED strip installed in a groove machined into the underside of the tread's nosing produces a floating-step effect and highlights the material grain from below.

### Wear and Maintenance

Treads see the highest wear of any staircase component. Standard maintenance:

- **Oil finishes** — re-oil every 1-3 years depending on traffic. Higher-wear treads (e.g., the first three steps at the bottom of a flight) may need re-oiling more frequently than the flight generally.
- **Lacquer finishes** — clean with a soft dry or slightly-damp cloth; avoid abrasive cleaners. Refinish if surface wear becomes visible.
- **Solid timber treads:** can be sanded and refinished multiple times over the staircase's life.
- **Engineered treads:** limited refinishing capacity due to the veneer thickness.
- **Stain touch-ups** are possible where wear has removed stain from high-touch areas.
- **Squeaking:** if a tread squeaks over time, the cause is typically a loose wedge or a failed glue block. Repair from underneath where accessible.

Signature tier and NEX Premium™ specifications typically call for solid timber treads specifically because of their refinishing capacity — a staircase that will be in service for 50-100 years benefits from a tread that can be refinished repeatedly rather than replaced.

---

## Advantages

- **Structural + wear surface in one component** — the tread does both jobs.
- **Refinishable (solid treads)** — multiple refinishing cycles over the staircase's life.
- **Material choice determines aesthetic** — tread material is the most visible material decision on a staircase.
- **Well-established regulation-compliance path** — Approved Doc K provides clear dimensional guidance.
- **Multiple valid construction methods** — from traditional housed-and-wedged to contemporary floating designs.

## Considerations

- **Regulation-constrained dimensions** — going, rise, pitch, and consistency are non-negotiable.
- **Material sustainability considerations** — active alerts on Ash apply to ash treads.
- **Wear pattern is not uniform** — high-traffic areas (bottom of flight, walking line) wear faster than corners.
- **Engineered treads have limited refinishing capacity** — appropriate for lower-tier specifications but not Signature.
- **Nosing chip risk** — square-edge treads are more chip-prone than rounded profiles.

## Common Mistakes

- **Specifying tread dimensions without checking Approved Doc K category** — Category 1, 2, and 3 have different minimum dimensions.
- **Ignoring the consistency requirement** — treads within a flight must all have equal going.
- **Under-specifying material** — a Signature tier staircase with engineered treads misses the material substance a Signature specification implies.
- **Missing acclimatisation** — treads machined without acclimatisation will move after installation.
- **Ignoring iron-tannin risk in oak treads** — steel fasteners in damp installation conditions produce staining.
- **Specifying square-edge nosings for high-traffic public installations** without accepting the chip risk.
- **Overlooking the ash sustainability alert** on long-lead projects specifying solid ash treads.

## Sourcing and Fabrication Notes

- **Source treads from a specialist staircase joiner** for premium work — bespoke tread machining is not typical general joinery work.
- **Verify material moisture content on delivery** per `processes_moisture_content_verification_v1`.
- **Acclimatise before machining** — 1-2 weeks in the workshop for premium pieces.
- **Specify grade explicitly** — FAS for visible premium work; Selects acceptable where the underside is hidden.
- **Consider tread thickness against the visual mass** — 32mm treads for a traditional look, 40mm for a substantial modern look, 50mm+ for a cantilever floating design.

## Maintenance

Follow the material-specific maintenance guidance from the referenced material record. For example, solid walnut treads maintained per `materials_american_black_walnut_v1` maintenance section; solid oak treads maintained per `materials_american_white_oak_v1` or `materials_european_oak_v1`.

## Search Keywords

stair tread, staircase tread, tread, going, rise, nosing, bullnose, bullnose starting step, square edge nosing, ovolo nosing, chamfered nosing, tread thickness, 32mm tread, 40mm tread, 50mm tread, solid oak tread, solid walnut tread, oak stair tread, walnut stair tread, engineered tread, engineered stair tread, housed and wedged tread, closed string tread, cut string tread, cantilever tread, floating tread, winder tread, kite winder, curved tread, radiused tread, cnc machined tread, tread refinishing, tread wear, tread squeaking, tread led lighting, under tread led, approved document k tread, tread regulation, category 1 tread, category 2 tread

---

## Concepts

### Industry Knowledge

- **Tread** (this record) — the horizontal walking surface of a step.
- **Riser** — the vertical component between successive treads.
- **Going** — the horizontal walking depth of a tread, measured on the walking line.
- **Rise** — the vertical height between the top of one tread and the top of the next.
- **Pitch line** — the imaginary line joining the nosings of successive treads.
- **Nosing** — the projecting front edge of the tread.
- **Bullnose** — a rounded profile, particularly on the front edge; also a broader starting step of curved plan.
- **Housed and wedged** — the traditional construction method where the tread is set into a rebate in the string and secured with a hardwood wedge from below.
- **Cut string / open string** — a construction method where the string is cut to the profile of each step and the tread rests on top.
- **Winder** — a tapered tread used to turn a stair around a corner without a landing.
- **Kite winder** — a set of three winders turning a stair 90°.
- **Cantilever tread** — a tread projecting from a hidden structural support without visible under-string.
- **BS 5395-2** — British Standard code of practice for helical and spiral stair design.

### NEX Concepts

- **NEX preferred tread specifications by tier** — Essentials (painted softwood or engineered), Classic (oak 32mm), Heritage (European Oak character grade), Contemporary (oak/walnut with LED integration), Signature (solid oak/walnut 40mm minimum).
- **Bullnose starting step as NEX heritage feature** — Signature and Heritage tier staircases commonly include a broader curved-plan first step.
- **NexString™ tread construction** — treads housed into the NEX-branded continuous flush architectural string face.
- **Under-tread LED specification** — contemporary feature specification for a warm-white LED strip in a groove machined into the tread nosing underside.
- **Cross-cluster composition (this record)** — the first Component record to demonstrate composition from Materials + Regulations + Processes clusters simultaneously.

---

## Claims (Structured with Evidence)

- claim: "A stair tread is the horizontal walking surface of each step; going is the horizontal walking depth of the tread, and rise (defined by the riser) is the vertical height between successive treads."
  classification: established_practice
  confidence: high
  source_type: industry_standard
  source_ref: "Approved Document K1 · standard staircase terminology"
  verification_date: 2026-08-06
  rationale: "The tread/riser/going/rise terminology is universal in staircase construction."

- claim: "For Category 1 private stairs, the minimum going is 220mm and the rise is between 150mm and 220mm."
  classification: industry_consensus
  confidence: high
  source_type: industry_standard
  source_ref: "Approved Document K1 (current edition) via regulations_approved_document_k_v1"
  verification_date: 2026-08-06
  rationale: "The dimensional rule is well-established; exact current value must be verified against the current published Approved Doc K text."

- claim: "The housed-and-wedged closed-string construction is the standard traditional method for domestic stair treads."
  classification: established_practice
  confidence: high
  source_type: industry_standard
  source_ref: "TRADA guidance · standard staircase joinery practice"
  verification_date: 2026-08-06
  rationale: "The method is universally described across staircase joinery references."

- claim: "The bullnose starting step is a canonical NEX heritage feature — a broader, curved-plan first step with a rounded profile."
  classification: NEX_concept
  confidence: high
  source_type: NEX_authored
  source_ref: "Connected Staircase™ Heritage and Signature tier standard specifications"
  verification_date: 2026-08-06
  rationale: "The bullnose starting step is a common feature of NEX heritage and signature tier specifications."

- claim: "Winder treads are permitted subject to Approved Doc K measurement rules; going is measured at the centre of the stair for stairs less than 1000mm wide and at 270mm from the inside face for wider stairs."
  classification: industry_consensus
  confidence: high
  source_type: industry_standard
  source_ref: "Approved Document K1 (current edition) via regulations_approved_document_k_v1"
  verification_date: 2026-08-06
  rationale: "The winder measurement rule is a well-established Approved Doc K provision."

- claim: "Signature tier and NEX Premium™ specifications typically call for solid timber treads at 40mm minimum thickness, FAS grade, kiln-dried to 8-10% moisture content, with acclimatisation before machining."
  classification: NEX_concept
  confidence: high
  source_type: NEX_authored
  source_ref: "Connected Staircase™ Signature tier and NEX Premium™ specification patterns"
  verification_date: 2026-08-06
  rationale: "Specification pattern established through the tier hierarchy and demonstrated in the walnut, oak, and ash material records that consume this component."

- claim: "This Component record composes with Materials (via composes_material edge), Regulations (via regulated_by edge), and Processes (via processes_used edge) — cross-cluster composition demonstrated."
  classification: NEX_concept
  confidence: high
  source_type: NEX_authored
  source_ref: "NEX Golden Rule · Parallel Growth Doctrine · Constitutional Clause 6"
  verification_date: 2026-08-06
  rationale: "This record is the first Component record; its cross-cluster edges are what the tree-growth doctrine intends to produce."

- claim: "Solid timber treads can be sanded and refinished multiple times over the staircase's life; engineered treads have limited refinishing capacity due to veneer thickness."
  classification: established_practice
  confidence: high
  source_type: industry_standard
  source_ref: "Standard timber staircase maintenance guidance"
  verification_date: 2026-08-06
  rationale: "The refinishing capacity distinction between solid and engineered treads is well-established trade knowledge."

- claim: "Under-tread LED lighting is a common contemporary feature: a warm-white LED strip installed in a groove machined into the underside of the tread's nosing produces a floating-step effect."
  classification: NEX_concept
  confidence: high
  source_type: NEX_authored
  source_ref: "Contemporary tier standard specifications · NEX design tradition"
  verification_date: 2026-08-06
  rationale: "Under-tread LED is a recognised NEX contemporary feature; the technical detail is captured in the Contemporary tier standard specifications."

- claim: "All treads in a single flight must have equal going per Approved Doc K consistency requirement; variation increases trip risk."
  classification: established_practice
  confidence: high
  source_type: industry_standard
  source_ref: "Approved Document K1 (current edition) via regulations_approved_document_k_v1"
  verification_date: 2026-08-06
  rationale: "Consistency is a fundamental Approved Doc K rule and a well-established safety principle."

---

## Relationships (Typed Graph Edges · Constitutional Clause 6)

```yaml
part_of:
  - components_cluster
  - components_staircase_family

# CROSS-CLUSTER COMPOSITION - Materials
composes_material:                                # materials the tread is made of
  - materials_american_black_walnut_v1            # authored
  - materials_american_white_oak_v1               # authored
  - materials_european_oak_v1                     # authored
  - materials_ash_v1                              # authored · with sustainability alert
  - materials_maple                               # to be authored
  - materials_beech                               # to be authored
  - materials_sapele                              # to be authored
  - materials_engineered_timber_core              # for engineered treads

# CROSS-CLUSTER COMPOSITION - Regulations
regulated_by:                                     # regulations the tread specification must satisfy
  - regulations_approved_document_k_v1            # authored · dimensional rules
  # (Approved Doc B for fire, Approved Doc M for accessibility to be authored)

# CROSS-CLUSTER COMPOSITION - Processes
processes_used:                                   # processes applied in tread manufacture
  - processes_kiln_drying_v1                      # authored
  - processes_moisture_content_verification_v1    # authored
  - processes_timber_grading                      # to be authored
  - processes_acclimatisation                     # to be authored
  - processes_cnc_machining                       # to be authored
  - processes_sanding                             # to be authored
  - processes_oil_finishing                       # to be authored
  - processes_uv_cured_lacquer                    # to be authored

sibling_components:
  - components_stair_risers                       # to be authored · sibling · partners with treads
  - components_stair_strings                      # to be authored · treads housed into strings
  - components_stair_handrails                    # to be authored
  - components_stair_newel_posts                  # to be authored
  - components_stair_balusters                    # to be authored
  - components_stair_nosings                      # to be authored · nosing detail spec
  - components_stair_landings                     # to be authored
  - components_stair_winder_treads                # to be authored · specific to winder configurations
  - components_stair_bullnose_starting_step       # to be authored · canonical NEX heritage feature

composes_into:                                    # System records that consume this component
  - staircases_connected_staircase_essentials_tier
  - staircases_connected_staircase_classic_tier
  - staircases_connected_staircase_heritage_tier
  - staircases_connected_staircase_contemporary_tier
  - staircases_connected_staircase_signature_tier
  - staircases_straight_flight                    # geometry-specific systems
  - staircases_quarter_landing
  - staircases_half_landing
  - staircases_winder
  - staircases_curved
  - staircases_spiral
  - staircases_helical

references:
  - industry_stair_terminology
  - industry_bs_5395_2_helical_spiral_stairs
  - industry_stair_joinery_practice

audience_variants:
  homeowner_version: null                         # customer-facing perspective ("what is a stair tread and how do I choose one?")
  engineer_version: null                          # technical detail (structural calculations, tread deflection, fixing methods)

specialist_brains_that_consume:
  - staircase_brain
  - configurator_brain
  - cost_engine_brain
  - image_explainer_brain
  - manufacturing_brain
  - installation_brain
  - master_aggregator

brand_associations:
  - brand_nex_premium
  - tier_connected_staircase_essentials
  - tier_connected_staircase_classic
  - tier_connected_staircase_heritage
  - tier_connected_staircase_contemporary
  - tier_connected_staircase_signature
  - brand_nexstring                               # NexString™ tread construction
  - feature_bullnose_starting_step
  - feature_under_tread_led_lighting
```

---

## Canonical Q&A (Auto-Generated From Structured Knowledge · Philip 2026-08-06 FAQ Automation Rule)

**Q1 · What is a stair tread?**
A: A stair tread is the horizontal walking surface of each step in a staircase — the part your foot lands on. It is both a structural component (carrying user weight) and a wear surface (the part most visible and frequently touched).

**Q2 · What is going?**
A: Going is the horizontal walking depth of the tread, measured on the walking line. For Category 1 private stairs under Approved Document K, the minimum going is 220mm.

**Q3 · What material should I use for stair treads?**
A: The specification depends on your project tier. Essentials tier typically uses painted softwood or engineered core. Classic and Heritage tiers typically use European or American White Oak at 32mm. Contemporary and Signature tiers may use oak or walnut at 40mm. Ash is a Scandinavian aesthetic choice but note the current sustainability alert.

**Q4 · How thick should stair treads be?**
A: Common domestic tread thicknesses are 32mm and 40mm. Signature tier and cantilever floating designs typically use 40mm or thicker. Contemporary industrial designs may use 50mm+ for visual mass. Engineered treads are available thinner but with limited refinishing capacity.

**Q5 · What is the maximum rise for stair treads?**
A: Rise is the vertical distance between treads, not a tread dimension itself, but it constrains tread joinery. For Category 1 private stairs under Approved Doc K, the maximum rise is 220mm.

**Q6 · Can I use solid walnut for my treads?**
A: Yes. Solid American Black Walnut is a Signature tier specification. It is premium cost but produces the deepest colour and highest perceived value. See the American Black Walnut material record for detail.

**Q7 · Can I use oak for my treads?**
A: Yes. Oak is the most commonly specified tread material across all tiers. American White Oak is harder and cleaner than European Oak; European Oak has UK provenance and character grade availability. Both are canonical choices.

**Q8 · Can I use ash for my treads?**
A: Yes, but note the current sustainability alert — Ash Dieback (Europe) and Emerald Ash Borer (North America) are reducing supply. For long-term projects, consider American White Oak or Beech as alternatives.

**Q9 · What is a bullnose?**
A: Two meanings. A **bullnose nosing** is a rounded front edge on a tread. A **bullnose starting step** is a broader, curved-plan first step at the bottom of a flight, typically with a rounded profile — a canonical NEX heritage feature.

**Q10 · What is a nosing?**
A: The projecting front edge of a tread. The nosing typically overhangs the riser below by approximately 20-25mm and can be shaped with a square edge, bullnose, ovolo, chamfered, or torus profile depending on aesthetic.

**Q11 · What is a housed-and-wedged tread?**
A: The standard traditional method for domestic staircase construction. The tread is housed into a rebate in the string, glued, and secured with a hardwood wedge driven from below. This produces a rigid, quiet, long-lasting staircase.

**Q12 · What is a cut-string staircase?**
A: A construction method where the string is cut to the profile of each step and the tread rests on top. This exposes the tread ends and makes them a decorative feature. Cut-string is contrasted with closed-string (or NexString™) where the tread ends are concealed.

**Q13 · What are winder treads?**
A: Winder treads are tapered — narrower at the newel end and wider at the outside — used to turn a stair around a corner without a landing. Approved Doc K specifies how the going of a winder is measured. Kite winders (three winders that turn a stair 90°) are a common space-saving configuration.

**Q14 · What is a kite winder?**
A: A configuration of three winder treads that turn a staircase 90° at a corner without an intermediate landing. It is a common way to fit a staircase into a constrained space in domestic construction.

**Q15 · Can I have LED lighting in my treads?**
A: Yes. Under-tread LED lighting is a common contemporary feature. A warm-white LED strip is installed in a groove machined into the underside of the tread's nosing, producing a floating-step effect and highlighting the material grain from below.

**Q16 · Can I refinish my treads?**
A: Solid timber treads can be sanded and refinished multiple times over the staircase's life. Engineered treads have limited refinishing capacity due to the thin veneer layer. Signature tier specifications call for solid treads specifically because of their refinishing capacity.

**Q17 · Why do my treads squeak?**
A: The most common cause is a loose wedge or a failed glue block from underneath the tread. Repair from the underside where accessible. New treads should not squeak; squeaking that develops years after installation typically indicates joint failure.

**Q18 · Can I use different materials for the treads and the risers?**
A: Yes. A common specification is oak treads (natural finish) with white painted risers, or walnut treads with painted risers. This composes with the D1 Selective Material Placement doctrine — premium material where seen and touched, painted material elsewhere.

**Q19 · Do all treads in a flight need to be the same size?**
A: Yes. Approved Doc K requires all treads in a single flight to have equal going. Variation increases trip risk. This is a strict consistency requirement, not a design preference.

**Q20 · What is the difference between solid and engineered treads?**
A: Solid treads are a single piece of the specified material. Engineered treads are a hardwood veneer on a softer core. Engineered are typically cheaper but have limited refinishing capacity. Solid are premium and refinishable.

**Q21 · How wide can my treads be?**
A: For domestic use, tread widths typically range from 800mm to 1200mm+ depending on the staircase width. Approved Doc K does not set a maximum but sets other constraints (handrails on both sides for stairs wider than 1000mm, for example).

**Q22 · What finish is best for my treads?**
A: Oil finishes (Danish oil, Osmo Polyx, hardwax oil) are common for Signature tier — they preserve the natural material colour and are spot-repairable. UV-cured lacquer is preferred for volume production and high-wear applications. Stain-and-lacquer is used where a specific colour is required. The right choice depends on material, tier, and expected use.

**Q23 · Can I have a curved staircase?**
A: Yes. Curved treads follow the plan of the staircase and are typically CNC-machined. BS 5395-2 provides design guidance for helical and spiral stairs. Curved staircases are premium specifications; see the sibling Systems record when authored.

**Q24 · Do I need to acclimatise my treads before installation?**
A: Yes for premium work. Standard practice is 1-2 weeks in the workshop or in the installation environment before final machining and installation. Acclimatisation prevents post-installation movement.

**Q25 · What regulation covers stair treads in the UK?**
A: For staircases in England, Approved Document K1 covers dimensional and safety rules for stairs including tread dimensions (going, rise, pitch). Wales, Scotland, and Northern Ireland have parallel provisions.

**Q26 · Can I paint my treads?**
A: Painted treads are typical for Essentials tier where the tread is painted softwood. For premium tiers, painted treads are less common because the material specification is often the aesthetic point. Some contemporary designs use painted treads (e.g., black-painted treads with a metal balustrade) but this is a distinctive design choice.

**Q27 · What is under-tread LED lighting?**
A: A warm-white LED strip installed in a groove machined into the underside of the tread's nosing, producing a floating-step effect from below. Common contemporary feature that highlights the material grain and improves nighttime visibility.

**Q28 · Where do I find the exact dimensional requirements for my staircase?**
A: For staircases in England, the authoritative source is the current published Approved Document K, available from gov.uk. This NEX record summarises the widely-cited dimensional rules but defers to the current published text as the authoritative source. For staircases in Wales, Scotland, or Northern Ireland, refer to the parallel provisions in each jurisdiction.

---

## Related Records

**Sibling components (immediate authoring priorities):**
- components_stair_risers
- components_stair_strings
- components_stair_handrails
- components_stair_newel_posts
- components_stair_balusters
- components_stair_nosings
- components_stair_landings
- components_stair_winder_treads
- components_stair_bullnose_starting_step

**Systems records that will consume this component:**
- staircases_connected_staircase_[essentials|classic|heritage|contemporary|signature]_tier
- staircases_straight_flight
- staircases_quarter_landing
- staircases_curved
- staircases_spiral
- staircases_helical

**Foundation records referenced by this record:**
- Materials: `materials_american_black_walnut_v1` · `materials_american_white_oak_v1` · `materials_european_oak_v1` · `materials_ash_v1` (authored)
- Regulations: `regulations_approved_document_k_v1` (authored)
- Processes: `processes_kiln_drying_v1` · `processes_moisture_content_verification_v1` (authored)

**Audience variants to be authored:**
- components_stair_treads_homeowner_v1 — customer-facing perspective
- components_stair_treads_engineer_v1 — technical detail (structural calculations, deflection, fixing)
