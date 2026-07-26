# Staircase Design Recommendation Engine — Specification

**Data file:** `data/staircase-design-recommendation-rules.json`
**Version:** V1

## Purpose

Turn customer inputs into a concrete staircase design specification with reasoning — not a stock photo, a real material-and-construction spec the workshop can quote from.

Enforces the **never recommend a staircase without understanding the home** rule from the knowledge architecture doc.

---

## Input dimensions

The engine takes four inputs:

1. **`house_style`** — one of `modern_minimal | farmhouse | victorian_period | industrial | luxury_contemporary | classic_period`
2. **`budget_tier`** — one of `entry | mid | premium | luxury`
3. **`space_context`** — one of `small_hallway | large_entrance | narrow_staircase | dark_hallway | standard`
4. **`priorities`** — array from `aesthetic_first | budget_first | practicality_first | safety_first | future_proofing | quick_upgrade_path`

**Optional context:**
- `children_in_home: boolean` — activates child-safety rules (100mm sphere, avoid horizontal rails)
- `existing_stair: object` — if refurbishing rather than replacing, pass existing details

---

## Output specification

The engine returns a design object with 9 dimensions:

```
stair_type          - straight | quarter_turn | half_turn | floating | cantilevered | curved | spine_stringer
treads              - specific material + thickness recommendation
risers              - material + finish
strings             - construction + finish
handrail            - profile + material
balustrade          - system + spec
finish              - lacquer / oil / paint spec
lighting            - LED / wall / feature recommendation
under_stair         - open / storage / office / wine / etc.
```

Plus:
- **`reasoning`** — why this spec fits
- **`budget_indication`** — indicative price range
- **`avoid[]`** — style-inappropriate choices (never mix modern minimal with turned spindles, etc.)

---

## Engine workflow

Nine steps, in order:

1. Capture inputs from user.
2. Look up `recommendations_by_style[house_style].default_spec` for base spec.
3. Apply `budget_variants[budget_tier]` modifications:
   - `swap` — replace specific fields
   - `keep` — use default_spec unchanged
   - `add` — additional recommendations
   - `note` — advisory message (e.g. "luxury contemporary at entry budget is a style mismatch")
4. Apply `space_variants[space_context]` modifications.
5. Filter `balustrade_selection_rules[]` by matching `when` conditions — take the highest-priority match.
6. Filter `under_stair_selection_rules[]` by matching `when` conditions.
7. Cross-check final spec against the style's `avoid[]` list — flag any conflict.
8. Assemble final specification with reasoning and budget indication.
9. **Present 2-3 variants** (default + one budget tier down + one up) so customer sees range not one answer.

---

## Style-to-material personality mapping

The `material_personality_matrix` codifies what each material *reads as* — critical for the customer emotion translation the knowledge architecture doc requires.

**Example:** customer says "I want it to feel expensive and warm."
- Translation: premium timber + warm palette + integrated lighting
- Match: American Walnut or smoked oak + Osmo hardwax oil + under-tread LED
- Match style: `luxury_contemporary` or `classic_period` depending on other signals

**Example:** customer says "I want it to feel modern and open."
- Translation: light timber + glass + no visible clutter
- Match: American White Oak + frameless glass balustrade + open under-stair
- Match style: `modern_minimal`

---

## The `avoid` list — style guardrails

Every style carries an `avoid[]` array. These are combinations that are *technically possible* but *stylistically wrong*.

**Example:**
- `modern_minimal.avoid`: turned spindles, carpet runner, yellow-tone oak stain, high-gloss lacquer, brass fittings
- `farmhouse.avoid`: glass balustrade, floating stair, chrome or stainless hardware, shadow-gap details, matt-black finishes
- `victorian_period.avoid`: glass balustrade, floating stair, square modern handrails, shadow-gap detail, cool grey paint

Guardrails protect against the "customer saw a modern staircase on Pinterest and wants it in their Victorian terrace" problem — a real support burden every staircase company deals with.

---

## Rule format

Balustrade and under-stair recommendations use pattern-matching rules:

```json
{
  "when": { "style": "modern_minimal", "budget": "entry" },
  "recommend": "square black metal balusters at 99mm centres",
  "reasoning": "Achieves modern look at accessible price.",
  "safety_note": true          // optional
}
```

Rules are evaluated in order; safety-tagged rules always win when the trigger conditions match (e.g. child-safety spindle rule overrides aesthetic-driven horizontal rail recommendation when `children_in_home: true`).

---

## Present 2-3 variants, not one answer

Non-negotiable engine behaviour: the output is always a shortlist, not a single recommendation. This is the same principle that guides the budget intelligence rule in the knowledge architecture doc — *offer three routes and let the customer pick*.

Typical presentation:
1. **Default recommendation** — what fits the inputs exactly
2. **One tier down** — what changes if budget is tighter
3. **One tier up** — what changes if budget is stretched

Customer sees the spec, the price implication, and the reasoning for each. They pick — the engine advises.

---

## Cross-references

- Consumes: `knowledge/staircase.json` for detailed reasoning behind each recommendation.
- Consumes: `data/uk-merchant-directory.json` for supplier-side matching when the customer is ready to source.
- Feeds: (future) design visualisation renderer that turns the spec into an image.
- Feeds: (future) quote generator that maps the spec + regional labour rate to a price range.

---

## Not in V1

- **Multi-style hybrid** (modern-farmhouse crossover) — needs more nuanced rules
- **Regional variants** — handled by country packs, not this engine
- **Curved-stair geometry** — needs stair-calculation engine integration
- **Real-time cost calculation** — needs regional pricing data
- **Rendered visualisation** — needs image generation integration
- **Save + iterate** — customer selects, engine refines from selection (needs conversation state)
