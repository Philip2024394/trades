# Future Module Brief · NEX Buying Intelligence

**Status:** Roadmap · not scheduled
**Source:** Philip O'Farrell · 2026-07-28
**Depends on:** Materials v1 (frozen) · Hardwood Calculator (shipped) · Stock Intelligence (shipped) · initial Staircase Reference Brain content

---

## The difference this module captures

A normal software system thinks: *"find the cheapest individual item."*
An experienced staircase maker thinks: *"find the cheapest complete staircase package."*

That difference is a major NEX advantage. This module encodes the trade intelligence that comes from years of buying timber.

## The purchasing trap this prevents

A beginner buyer scans a price list:

| Item      | Price |
|---|---|
| Baluster  | £4.20 |
| Handrail  | £80   |
| Newel     | £90   |

They think: *"balusters are the big quantity, save money there."*

An experienced maker looks at the complete package.

```
Supplier A                       Supplier B
Balusters: £3.90 each  ← cheap    Balusters: £4.30 each
Handrail:  £95                    Handrail:  £70
Newels:    £120                   Newels:    £85

40 × £3.90 = £156                 40 × £4.30 = £172
Handrail   = £95                  Handrail   = £70
2 newels   = £240                 2 newels   = £170
─────────────────                 ─────────────────
Total      = £491                 Total      = £412
```

The *"cheaper baluster"* supplier was actually **£79 more expensive** for the complete staircase.

## The NEX purchase warning

Before an order goes out:

```
NEX Buying Check

You selected ABC Timber because:
  Balusters: £0.30 cheaper each

However:
  Handrail:  £18 more expensive
  Newels:    £42 more expensive

Complete staircase package: £76 higher.

Would you like to compare suppliers?

[Compare Suppliers]  [Order Anyway]  [Cancel]
```

That is a very experienced trade conversation, packaged in a single card the owner reads in ten seconds.

## The assembly concept

Instead of thinking in individual parts:

- Baluster
- Handrail
- Newel

NEX thinks in **staircase component packages**:

```
Oak Traditional Stair
├── 42 balusters
├── 1 handrail
├── 2 newels
├── baserail
├── caps
└── fittings
```

Then evaluates **Supplier Package Cost**, not individual part cost. Two effects:

1. Owner sees the real cost of an order at package granularity.
2. When comparing suppliers, NEX highlights the ones whose *package* is cheapest — not just the ones with the cheapest headline item.

## Message Centre re-engagement

If the owner hasn't reviewed Materials for a period, NEX quietly nudges — like an experienced workshop manager checking in, not spam:

```
Good morning.

I noticed you haven't reviewed your material dashboard for 14 days.

Would you like me to check:
  ✓ Low stock items
  ✓ Recent price changes
  ✓ Upcoming staircase requirements
  ✓ Supplier opportunities

[Review Materials]  [Remind Me Next Week]
```

Never more than one nudge per two weeks. Never during production hours by default (owner can override).

## The purchasing principle (candidate for Reference Brain)

This is captured as expert evidence in `data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/purchasing-principles.md` and will eventually enter the Staircase Reference Brain through the governed authoring workflow (Rule B — authored by named expert Philip O'Farrell):

```json
{
  "principle": "compare_complete_material_packages",
  "trade": "staircase",
  "rule": "Never optimise one component price without checking related components",
  "reason": "Suppliers may compensate pricing across quantities and product groups"
}
```

## Architecture note

Buying Intelligence sits on top of:

- **Materials Library** — knows what a staircase package normally contains
- **Materials Memory** — knows which suppliers this company uses and their agreed prices
- **Staircase Reference Brain** — knows the purchasing principles (like the one above)
- **Stock** — knows what's already available so orders don't over-buy

The composition is what makes it valuable — no single layer can do this alone.

## Quality-gate stance

- **Q1 (feels like ops manager):** Passes — the warning card is exactly what a senior buyer would say before signing off an order.
- **Q2:** NEX must have already done the package comparison before the warning appears — never make the owner do the maths.
- **Q7 (confidence > automation):** The warning is a proposal, never a blocker. Owner can always *"Order Anyway"*.
- **Q11 (workshop manager test):** Passes — a real senior buyer holds this conversation every time an order goes out.
- **Q12 (traceability):** Every warning must show which line items caused the difference, and every completed order carries provenance back to the supplier comparison NEX ran at approval time.

## Design constraints for the eventual build

- Never block a purchase. Warnings inform, they don't gate.
- Package definitions come from the Staircase Reference Brain (not hardcoded). If the Brain doesn't know how many balusters a "traditional oak stair" contains, the warning stays silent — don't invent numbers.
- Price comparisons must respect *"agreed supplier price"* from Materials Memory. If a supplier offers a lower published price but the company has a different agreed rate, use the agreed rate.
- Re-engagement nudges follow strict rate limits: no more than one every 14 days per surface, none during production hours by default.

---

## Extension · Best Time to Buy (seasonal timing intelligence)

*Added 2026-07-28 — Philip O'Farrell.*

Timing affects supplier workload · timber availability · installation slots · promotions · project planning. NEX eventually advises:

> *"Based on current demand and supplier capacity, this may be the best time to order."*

### Seasonal patterns for UK staircase manufacturing

| Period | Pattern | Buyer implication |
|---|---|---|
| **January – February** | Post-Christmas · fewer renovation projects start immediately · some workshops have spare capacity · some manufacturers want early-year orders | ✓ More flexible installation dates · ✓ Easier communication · ✓ Occasional scheduling promotions (rarely on timber itself — usually on labour/scheduling) |
| **March – June** | Spring demand surge · home improvements restart · extensions and renovations increase | Longer lead times · fewer installation choices · less discount pressure |
| **September – November** | Pre-Christmas rush for homeowners · but some workshops have quieter gaps before that rush | ✓ Better chance of finding installation slots · workshops may promote available capacity |
| **December / Christmas** | Complicated — some promotions for end-of-year strength or January deposits, but workshops close · suppliers reduce operations · installation before Christmas can be difficult | *"A cheap staircase is not useful if it cannot be installed when needed."* |

### The customer feature this becomes

```
NEX Staircase Buying Advice

You are planning installation in March.

Current market:
  Timber prices:     Stable
  Workshop demand:   High

Recommended action:
  Order 10–12 weeks before installation.

Benefits:
  ✓ More installer choice
  ✓ Better material planning
  ✓ Less deadline pressure
```

### The deeper principle

> **The cheapest time to buy is not always when the price is lowest.**

Best value usually comes from:

- Ordering before busy periods
- Comparing true specifications (see NEX Specification Intelligence brief)
- Allowing proper manufacturing time (see NEX Staircase Estimation brief)
- Choosing the right supplier (see Wood Intelligence Principle 2 · Country-alone-does-not-define-quality)

---

## Extension · Material Watch (timber market intelligence)

*Added 2026-07-28 — Philip O'Farrell.*

A staircase company isn't only buying wood — it's managing future material risk. NEX should surface material market conditions the same way a senior buyer scans the market:

```
Material Watch

European Oak Handrail

  Current price trend:  Increasing
  Reason:               Limited long clear lengths available
  Recommendation:       Review future projects requiring large handrails.
```

### What makes a "Material Watch" different from generic price tracking

- Not a stock ticker. NEX doesn't publish specific £ figures — it surfaces **direction + reason + recommendation** (relative language only per HARD LAW).
- Not species-only. NEX tracks by **specification** — species + grade + length + section — because "the most expensive timber is often the one with the right combination of size, quality, clarity, and stability", not simply the rarest species.
- Not universal. Every company's watchlist is derived from their Materials Memory — the materials this company actually uses.

### Why this matters (the trade principle)

Timber supply doesn't respond quickly to demand (trees take decades to grow). Premium grades — clear grain, long lengths, wide boards, low defects — are always more supply-constrained than commodity dimensions. Full trade principle captured in `data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/timber-market-principles.md`:

```json
{
  "principle": "timber_availability_depends_on_specification",
  "rule": "Timber supply should be evaluated by species, grade, dimensions and availability, not only by volume.",
  "example": "A shortage of premium long oak lengths can occur even when overall oak supply exists."
}
```

### Quality-gate stance for both extensions

- **Q1:** Passes — this is what a senior buyer already does mentally when they scan a supplier catalogue at 07:30 on Monday.
- **Q7 (confidence > automation):** Recommendations only — never triggers an order.
- **Q11 (workshop manager test):** Passes — captures the timing instincts an experienced buyer carries.
- **Q12 (traceability):** Every "trend" claim must cite its evidence source (Materials Memory price history · supplier notification · external market data). No unsourced trend claims.

### Design constraints

- Relative language only. Never publish specific £ figures to owner-facing content.
- Watch items derive from Materials Memory + real usage — nothing generic.
- Recommendations link to concrete next actions (review project X · consider alternative supplier Y · plan reorder before month Z) — never abstract "keep an eye on prices".
