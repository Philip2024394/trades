# NEX Directory — Seed Listings

File-based staging for the NEX merchant directory, per ADR-0023.

## What lives here

Every file is one public seed listing imported from publicly-available UK
business information (Google Business Profile text). These are **not**
merchant accounts — no login, no dashboard, no NEX Assistant. They become
merchant accounts only when the business owner claims the listing.

## Layout

```
data/directory-seeds/
├── README.md                (this file)
├── _index.json              (append-only registry — id → filepath, for duplicate detection)
├── _schema.json             (JSON Schema for the listing shape)
└── <town-slug>/
    └── <listing-slug>.json  (one file per listing)
```

`<town-slug>` is `kebab-case(town.trim())`. `<listing-slug>` is
`kebab-case(business_name) + "-" + kebab-case(town)` for uniqueness and
SEO. Example: `data/directory-seeds/leeds/oakco-timber-leeds.json`.

## Contract (per ADR-0023)

Every seed listing MUST contain and validate:

- `id`: UUID v4 generated at insert time
- `slug`: the derived unique slug (matches the filename stem)
- `status: "listed"`
- `claimed: false`
- `verified: false`
- `visibility: "public"`
- `photos: []` and `cover_image: null` (per ADR-0022 — no third-party imagery)
- `source: "google_business_manual_paste"`
- `imported_at`: ISO8601 timestamp

Any listing that fails these invariants is invalid and must not be
written.

## Field list (all optional; empty stays empty — never invent data)

- `business_name`
- `category`
- `address_line_1`, `address_line_2`
- `town`, `county`, `postcode`, `country`
- `telephone`
- `website`
- `email` (only if publicly listed by the business)
- `opening_hours` (structured or free text as supplied)
- `description`
- `services` (string[])
- `google_rating` (numeric)
- `google_review_count` (integer)
- `google_maps_url`
- `latitude`, `longitude`

## Reviews

Reviews are a **separate** pipeline. Stored as sibling files under
`data/directory-seed-reviews/<listing-slug>.json` when Philip supplies
them. Never scraped. Verbatim text preserved (only cosmetic formatting
normalisation allowed).

## Promotion path

When the directory has meaningful density (target: post-metro-1 London
build), a one-shot migration + loader script reads every JSON file here
and inserts it into `os_business_listings` in Supabase with the new
directory columns added by a preceding migration. IDs are preserved so
downstream SEO / URLs / analytics carry through unchanged.

## Metro build priority (ADR-0023 §7)

1. Greater London
2. Birmingham / West Midlands
3. Manchester
4. Leeds
5. Sheffield
6. Liverpool
7. Bristol
8. Nottingham
9. Leicester
10. Newcastle
11. Cardiff
12. Glasgow
13. Edinburgh
14. Southampton / Portsmouth
15. Cambridge
16. Oxford
17. Reading
18. Brighton
19. Norwich
20. Belfast

Then expand to surrounding towns.
