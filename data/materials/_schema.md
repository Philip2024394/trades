# Materials Library · JSON Schema

Every file under `data/materials/**/*.json` contains an **array of Library items**. No wrapper object, no `_meta` field — just the array. Simpler to load, simpler to diff.

```json
[
  { …item 1… },
  { …item 2… }
]
```

## Item shape

```jsonc
{
  "slug": "european-oak-par",              // REQUIRED · globally-unique · lower-kebab-case
  "name": "European Oak PAR",              // REQUIRED · display name
  "category": "hardwood",                  // REQUIRED · see Category enum below
  "subcategory": null,                     // OPTIONAL · free-text refinement · e.g. "baluster", "newel", "plywood"
  "species_id": "oak_european",            // OPTIONAL · matches nex_materials_species.id when applicable
  "default_unit": "board",                 // REQUIRED · see Unit enum below
  "finish": "par",                         // OPTIONAL · "par" | "rough_sawn" | "planed" | "engineered" | "kiln_dried" | …
  "typical_grades": ["prime", "character"],// OPTIONAL · grade names an owner would expect
  "typical_applications": ["treads", "strings", "handrails"],
                                            // OPTIONAL · what this material is typically used for
  "synonyms": ["oak par", "european oak boards"],
                                            // OPTIONAL · alternative names owners might use
  "common_dimensions": {                    // REQUIRED · shape varies per category (see below)
    "thicknesses_mm": [20, 25, 32, 38, 50, 63, 75],
    "widths_mm":      [100, 125, 150, 175, 200, 225, 250, 300],
    "lengths_mm":     [1800, 2400, 3000, 3600, 4200]
  },
  "notes": null,                           // OPTIONAL · short guidance for onboarding
  "sort_order": 0                          // OPTIONAL · display order within category · default 0
}
```

## Category enum (REQUIRED)

| Value | Use for |
|---|---|
| `hardwood` | PAR boards in hardwood species (oak, ash, walnut, sapele, beech, maple, mahogany, …) |
| `softwood` | PAR boards in softwood species (pine, redwood, whitewood, hemlock, spruce, …) |
| `stair_part` | Manufactured components — newels, balusters, handrails, baserails, tread blanks, string blanks, riser blanks, kite winders, bullnose treads, curtail steps, plinth blocks, rosettes, cover caps |
| `sheet` | Sheet materials — MDF, MR MDF, plywood, veneered MDF, flexible MDF, hardboard, chipboard, OSB |
| `flooring` | Board flooring — oak flooring, pine flooring, engineered flooring |
| `moulding` | Profile mouldings — scotia, quadrant, ogee, chamfer, staff bead, skirting, architrave, dado, picture rail |
| `consumable` | Adhesives, sandpaper, screws, fixings, dowels, biscuits, filler |
| `hardware` | Fittings not applied as a coating — brackets, connectors, hangers |
| `finish` | Applied coatings — oils, hardwax, lacquer, varnish, stain, wax |
| `other` | Rare · use only when none of the above fit |

## Unit enum (REQUIRED)

| Value | Use for |
|---|---|
| `board` | Solid boards (PAR, tread blanks, string blanks) |
| `sheet` | Sheet material (MDF, plywood, T&G) |
| `length` | Lengths sold as-is (handrail blanks, mouldings) |
| `unit` | Single components (newel post, baluster, rosette) |
| `pack` | Sold in a bundled pack |
| `linear_metre` | Sold by the metre (some mouldings, rope) |
| `litre` | Liquids (oils, lacquers, stains) |
| `kg` | Bulk consumables (fillers, powders) |
| `each` | Fittings, fixings, screws — individually |

## `common_dimensions` shape per category

The `common_dimensions` field is deliberately flexible. Different categories describe dimensions differently.

**Hardwood / Softwood PAR boards**

```jsonc
{
  "thicknesses_mm": [20, 25, 32, 38, 50, 63, 75],
  "widths_mm":      [100, 125, 150, 175, 200, 225, 250, 300],
  "lengths_mm":     [1800, 2400, 3000, 3600, 4200]
}
```

**Balusters / Newels (section × length)**

```jsonc
{
  "sections_mm": [[32,32], [41,41], [50,50]],
  "lengths_mm":  [900, 1000, 1100]
}
```

**Handrails / Baserails (profile + section + length)**

```jsonc
{
  "profiles":     ["mopstick", "pigs_ear", "square", "traditional"],
  "sections_mm": [[54,54], [54,66], [70,70]],
  "lengths_mm":  [2400, 3000, 3600, 4200]
}
```

**Sheet material (thickness + sheet size)**

```jsonc
{
  "thicknesses_mm": [6, 9, 12, 15, 18, 22, 25],
  "sheet_size_mm":  [[2440, 1220]]
}
```

**Flooring (thickness × width × length)**

```jsonc
{
  "thicknesses_mm": [14, 15, 18, 20, 21],
  "widths_mm":      [90, 120, 150, 190, 220],
  "lengths_mm":     [1200, 1800, 2200, 2400]
}
```

**Consumables**

Usually just an empty object; the `default_unit` alone is enough:

```jsonc
{}
```

Special fields can be added freely (e.g. `tube_ml`, `coverage_m2`) — the type is open.

## Slug conventions

- Lower-kebab-case: `european-oak-par`, `50x50-stop-chamfer-baluster`, `mdf-mr-18mm`
- Unique across the entire Library (not per file)
- Stable — never rename after ship; if a rename is needed, deprecate the old slug and add a new one
- Owner-recognisable when possible (they may see it in provenance labels)

## Validation

The Library service performs light validation at load time:

- `slug`, `name`, `category`, `default_unit`, `common_dimensions` must be present
- `category` must be one of the enum values
- `default_unit` must be one of the enum values
- Duplicate slugs across files fail loudly

Unknown fields are ignored — safe to add product-specific metadata to individual items without breaking loading.

## Related

- `data/materials/README.md` — why this exists and how the three layers separate
- `src/apps/materials/_services/library.ts` — the loader and import service
- `src/apps/materials/_schema/library_types.ts` — TypeScript types
