# NEX Design Editorial Framework v1

**Status:** Scaffold · awaits Philip's editorial pass.
**Purpose:** Give every confirmed staircase design a clear place in the ranking system so Nex behaves like a staircase designer, not a database search.

---

## The ranking mechanism is already live

Every `ConfirmedImage` record supports two editorial controls:

- **`priority: "flagship" | "recommended" | "standard" | "specialist"`** — tier-based
- **`ranking_weight: 0-100`** — numeric override for fine-grained control

Composite ranking = `raw_match_score + priority_weight + freshness_bonus`. Confidence stays match-only (honest fit metric shown to customers).

Priority weights:

| Tier | Weight | Meaning |
|---|---|---|
| `flagship` | +20 | Signature Nex designs · shown first when eligible |
| `recommended` | +10 | Strong practical solutions · common homeowner requirements |
| `standard` | 0 | Default · new confirmations land here |
| `specialist` | -10 | Niche · experimental · rarely requested |

---

## Editorial pass · what needs to happen

The mechanism exists. **Curation is content work, not code.** For the current 24 designs, the editorial pass involves:

### Flagship tier (target: 5-15 designs)
Choose designs that represent:
- Nex's signature style
- Premium craftsmanship
- Strong visual identity
- Designs customers should see first

Suggested flagship categories (each family should have at least one):
- Contemporary glass + oak
- Luxury floating staircase
- Traditional cut-string oak
- Steel + timber statement staircase
- Minimalist mono-string staircase
- Curved sweeping staircase
- Illuminated feature staircase

### Recommended tier
Strong practical solutions · common homeowner requirements:
- Straight-flight oak staircase
- L-shaped staircase
- Painted staircase with oak handrail
- Carpet-runner staircase

### Standard tier
Everything not explicitly promoted.

### Specialist tier
Niche or experimental designs that shouldn't dilute mainstream results.

---

## Naming conventions (proposed)

Design titles should follow a consistent shape for editorial clarity:

`[Family/Style] · [Distinctive Material] · [Distinctive Feature]`

Examples from the current library:
- `Ultra-Luxury · Grand Sweeping Curved Staircase · Walnut · Frameless Glass · Cylindrical Timber Newel`
- `Modern Scandinavian · Light Oak · Black Perforated Steel Panels · Illuminated Newel · Shaker Under-Stair Panelling`

Avoid auto-synthesized fragments like `Industrial · walnut · slim black steel posts horizon` (truncation artefact from migration).

---

## Metadata for future ranking sophistication (candidates · not yet fields)

If ranking needs more nuance later, consider adding:

- `design_tags: string[]` — free-form retrieval hooks (`"open-riser", "cantilever", "double-height", "led-newel"`)
- `style_families: string[]` — cross-brain style vocabulary (`"scandinavian", "victorian", "biophilic-modern"`)
- `material_tags: string[]` — machine-readable material fingerprints (`"walnut-hero", "quartz-worktop", "brushed-steel-riser"`)
- `customer_intent_mapping: string[]` — links to Router intent labels (`"design-inspiration", "renovation-example", "installation-reference"`)

These are **candidates**, not authorized fields. Add only when a specific ranking failure demonstrates the need (per ADR-0041 · author-driven principle).

---

## Editorial workflow

To promote a design:

```
POST /api/admin/nex/images/confirm
{
  "url": "...",
  "design_id": "NEX-DESIGN-000009",
  "priority": "flagship",
  ...remaining fields unchanged...
}
```

Or numeric weight:

```
{ "url": "...", "ranking_weight": 50, ...  }
```

The endpoint upserts by URL · re-posting only updates the changed fields effectively.

---

## What this framework achieves

Once the editorial pass is done, a query like *"I want a modern staircase with glass"* returns:

1. **Flagship** contemporary glass design (highest priority, matching attributes)
2. **Recommended** alternative modern glass options
3. **Standard** other matches

Instead of `24 designs all scored 0.11 · library-order determines winner`.

This is the point where Nex starts behaving like a staircase designer.
