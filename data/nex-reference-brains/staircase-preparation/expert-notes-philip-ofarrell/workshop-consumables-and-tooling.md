---
author: Philip O'Farrell
role: Founder · staircase manufacturer · named expert for the Staircase Reference Brain
captured_at: 2026-07-29
type: expert_reference_guide
status: layer_1_evidence
intended_module: workshop_consumables_and_tooling (feeds Estimation · Buying Intelligence · Vision Stock Count · Installation Techniques)
rule_b_compliance: authored by named expert · not AI-authored · brand mentions are market observation, not endorsement
rule_c_compliance: single named expert · every claim traceable
---

# Workshop Consumables and Tooling · Reference Guide

*Expert reference guide by Philip O'Farrell · captured 2026-07-29 · Layer 1 evidence. What blade for what job · what glue for what joint · when the answer changes. Companion to `workshop-operations-principles.md` (which covers the higher-level rules) · this file is the practical lookup a workshop uses every day. It will grow as more consumable and tool categories are captured.*

**Application note:** every recommendation is subject to Product Constitution Principle 0003 — composed judgement, never rigid rules. The right blade for one workshop may not be right for another based on machine power · timber species mix · finish tier · production volume.

**Visual reference:** [`reference-images/mitre-saw-blade-teeth-detail.jpg`](reference-images/mitre-saw-blade-teeth-detail.jpg) — close-up of a TCT mitre saw blade showing the tungsten carbide teeth. The tooth count, geometry, and kerf width all matter for staircase-quality cuts.

---

## Part A · Saw blade selection for staircase work

### Hardwood staircases (Oak · Ash · Walnut · Beech)

For a mitre / chop saw, a **high tooth count** gives the cleanest finish.

- **250 mm (10")** blade: **60–80 teeth**
- **305 mm (12")** blade: **80–100 teeth**
- **Blade type:** fine crosscut · Tungsten Carbide Tipped (TCT)

Produces clean cuts with minimal splintering — critical for visible surfaces like handrails and tread noses.

### Softwood staircases (Pine · Red Deal · Spruce)

Softwood is easier to cut but can tear if the blade is too coarse.

- **250 mm** blade: **48–60 teeth**
- **305 mm** blade: **60–80 teeth**

For painted pine staircases, a cleaner cut means less filling and sanding downstream.

### Laminated hardwood (Lamwood)

Lamwood is very stable but contains multiple glue lines that can chip if the blade is wrong.

- **80–100 tooth** TCT blade · high-quality carbide teeth

Fine blade reduces chipping along glue joints — cross-reference to `material-profile-lamwood.md`.

### General staircase workshop blade (one-blade-fits-most)

If a workshop wants **one blade** for most staircase work: **305 mm mitre saw · 80-tooth TCT blade**.

Handles: handrails · balusters · newels · treads · risers · strings · mouldings. Best all-round choice.

### Tooth geometry

Tooth count isn't everything. For staircase work:

- **ATB (Alternate Top Bevel)** — excellent for clean timber crosscuts · **the standard choice for solid hardwood and softwood staircase components**
- **Hi-ATB** — even cleaner on veneered and fine-finish materials · dulls faster
- **Triple Chip Grind (TCG)** — better suited to laminates · aluminium · some composite materials · not usually first choice for solid timber

### Thin kerf vs full kerf

**Thin kerf:** easier on smaller saws · faster cutting · less waste.
**Full kerf:** stiffer blade · less deflection · often preferred for professional workshop accuracy.

Many professional staircase workshops use **full-kerf blades on powerful saws** for the accuracy gain.

### Blade maintenance

Even the best blade becomes poor when dirty. Clean regularly to remove resin · sap · glue · pitch. A dirty blade **burns timber · cuts slower · leaves rough edges · loads the saw motor**.

Signs a blade needs sharpening or replacement:

- Burn marks on oak
- More tear-out than usual
- Increased cutting effort
- Rough finish
- Chipped carbide teeth
- Blade wandering during cuts

Professional workshops **send quality blades for sharpening several times before replacing them** — a good blade is a durable asset, not a disposable.

### Professional workshop blade setup

Many shops keep **several dedicated blades** rather than trying to do everything with one:

| Blade | Best use |
|---|---|
| **24–30 tooth** | Fast rough cutting of timber |
| **48–60 tooth** | General softwood cutting |
| **60–80 tooth** | Hardwood and finish cuts |
| **80–100 tooth** | Premium finish work · lamwood · fine mouldings |

Avoids the compromise of one blade for every task.

### Brands commonly trusted in professional joinery (market observation)

**Freud · CMT Orange Tools · Leuco · Leitz · Bosch Professional · Makita (premium range)** — captured as market observation, not endorsement. Different workshops develop different preferences based on saw brand · sharpening service availability · price/durability tradeoff.

### Structured form (for eventual Reference Brain module)

```json
{
  "principle": "blade_selection_matches_material_and_finish_tier",
  "trade": "staircase",
  "domain": "workshop_tooling",
  "rule": "Match tooth count and geometry to the timber species AND the visible-finish tier. Never use one blade across all tasks if finish quality matters.",
  "recommendation_matrix": {
    "hardwood_305mm":  "80-100 tooth TCT ATB",
    "softwood_305mm":  "60-80 tooth TCT ATB",
    "lamwood_305mm":   "80-100 tooth TCT (fine · reduces glue-line chipping)",
    "general_305mm":   "80 tooth TCT · best all-rounder"
  }
}
```

### The NEX Workshop Intelligence feature this enables

Before each job, NEX can recommend:

```
Material:          American White Oak
Component:         Handrail
Machine:           305 mm mitre saw
Recommended blade: 80-tooth TCT ATB
Expected finish:   Fine crosscut with minimal sanding
Maintenance check: Inspect blade for resin build-up before cutting
```

Same composition discipline — reasoning visible, alternatives noted, owner decides.

---

## Part B · Wood glue selection for staircase work

A staircase has many different joints — the wrong adhesive can cause problems years later. Four main choices for staircase manufacturing:

- **PVA wood glue (water-based)** — the standard for most staircase joints
- **Polyurethane glue (PU)** — used less commonly · special applications
- **Epoxy** — specialist / repairs
- **Hybrid construction adhesives** — decorative panels / cladding · not structural

For most timber staircases, **a good quality PVA wood adhesive is the standard choice.**

### 1 · PVA wood glue (most common for stairs)

Common grades: **D3 PVA · D4 PVA**.

Used for: treads into strings · risers into grooves · balusters · handrail joints · newel joints · timber assembly.

**Advantages:** strong timber bond · easy cleanup · sands well · does not expand · suitable for precision joinery.

**D3 vs D4:**

- **D3 PVA** — normal indoor staircases · dry homes · controlled environments. Common for oak stairs · pine stairs · internal joinery.
- **D4 PVA** — higher water resistance. Better for entrance areas · higher humidity environments · situations where extra moisture resistance is desired. Often preferred by professional joiners because staircases experience seasonal humidity changes.

### 2 · Polyurethane glue (PU)

Used less commonly for fine staircase assembly.

**Advantages:** waterproof versions available · fills small gaps · strong bond.
**Disadvantages:** expands while curing · creates messy squeeze-out · harder to clean · can stain timber.

Useful where there are small uneven areas but **not usually the first choice for precision staircase joints**.

### 3 · Epoxy

Specialist applications: repairs · difficult bonding situations · metal-to-timber connections.

**Advantages:** extremely strong · gap filling.
**Disadvantages:** expensive · harder to work with · less convenient for normal staircase production.

### 4 · Construction adhesives (grab adhesives, etc.)

Have their place but **should not replace proper woodworking joints**.

Good for: fixing decorative panels · cladding · some renovation work.
**Not ideal as the only fixing for:** structural handrails · newel posts · tread joints.

### Where each glue actually goes in a staircase workshop

- **Treads and risers** — D3/D4 PVA · mechanical fixing where designed · wedges/glue blocks where traditional
- **Balusters** — D3/D4 PVA
- **Handrails** — PVA for timber joints · mechanical fixing where required
- **Lamwood handrails** — high-quality adhesive systems · controlled factory gluing process (manufacturer relies on the glue lines for stability)

### The governing rule

> **The best glue is not the strongest glue — it is the correct glue used with the correct joint, timber moisture, and workmanship.**

A good staircase joint is a composed result:

```
Good timber fit
      +
Correct joint design
      +
Correct moisture content
      +
Correct glue
      +
Correct clamping
      =
Long-lasting staircase
```

**Glue cannot fix:** wet timber · poor fitting joints · movement problems · bad machining.

### Common mistakes in staircase gluing

- ❌ Using too much glue (more glue does not mean stronger)
- ❌ Using glue on dusty surfaces
- ❌ Joining wet timber
- ❌ Not clamping or holding joints properly
- ❌ Using interior glue in damp conditions

### Philip's general UK staircase workshop preference

- **Main joinery:** high-quality D4 PVA
- **Traditional housed staircase joints:** D3/D4 PVA + wedges/glue blocks as designed
- **Decorative panels:** suitable flexible adhesive where appropriate
- **Special repairs:** epoxy if required

### Structured form (for eventual Reference Brain module)

```json
{
  "principle": "glue_selection_matches_joint_and_environment",
  "trade": "staircase",
  "domain": "workshop_consumables",
  "rule": "Choose glue by joint type + timber moisture + environment + workmanship — never by strength alone. The best glue is the correct glue, not the strongest.",
  "recommendation_matrix": {
    "internal_dry_home":       "D3 PVA",
    "internal_variable_humidity": "D4 PVA (default preference)",
    "structural_handrail_joint":  "PVA + mechanical fixing (glue supports, doesn't sole-support)",
    "lamwood_factory_bonding":    "specialist adhesive systems · factory-controlled",
    "decorative_cladding":        "flexible construction adhesive",
    "specialist_repair":          "epoxy if needed"
  }
}
```

### The NEX Glue Selection feature this enables

```
Component:      Oak handrail
Joint:          Newel connection
Environment:    Indoor residential

Recommendation: D4 PVA + mechanical fixing
Reason:         Strong timber bond while allowing controlled timber movement.
```

---

## Governance note

Same lifecycle as sibling files. Rule A · Rule B · Rule C compliant. Brand mentions are market observation only (Freud · CMT · Leuco · Leitz · Bosch · Makita) — never endorsements. Glue chemistry references qualitative — always defer to the specific manufacturer's data sheet for cure times · temperatures · substrate limitations.

## Related documents

- `workshop-operations-principles.md` — Principles A + B (workshop as a system · hand tools) provide the higher-level frame this reference guide operates inside
- `wood-intelligence-principles.md` — Principle 7 (movement) · Principle 8 (moisture) · Principle 11 (adhesive performance depends on environment) all interact with glue selection
- `material-profile-lamwood.md` — lamwood-specific glue requirements
- `staircase-installation-techniques.md` — installation workflows that consume these blades and glues in sequence
- `docs/product-constitution/roadmap/nex-buying-intelligence.md` — blade + glue purchasing composes with the package-thinking rule
- `docs/product-constitution/roadmap/nex-stock-intelligence.md` — blade + glue stock monitoring composes with reorder recommendations

## Future sections this file will grow into

- **Part C** · Finishes (natural oil · hardwax oil · lacquer · varnish · stain · paint · when each is right)
- **Part D** · Fixings (wood screws · dowels · biscuits · Domino connectors · hanger bolts · Zipbolt · coach screws · structural screws · hidden brackets)
- **Part E** · Abrasives (grits by stage · belt vs orbital · sanding schedule for premium hardwood)
- **Part F** · Personal protective equipment (dust masks · respirators · hearing protection · eye protection · safety footwear · dust extraction attachments)
- **Part G** · Machinery maintenance schedules (planer knives · spindle cutters · CNC bits · saw blade rotation)

Same pattern in each: what to use where · why the recommendation depends on context · common mistakes · structured JSON · the NEX runtime feature it enables.
