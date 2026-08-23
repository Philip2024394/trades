# Global Staircase Sales & Specification Research

**Purpose:** foundational taxonomy for the NEX Staircase Sales & Specification System
(a highly knowledgeable digital staircase salesperson that captures customer wishes
into a structured specification for professional review — NOT an engineering system,
measurement tool, pricing engine, or building-regulation authority).

## Deliverables in this directory

| File | Contents |
| --- | --- |
| `staircase-taxonomy-master.md` | Layered narrative taxonomy · covers Layers A–L across all researched markets |
| `staircase-terminology-global.json` | Machine-readable terminology database with regional variants + confidence per entry |
| `staircase-decision-tree.json` | Conditional decision path (overall material → geometry → structural system → …) |
| `staircase-compatibility.json` | Combination compatibility rules (compatible · conditional · specialist-review · incompatible) |
| `staircase-regional-terminology.json` | Per-country lookup — UK · US · Canada · Australia · NZ · Ireland · Germany · Austria · Switzerland · Italy · France · Spain · Netherlands · Belgium · Sweden · Norway · Denmark · Finland |
| `staircase-sources.md` | Every source cited, grouped by country and category, with source-quality tier |
| `research-gaps.md` | Every UNKNOWN · NEEDS_REVIEW · weak-evidence item flagged with reason |

## Source hierarchy (highest to lowest weight)

1. Government / official building code (UK Approved Documents, US IBC/IRC, DIN, NCC, etc.)
2. Recognised standards organisations (BS · EN · ISO · ASTM)
3. Professional industry organisations (BWF, FMB, NAHB, RIBA, DGSF, etc.)
4. Established staircase manufacturers with technical publications
5. Architectural / construction reference publications
6. Specialist technical publications
7. General websites (only when higher-quality corroboration is unavailable; flagged)

## Confidence scale

- **`high`** — corroborated by multiple tier 1–4 sources
- **`medium`** — corroborated by tier 3–5 sources OR a single strong tier 1–2 source
- **`low`** — single source at tier 5+ · flagged in research-gaps.md
- **`unknown`** — searched but no defensible finding · flagged
- **`needs_review`** — genuine ambiguity between sources · flagged

## Research integrity rules

- Never invent a staircase type
- Never invent a regional term
- Never assume a translated term is technically equivalent
- Never merge two different concepts because they look similar
- When uncertain: `UNKNOWN` or `NEEDS_REVIEW` is preferable to fabrication

## Existing NEX baseline (used as input, not source-of-truth)

Prior UK-centric expert work in `data/nex-reference-brains/staircase-preparation/` is treated as **one input** to this global research — not as the authoritative baseline. The global taxonomy must survive independent international review.

Key priors:
- `staircase-category-taxonomy.md` (Philip O'Farrell, 2026-07-28) — 5-level UK complexity taxonomy
- `staircase-types.md` (layer-2-drafts) — Level 1–5 with kite winder / bullnose / curtail / helical / elliptical terminology
- Existing wood species canon: Oak · Ash · Walnut · Pine · Maple · Cherry · Mahogany · Knotty Pine

## Governance

- **Do NOT** start building the customer-facing wizard until this taxonomy is reviewed.
- Follow-up pipeline: `Taxonomy → Decision Engine → Customer Wizard → Visual Selection System → Specification → Company Review`.
- Research remains **living** — new regional terms discovered later must be added with source citation.
