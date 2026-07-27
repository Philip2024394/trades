# ADR-0023: Directory import rules & process for seed listings

Status: Accepted
Date: 2026-07-27

## Context

NEX needs a populated UK merchant directory on day one. Waiting for merchants to self-register would leave the platform empty for months. The path is to import publicly-available UK business information (name, address, phone, category, hours, rating, etc. as visible on Google Business Profile) as SEED LISTINGS.

Seed listings are not merchant accounts. They are public directory entries that let customers discover local businesses before those businesses have engaged with NEX. When a business owner claims their listing, the existing seed record is attached to their new merchant account — never replaced, never duplicated — so all URL history, reviews, and ranking flow through unchanged.

ADR-0022 already governs the imagery slice: never copy images from any third-party source. This ADR extends that policy into a complete import contract covering fields, status, reviews, claim flow, and geographic priority.

## Decision

### 1. What gets imported (text only)

For each business, store only the following fields when available. Never invent data. Empty fields stay empty.

- Business Name
- Category
- Address
- Town
- County
- Postcode
- Country
- Telephone
- Website
- Email (only if publicly listed by the business)
- Opening Hours
- Description
- Services
- Google Rating (numeric)
- Google Review Count (numeric)
- Google Maps URL
- Latitude
- Longitude

### 2. What is NEVER imported

- Images of any kind (see ADR-0022). Cover image = `null`, gallery = `[]`.
- Reviews (Philip supplies these separately as a distinct import step).
- Login credentials of any kind. Seed listings have no owner account.
- Verification status. All seed listings start unverified.
- Ratings authored by anything other than the source (Google). No NEX-generated stars.

### 3. Status contract for every seed listing

Every seed listing MUST start with all four flags set exactly:

- `status: listed`
- `claimed: false`
- `verified: false`
- `visibility: public`

These flags are enforced at insert time, not derived. A seed listing that fails any of these on creation is invalid and must not be written.

### 4. Capabilities gate

Until a seed listing is claimed, it does NOT receive:

- Merchant login
- Dashboard access
- NEX assistant (chat, drafts, analytics)
- Membership features
- Any write-back path for the listing owner

A public directory page renders (address, phone, website link, hours, Google rating). That is the entire surface until claim.

### 5. Review handling

Reviews are a separate import pipeline. Do not scrape.

When Philip supplies a review batch, each review is stored as:

- Reviewer Name
- Rating (1-5)
- Date (if available)
- Review Text (verbatim except for cosmetic formatting normalisation — no rewriting)
- Source (e.g. `google`, `nex_native`)
- Linked to the merchant listing by ID

Never alter review wording beyond removing obvious formatting artefacts (double whitespace, mojibake). Never summarise. Never truncate.

### 6. Claim process (never duplicate)

When a merchant later joins NEX and claims a seed listing:

- Attach the existing listing to the new merchant account (do not create a new record).
- Preserve all reviews.
- Preserve the listing URL / slug (SEO-critical).
- Preserve directory ranking signals.
- Preserve history and audit log.
- Flip `claimed: true`. `verified` stays `false` until earned separately.

Duplicate detection runs on postcode + business name similarity before any new merchant record is created. Match ⇒ claim path. No match ⇒ new merchant record.

### 7. Geographic priority — 20 metros first

Populate the directory in this metro-first order rather than sweeping every town. Density in a few areas beats sparse national coverage for perceived platform activity.

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

After these 20 are healthy, expand into surrounding towns and rural areas.

### 8. Processing model

Philip pastes one business at a time. For each:

1. Validate the supplied fields against the field list in §1.
2. Create the listing.
3. Return the listing ID.
4. Wait for the next business.

Do not batch unless Philip explicitly instructs.

### 9. Future media

Cover image, gallery, videos, product photos, team photos are all added AFTER the initial import — by the merchant (post-claim), by NEX itself with authorisation, or by an approved directory editor. They are never part of the seed import step.

## Consequences

**Positive:**
- Directory looks active from day one without incurring copyright risk (ADR-0022 preserved).
- The claim path is the growth engine: every empty gallery / missing image is a reason for a real merchant to claim, upload, and eventually subscribe.
- Zero moderation burden — no fabricated data means no takedown queue.
- Geographic phasing produces visible density fast in the metros that matter for launch marketing.
- Reviews stay authentic (never AI-summarised, never edited).

**Negative:**
- Slower to import than a batch scrape would be. Deliberate.
- Seed listings without images look sparser than competitor directories that scrape. Defended as a claim incentive.
- Requires Philip's manual paste per business — human bottleneck by design during the seed phase.

**Neutral:**
- Duplicate detection at claim time must be robust; a bug that creates duplicates instead of attaching to the seed loses the SEO / ranking / review history of the seed. This is a first-class quality requirement of the claim flow.

## Enforcement

- Insert path for seed listings must reject any record that does not have `status=listed`, `claimed=false`, `verified=false`, `visibility=public`.
- Insert path for seed listings must reject any record with a non-null image field.
- Review insert path must reject any record whose text field differs from the supplied source beyond formatting normalisation (validate by cheap heuristic; reviewed manually if edge cases).
- Merchant signup must run duplicate detection against seed listings before creating a new merchant record.
- Metro priority tracked as a manual queue; no automated scraper. Philip curates.

## Related

- ADR-0022 (Merchant images — no third-party copy) — governs the image slice of this policy.
- ADR-0007 (No editorial image rules) — governs merchant-uploaded imagery post-claim.
- ADR-0003 (Never sell leads) — seed listings are directory entries, not lead-gen assets.
