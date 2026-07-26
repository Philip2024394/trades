# Staircase Quote Generation Engine — Specification

**Data file:** `data/staircase-quote-engine.json`
**Version:** V1
**Purpose:** Turn a design specification into an indicative price range with itemised breakdown. Bridge the gap between "customer sees a design" and "customer requests a real quote."

Marked ⭐⭐⭐⭐⭐ in Philip's priority list: **the module that turns NEX from a knowledge base into a business tool.**

---

## What it is (and what it is not)

**It is:** an estimator. Order-of-magnitude clarity for a customer who wants to know "am I in a £6k conversation or a £25k conversation" before they engage a supplier.

**It is not:** a firm quote. Every output must carry the disclaimer that a real quote requires a site survey, actual supplier pricing, and project-specific variables the engine cannot see.

The honest boundary matters: giving false-precision numbers destroys customer trust more than an honest range does.

---

## Input

The engine takes:

1. **`design_spec`** — the 9-dimension output from `data/staircase-design-recommendation-rules.json` (stair type + treads + risers + strings + handrail + balustrade + finish + lighting + under_stair)
2. **`region`** — user postcode or region name (for the regional multiplier)
3. **`stair_count`** — number of risers in the flight (default 13 for typical UK domestic 2.7m floor-to-floor)
4. **`priorities`** — optional (`speed_first`, `quality_first`, `budget_first`) — affects contingency and tier presentation

---

## Output

```
materials_breakdown:
  treads: { spec, unit_low_gbp, unit_high_gbp, quantity, subtotal_range }
  risers: { ... }
  strings: { ... }
  newels: { ... }
  handrail: { ... }
  balustrade_infill: { ... }
  hardware_fixings: { ... }
  finish: { ... }
  lighting: { ... }
  under_stair: { ... } (if included)

materials_total_range_gbp: [low, high]

labour_breakdown:
  workshop: { hours_range, rate, subtotal }
  install: { hours_range, rate, subtotal }
  surveyor: { fixed_or_hourly, subtotal }
  designer: { optional, subtotal }

labour_total_range_gbp: [low, high]

regional_multiplier: 1.15
contingency_range_gbp: [low, high]      // 10% low / 15% high
supplier_margin_range_gbp: [low, high]   // 25% low / 40% high

final_range_gbp: [low, high]
suggested_target_gbp: mid-point rounded to nearest £250

caveats: [list of assumptions and exclusions]
disclaimer: "..."

three_tier_presentation:
  budget_option:   { spec_modifications, price_range }
  default_option:  { spec, price_range }
  premium_option:  { spec_modifications, price_range }

suggested_next_step:
  find_local_suppliers: [supplier_list from merchant_directory filtered by region]
  survey_recommendation: "Request site survey from 2-3 verified suppliers to convert this estimate to a firm quote."
```

---

## Engine workflow

10 steps, in order:

1. **Take design_spec** from design recommendation engine or user input.
2. **Compute material list** from the spec: enumerate treads × stair_count, risers × stair_count, string per flight, newels × count, handrail × running metres, balustrade infill × count / metres.
3. **Look up each item** in `material_cost_bands_gbp`. Sum low totals and high totals separately.
4. **Add labour:** match `stair_type` to `labour_hours_by_stair_type`, multiply hour ranges by workshop + installer rates from `labour_rates_gbp`.
5. **Apply regional multiplier** based on user postcode → `regional_multipliers[region]`.
6. **Add finish + lighting + under_stair** costs from the corresponding bands.
7. **Add contingency:** 10% low, 15% high — covers unforeseen site work.
8. **Add supplier margin:** manufacturer gross typically 25% low, 40% high, on total materials + labour.
9. **Present three tiers** (default + one down + one up, per design engine convention) with itemised breakdown.
10. **Every output ends with** the disclaimer and a link to real-quote next steps.

---

## Regional multipliers

Materials are largely national — a Manchester and a Bristol customer pay similar hardwood prices. **Labour varies** significantly by region:

| Region | Multiplier |
|---|---|
| London + Home Counties | 1.30 |
| South East England | 1.15 |
| South West England | 1.05 |
| Midlands | 1.00 (baseline) |
| North West England | 0.95 |
| Yorkshire | 0.95 |
| North East England | 0.90 |
| Scotland Central Belt | 0.95 |
| Scotland Rural | 1.05 |
| Wales Urban | 0.90 |
| Wales Rural | 1.00 |
| Northern Ireland | 0.85 |

Rural multipliers can be higher than urban despite lower wages because of travel-to-site premium, delivery cost and installer scarcity.

---

## Budget tier ranges (UK 2026-2027 baseline)

Reflected in the design engine tiers and shown to the customer as target ranges:

- **Entry** — £2,500-£6,000 (pine + MDF + basic finish)
- **Mid** — £6,000-£12,000 (oak treads + painted string + oil finish)
- **Premium** — £12,000-£25,000 (white oak / walnut + glass + LED)
- **Luxury** — £25,000-£60,000 (curved / floating + rare timber + full lighting)
- **Bespoke luxury** — £60,000-£250,000 (top-of-market)

Customer sits somewhere in the range based on their design spec. Engine picks the tier automatically from the spec input.

---

## Customer presentation rules

**Non-negotiable:**

1. **Always a range** — never a single number
2. **Always three tiers** — customer sees budget / default / premium equivalents
3. **Always itemised** — materials / labour / contingency / margin visible separately
4. **Always the disclaimer** — this is an estimate not a quote
5. **Always a next step** — link to nearby suppliers from `data/uk-merchant-directory.json` filtered by region

Example customer output framing:

> Based on your design (modern minimal white-oak-and-glass straight staircase in Leeds), the indicative range for this project is **£8,200 to £15,900** with a mid-point around £12,000.
>
> That splits roughly as: materials £3,200-£5,100 · labour £2,400-£4,200 · contingency £560-£1,395 · supplier margin £2,050-£4,180.
>
> This is an estimate, not a quote. Real pricing depends on site access, specific supplier and material availability. To get a firm quote, request site surveys from 2-3 verified suppliers below.
>
> **Nearby suppliers matched to this design:**
> - Howarth Timber Leeds — oak treads and hardwood
> - Jewson Leeds — MDF risers and installation supplies
> - [Local stair manufacturer from directory]

---

## Integration with other NEX components

- **Consumes:** `data/staircase-design-recommendation-rules.json` for the input spec
- **Consumes:** `data/uk-merchant-directory.json` for the "nearby suppliers" section (filter by region and staircase_relevance rating)
- **Consumes:** `data/staircase-country-packs/*.json` for regional context (currency, terminology, regs framing)
- **Feeds:** future customer-request workflow — customer chooses a tier + suppliers, engine creates the enquiry package

---

## Confidence and limits

Per the answer-engine confidence model, quote engine outputs are **Level 2 confidence** (verified rule set applied to a consistent price database, but not verified against a specific supplier).

- **Certain** — the ranges are wide enough to cover most real quotes
- **Uncertain** — the *specific number* within the range depends on unpriceable variables (which supplier, on what week, with what regional supply of oak)

Anytime the engine has to estimate outside its rule set (unusual stair geometry, exotic material, unusual property access), it should **flag "outside V1 scope — contact a supplier directly"** rather than fabricate a number.

---

## Not in V1

- Live supplier pricing feeds (needs API integrations per supplier)
- Regional-specific supplier price variations beyond the multiplier
- Country-specific currency (USD, AUD, EUR) — needs country packs to feed
- VAT / business-status pricing (B2B vs B2C)
- Delivery + access surcharges (attic conversions, no-parking sites)
- Historic-staircase restoration (specialist market with different pricing)
- Commercial project pricing (different labour rates + different scope)
- Time-of-year variation (some suppliers busier in Q4 = higher lead time premium)
