# NEX Trade Centre · Kitchen Companies architecture (Philip 2026-08-04)

> **Directive (Philip 2026-08-04):** *"I would build the UK Trade Center by major metropolitan areas first. Rather than telling Claude to 'read every website', build the directory in phases: Create the company record (name, website, location). Extract structured facts into your schema. Verify the extracted data. Store only the structured information. Keep the website URL as the source reference. Do not invent or infer missing details."*

Codifies how Kitchen Companies (and every future trade directory) flow into
the NEX Trade Centre. This doctrine sits BELOW ADR-0023 (directory seed
rules) and OPERATIONALISES it — anything that contradicts ADR-0023 loses.

## The three-phase directory rule

Every directory listing walks the same three phases in strict order. Phases
never skip ahead — a Phase 1 stub becomes Phase 2 only after enrichment
runs, and Phase 3 only when a human confirms every field against the
official source.

- **Phase 1 · STUB.** Business name · category · primary_trade · town ·
  country ONLY. Every other field null (or `[]`). `enrichment_status: "stub"`,
  `verified: false`, `claimed: false`, `status: "listed"`. Written by
  `scripts/seed-kitchen-companies-directory.mjs`.
- **Phase 2 · PARTIAL.** Per-company enrichment from the official website.
  Extract only what's publicly published. Blank fields stay blank rather
  than being guessed. `enrichment_status: "partial"`, `last_verified_at`
  records the retrieval timestamp, `website` becomes the source URL.
- **Phase 3 · VERIFIED.** Every field on the record confirmed. Human review
  passes. `enrichment_status: "verified"`. Still `claimed: false` until the
  business itself claims the listing.

Verified never precedes partial. Partial never precedes stub. The pipeline
grows depth after breadth — cover the map first, then verify per-company.

## Trade Centre hierarchy (Philip's directive)

```
Trade Centre
├── Kitchen Companies
│   ├── London
│   ├── Manchester
│   ├── Birmingham
│   ├── Leeds
│   ├── Glasgow
│   ├── Edinburgh
│   ├── Bristol
│   ├── Liverpool
│   ├── Newcastle upon Tyne
│   ├── Sheffield
│   ├── Nottingham
│   ├── Leicester
│   ├── Southampton
│   ├── Cardiff
│   └── Belfast
├── Staircase Companies       (37 listings already populated)
├── Bathroom Companies
├── Bedroom Companies
├── Flooring Companies
├── Window Companies
└── Door Companies
```

Every trade slot uses the same seven-category subdivision:

1. **Premium Bespoke** — bespoke kitchen manufacturers · Tom Howley · Harvey
   Jones · Neptune · Kitchen Architecture · Diane Berry · PAD London
2. **Independent Designer** — independent local studios · The London Kitchen
   Company · Kitchen Design House · The Main Company
3. **German / European Specialist** — Kutchenhaus · Schmidt · Nolte · Häcker
   · Leicht · Pronorm · Keller · Kochwerk
4. **National Kitchen Brand** — Wren · Magnet · Symphony
5. **Trade Kitchen Supplier** — Howdens · Benchmarx · DIY Kitchens · Kitchen
   Doors London · Kitchen Warehouse
6. **Kitchen Fitter** — install-only businesses
7. **Used Kitchen Specialist** — Used Kitchen Exchange

Future categories to slot in when populated: Worktop Specialists · Appliance
Specialists · Door Replacement Specialists · Handles & Ironmongery · Lighting
Suppliers · Kitchen Accessories.

## Data storage · reuses the existing directory-seeds pipeline

Kitchen Companies live in the SAME pipeline as staircase companies (ADR-0023):

```
data/directory-seeds/
├── _index.json              (append-only registry)
├── _schema.json             (extended 2026-08-04 · adds primary_trade + tags + enrichment_status + last_verified_at + source: "philip_manual_seed")
└── <town-slug>/
    └── <listing-slug>.json  (one file per company)
```

The `primary_trade` field distinguishes trades within the same town folder.
Every kitchen record uses one of `kitchen_manufacturer` · `kitchen_designer`
· `kitchen_retailer` · `kitchen_supplier` · `kitchen_fitter`.

## Schema extensions (backwards-compatible · Philip 2026-08-04)

Added to `data/directory-seeds/_schema.json`:

- `primary_trade` (nullable string) · already present in practice on
  staircase listings but was missing from the schema · now formalised.
- `tags` (string array, default `[]`) · already present in practice · now
  formalised for cross-cut queries.
- `enrichment_status` (nullable enum: `stub` · `partial` · `verified` ·
  `null`) · NEW · tracks which phase the record is in.
- `last_verified_at` (nullable date-time) · NEW · when Phase 3 last passed.
- `source` was const `"google_business_manual_paste"` · now enum adding
  `"philip_manual_seed"` for stub-first records that never touched Google
  Business Profile.

Every existing 37-listing staircase directory validates unchanged.

## Never-invent rule (composes with ADR-0023)

Stub creation NEVER invents:

- Addresses · postcodes · phone numbers · emails · opening hours ·
  descriptions · services · brands · social handles · ratings · lat/lng ·
  Google Maps URLs · photos · cover images.

Every one of those fields is `null` (or `[]` for arrays) at stub time. If
enrichment cannot verify a field from the official website, the field stays
`null` — Phase 2/3 must move only fields that are provably true.

## Metro-first geographic rollout (composes with ADR-0023's metro priority)

Order dictated by Philip 2026-08-04:

1. London *(in progress · 18 companies seeded)*
2. Manchester *(37 companies seeded)*
3. Birmingham *(41 companies seeded)*
4. Leeds *(40 companies seeded)*
5. Plymouth *(next)*
6. Glasgow · Edinburgh · Bristol · Liverpool · Newcastle · Sheffield ·
   Nottingham · Leicester · Southampton · Cardiff · Belfast
7. Affluent counties: Surrey · Kent · Essex · Hertfordshire · Buckinghamshire
   · Berkshire · Cheshire · Oxfordshire · Hampshire · West Sussex

Metro-first because a directory that already covers 4 cities is more
useful than one that covers every trade thoroughly in one city.

## Company profile page contract

Every enriched company (Phase 2+) surfaces the same page shape:

- Company overview
- Services
- Products / Styles
- Areas covered
- Gallery *(only merchant-provided or merchant-authorised media · ADR-0022)*
- Reviews *(separate manual pipeline · never invented · ADR-0023)*
- Website (source-of-truth link)
- Contact details
- Social media (only if published)
- "Ask NEX about this company" chat integration
- `last_verified_at` timestamp shown to the user (Trust Metric)

## Files owned by this doctrine

- `data/directory-seeds/_schema.json` (schema · extended 2026-08-04)
- `data/directory-seeds/_index.json` (append-only registry)
- `data/directory-seeds/<town>/*.json` (137+ listings)
- `scripts/seed-kitchen-companies-directory.mjs` (Phase 1 stub creator)

## Related doctrines

- **ADR-0023** · directory import rules (parent · authoritative)
- **ADR-0022** · no third-party image copy on merchant import
- **Master Data Architecture v1** (memory) · Trade Centre namespace
  `nex_trade_*` · Trade Centre = World 3 (nex_tc_)
- **NEX Second Law** · Nex must not guess — clarify or leave blank
- **NEX Third Law** · truth · never present uncertainty as certainty
