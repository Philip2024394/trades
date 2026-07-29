---
author: Philip O'Farrell
role: Founder · staircase manufacturer · named expert for the Staircase Reference Brain
captured_at: 2026-07-28
type: expert_note
status: layer_1_evidence
intended_module: timber_market_principles (feeds Buying Intelligence · Material Watch · Estimation risk factors)
rule_b_compliance: authored by named expert (Philip O'Farrell) · not AI-authored · eligible to enter the Reference Brain through the governed authoring workflow
rule_c_compliance: single named expert · every claim traceable
---

# Timber Market Principles for Staircase Manufacturers

*Expert principles by Philip O'Farrell · captured 2026-07-28 · Layer 1 evidence. Two related trade principles about how the timber market actually behaves — critical background for Buying Intelligence, Material Watch, and Estimation risk factors.*

**Compliance note:** this file discusses market direction and structural reasons behind price movement in RELATIVE terms only. Never publish specific £/$/€ figures to owner-facing NEX content from this file — the no-prices HARD LAW applies. Specific supplier pricing lives in each company's Materials Memory, not in shared knowledge.

---

## Principle A · Timber prices trend upward over time, but not linearly

Timber prices have generally increased over the years because the cost of producing, moving, and supplying timber has increased — but the trajectory is not a straight line. Prices rise and fall depending on the market. A staircase company is not only buying wood; it's managing **future material risk**.

### The seven forces driving price direction

**1 · Trees take decades to replace.** Unlike manufactured products, timber supply cannot quickly increase. A factory can make more products next month; a forest cannot produce more mature oak next year. High demand → more timber required → forest supply cannot respond quickly → prices increase.

**2 · Better quality timber is becoming harder to find.** For staircase manufacturers, the important timber isn't just any timber. They need clear grain · long lengths · wide boards · fewer defects · consistent colour. A 4.2m clear oak handrail blank is much harder to source than shorter construction timber. Premium grades become more expensive because supply is limited.

**3 · Energy costs.** Timber needs processing — sawing · kiln drying · planing · sanding · gluing · packaging. All require energy. When electricity, fuel, and factory costs rise: Raw timber + Processing cost + Transport = Finished timber price.

**4 · Transport costs.** Timber often travels internationally. Costs include forestry transport · shipping · fuel · storage · delivery. A staircase company buying European Oak in the UK may be affected by costs far away from the workshop.

**5 · Construction demand.** When building activity increases, timber demand rises. The same materials are used for houses · extensions · flooring · furniture · kitchens · staircases. More buyers competing for supply pushes prices upward.

**6 · Environmental and forestry regulations.** Many countries are increasing controls on harvesting · replanting · forest management. These are important for sustainability but can reduce the speed of supply entering the market.

**7 · Climate and weather.** Forests can be affected by storms · drought · wildfires · pests · disease. A poor harvest year affects availability.

### Why staircase companies feel it more than most timber buyers

A staircase company doesn't buy only basic timber. They often need specialist sizes: 28mm oak treads · 18mm risers · 38mm strings · 4m+ handrails · large newel posts. These are limited products.

A supplier may have plenty of small oak boards but very few premium European Oak lengths in 4.2m clear grade suitable for handrail. Scarcity of the exact specification creates a higher price.

### Structured form for the eventual RB module

```json
{
  "principle": "timber_price_trends_reflect_specification_scarcity",
  "trade": "staircase",
  "rule": "Timber prices rise faster for specialist specifications than for commodity dimensions. A staircase company's exposure to price movement depends on the specifications it buys, not the timber market average.",
  "reason": "Seven forces drive timber price trajectory (slow supply response · quality scarcity · energy · transport · construction demand · regulation · climate). Staircase manufacturers buy in the specification zones most affected by scarcity."
}
```

### The Material Watch feature this enables

Rather than a generic price ticker, NEX surfaces material-specific trend + reason + recommendation — see the *Material Watch* section in `docs/product-constitution/roadmap/nex-buying-intelligence.md`.

---

## Principle B · Timber availability depends on specification, not volume

**The world is not running out of all timber, but certain types are becoming more limited** — especially high-quality, old-growth, large-dimension hardwoods used for premium products like staircases, furniture, and joinery.

### Softwood vs hardwood reality

**Softwoods** (pine · spruce · fir) are widely planted and managed. Large plantation systems exist in Europe · North America · South America · New Zealand. These trees grow relatively quickly.

**Hardwoods** (oak · walnut · mahogany · ash · maple) grow much more slowly. The issue is not simply the *number* of trees — it's the availability of *quality* timber. A staircase manufacturer needs wide boards · straight grain · long lengths · low defects · consistent colour. Those trees take many decades to produce.

### Plantation vs old natural forest

A newly planted forest can replace timber production **but does not immediately replace the ecological and timber qualities of an old forest.**

- **Plantation:** trees planted → grown for 20-60 years → harvested → replanted
- **Old natural forest:** hundreds of years of growth · complex ecosystem · large mature trees

### The specification difference

Two oak trees:

```
Tree A · Young managed oak
  Produces: standard boards · smaller dimensions · more knots

Tree B · Large mature oak
  Produces: long clear boards · wide sections · premium handrails · large newels
```

Tree B is much harder to replace. Replanting for future harvest doesn't help this year's premium handrail order.

### The future reality for staircase companies

The future issue is not:

> ❌ *"No wood left."*

It is:

> ✓ *"The exact timber specification you want may become harder and more expensive to obtain."*

**More difficult over time:** 5-metre clear oak handrail · wide knot-free oak tread · large decorative newel post · rare species.

**Easier over time:** engineered oak panels · laminated components · standard softwood sizes.

### Why lamwood exists (connecting to the material profile)

Engineered and laminated timber exists partly because the industry needs to create **stable, wide, predictable components** from a resource where the best natural pieces are limited. Lamwood is not a lower-grade solid-timber substitute — it's often the professional response to a real supply constraint. See `material-profile-lamwood.md` for the full profile.

### Structured form for the eventual RB module

```json
{
  "principle": "timber_availability_depends_on_specification",
  "trade": "staircase",
  "rule": "Timber supply should be evaluated by species, grade, dimensions and availability, not only by volume.",
  "example": "A shortage of premium long oak lengths can occur even when overall oak supply exists. Standard sizes remain available; specialist specifications become progressively harder to source."
}
```

---

## Why these two principles matter together

Principle A explains the **direction** of the market (upward over time, with variation). Principle B explains **which specifications** feel the pressure first (premium, long, wide, clear hardwood).

A staircase manufacturer holding these two principles in mind will:

1. Never order at the last minute for premium specifications
2. Track the specifications most exposed to scarcity in their Material Watch (see Buying Intelligence brief)
3. Consider engineered/laminated alternatives (see lamwood profile) where they solve the same problem more reliably
4. Explain to customers *why* a long clear hardwood component is a premium, not just a marked-up plank

## Governance note

Same lifecycle as sibling files. Ready for promotion to Layer 2 whenever Philip chooses.

## Related documents

- `wood-intelligence-principles.md` — Principle 2 (application-specific quality) and Principle 5 (component reuse) both compound with these market principles
- `material-profile-lamwood.md` — the practical response to Principle B's specification-scarcity reality
- `purchasing-principles.md` — the package-comparison principle that Buying Intelligence layers on top of market timing
- `staircase-category-taxonomy.md` — Level 4-5 stairs are the most exposed to premium-timber scarcity
- `docs/product-constitution/roadmap/nex-buying-intelligence.md` — Material Watch feature reads these principles at runtime
