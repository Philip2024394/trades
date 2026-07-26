# UK Merchant Directory — Specification

**Data file:** `data/uk-merchant-directory.json`
**Version:** V1 (national + specialist layer)
**Purpose:** Turn NEX from an information tool into a trade operating assistant. User enters a postcode, NEX returns the nearest merchants that stock what the project needs.

## The problem this solves

A staircase project needs materials from **different suppliers**:
- Oak treads → hardwood specialist
- MDF risers → general builders merchant
- Screws + adhesive → fixings merchant
- Glass panels → balustrade specialist
- Stair components (handrail, newel, spindles) → stair-parts merchant

A homeowner or joiner does not know which merchant carries which category. NEX bridges the gap: `project spec → material list → nearest merchant per category`.

## Schema

Each merchant record:

```json
{
  "id": "merchant-XXX",
  "company": "Jewson",
  "type": "national | regional | independent | specialist",
  "primary_category": "general_builders_merchant | timber_merchant | sheet_materials | fixings | stair_specialist | stair_manufacturer | glass_balustrade | metal | joinery_specialist",
  "parent_group": "Grafton Group UK",
  "website": "jewson.co.uk",
  "branch_finder_url": "jewson.co.uk/branch-locator",
  "hq": { "address": null, "town": null, "postcode": null, "phone": null },
  "coverage": {
    "regions": ["UK-wide", "England", "Scotland", "Wales", "Northern Ireland", or specific counties],
    "approximate_branch_count": 500
  },
  "known_branches": [
    {
      "id": "branch-XXX",
      "branch_name": "...",
      "address": "...",
      "town": "...",
      "county": "...",
      "postcode": "...",
      "phone": "..."
    }
  ],
  "products": ["timber", "sheet_materials", "fixings", "plumbing", "insulation", "tools", "landscaping", "roofing"],
  "services": {
    "delivery": true,
    "click_and_collect": true,
    "trade_account": true,
    "cutting_service": null
  },
  "staircase_relevance": {
    "rating": 4,
    "categories": ["treads_supply", "risers_mdf", "fixings", "adhesive", "under_stair_plasterboard"],
    "notes": "General merchant carrying softwood, MDF, plywood, screws, adhesive — good baseline for staircase installation supplies. Not the first stop for premium hardwood treads."
  },
  "tags": ["NATIONAL", "GENERAL_MERCHANT", "TIMBER", "TRADE_ACCOUNT", "DELIVERY", "CLICK_COLLECT"],
  "verification_level": "listed | claimed | verified | partner",
  "data_quality": {
    "last_checked": "2026-07-27",
    "source": "philip_provided_and_claude_curated | well_known_uk_trade_name | trade_reference | category_placeholder | claude_curated",
    "data_completeness_score": 85,
    "missing_fields": ["phone", "detailed_branches"],
    "verification_notes": null,
    "confidence": "high | medium | low"
  }
}
```

**`verification_level`** — see `docs/brains/nex-business-listing-and-trust-architecture.md`. Default `listed` on directory import; progresses when business owner claims and NEX completes checks.

**`data_quality`** — completeness + confidence signals. Every record MUST carry this block per Phase 6 quality-first mandate.

- `last_checked` — ISO date the record was last reviewed
- `source` — provenance of the data (self-provided, well-known trade name, generic placeholder, curated)
- `data_completeness_score` — computed 0-100 from filled required + high-value optional fields
- `missing_fields` — array of field names still to populate
- `verification_notes` — free text (e.g. "multiple businesses trade under this name — verification needed per region")
- `confidence` — `high` for well-known specific brands, `medium` for regional named businesses, `low` for category placeholders

**Progress toward 250-quality target:** 142 / 250 (57%) as of Phase 6 batch 1. Records with `confidence: low` should be verified or removed before counting toward the 250 milestone.

## Categories

**`general_builders_merchant`** — Jewson · Travis Perkins · Huws Gray · Buildbase · MKM · Selco · Bradfords · Ridgeons · Robert Price · Parker BS · Covers · Lawsons · Supreme · ANT · London Builders Merchants · Builder Depot · TBM · C&S · Haldane Fisher · JP Corry · MacBlair
**`timber_merchant`** — Howarth · International Timber · Arnold Laver · Timbmet · James Jones & Sons · MGM · James Donaldson · Bury · Champion · Beesley & Fildes · Myers · Brooks Bros · Pontrilas · Lakeside · Staddons
**`sheet_materials`** — James Latham · Hanson Plywood · Robbins Timber
**`fixings`** — Screwfix · Toolstation · TIMCO
**`stair_specialist`** — Richard Burbidge · Cheshire Mouldings · StairBox · Yorkshire Timber (Halifax) · Trade Stair Parts (Halstead)
**`stair_manufacturer`** — Neville Lumb · Staircraft · Complete Stair Systems · The Stair Factory · Elite Staircases · Pear Stairs · TK Stairs
**`glass_balustrade`** — CRL (C.R. Laurence) · Q-railing · F H Brundle · Balustrade Components
**`metal`** — Aalco · Metal Supermarkets UK · Parker Steel
**`tool_hire`** — HSS Hire · Speedy Hire · Travis Perkins Tool Hire · National Tool Hire Shops · RSD Tool Hire
**`machinery_supplier`** — Record Power · Felder Group UK · Axminster Tools · SCM Group UK · Biesse UK · AXYZ · Multicam
**`software_vendor`** — Autodesk (AutoCAD / Fusion 360) · Dassault Systèmes (SolidWorks) · StairDesigner · Compass Software · Consultec (Staircon)
**`finishing_supplier`** — Osmo UK · Fiddes · Rubio Monocoat · Morrells · Bona · Sikkens
**`ironmongery`** — Ironmongery Direct · Prima Ironmongery · IronmongeryOnline
**`flooring_supplier`** — Havwoods · Ted Todd · Wood Floor Warehouse · UK Flooring Direct · Flooring Superstore · Direct Wood Flooring · Howdens · Carpetright · Abingdon · Crucial Trading · Junckers UK · Boen UK · The Wood Flooring Company
**`loft_ladder_supplier`** — FAKRO UK · Youngman · Werner · Telesteps · Bison · Electric Loft Ladder Co · Loft Shop · Ladders UK Direct · Ladderstore
**`loft_installer`** — The Loft Access Company · The Loft Ladder Man · Loft Centre · Castlewood · Advanced Loft Ladders · Easyreach · Loft Ladders Herts · Home Counties · Loft & Ladders (Essex) · Yorkshire Loft Ladders · Loft Ladders Scotland · Lofts & Ladders (Liverpool)
**`stair_manufacturer` (Phase 6 additions)** — Bisca · Jarrods · Stairplan · First Step Designs · Model Stairs · Canal Engineering · Signature Stairs · Diapason · Spiral UK
**`glass_balustrade` (Phase 6 additions)** — Firman Glass · Cantifix · IQ Glass · Prism Architectural
**`trade_association`** (verification-source category, new) — British Woodworking Federation · TrustMark · Federation of Master Builders · British Woodworking Association
**`finishing_contractor`** (outsource service, new) — placeholder for spray-finishing contractors that workshops send stair components to

## Staircase relevance rating

Every merchant carries a 1-5 rating for staircase-project usefulness:

| Rating | Meaning |
|---|---|
| 5 ★★★★★ | Primary specialist — go here first for staircase-specific stock |
| 4 ★★★★ | Strong general supply — carries most staircase installation basics |
| 3 ★★★ | Useful for specific categories only (e.g. fixings, tools) |
| 2 ★★ | Occasional relevance |
| 1 ★ | Rarely relevant to staircase work |

Rating is applied by NEX curators using the merchant's product spread against staircase project requirements. Not the merchant's overall quality — a great hardware store rates low for staircases because it does not stock hardwood or stair parts.

## How NEX uses the directory

### Postcode-nearest lookup
User enters postcode → NEX filters merchants covering that region → returns branch-level records sorted by distance.

*V1 note:* Distance sorting requires branch lat/long, which most known-branch records lack. V1 ships with company-level regional coverage; V2 adds full lat/long for all known branches.

### Project shopping list
User describes project → NEX creates a categorised material list → matches each category against the most-relevant merchant type in the user's region.

**Example** — user says "oak staircase in Leeds":
1. Oak treads → hardwood specialist near Leeds → Howarth Timber (Leeds branch)
2. MDF risers → general merchant → Jewson (Leeds branches)
3. Screws + adhesive → fixings → Screwfix or Toolstation (local branch)
4. Glass balustrade → glass specialist → CRL or Q-railing
5. Stair parts → stair specialist → Richard Burbidge / Cheshire Mouldings (online + local trade counters)
6. Finish → Osmo Polyx Oil or Fiddes hardwax oil (via any timber merchant carrying finishing lines)
7. Handrail brackets → Ironmongery Direct (next-day delivery)
8. Site tools (floor sander for tread refinishing, dust extractor) → HSS or Speedy Hire (local branch)

**Example — workshop setup** — user says "starting a small staircase workshop":
1. Small-tier machinery → Record Power · Axminster Tools
2. Larger-tier machinery → Felder Group UK · SCM · Biesse
3. Software → StairDesigner (calculations + drawings + CNC output for small workshop) or Compass / Staircon (industrial scale)
4. Finishing kit → Osmo / Fiddes / Rubio Monocoat / Morrells
5. Timber supply chain → Howarth / Arnold Laver / International Timber / regional independent depending on location

### Filter by service
User needs delivery / trade account / cutting service → filter merchants by services block.

### Group-aware
When a customer already has an account with Jewson, NEX prefers other Grafton Group brands (Buildbase, Selco variants) as fallbacks because trade account often works cross-brand.

## Not in V1

- Real-time stock availability (needs API integration per merchant)
- Live pricing
- Full branch lat/long (needs geocoding pass)
- Reviews and quality scoring
- Every independent regional merchant (V1 covers ~50; V2 target ~500; V3 target 5,000+)
- Currency / opening hours in structured form (need branch-level scraping or API access)

## Extension rules

- New merchants get next `merchant-XXX` ID.
- Regional/independent merchants added under `type: "regional"` or `type: "independent"`.
- When a merchant joins a group (acquisitions common in this sector), update `parent_group` — do not delete the record.
- `staircase_relevance` rating is reviewed when product mix changes; do not raise a rating without evidence the merchant stocks the material.
- Real branch phone numbers only when verified from the merchant's website — never scraped from third-party listings.
