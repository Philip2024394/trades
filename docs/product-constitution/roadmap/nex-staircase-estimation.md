# Future Module Brief · NEX Staircase Estimation Intelligence

**Status:** Roadmap · not scheduled
**Source:** Philip O'Farrell · 2026-07-28
**Depends on:** Materials v1 (frozen) · Hardwood Calculator (shipped) · initial Staircase Reference Brain content · Materials Memory · Materials Library
**Category:** Customer-facing estimation + internal manufacturing estimation

---

## The principle this module encodes

Estimating a staircase is not just measuring wood. A good staircase company is estimating:

- The geometry
- The materials
- The manufacturing time
- The installation difficulty
- The risk of problems on site

A poor estimate can lose a company thousands because staircases are custom-made. **NEX must estimate like an experienced staircase manufacturer, not like a materials calculator.**

## How staircase companies estimate today (six stages)

### 1 · Initial information gathering

Collected: new build vs replacement · staircase shape (straight · winder · quarter turn · half turn · curved) · timber type · finish (painted vs natural) · closed vs open risers · handrail style · baluster design · customer budget.

### 2 · Site survey (the most important stage)

A surveyor visits the property and measures:

**Floor-to-floor height** — determines number of risers. Example: 2700mm ÷ 15 risers = 180mm rise per step.

**Available space** — staircase opening · hallway width · landing size · ceiling height · headroom. *A staircase must fit the building, not just look good on a drawing.*

**Existing structure** — walls · joists · openings · support points · flooring levels.

### 3 · Stair calculation

- **Rise** — height of each step (e.g. 180mm)
- **Going** — depth of each step (e.g. 250mm)
- **Stair angle** — affects comfort · appearance · space required

### 4 · Material estimate

Example for a 15-riser oak staircase:

- 15 treads · oak 28mm × 900mm
- 15 risers · oak 18mm
- 2 closed strings · 38mm × 3.6m
- Newel posts · handrail · baserail · balusters · spindles · caps · fittings

### 5 · Manufacturing cost

Workshop time estimate — e.g. CAD/design 3h · machining 8h · assembly 10h · finishing 12h.

### 6 · Installation estimate (often underestimated)

Distance travelled · access · number of floors · removal of old staircase · fitting complexity · finishing work.

## Who fits the staircase (three models)

**Model 1 · Staircase company installation team** (most common for higher-quality work) — one company measures, manufactures, delivers, installs. Advantages: one company responsible · installer knows the product · fewer fitting issues.

**Model 2 · Independent staircase installer** — the manufacturer supplies staircase only · the builder/customer hires a joiner or staircase fitter.

**Model 3 · Builder's carpenter** — on new houses, the main builder's carpenters install a supplied kit.

## The NEX estimate output shape

Instead of a bare *"Oak staircase: £8,000"*, NEX generates a structured breakdown:

```
Staircase Estimate

Geometry:
  Straight flight · 15 risers · 900mm width

Materials:
  European Oak · 28mm treads · 18mm risers · 38mm strings

Parts:
  2 newels · 28 balusters · 4.2m handrail

Manufacturing:
  ~42 hours

Installation:
  ~2 days

Risk factors:
  ✓ Tight access
  ✓ Existing flooring complete

Estimated price range:
  Lower — Upper (relative language · see below)
```

## Learning intelligence (the compounding value)

After enough staircase companies use it, NEX learns:

> *"A 900mm oak straight flight staircase with 28mm treads usually takes 2 installers 1.5–2 days."*

That becomes a **staircase estimating intelligence engine** — the difference between:

- Normal software: *"Calculate materials."*
- NEX: *"Estimate like an experienced staircase manufacturer."*

## Free vs paid estimates (business model NEX supports)

Estimating spans three commercial layers:

**1 · Free initial estimate (most common)** — rough price guidance from staircase type + approximate size + timber choice + photos. Company replies *"a similar staircase is likely to be around £X–£Y"* to help the customer decide whether to continue.

**2 · Free site survey (sometimes)** — many companies visit free if the customer looks like a serious buyer. Survey cost is built into the final staircase price.

**3 · Paid detailed design / drawings** — for complex staircases (sweeping · curved · architectural · unusual spaces), companies may charge for detailed drawings · CAD work · engineering checks · multiple revisions. Sometimes refunded if the customer orders.

## The NEX customer feature

```
Free NEX Staircase Estimate

You've shared:
  · Room photo
  · Rough measurements
  · Style choice

Preliminary Estimate

Type:
  Oak closed string staircase

Estimated range:
  (relative range · specific pricing subject to survey)

To confirm:
  Professional site survey required

Main price factors:
  ✓ Timber grade
  ✓ Stair width
  ✓ Handrail design
  ✓ Installation complexity

[Request site survey]  [Save for later]
```

The staircase company then receives a **better-qualified customer** — one who understands what a survey is for and roughly where the price will land.

## Two audiences

- **Owner-facing (workshop side)** — the internal estimator uses full detail, real prices from Materials Memory, real supplier data. Generates quotes.
- **Customer-facing (public side)** — preliminary estimate with relative language, honest caveats, always ends with *"a survey is required to confirm."*

Both share the same intent-parse + confirmation shape as every NEX workflow.

## Quality-gate stance (all 12 must pass)

- **Q1 (feels like ops manager):** Passes — the output reads like a senior estimator's summary sheet.
- **Q6 (owner understands what will change):** Every estimate ends with the risk factors AND the range · no hidden assumptions.
- **Q7 (confidence > automation):** Never publish a specific £ figure to a customer without a survey. Relative ranges only for public-facing content · full detail for internal owner-facing content.
- **Q11 (workshop manager test):** Passes — the six-stage estimating flow mirrors how real staircase companies actually work.
- **Q12 (traceability):** Every estimate carries provenance — which Materials Memory entries supplied the material prices · which Reference Brain principles justified the risk factors · which prior jobs informed the manufacturing time estimate.

## Design constraints

- Never publish specific £ figures in customer-facing content without a professional site survey. HARD LAW compliance (relative language only).
- Owner-facing internal estimates use real Materials Memory prices — that's private business data.
- Manufacturing-time estimates start from the trade rule of thumb, then improve over time from real prior-job data in the company's audit trail.
- Every estimate is a **proposal** — never a final quote. The workflow always ends with the owner reviewing and approving before it becomes a formal document.
- Site-survey requirement must be visible on every customer-facing estimate.

## Cross-references

- `wood-intelligence-principles.md` — all five trade rules apply to estimates
- `material-profile-lamwood.md` — dimensional data feeds material calculations
- `staircase-category-taxonomy.md` — the 5-level complexity classification (standard straight → architectural grand) that drives manufacturing-time estimates
- `docs/product-constitution/roadmap/nex-specification-intelligence.md` — comparison across estimates
- `docs/product-constitution/roadmap/nex-buying-intelligence.md` — the package-thinking rule applies to internal cost calculation
