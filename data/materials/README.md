# NEX Materials Library

**Shared reference catalogue of standard UK staircase manufacturing materials.**

Read-only, product-authored, git-versioned. Not a database. Not a company's Materials Memory. Not stock.

## The three layers this belongs to

| Layer | Where it lives | Who authors it | How often it changes |
|---|---|---|---|
| **Reference Brain** | `data/nex-reference-brains/` | Named experts (Rules A/B/C) | Rare · versioned releases |
| **Materials Library** *(this dir)* | `data/materials/` | NEX product team | Slow · git-versioned |
| **Materials Memory** | `nex_materials_memory` (DB) | Each company via NEX | Daily |
| **Stock** | `nex_materials_hardwood_*` (DB) | Each company via NEX + workshop | Hourly |

The Library sits between Reference Brain knowledge and per-company Memory. It's what NEX ships with — a curated set of materials any UK staircase manufacturer would recognise. Companies can import from it during onboarding (or later) but nothing enters their Memory automatically.

## Why file-based

- Library data changes very slowly — a new baluster profile lands maybe once a quarter, not once an hour.
- It isn't user data. It isn't stock. It isn't company-specific.
- It's essentially documentation NEX understands.
- **Git is a better home than a database** for that shape of information:
  - Every change is version-controlled.
  - Every update is reviewable via PR.
  - Every release is traceable.
  - Rollback is `git revert`.
  - Diffs are human-readable.
  - Ships with the product · no seed migration needed.

This is the same pattern the Reference Brain uses. Read-only knowledge = file-based. Transactional data = database. The rule is consistent.

## Directory structure

```
data/materials/
├── README.md              (this file)
├── _schema.md             (JSON schema documentation)
├── hardwood/
│   ├── oak.json
│   ├── ash.json
│   ├── walnut.json
│   └── ...
├── softwood/
│   ├── pine.json
│   └── ...
├── stair_parts/
│   ├── newels.json
│   ├── balusters.json
│   ├── handrails.json
│   └── ...
├── sheet_materials/
│   ├── mdf.json
│   ├── plywood.json
│   └── ...
├── flooring/
├── mouldings/
├── finishes/
└── consumables/
```

Each JSON file contains an array of Library items (see `_schema.md`). Files are grouped by category then organised however the product team finds clearest — usually by species (for hardwood/softwood) or by part-type (for stair_parts, sheet, etc.).

## Adding or editing an item

1. Edit the relevant JSON file in this directory. Follow the shape in `_schema.md`.
2. Open a PR — every change gets reviewed like any other product change.
3. On merge, the next deploy picks up the file automatically. No migration required.
4. Companies already using the platform don't get automatic changes to their Memory — the Library is a template for *future* imports.

## Consuming the Library

Server-side only:

```ts
import { listLibrary, getLibraryItem, importLibraryToMemory } from "@/apps/materials/_services/library";

const oakItems = await listLibrary({ category: "hardwood", species_id: "oak_european" });
const oakPar   = await getLibraryItem("european-oak-par");

// Onboarding: import selected slugs into this owner's Memory
const result = await importLibraryToMemory(ownerId, actorEmail, [
  "european-oak-par",
  "american-white-oak-par",
]);
// → { imported_count: 2, skipped_count: 0, ... }
```

The service loads all JSON files once at first use and caches them for the process lifetime. In dev, HMR reloads the process which invalidates the cache automatically. In production, a redeploy is the natural cache-buster.

## What NOT to put here

- ❌ Owner-specific overrides or defaults — that belongs in Materials Memory.
- ❌ Current stock or transactional records — that belongs in the Stock tables.
- ❌ Prices — the Library is dimensional / structural knowledge, not commercial.
- ❌ Staircase geometry rules or trade practices — that belongs in the Staircase Reference Brain (subject to Rules A/B/C).
- ❌ Supplier-specific product lines — the Library is generic; suppliers vary by company.

## Governance

- Any PR touching this directory must include a real reason ("standardising the balusters shortlist" beats "add stuff").
- Library entries are **not** trade knowledge in the Reference Brain sense — they don't require expert-authored provenance. They are product decisions ("what does NEX ship with").
- If a proposed entry starts to feel like it needs expert authorship (e.g. *"which species is best for treads"*), it belongs in the Staircase Reference Brain instead.
