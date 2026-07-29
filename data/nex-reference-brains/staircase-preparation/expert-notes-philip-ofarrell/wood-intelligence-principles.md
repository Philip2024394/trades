---
author: Philip O'Farrell
role: Founder · staircase manufacturer · named expert for the Staircase Reference Brain
captured_at: 2026-07-28
type: expert_note
status: layer_1_evidence
intended_module: wood_intelligence_principles (Principles 1-11 → this module · material profiles now live in separate files, one per material — first entry: material-profile-lamwood.md)
rule_b_compliance: authored by named expert (Philip O'Farrell) · not AI-authored · eligible to enter the Reference Brain through the governed authoring workflow (Layer 1 → draft → review → approved → published)
---

# Wood Intelligence Principles for Staircase Manufacturers

*Expert note by Philip O'Farrell · captured 2026-07-28 · Layer 1 evidence · does NOT yet enter the Staircase Reference Brain (Layer 2) until it goes through the drafting / review / approval workflow.*

Three related principles captured together. They govern how NEX must reason about material *quality* and *value* — the kind of judgement that separates a general AI answer from staircase workshop intelligence.

---

## Principle 1 · Price without specification is incomplete information

A professional tradesperson does not buy *"a staircase"*. They buy timber thickness, profile sizes, machining quality, strength, finish level, and lifespan.

Two staircases quoted at wildly different prices are often different **specifications**, not different **values**. A £4,500 staircase with 22mm treads and 28mm strings is not directly comparable to a £5,200 staircase with 28mm treads and 38mm strings. The lower price is often mostly explained by the reduced material specification — and the customer usually doesn't know that.

### Structured form (for eventual Reference Brain module)

```json
{
  "principle": "price_without_specification_is_incomplete",
  "trade": "staircase",
  "rule": "Never compare staircase quotes on price alone. Always surface the specification differences that explain the price gap.",
  "reason": "Suppliers can reduce cost by reducing material specification (thickness, profile size, section) without the customer realising the two quotes are not like-for-like."
}
```

### The components where specification matters most

| Component | Specification field | Typical range | Impact |
|---|---|---|---|
| Stair tread | thickness | 22mm · 28mm · 32mm | strength · deflection · lifespan · visual weight |
| Stair riser | thickness | 12mm · 15mm · 18mm | structural integrity · visual weight |
| String (closed / cut) | thickness | 28mm · 32mm · 38mm | strength · rigidity · rack resistance |
| Handrail | cross-section | 75 × 56mm · 56 × 60mm · larger | grip · visual presence · code compliance |
| Baluster | diameter / section | 32mm · 41mm · 44mm · 50mm | strength · visual weight · code compliance |
| Newel post | section | 75mm · 90mm · 100mm · 120mm | structural anchor · visual anchor · terminal strength |

Every one of these fields can move price by 10–30% without the customer noticing the difference on paper.

---

## Principle 2 · Material quality depends on where the timber is used

A material can be **technically stronger** but **less valuable** for a specific application. NEX must not learn a simplistic ranking like:

- ❌ Solid wood = always better
- ❌ Lamwood = always better

The correct answer depends on the **component**, **application**, **length**, and **purpose**.

### Structured form (for eventual Reference Brain module)

```json
{
  "principle": "wood_quality_is_application_specific",
  "trade": "staircase",
  "rule": "Never rank a material as universally superior. Quality is a function of the component it will become, the length required, the application load, and whether visual continuity is a value driver.",
  "reason": "A material choice that is optimal for one component may be sub-optimal for another; ignoring application context leads to naive recommendations that experienced tradespeople would reject."
}
```

### Worked example · Handrails · Lamwood vs long solid hardwood

**A common assumption:**

> *"A solid 14ft hardwood handrail = best quality."*

**But many professional suppliers use lamwood (laminated handrail)** because the construction controls movement. Why:

Long solid hardwood lengths carry natural grain tension. A 14ft single piece can bow, twist, or move as moisture changes — it follows the grain. Lamwood counteracts this by opposing grain directions between strips:

```
Strip 1 grain →
Strip 2 grain ←
Strip 3 grain →
Strip 4 grain ←
```

The opposing grain balances movement.

**Lamwood advantages (for handrails):**
- More stable in storage
- Less bowing before installation
- More predictable machining
- Better dimensional control

**BUT — long solid hardwood advantages:**

A staircase company that can produce a 14ft solid hardwood handrail has something valuable. Not just structurally — commercially and craftwise:

- Premium natural product
- Shows rare timber availability
- Represents craftsmanship
- Some customers specifically want uninterrupted grain
- Avoids glued joints

The value is not only structural. It is **material rarity + craftsmanship + visual quality + length availability**.

### The Reference Brain rule this generates

```json
{
  "principle": "wood_quality_is_application_specific",
  "component": "handrail",
  "rule": "Lamwood improves stability for long hardwood handrails, but exceptional long solid timber has premium value.",
  "reason": "Long solid hardwood can move in storage due to natural grain tension, while installed handrails have controlled conditions. Solid long-length availability is also a craftsmanship signal."
}
```

### The NEX comparison this enables

Customer asks: *"Why is this handrail more expensive?"*

**Generic software:** *"Oak handrail — £250."*

**NEX:**

```
Comparison

Option A · Oak laminated handrail
Length:    4.2m
Benefits:  High stability · Low movement risk

Option B · Single-piece European Oak
Length:    4.2m
Benefits:  Continuous natural grain · Rare long timber · Premium appearance

Price difference reflects timber availability and craftsmanship.
```

Not *"A is worse than B."* Not *"B is better than A."* Just the truth about what the price gap actually reflects.

---

## Principle 3 · The environment changes the risk

A material's stability risk **before installation** is not the same as its stability risk **after installation**.

### Structured form (for eventual Reference Brain module)

```json
{
  "principle": "environment_changes_risk",
  "trade": "staircase",
  "rule": "Never evaluate material stability without specifying the environment. A material's risk during storage/transport is not the same as its risk after installation.",
  "reason": "Storage conditions vary widely (temperature, humidity, handling); installed conditions are stabilised by the surrounding building. A material judged 'unstable' in one context may be perfectly appropriate in the other."
}
```

### Worked flow

**Before installation:**

```
Timber storage
   ↓
Temperature changes
   ↓
Humidity changes
   ↓
Movement risk
```

**After installation:**

```
Fixed to staircase
   ↓
Room conditions stabilise
   ↓
Movement controlled
```

### The rule this generates

> **A material risk before installation is not always a material problem after installation.**

This is why the handrail example above is nuanced: lamwood's advantages are largely **pre-installation**. Once a solid handrail is fixed to a staircase inside a heated home, most of the movement risk disappears — and the visual/commercial value of the solid piece takes over.

---

## Principle 4 · Every material has advantages and handling requirements

A professional staircase manufacturer never asks *"which wood is best?"* — they ask *"which material is best for this **component**, **process**, **finish**, and **environment**?"* Every material carries **advantages**, **limitations**, and **handling requirements** that only make sense in the context of what it will become.

This principle extends Principle 2 (application-specific quality) with a specific practical corollary: NEX must know per-material *handling rules* — how to store it, what to protect it from, what natural characteristics to expect, and where its limits are.

### Structured form (for eventual Reference Brain module)

```json
{
  "principle": "every_material_has_advantages_and_handling_requirements",
  "trade": "staircase",
  "rule": "Never present a material's advantages without its limitations and handling requirements. Never present its limitations without its advantages.",
  "reason": "A material recommendation is only useful if the reader also knows how to store, machine, and finish it. Silent gaps in handling knowledge lead to real losses on the shop floor (moisture damage, glue-line failure, visible defects after drying)."
}
```

### The pattern this creates for every material NEX knows

Instead of the shape a normal materials catalogue stores:

> *"Oak — £X per metre"*

NEX should store the trade shape:

> *"Oak lamwood — preferred for stable premium stair production, excellent finish, wide components possible, protect from moisture, understand glue-line behaviour."*

That is the difference between a catalogue and a staircase manufacturing knowledge engine.

### Worked example — see the dedicated lamwood profile

The first fully-captured material profile is lamwood, in [`material-profile-lamwood.md`](material-profile-lamwood.md). It demonstrates the shape a Reference Brain material-profile module should follow: manufacturing process, per-component specifications (treads · risers · strings), secondary applications, handling rules, structured JSON forms — plus a reference photograph.

Quick summary of what that profile carries (do NOT rely on this summary as authoritative — it exists to show *why* material profiles live in a separate module):

- **Advantages** · consistent dimensions · reduced movement · stable machining · excellent finish · wide component capability
- **Limitations** · avoid water exposure · glue-line sensitivity · not outdoor timber
- **Handling** · store dry · flat · protected from moisture

Every future material (oak solid · ash · walnut · pine · MDF · plywood · consumables · finishes) will be captured in the same shape in its own file.

### Corollary · Width intelligence

Different timbers have natural **width limitations**. NEX must know these limits before recommending a solid vs engineered choice.

**Example · Red Deal solid timber:**

- ✓ Long solid sections available
- ✓ Traditional timber choice
- ✓ Natural grain
- **Limitation:** limited width availability

For wider staircase components (wide treads, larger blanks, wide handrails) manufacturers may prefer engineered/laminated solutions. Not because engineered is *"better"* — because the required width simply isn't available in a single solid board.

**Example customer explanation NEX can generate:**

> *"This staircase uses laminated oak construction because wider tread widths can be achieved, movement is reduced, production consistency improves, and finish quality is maintained. Solid timber alternatives may have availability limitations, greater movement risk, and higher material cost."*

### Corollary · "Shakes" and natural timber characteristics

Not every visual mark on timber is a defect. NEX must not treat every characteristic as a failure. Some marks are:

- Acceptable and expected
- Structurally significant in load-bearing areas but cosmetically fine in hidden areas
- Aesthetic on visible surfaces but harmless on hidden faces
- A signal to inspect placement before machining

**Example NEX inspection response:**

```
Material inspection
  Minor shake detected.

Classification: Natural timber characteristic
Recommendation: Review location before machining.
```

An experienced maker instinctively decides *"this can go into a hidden riser but not into a visible tread nose"*. NEX must eventually carry the same judgement — surfacing marks with a classification and a placement recommendation, not a pass/fail verdict.

---

## Principle 5 · Component reuse intelligence

A staircase material may have valuable secondary applications. A joinery blank isn't defined only by the component it was originally sold as — an experienced tradesperson keeps a mental inventory of *what else this stock could become* if a project needs it.

The Materials Library and Materials Memory should carry this knowledge. NEX should know not only what a material **is** but what else an experienced tradesperson would use it **for**.

### Structured form (for eventual Reference Brain module)

```json
{
  "principle": "component_reuse_intelligence",
  "trade": "staircase",
  "rule": "A staircase material may have valuable secondary applications. Surface the alternative uses when the primary one isn't required — and surface the checks that qualify a reuse.",
  "reason": "Reducing stock across products increases yield and reduces purchase cost. But reuse only works when specification, edge finish, and moisture context are considered — silent reuse without checks creates hidden defects downstream."
}
```

### Worked example · Lamwood stair tread blank as window board

A 40mm oak laminated tread blank can be cut into internal window boards, shelves, radiator shelves, or mantle shelves — **provided three checks pass**:

1. **Edge finish** — a stair tread carries a nosing profile; a window board may need a square or bevel edge. Factor re-machining into the cost.
2. **Moisture location** — internal fine. External / condensation / wet-room applications need proper sealing. **Lamwood is never outdoor timber.**
3. **Cost efficiency** — sometimes a tread blank is *higher* specification than a window board needs; a joinery panel or glued board may be cheaper. Surface both options.

Full worked structure lives in [`material-profile-lamwood.md`](material-profile-lamwood.md) under *Secondary applications (component reuse)*.

### How NEX applies this principle at runtime

When the owner asks NEX *"I need window boards"* and NEX sees they hold oak lamwood tread blanks in stock:

```
You currently hold 6 × oak lamwood tread blanks (40mm · 1200mm wide).

These could also work as internal window boards. Before you buy new stock:

  ✓ Edge finish — will need re-machining from tread nosing to square edge
  ✓ Moisture location — internal only · seal if near external door
  ✓ Cost efficiency — an oak joinery panel may be cheaper if you don't need
    the full tread specification

Would you like to compare using existing stock vs a new order?
```

That's an experienced workshop manager voice: not a recommendation, a surfacing of the option.

### The broader pattern this supports

Every material profile (see the future `material_profiles` Brain module) will eventually carry a `possible_secondary_components` list plus `reuse_checks`. The Hardwood Calculator, Buying Intelligence, and Stock Intelligence workflows all read this to answer *"can we solve this from what we already own?"* before any purchase is proposed.

---

## Principle 6 · Knot quality depends on type and location

A customer often says *"I don't want knots."* A staircase manufacturer thinks *"what type of knot, where is it, and what is the timber being used for?"* Those are completely different questions — and the difference is exactly the craft knowledge NEX must carry.

**A knot is not automatically a defect.** Size · type · and location determine suitability. Getting this wrong in either direction (accepting a bad knot in a critical location, or rejecting a sound knot in a hidden face) costs a workshop real money.

### Structured form (for eventual Reference Brain module)

```json
{
  "principle": "knot_quality_depends_on_type_and_location",
  "trade": "staircase",
  "rule": "A knot is not automatically a defect. Judge every knot by three axes: type (live vs dead), size, and location in the finished component.",
  "reason": "Small sound knots in painted or hidden faces are acceptable and expected. Loose dead (black) knots in visible or load-carrying areas are not. Treating all knots the same wastes usable timber and admits unsuitable timber into critical work."
}
```

### Live knot vs dead knot (the fundamental distinction)

**Live knot (sound knot)** — from a branch that was still alive while the tree was growing.

- ✓ Wood fibres connected to surrounding timber
- ✓ Usually tight and solid
- ✓ Often the same colour family as surrounding timber
- ✓ Less likely to fall out

The tree continues growing and surrounds the live branch with new wood — the connection stays intact.

**Dead knot (black knot)** — from a branch that died but remained inside the tree.

- Dark colour
- Black appearance
- Poor connection to surrounding wood
- Can loosen or fall out during drying or machining

The tree continues growing around the dead branch, but the old branch wood is no longer actively connected to the new growth.

### Why dead knots become black

Dead branches don't seal cleanly. Moisture enters through cracked bark; decay organisms follow; the knot area darkens through slow decomposition long before the tree is harvested.

Aggressive drying (kiln pushed too fast) makes it worse — the outside dries faster than the inside · stresses develop · cracks appear · resin migrates · colour changes intensify. Pine especially contains resin, which can darken further around knots.

### Structured form (for eventual material_profiles module)

```json
{
  "principle": "knot_quality_depends_on_type_and_location",
  "material": "softwood",
  "knowledge": {
    "live_knot": {
      "description": "Branch remains connected to surrounding timber",
      "characteristics": ["usually tight", "more stable"]
    },
    "dead_knot": {
      "description": "Branch died before harvest and is less connected",
      "characteristics": ["dark colour", "possible loosening", "higher defect risk"]
    },
    "trade_rule": "A knot is not automatically a defect; size, type and location determine suitability."
  }
}
```

### Location matters as much as type

The same knot can be perfectly acceptable in one component and completely unacceptable in another:

| Location | Small sound knot | Loose dead knot |
|---|---|---|
| Hidden riser (painted) | ✓ Fine | ⚠ May be OK if not loose |
| Painted newel (concealed by decoration) | ✓ Fine | ⚠ Depends on size |
| Visible clear-finished tread nose | ⚠ Cosmetic concern only | ✗ Reject |
| Clear-finished handrail (grip area) | ✗ Reject | ✗ Reject |
| Structural string · load path | ✗ Reject | ✗ Reject |

An experienced maker instinctively decides *"this piece can go into a hidden riser but not into a visible tread nose"*. NEX must eventually carry the same judgement — surfacing knots with a **classification + placement recommendation**, not a pass/fail verdict.

### Timber grade language reflects this

Grade descriptions are largely about how many knots (and what kind) are acceptable:

- **Clear grade** — few or no visible knots · used for premium visible work (handrails · newels · tread nosings)
- **Prime grade** — occasional small sound knots acceptable · used for most quality staircase work
- **Character grade** — visible knots intentionally shown · used for rustic aesthetics
- **Rustic grade** — heavy knot pattern · used decoratively or where knots become a feature

NEX should never present a grade as universally *"better"* — grade is only meaningful once the component and its final application are known (Principle 2).

### How NEX applies this at runtime

When an inspection photo shows a knot (see NEX Vision Stock Count roadmap):

```
Inspection

Detected: knot near right end of board
Classification: dead knot (dark colouration · potential loosening)

Suggested placement:
  ✓ Acceptable — hidden face of a riser
  ⚠ Marginal — non-visible section of a painted newel
  ✗ Reject — visible tread nose · clear-finished handrail · load-path string

Would you like me to update the board's suitability tag?
```

That's an experienced grader's voice. Classification + placement recommendation + owner decides.

---

---

## Principle 7 · Timber movement is natural; uncontrolled movement is a failure

A customer thinks *"the wood has shrunk, so the staircase was made wrong."* An experienced staircase maker thinks *"timber movement is normal — the question is whether the timber was correctly dried, designed, stored, installed, and finished."*

A staircase is expected to move slightly. **The skill is controlling where and how that movement happens.** A stable staircase is not one that never moves — it's one where movement is expected and controlled.

### Structured form (for eventual Reference Brain module)

```json
{
  "principle": "timber_movement_is_natural",
  "trade": "staircase",
  "rule": "Wood movement must be managed through correct drying, design, storage and installation. Movement itself is never a defect — uncontrolled movement is.",
  "important_factors": [
    "moisture content",
    "species",
    "grain direction",
    "component size",
    "environment",
    "storage conditions",
    "installation timing"
  ],
  "trade_note": "A stable staircase is not one that never moves; it is one where movement is expected and controlled."
}
```

### Wood is a living material after harvesting

Even after a tree is cut, the cells remain responsive · moisture continues moving in and out · the timber seeks balance with the surrounding air. A metal staircase does not breathe. A timber staircase does.

### Three directions of timber movement (very unequal)

Wood does not shrink equally in every direction:

- **Long grain (along the length):** very little movement · a 3m handrail rarely becomes dramatically shorter
- **Across the grain:** much more movement · affects tread width · riser width · panels · boards
- **Through thickness:** noticeable movement · important for treads · handrails · window boards

**Practical implication:** a 900mm oak tread may shrink from 900mm to 895-898mm across its width as moisture stabilises — the exact amount depends on species · moisture content · board orientation · environment. That's not a defect; that's timber.

### Six common movement conditions and what they mean

| Condition | Shape | Common cause | Trade view |
|---|---|---|---|
| **Bow** | curve along the length `)` | uneven drying · internal stress · irregular grain · cutting position in log · poor storage | Judged by severity + intended component |
| **Cup** | curve across the width `\____/` | uneven moisture between faces · quarter-sawn preferred to minimise | Small cup on a wide board may still be planed flat |
| **Twist** | corners move differently | unstable grain · poor drying · tension in timber | Usually harder to correct than bow or cup |
| **Crook** | sideways curve along the edge `(` | uneven growth · reaction wood | Depends on length + component |
| **Checking** | small cracks as stress releases | over-fast drying · surface dries much faster than interior | Not every crack is a failure · location matters |
| **Shrinkage / gaps** | small joints open after installation | timber acclimatising to new environment | Distinguish normal seasonal adjustment from a defect |

### Why lamwood reduces movement (cross-reference to `material-profile-lamwood.md`)

A solid wide board has one grain direction — natural forces pull one way. Lamwood alternates strip grain directions so opposing forces balance:

```
Solid:    ================
          one grain direction

Lamwood:  ====>
          <====
          ====>
          <====
          balanced grain directions
```

This is exactly why the industry developed lamwood for wide, visible, and long components — see the lamwood profile.

### Why wide boards are more challenging

```
Narrow board:  |------|      less movement across the width
Wide board:    |----------------|      more movement potential
```

The wider the piece, the more important: timber selection · grain orientation · drying · construction method. This is why manufacturers *sometimes* join pieces — a carefully made laminated or edge-jointed component can be more stable than one wide solid board. *"One piece is always better"* is not correct.

### Why stairs can shrink after installation

A staircase manufactured in a controlled workshop (stable humidity · stable temperature) is installed into a house (heating switched on · plaster drying · changing humidity). The timber adjusts.

```
Workshop timber
      ↓
Installed into house
      ↓
Moisture changes
      ↓
Timber settles
```

This is why staircase companies prefer the building to be properly dried before installation — see `docs/product-constitution/roadmap/nex-installation-readiness-check.md`.

### Storage before installation is critical

A staircase should not be left:

- ❌ Outside
- ❌ In damp garages
- ❌ Against wet walls
- ❌ Near direct heat sources

Correct storage:

- ✓ Dry building
- ✓ Flat support with stickers (small strips allowing air movement between boards)
- ✓ Protected from moisture
- ✓ Allowed to acclimatise

```
Board       ====================
Sticker     --------
Board       ====================
Sticker     --------
Board       ====================
```

### Grain-orientation intelligence

The cutting direction of a board significantly affects its movement behaviour:

*Reference image: [`reference-images/oak-sawing-patterns-plain-rift-quarter.jpg`](reference-images/oak-sawing-patterns-plain-rift-quarter.jpg) — same oak, three cutting patterns.*

- **Plain sawn** — rings appear curved (cathedral pattern) · higher yield from the log · more visual figure · more movement potential across the width
- **Rift sawn** — rings close to 45° · balance between yield and stability · less pronounced figure · moderate movement
- **Quarter sawn** — rings close to vertical (nearly perpendicular to face) · lower yield · very stable · shows medullary rays on oak (attractive on treads and premium panels) · minimal movement

Choosing the cutting pattern for the component is part of the movement-control craft — not just an aesthetic choice.

### How NEX applies this at runtime (customer report example)

The customer says: *"my oak stairs have a small gap between tread and riser."*

NEX must not immediately say *"defect"*. It gathers context, then assesses:

```
Material:         Solid oak
Installation:     3 months ago
Environment:      New build
Heating:          Recently activated
Location:         Between tread and riser

Assessment:
  Possible normal timber adjustment as building dries.

Recommended:
  Monitor seasonal changes.

Inspection required if:
  · gap increases
  · cracking occurs
  · movement affects safety
```

That's operations-manager voice · not chatbot voice · fully aligned with Principle 0003 (judgement, not verdict).

### The customer education line

Every module that discusses timber movement to customers should carry the same lesson:

> **Timber is not defective because it moves. Timber is defective when movement was not considered during selection, drying, design, or installation.**

---

## Principle 8 · Moisture content is the foundation of timber quality

Nearly every timber issue links back to moisture: when the tree was cut · how it was dried · how it was stored · where it was installed. Principle 7 explains why movement happens; Principle 8 explains how the trade actually measures and controls the underlying moisture that drives it.

The core rule:

> **The goal is not "zero moisture". The goal is timber moisture matching the environment where it will live.**

### Structured form (for eventual Reference Brain module)

```json
{
  "principle": "moisture_content_is_the_foundation",
  "trade": "staircase",
  "rule": "Judge timber suitability by whether its moisture content matches the environment it will live in — not by whether it is 'dry'.",
  "typical_indoor_target_uk": { "range_pct": [8, 12], "workshop_common_target_pct": [9, 11] },
  "measurement_practice": "Test in several places (both ends, middle, near knots, different faces). Consider surface vs core, especially in thick sections.",
  "reason": "Timber too wet at installation shrinks and gaps open; timber too dry absorbs moisture and expands. Correct moisture at installation prevents both failure modes."
}
```

### The measurement tools

Two main instruments used to test moisture content (MC):

*Reference image (workshop): [`reference-images/moisture-meter-workshop.jpg`](reference-images/moisture-meter-workshop.jpg)*
*Reference image (warehouse): [`reference-images/moisture-meter-warehouse.jpg`](reference-images/moisture-meter-warehouse.jpg)*
*Reference image (sawmill after kiln): [`reference-images/moisture-meter-sawmill-post-kiln.jpg`](reference-images/moisture-meter-sawmill-post-kiln.jpg)*

**Pin moisture meter** — small metal pins penetrate the wood and measure electrical resistance (wet timber conducts differently from dry timber).

- ✓ More accurate at a specific depth
- ✓ Can test below the surface
- ✓ Good for stair parts and joinery

**Pinless moisture meter** — sits on the surface, uses electromagnetic sensing.

- ✓ No pin marks
- ✓ Quick testing across many boards
- ⚠ Less precise · affected by thickness and surface conditions

### Where to measure

A common mistake is testing only one place. A good timber check measures:

- Both ends
- The middle of each board
- Near any knots (moisture behaves differently around them)
- Different faces

```
End       Middle       End
[12%] ---- [13%] ---- [12%]
```

Timber can have different MC in different areas — one reading is a data point, not a verdict.

### Typical indoor UK targets

For indoor staircase work, timber is brought close to the moisture level of an occupied home:

- **Common target range:** 8–12% MC
- **Many workshops aim for:** 9–11% MC (most heated UK homes sit in that range once occupied)
- **Too wet:** 15–20%+ MC · high risk of shrinkage after installation
- **Too dry:** below ~7% MC · may absorb moisture and expand

Construction timber may be higher because it is used differently — never confuse construction-grade MC targets with staircase-grade targets.

### The number alone is not enough

A single MC reading must be understood in context. An oak batch reading 10% at the surface may still have a wetter core — especially in thick sections. A good manufacturer also checks:

- Was it stored correctly?
- Is the centre dry?
- Is the surface hiding wetter timber?
- Has it acclimatised to workshop conditions?

### Component size dramatically affects behaviour

A single MC number is misleading if you don't factor in component size. A skilled manufacturer does not judge a 90mm newel post and a 28mm tread by the same test.

| Component | Typical size | Moisture behaviour |
|---|---|---|
| Baluster | 38 × 38mm | Moisture escapes easily · dries fast · reads consistent |
| Tread | 28mm thick × 900mm wide | Thin enough to dry evenly · wide face means movement across width matters |
| String | 38mm thick × long | Structural · length + section make replacement difficult · MC must be right before install |
| Handrail (long) | e.g. 4.2m length | Long enough to bow noticeably if MC is wrong · storage matters as much as MC |
| Newel post | 90 × 90mm+ | Centre dries much slower than surface · surface may read 10% while core reads 14% |

**Example:** a 90mm oak newel post — surface at 10% MC · centre at 14% MC. The outside says dry, but the inside is still adjusting. Ignore this and the newel will move after installation.

**The rule:** the larger the timber section, the more important controlled drying and acclimatisation become — not because it has a higher moisture percentage overall, but because moisture moves in and out more slowly.

### Species behaves differently

- **Oak** — stable hardwood · still moves with humidity · wide boards need careful selection
- **Pine / Red Deal** — lighter · easier to dry · more resin · more visible knots
- **Beech** — strong · can move noticeably if conditions change

Never apply a universal MC verdict across species — check the component's species profile in the material-profiles library.

### How sawmills reach the target · kiln drying

*Reference image: [`reference-images/moisture-meter-sawmill-post-kiln.jpg`](reference-images/moisture-meter-sawmill-post-kiln.jpg)*

Before timber reaches a staircase workshop, the mill controls temperature · airflow · humidity through a kiln cycle. The timber is slowly dried to reduce cracking · warping · excessive movement.

**Fast drying creates problems:**

- Surface dries too quickly
- Internal stress builds
- Checking (small cracks) appears
- The board may look dry on the outside but hold moisture inside

That's why *"kiln dried"* on a delivery note is not the whole answer — the *cycle quality* matters as much as the fact that a kiln was used.

### What happens if timber is too wet at installation

```
Handrail installed at high MC
     ↓
House heating starts
     ↓
Timber loses moisture
     ↓
Shrinks
     ↓
Joints open · cracks may appear
```

Possible outcomes: gaps · movement · twisting · splits.

### What happens if timber is too dry at installation

Very dry timber can absorb moisture from the air · expand · create pressure at joints.

**Example:** a dry tread installed in a humid environment may expand across its width, potentially pushing against risers or strings and creating pressure damage.

### The building matters as much as the staircase

A staircase at 10% MC entering a damp new house may still move. Plaster, screed floors, concrete, paint, and adhesives all release moisture into the air. The building may feel finished but still be drying — see the Installation Readiness Check brief.

```
Staircase (10% MC)   →   Damp new house   →   Heating starts   →   Moisture leaves building   →   Timber adjusts
```

The staircase wasn't necessarily wrong — the environment changed.

### The NEX Timber Readiness Check at runtime

Before installation:

```
NEX Timber Readiness Check

Material:      European Oak Stair Treads
Moisture readings:
  Tread 1:  10%
  Tread 2:  11%
  Handrail: 9%

Status:       Suitable for indoor installation ✓
Notes:        Building conditions stable · heating operational · plaster fully dried.
```

If the building isn't yet dry (see Installation Readiness Check), the readiness check flags the mismatch and recommends deferring — never proceeds silently.

### The important staircase-maker rule

> **A skilled carpenter does not try to make timber "dead and unable to move" — that is impossible. The goal is: dry it correctly, select it correctly, install it correctly, and allow normal movement to happen safely.**

---

## Principle 9 · Surface feel and density are species characteristics, not quality verdicts

A customer feels a rough pine end grain and a smooth planed oak face and concludes *"the pine is lower quality."* A staircase manufacturer knows the two woods have different cell structures, densities, and processing characteristics — the surface difference is species behaviour, not a quality gap.

Pine is not a cheap version of hardwood. It's a different material with different uses. Choosing between them for a specific component is a design decision — not a hierarchy of *"better vs worse"*.

### Structured form (for eventual Reference Brain module)

```json
{
  "principle": "surface_feel_is_not_only_a_quality_measure",
  "trade": "staircase",
  "rule": "Never judge timber suitability from surface feel alone. Species density, cell structure, grade, drying, machining quality, and intended component all matter. Softwood correctly graded can be the right choice; hardwood poorly selected can still perform badly.",
  "reason": "Softwood tracheid structure is intrinsically less dense than hardwood vessel+fibre structure — the surface will always feel different, whether the timber is well processed or poorly processed. Roughness is a species characteristic first, a processing signal second."
}
```

### Why the surface feels different (structural reason)

**Softwood** (pine · spruce · fir · red deal) comes from conifers. The main cells are called **tracheids** — they transport water and support the tree. Simpler structure · lower density · fibres compress easier · surface can feel softer · end grain feels rougher.

**Hardwood** (oak · walnut · maple · beech) comes from broadleaf trees. Contains **vessels · fibres · rays** — more complex structure. Many hardwoods have higher density. Machined surface is smoother · harder feel · finer finish after sanding.

### Why end grain is especially rough (both woods)

End grain shows fibres cut across. Every fibre becomes a tiny open tube:

```
Side grain:      |||||||||||||||||     (fibres run along the length)

End grain:       ooooooo
                 ooooooo               (fibres cut across · open tubes)
                 ooooooo
```

End grain in any species absorbs moisture faster · feels rougher · crushes easier · takes more sanding. Pine shows it more because it's less dense — but it's not a defect in either species.

### When processing (not species) IS the reason for roughness

Pine can feel especially rough for reasons unrelated to being pine. NEX must be able to distinguish species behaviour from processing issues:

- **Fast growth** — wider growth rings · lower density · softer earlywood zones
- **Poor drying** — fibres can raise · surface feels fuzzy · movement increases
- **Blunt planer blades** — torn grain · fuzzy fibres · rough surfaces (this is a workshop failure, not a timber failure)
- **Resin pockets** — pine naturally contains resin · problems around knots · resin bleed · sticky areas · especially problematic under paint

### Species selection is a design decision, not a hierarchy

**Painted pine staircase** — the manufacturer chooses pine because it machines well · is stable enough · paint hides visual variation · cost fits the customer's budget.

**Clear-varnished oak staircase** — the customer expects a smooth touch · visible grain · premium appearance. Oak's density and structure suit the purpose.

Neither is *"better"*. Both are correct choices for their contexts. See Principle 2 (application-specific quality) — this principle is Principle 2 applied specifically to the density / surface question that customers most commonly misunderstand.

### The runtime line NEX should carry

When a customer says *"why does pine feel rougher than oak?"*:

> *"That's the two woods' natural structure showing — softwood cells are less dense than hardwood, so pine feels softer at the end grain and rougher when raw. It doesn't mean pine is lower quality. A painted pine staircase is a completely correct choice; a clear-varnished oak staircase is a completely correct choice; they just live in different contexts. The rougher pine you're feeling could also be from fast-grown timber, imperfect drying, or a blunt planer blade — those are the processing questions to ask if the roughness looks unusual."*

Composed judgement · reasoning visible · alternative honestly named · exactly the shape Principle 0003 requires.

---

## Principle 10 · Timber storage controls future stability

Covering timber outdoors is not the same as protecting it. A badly covered stack can become worse than an uncovered one because moisture gets trapped. The goal is not to isolate timber from the weather — it's to **control moisture movement**.

The core rule (recognisable from Principle 7 and Principle 8):

> **Timber does not fail because it moves. Timber fails when movement is uncontrolled — and uncontrolled movement often starts in the timber yard, before machining begins.**

### Structured form (for eventual Reference Brain module)

```json
{
  "principle": "timber_storage_controls_future_stability",
  "trade": "staircase",
  "rule": "Judge timber storage by whether it controls moisture movement, not by whether it is 'covered'. Sealed sides trap moisture and create worse outcomes than open airflow with a waterproof top.",
  "reason": "A staircase failure often begins in the yard, weeks or months before the timber reaches the machine. The stack's condition at receipt does not tell the whole story if the storage phase changed it.",
  "correct_pattern": [
    "waterproof top",
    "open sides for airflow",
    "raised off ground on bearers/pallets",
    "stickers between layers for air movement",
    "organised by species and thickness"
  ],
  "incorrect_pattern": [
    "wrapped completely in plastic (traps moisture · creates condensation)",
    "stored directly on concrete or soil (moisture wicks up)",
    "no stickers (air cannot circulate around each board)",
    "leaning vertically for long periods (uneven support · bowing)",
    "one face in sun · other in damp (differential drying · cupping)"
  ]
}
```

### The correct outdoor pattern (professional yard)

```
Waterproof roof / cover
          ↓
Air gap (do not seal against timber)
          ↓
Timber stack
============
Sticker gaps            ← small strips between layers · allows airflow around every board
============
Timber stack
          ↓
Raised supports (bearers/pallets)
          ↓
Dry ground
```

### Three rules that make the difference

**1 · Keep timber off the ground.** Never store expensive staircase timber directly on concrete or soil. Ground moisture wicks into board ends.

**2 · Allow airflow.** Use stickers between layers. This is the single most common mistake in poorly-managed yards.

**3 · Cover the top, not the sides.** Waterproof top · open sides. Wrapping in plastic traps moisture from the timber itself and creates condensation.

### Why this matters for staircase-grade timber

Oak · walnut · ash · handrail blanks · lamwood components are too valuable to store carelessly. Even a well-run yard is not a substitute for a controlled workshop environment for finished or prepared components.

**Failure mode example:**

```
Fresh oak delivery:  12% MC · looks perfect

Stored incorrectly (plastic-wrapped or ground-contact):
  Rain + trapped humidity + condensation
      ↓
After months:  18% MC · looks fine but is not stable

Machined into treads · installed into house:
      ↓
House heating → moisture leaves → boards cup / bow / open joints
```

The staircase failure looks like a manufacturing defect. The root cause was **yard storage months earlier**.

### The best-practice sequence a staircase workshop should run

```
Timber arrives
      ↓
Check moisture immediately (Principle 8)
      ↓
Store correctly (this principle)
      ↓
Allow acclimatisation indoors before machining
      ↓
Re-check moisture
      ↓
Machine
      ↓
Assemble
      ↓
Finish
```

### Yard vs shed vs climate-controlled room

- **Outdoor uncovered** — never for staircase-grade timber
- **Outdoor with waterproof top + open sides + stickers + raised** — acceptable for kiln-dried timber awaiting further processing
- **Enclosed timber shed (roof + open sides + racks)** — better · protects from weather and reduces daily humidity swings
- **Climate-controlled room** — best · required for premium components approaching machining

### How NEX applies this at runtime

For any Materials Memory / Stock item that has been in the yard beyond a threshold, NEX can flag a re-check before machining:

```
Storage condition risk

Material:       Oak handrail blank
Current MC:     10% (last checked 42 days ago)
Storage:        Outside covered yard
Risk:           Medium

Recommendation:
  Move indoors and re-check moisture before machining.
  Long premium sections are especially exposed.
```

Never blocks the work. Surfaces the risk · owner decides. Same discipline as everywhere.

---

## Principle 11 · Adhesive performance depends on environment

Cold weather can affect wood glue performance and staircase joints — especially during installation in workshops, garages, new builds, or unheated houses. **The glue itself is usually not the problem** — it's the combination of temperature, moisture, timber condition, and curing time.

The core rule (recognisable from Principles 3 · 7 · 8):

> **The glue is only as good as the timber, the joint, and the conditions around it.**

### Structured form (for eventual Reference Brain module)

```json
{
  "principle": "adhesive_performance_depends_on_environment",
  "trade": "staircase",
  "rule": "Judge glue behaviour by the environment it will cure in, not by the specification on the bottle. Cold air + high humidity + wet or cold timber = a glue joint that may look correct but will fail years later.",
  "reason": "PVA is water-based · needs water to evaporate + adhesive particles to bond. Cold slows cure, thickens the glue, and creates weak joints. D4 improves cured moisture resistance but does not change cold-application behaviour.",
  "recommended_minimum_workshop_temp_c": 5,
  "manufacturer_datasheet_note": "Actual minimum depends on the specific product · always verify."
}
```

### How cold affects PVA wood glue

Most staircase workshops use PVA (D3/D4). It is a water-based adhesive — needs the water to evaporate and the adhesive particles to bond together. In cold conditions:

- Glue becomes thicker
- Spreads less evenly
- Curing slows down
- Joints may not reach full strength quickly

A joint that cures properly in a warm workshop **may take much longer in a cold site**.

### Minimum temperature matters

Most PVA adhesives perform best when timber is warm · workshop temperature is stable · surfaces are dry. **Many manufacturers recommend avoiding application below around 5°C** — the exact limit depends on the specific glue product. A staircase fitted in a freezing new-build house can have problems if the installer is rushing.

### Cold + damp is the real enemy

Cold itself is usually not the biggest problem. The bigger problem is **cold air + high humidity + wet timber**. Example: a staircase manufactured at 10% MC · installed into a cold damp house (plaster still drying · concrete releasing moisture · no windows · no heating) → staircase absorbs moisture and moves.

### The joint failure modes cold enables

- **Open joints** — small gap develops between tread/riser · from timber movement · insufficient glue cure · poor fitting
- **Loose balusters** — if glue hasn't properly cured, spindle can move · handrail feels less solid
- **Squeaks** — movement between tread/riser · tread/string · newel joints
- **Weak glue lines** — especially critical in lamwood · glued handrails · laminated components where the manufacturer relies on the glue line for stability

### Can you glue cold timber?

Common workshop mistake: timber stored outside (e.g. 2°C) brought inside and immediately glued. **Timber may still be cold internally · glue may not behave correctly.** Professional workshops allow timber to acclimatise before machining and assembly.

### The D4 misconception

D4 is more moisture-resistant than D3 — **but D4 does not mean it can be applied in freezing conditions.** D4 improves water resistance AFTER curing. It does not remove the need for correct temperature and preparation.

### Best practice for staircase workshops

- **Timber:** kiln-dried · checked MC · stored correctly (Principle 10)
- **Environment:** stable temperature · controlled humidity · no wet timber
- **Assembly:** correct glue spread · correct joint fit · clamping where needed · **enough curing time before load**

### Winter installations

Winter installations are common. The building should ideally be weather-sealed · windows fitted · heating available · plaster reasonably dry · ventilation controlled. **A staircase should not be installed into a building that is still acting like a drying chamber** — see Installation Readiness Check roadmap.

### The runtime message NEX should carry

```
Staircase installation check

Temperature:      4°C ⚠
Humidity:         78% ⚠
Timber moisture:  11% ✓

Recommendation:   Delay final glue assembly until environment improves.
Reason:           Cold conditions may extend curing time and increase movement risk.
```

Never blocks the installer. Surfaces the risk · installer decides.

### Can cold cause a staircase to fail years later?

Usually not IF it was installed correctly. The biggest risk is when glue was applied too cold · joints were forced · timber was wet · staircase was loaded before curing. A properly made staircase has mechanical strength from its design — housed joints · wedges · dowels · fixings. **Glue supports the joint; it should not be the only thing holding the staircase together.**

---

## Why these eleven principles matter as a set

Alone, each principle is useful. Together they define **NEX's judgement about material value**:

- **Principle 1** stops NEX from being fooled by price alone.
- **Principle 2** stops NEX from being fooled by a simplistic material ranking.
- **Principle 3** stops NEX from being fooled by out-of-context stability claims.
- **Principle 4** stops NEX from being fooled by advantages presented without handling requirements — and by defects presented without context.
- **Principle 5** stops NEX from proposing a purchase when existing stock could serve the need — and stops it from proposing reuse without the qualifying checks.
- **Principle 6** stops NEX from treating all knots (and by extension all timber defects) as pass/fail — the trade craft is in the classification and placement decision, not the presence or absence of a mark.
- **Principle 7** stops NEX from calling normal timber movement a defect — and stops it from ignoring uncontrolled movement that IS a defect.

- **Principle 8** stops NEX from judging timber by a single moisture number without considering component size, species, environment, and how the reading was taken.
- **Principle 9** stops NEX from mistaking species characteristics (softwood vs hardwood feel and density) for quality verdicts — and stops it from silently accepting rough timber as "just pine" when the actual cause is a processing failure.
- **Principle 10** stops NEX from treating stored timber as neutral — storage is a live process that can improve or ruin what arrived from the mill.
- **Principle 11** stops NEX from judging glue by the specification on the bottle — cold + damp + wet or cold timber can silently ruin a joint that looked correct on installation day.

A generic AI reasoning about staircases will fail all eleven. An experienced staircase maker holds all eleven in their head simultaneously and applies them without thinking (through Principle 0003 · composition, never lookup). NEX must do the same — that's the difference between *"another AI chatbot"* and *"a governed system for producing the world's most trusted professional knowledge references"* (Prime Sentence · ADR-0040).

---

## Two future Reference Brain modules this evidence maps to

The eleven principles above map to **one** Reference Brain module: *wood_intelligence_principles* (trade rules). Material profiles map to a **second, separate** module: *material_profiles* (per-material data · lamwood is the first entry in [`material-profile-lamwood.md`](material-profile-lamwood.md) · one file per material as the profile shelf grows). Keeping rules and profiles as distinct modules means:

- Rules stay small, timeless, universally-quotable
- Profiles grow independently as more materials are documented
- Runtime composition can quote a rule and cite a profile together, keeping provenance clean

## Related principles worth authoring later

Adjacent concepts flagged for future capture:

- **Machining tolerance vs specification** — how much a stated dimension can vary in practice and still be within spec
- **Species-specific movement coefficients** — different hardwoods move differently under humidity change
- **Grain orientation for treads** — quarter-sawn vs flat-sawn and what it means for wear
- **Finish selection by traffic level** — hardwax oil vs lacquer vs varnish for domestic vs commercial staircases
- **Fixings by species** — some hardwoods require pre-drilled and specific fixings
- **Defect placement rules** — which timber characteristics are acceptable on hidden faces vs visible faces vs load paths
- **Solid vs engineered decision criteria per component** — when width availability forces engineered · when visual continuity favours solid

Additional material profiles worth capturing beyond lamwood:

- European Oak · American White Oak · Ash · Walnut · Sapele · Beech · Maple · Mahogany · Red Deal · Whitewood · Douglas Fir · Iroko · Accoya · MDF (standard + MR) · Birch Plywood · Oak-veneered MDF

Each will be captured as a separate profile block when Philip is ready to formalise it — same shape as the lamwood profile above.

## Governance note

Same as `purchasing-principles.md`:

- **Layer 1 (this document):** collected · not yet entered the Reference Brain
- **Layer 2:** enters `hammerex_nex_brain_drafts` when Philip drafts it through the platform's authoring UI
- **Layer 3:** enters `hammerex_nex_brain_versions` when reviewed and approved
- Runtime composition then serves these principles back to Specification Intelligence and Buying Intelligence workflows

All five principles are expert-authored (Rule B compliant) and traceable to a named expert (Rule C compliant). Ready for promotion to Layer 2 whenever Philip chooses. The per-material profiles (starting with lamwood) live in sibling files and will be promoted into a separate `material_profiles` Brain module — same governance, distinct concern.

## Related documents

- `data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/purchasing-principles.md` — the *compare_complete_material_packages* principle
- `docs/product-constitution/roadmap/nex-specification-intelligence.md` — the roadmap module that will consume these principles at runtime
- `docs/product-constitution/roadmap/nex-buying-intelligence.md` — the sister module that also consumes them
