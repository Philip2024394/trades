# Future Module Brief · NEX Specification Intelligence

**Status:** Roadmap · not scheduled
**Source:** Philip O'Farrell · 2026-07-28
**Depends on:** Materials v1 (frozen) · Hardwood Calculator (shipped) · Materials Library extended with per-component specifications · initial Staircase Reference Brain content
**Related:** [`nex-buying-intelligence.md`](nex-buying-intelligence.md) — same *package thinking* applied to supplier comparison

---

## The deeper NEX principle this module encodes

> **Price without specification is incomplete information.**

A professional tradesperson does not buy *"a staircase"*. They buy timber thickness, profile sizes, machining quality, strength, finish level, lifespan. Two staircases at wildly different prices can be different **specifications**, not different **values**.

A general AI can tell someone what a staircase is. NEX must know:

> *"That £4,000 staircase is cheaper because the treads are 22mm, the strings are 28mm, and the newels are smaller."*

That difference is the NEX competitive advantage in this domain.

## The owner's problem today

A customer or builder receives two staircase quotes:

| Component  | Supplier A         | Supplier B          |
|---|---|---|
| Price      | **£4,500**         | £5,200              |
| Treads     | 22mm               | 28mm                |
| Risers     | 12mm               | 18mm                |
| Strings    | 28mm               | 38mm                |
| Handrail   | 75 × 56mm          | 56 × 60mm           |
| Balusters  | 38mm               | 44mm                |
| Newels     | 75mm               | 90mm                |

A normal buyer sees: **"Supplier A is £700 cheaper."**

NEX must see: **"Supplier A specifies lower material throughout."**

The two quotes are not comparing like-for-like — but the customer often doesn't know that. This costs staircase manufacturers business every day.

## The NEX Comparison Engine

Instead of:

```
Price
 ↓
Winner
```

NEX evaluates the full picture:

```
Price
+
Material Thickness
+
Structural Strength
+
Visual Appearance
+
Expected Lifespan
+
Manufacturing Standard
```

## The Specification Difference card

```
⚠  Specification Difference Found

Supplier A is £700 cheaper.

However:
  Tread thickness:   22mm vs 28mm
  Riser thickness:   12mm vs 18mm
  String thickness:  28mm vs 38mm
  Newel size:        75mm vs 90mm

The lower price is mainly due to reduced material specification.

Would you like to compare like-for-like?
```

Same shape as the Buying Intelligence card — a warning, never a blocker. Owner remains in control.

## The customer-facing side (huge commercial value)

When a customer asks the manufacturer:

> *"Why is your staircase £800 more expensive?"*

NEX can generate the answer verbatim:

```
Your staircase is higher priced because:

✓ 28mm oak treads instead of 22mm
✓ 38mm strings instead of 28mm
✓ 90mm newel posts instead of 75mm
✓ Larger baluster profile

The quotation is not the same specification.
```

That single card protects the manufacturer from being compared unfairly — and captures orders that would otherwise be lost on a price-only comparison.

## Materials Library extension required

To make this module work, the Materials Library JSON must extend so each component can hold multiple specification levels — not just dimensions but **grade tiers**.

Sketch (see `data/materials/_schema.md` for the current shape · this is the direction it needs to grow):

```jsonc
// A stair tread library item with specification levels
{
  "slug": "stair-tread-oak",
  "component": "stair_tread",
  "material": "oak",
  "specifications": [
    { "thickness_mm": 22, "grade": "standard" },
    { "thickness_mm": 28, "grade": "premium" }
  ]
}

// A closed string with multiple thicknesses
{
  "slug": "closed-string-oak",
  "component": "closed_string",
  "dimensions_mm": [28, 32, 38]
}

// A handrail with multiple profiles
{
  "slug": "handrail-oak",
  "component": "handrail",
  "profiles": [
    { "cross_section_mm": [75, 56] },
    { "cross_section_mm": [56, 60] }
  ]
}

// Balusters with diameter tiers
{
  "slug": "baluster-oak-turned",
  "component": "baluster",
  "diameters_mm": [38, 41, 44]
}

// Newels with size tiers
{
  "slug": "newel-post-oak",
  "component": "newel_post",
  "sizes_mm": [75, 90, 120]
}
```

This is a Library extension — the file-based shape grows to hold specification tiers, not just dimensions. The Comparison Engine reads these tiers to explain price differences honestly.

## Architecture note

Specification Intelligence sits on:

- **Materials Library** — knows the specification tiers per component
- **Staircase Reference Brain** — knows which specifications are professionally significant and why (structural strength, visual appearance, lifespan, machining standard) — see the Wood Intelligence Principles evidence note
- **Materials Memory** — knows this company's own default specifications
- **Any incoming quote** — parsed either from a supplier document (via multimodal LLM · same pattern as delivery notes) or entered by the owner

The composition is what makes the answer trustworthy.

## Quality-gate stance

- **Q1 (feels like ops manager):** Passes — the card is exactly what a senior estimator would say when reviewing two quotes.
- **Q2 (NEX did the work first):** NEX must have parsed both quotes and computed all differences before the card renders — never make the owner do the maths.
- **Q7 (confidence > automation):** The comparison is a proposal. If NEX can't identify one of the specs from a quote, it says so — never invents a spec to complete the comparison.
- **Q8 (uncertain → ask):** If one quote uses ambiguous language (e.g. *"substantial newels"*), NEX asks one specific follow-up rather than assuming a size.
- **Q11 (workshop manager test):** Passes — a workshop manager reading two quotes always looks at spec first, price second. NEX just formalises that.
- **Q12 (traceability):** Every claim in the comparison card must link back to (a) where the spec came from in the quote, (b) which Library entry it's compared against, (c) which Reference Brain principle justifies calling it *"significant"*. No unsourced spec differences.

## Design constraints for the eventual build

- The word *"cheaper"* must never appear alone. Always paired with the specification context.
- The customer-facing card (for use by the manufacturer with their customer) has a distinct visual identity — clearer, less internal — so it's safe to forward or screenshot.
- Comparisons never assume higher-spec = better. That's a separate judgement, guided by the Wood Intelligence Principles (application-specific quality — see the evidence note).
- Parsing of incoming quotes uses the same intent + confirmation pattern as delivery notes. If a spec can't be extracted, ask the owner to fill in that one field — never guess.
- Rule B still applies: any statement of the form *"22mm treads are structurally lighter than 28mm"* must come from an authored Reference Brain module, not from the app.
