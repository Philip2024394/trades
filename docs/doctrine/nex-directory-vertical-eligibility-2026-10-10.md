# NEX Directory · Per-vertical eligibility matrix · 2026-10-10

**Authored by** · verticals audit agent (C · wave V-2)
**Branch** · `nex/directory-work`
**Status** · Audit complete · each vertical's clearance decision is
founder-scoped · no DB mutation performed
**Builds on** · `docs/doctrine/nex-directory-vertical-clearance-paths-2026-10-10.md`
(verticals agent V · wave V-1); extends and corrects it with live DB
measurements from wave V-2

All findings in this document are sourced from live read-only probes
against `current_database() = nex_dev` (session asserted · zero writes).
Probe scripts:

- `scripts/nex-canonical/_ingestion-filter-probe.mjs`
- `scripts/nex-canonical/_vertical-audit-food.mjs`
- `scripts/nex-canonical/_vertical-audit-accommodation.mjs`
- `scripts/nex-canonical/_vertical-audit-service.mjs`
- `scripts/nex-canonical/_vertical-audit-mp-seller.mjs`
- `scripts/nex-canonical/_vertical-audit-transport.mjs`

## Executive summary

| Vertical | Legacy rows | Already linked | Remaining pool | Candidate eligibility (projectable) | Media | can_display | Clearance blocker |
|---|---:|---:|---:|---:|---|---|---|
| food | 22,757 | 22,631 | 126 | 126 (100 %) | 0 / 22,616 | **TRUE** | None · live. Backfill gap on 126 chain-franchise rows (see stop-reason doc). |
| accommodation | 9,230 | 0 | 9,230 | 9,230 (100 %) | 0 / 0 | FALSE | OSM ODbL attribution template + 24 "via_lab" provenance confirmation |
| service | 3,922 | 0 | 3,922 | 3,922 (100 %) | 0 / 0 | FALSE | OSM ODbL attribution template + health-sub-vertical regulatory review (2,409 health rows) |
| mp_seller | 23,580 | 0 | 23,580 | 23,580 (100 %) | 0 / 0 | FALSE | Mixed-provenance review: ODbL for 18,320 rows + provenance audit on 5,260 null-source rows + PDP consent review |
| transport | 107 | N/A | 107 | 105 (quarantines 2 "unknown") | 0 / 0 | FALSE | PDP per-row consent audit + migration to add `canonical_business_id` column (migration 169 skipped this table) |

Totals as of 2026-10-10: **59,596** legacy rows across five verticals.
**22,631** linked (37.97 %). **36,965** remaining in pools. **22,615**
visible in `business_directory_v` (food only, with
`lifecycle_state = VERIFIED`).

## Detail · per vertical

### Vertical 1 · Food

**Source adapter** · `source-legacy-food-business.ts`
**Entity type** · `food`
**Source ID** · `nex_food_business_legacy`

| Measure | Value |
|---|---|
| Legacy rows | 22,757 |
| Already linked | 22,631 (99.45 %) |
| Remaining pool | 126 (0.55 %) |
| Has name (whole table) | 22,757 (100 %) |
| Has coordinates | 22,757 (100 %) |
| Has address | 5,550 (24.4 %) |
| Has E.164 phone | 604 (2.7 %) |
| Has category | 22,757 (100 %) |
| Has website | 990 (4.4 %) |
| Near-duplicate rate (name + coord-3dp) | 1.95 % |
| Lifecycle (linked) | VERIFIED · 22,631 |
| Media coverage | 0 of 22,616 canonicals |
| **Candidate eligibility (projectable remaining)** | **126 / 126 (100 %)** |

**Source provenance:**

- osm_overpass · 21,954
- openstreetmap_overpass_v1 · 796
- osm_overpass_via_lab · 6
- osm_via_lab · 1

**Category-detail readiness** · READY. `CategoryDetails.kind = "food"`
carries `menu`, `cuisines`, `openingHours`, `dietary`. Projection source
is `business_canonical.services_products` jsonb, which is empty for all
22,616 current food canonicals · the UI falls back to the generic card.

**Clearance headline** · **Already clear.** `can_display = TRUE`;
`can_derive = TRUE`. Attribution_required is `FALSE` and
`attribution_template` is `NULL` — the registry row was flipped before
the OSM attribution policy wave (migration 182). Food publication is
LIVE in `business_directory_v`.

**Downstream impact if everything else landed** · All 22,631
`lifecycle_state = VERIFIED` canonicals are already publishable; the
126 remaining merged-but-unflagged legacy rows will NOT add any new
canonicals (they're chain franchises resolving to existing rows).
Expected net new publishable canonicals from fixing the handoff gap:
**0**. The gap matters for the ingestion loop halting cleanly, not for
publication count.

**Prerequisite work before any further ingestion** · patch
`canonical-handoff.ts` to backfill `canonical_business_id` on merged
rows (see
`docs/doctrine/nex-directory-ingestion-stop-reason-2026-10-10.md`).

**Attribution template proposal** · although attribution is not
currently required for the live `nex_food_business_legacy` source, a
future wave should align this with migrations 182 and the OSM ODbL
template already proposed for the other OSM-sourced verticals.

### Vertical 2 · Accommodation

**Source adapter** · `source-legacy-accommodation-business.ts`
**Entity type** · `accommodation`
**Source ID** · `nex_accommodation_business_legacy`

| Measure | Value |
|---|---|
| Legacy rows | 9,230 |
| Already linked | 0 (0.00 %) |
| Remaining pool | 9,230 (100 %) |
| Has name | 9,230 (100 %) |
| Has coordinates | 9,230 (100 %) |
| Has address | 2,828 (30.6 %) |
| Has E.164 phone | 384 (4.2 %) |
| Has category | 9,230 (100 %) |
| Has website | 946 (10.3 %) |
| Near-duplicate rate | 0.43 % |
| Lifecycle (linked) | none linked |
| Media coverage | 0 of 0 |
| **Candidate eligibility** | **9,230 / 9,230 (100 %)** |

**Source provenance:**

- osm_overpass · 9,206
- osm_overpass_via_lab · 24

**Category-detail readiness** · READY. `CategoryDetails.kind =
"accommodation"` carries `roomTypes` and 16-value sealed `facilities`
vocabulary.

**Clearance headline** · OSM ODbL. The 9,206 `osm_overpass` rows plus
24 `osm_overpass_via_lab` rows all originate from OpenStreetMap.
`can_display = FALSE` because:

1. `attribution_template IS NULL` on the registry row.
2. The 24 "via_lab" rows have not been provenance-audited (did the
   internal processing lab strip ODbL metadata? V-1 flagged this but it
   has not been resolved).

**What approval would unblock publication**

1. Founder approves the proposed OSM attribution template (shape
   suggested in V-1: `© OpenStreetMap contributors (ODbL) · source:
   {source_reference}` with link to
   `https://www.openstreetmap.org/{source_reference}`).
2. A migration (182-style, idempotent) seeds the
   `attribution_template` column and flips `can_display = TRUE` on
   `nex_accommodation_business_legacy`.
3. Legal reviewer signs off that the 24 "via_lab" rows are either
   provenance-clean or are quarantined pre-publication.

**Downstream impact if flipped** · Up to 9,230 accommodation canonicals
become eligible for `business_directory_v`. Actual visible count after
flip ≤ 9,230, bounded by:

- Canonical reaching `lifecycle_state ∈ {VERIFIED, CLAIMED,
  OWNER_CLAIMED, OWNER_VERIFIED}` (ingestion runner issues VERIFIED on
  write · same as food).
- Freshness band ∈ {FRESH, AGING}.
- Zero open conflicts.

Expected first-wave visible count: ≈ 9,100 (the 24 via_lab rows
quarantined pending audit).

**Prerequisite work before flip**

- [ ] Author migration 191-style (idempotent) seeding
      `attribution_template` on this source_registry row.
- [ ] Author migration (or script) that quarantines the 24 via_lab
      rows with a provenance marker (or confirms them clean).
- [ ] Run the accommodation ingestion wave (adapter already authored
      and tested; wrapper is `_ingest-accommodation.mjs`).
- [ ] Author Playwright coverage proving the accommodation detail page
      renders the attribution before `can_display = TRUE` ships.

### Vertical 3 · Service / Vehicle Rental

**Source adapter** · `source-legacy-service-business.ts`
**Entity type** · `service` (vehicle_rental not currently reachable)
**Source ID** · `nex_service_business_legacy`

| Measure | Value |
|---|---|
| Legacy rows | 3,922 |
| Already linked | 0 (0.00 %) |
| Remaining pool | 3,922 (100 %) |
| Has name | 3,922 (100 %) |
| Has coordinates | 3,922 (100 %) |
| Has address | 733 (18.7 %) |
| Has E.164 phone | 134 (3.4 %) |
| Has category | 3,922 (100 %) |
| Has website | 100 (2.5 %) |
| Near-duplicate rate | 0.66 % |
| Lifecycle (linked) | none linked |
| Media coverage | 0 of 0 |
| **Candidate eligibility** | **3,922 / 3,922 (100 %)** |

**Category_slug distribution** (sealed 6-value CHECK per migration 186):

| category_slug | n | Note |
|---|---:|---|
| pharmacies | 1,907 | **Health · regulatory review required** |
| salons | 615 | |
| car-repair | 606 | |
| dentists | 326 | **Health · regulatory review required** |
| gyms | 292 | |
| opticians | 176 | **Health · regulatory review required** |

Health subtotal: **2,409** (61.4 % of the vertical).

**Source provenance** · osm_overpass · 3,922 (100 %).

**Category-detail readiness** · PARTIAL. `CategoryDetails.kind =
"service"` is defined, but the adapter maps ALL six slugs to
`entity_type = service` — the UI will not differentiate pharmacies from
gyms unless the detail panel inspects `services_products` jsonb (empty
at ingest). The `vehicle_rental` branch is defined in the discriminator
but is not reachable from this adapter.

**Clearance headline** · OSM ODbL + Indonesian health regulatory
review. 100 % of rows are `osm_overpass`-sourced, so the ODbL
attribution template suffices for 1,513 non-health rows (salons,
car-repair, gyms). The 2,409 health rows carry an additional
jurisdictional requirement (SIP license verification for pharmacies,
STR for dentists, etc.) that OSM data does not provide.

**What approval would unblock publication**

**Scope-A (non-health · 1,513 rows):**

1. Founder approves the OSM attribution template (same shape as
   accommodation).
2. A migration seeds `attribution_template` and flips `can_display =
   TRUE` **with a per-row filter** that excludes category_slug IN
   ('pharmacies', 'dentists', 'opticians').

**Scope-B (health · 2,409 rows · later wave):**

1. Legal review of Indonesian consumer-protection posture for health
   directories.
2. Design per-row verification path (SIP / STR lookup against the
   Kemenkes registry, or require owner-claim before display).
3. Flip the per-row filter.

**Attribution template proposal** · Identical shape to accommodation.

**Downstream impact if Scope-A flipped** · Up to 1,513 non-health
service canonicals visible. Scope-B unlocks up to 2,409 more. Freshness
+ lifecycle gates apply.

**Prerequisite work before flip (Scope-A)**

- [ ] Migration 192-style seeding `attribution_template` and the
      exclusion filter.
- [ ] Run the service ingestion wave (wrapper
      `_ingest-service.mjs`).
- [ ] Playwright test proving attribution renders on service listing.

### Vertical 4 · Marketplace Seller

**Source adapter** · `source-legacy-mp-seller.ts`
**Entity type** · `marketplace_seller`
**Source ID** · `nex_mp_seller_legacy`

| Measure | Value |
|---|---|
| Legacy rows | 23,580 |
| Already linked | 0 (0.00 %) |
| Remaining pool | 23,580 (100 %) |
| Has name | 23,580 (100 %) |
| Has slug | 23,580 (100 %) |
| Has city | 23,580 (100 %) |
| Has jurisdiction | 23,580 (100 %) |
| Has bio | 2,395 (10.2 %) |
| Has contact_ref | 0 (0.00 %) |
| Jurisdiction ISO-2 parse OK | 23,580 (100 %) |
| Near-duplicate rate (name + jurisdiction) | **50.58 %** |
| Lifecycle (linked) | none linked |
| Media coverage | 0 of 0 |
| **Candidate eligibility** | **23,580 / 23,580 (100 %)** |

**Source provenance:**

- osm_overpass · 16,427 (69.7 %)
- (null) · 5,260 (22.3 %)
- nominatim · 1,893 (8.0 %)

**Category-detail readiness** · PARTIAL. `CategoryDetails.kind =
"marketplace_seller"` carries `productCategories` and `shippingScope`,
but neither field exists on the legacy table. They would need to be
populated via owner-claim / self-service workflow after ingestion. The
UI will fall back to the generic card until that happens.

**Near-duplicate rate 50.58 %** · roughly half the rows share a
(name_lowercased, jurisdiction) tuple with another row. The resolver
will heavily deduplicate: 23,580 legacy rows will likely produce
≈ 11,654 canonicals (the distinct-tuple count).

**Clearance headline** · THREE-mode provenance. The highest-risk mode
is the 5,260 null-source rows whose acquisition path is undocumented.

**What approval would unblock publication**

**Scope-A (OSM/Nominatim · 18,320 rows):**

1. OSM ODbL attribution template, same shape as accommodation. The
   Nominatim rows additionally require a one-line note to backend
   operators (Nominatim usage policy) but no display-side difference.
2. Migration seeds `attribution_template` and flips `can_display =
   TRUE` **with a per-row filter** excluding `source IS NULL` rows.

**Scope-B (null-source · 5,260 rows · later wave):**

1. **Provenance audit** — for each of the 5,260 null-source rows,
   determine acquisition path:
   - Owner self-sign-up at NEX (publishable with implicit consent).
   - Internal manual entry (publishable).
   - Scraped from a third-party site (requires fresh legal review).
2. Classify each row with a new provenance tag or quarantine.
3. Flip the per-row filter for cleared rows.

**Additional PDP guardrail (both scopes)** · marketplace sellers may
be natural persons. Indonesian UU 27/2022 (PDP) requires explicit
consent for publication of identifiable individuals. The sealed
owner-claim flow (O agent scope) should be the only path to publish
rows whose seller is a natural person.

**Attribution template proposal** · Per-row:

- `source IN ('osm_overpass', 'nominatim')` → OSM ODbL template.
- `source IS NULL` → no attribution if owner-provided; otherwise
  blocked (defer to Scope-B audit).

**Downstream impact if Scope-A flipped** · Up to 18,320 OSM/Nominatim
seller canonicals eligible (bounded by the ≈ 11,654 distinct-tuple
dedup ceiling). After the resolver and the ≈ 50 % merge rate, expected
≈ 9,000 visible canonicals. Scope-B unlocks up to 5,260 more pending
audit.

**Prerequisite work**

- [ ] Migration 193-style seeding `attribution_template` and the
      source-IS-NULL exclusion filter.
- [ ] Author provenance-audit tooling for the 5,260 null-source rows.
- [ ] Run the mp_seller ingestion wave (wrapper
      `_ingest-mp-seller.mjs`).
- [ ] PDP consent gate on owner-claim path for natural-person rows.

### Vertical 5 · Transport Acquisition

**Source adapter** · `source-legacy-transport.ts`
**Entity type** · `transport_operator` / `transport_driver` (routed by
`provider_kind`)
**Source ID** · `nex_transport_acquisition_legacy`

| Measure | Value |
|---|---|
| Legacy rows | 107 |
| **Has `canonical_business_id` FK column** | **NO · migration 169 skipped this table** |
| Already linked | N/A (no FK column) |
| Remaining pool | 107 |
| Has business_name | 107 (100 %) |
| Has contact_person_name (PII) | 0 (0 %) |
| Has E.164 phone | 7 (6.5 %) |
| Has jurisdiction | 107 (100 %) |
| Has city | 41 (38.3 %) |
| Has website | 6 (5.6 %) |
| Near-duplicate rate | 0.00 % |
| Lifecycle (transport canonicals) | none |
| Media coverage | 0 of 0 |
| Projectable (business_name AND provider_kind routable) | 105 |
| Quarantined provider_kind='unknown' | 2 |
| **Candidate eligibility** | **105 / 107 (98.1 %)** |

**Provider_kind distribution:**

- transport_business · 98 (routed to transport_operator)
- logistics_operator · 7 (routed to transport_operator)
- unknown · 2 (quarantined · adapter's `PROVIDER_KINDS_QUARANTINED`)

**Category-detail readiness** · PARTIAL. `CategoryDetails.kind =
"transport"` carries `serviceTypes`, `coverage`, `priceMethod`.
`provider_kind` would map to `serviceTypes` but the mapping is not yet
wired. Projection source `business_canonical.services_products` is
empty at ingest.

**Clearance headline** · Not OSM. These 107 rows were acquired directly
by NEX through acquisition workflows. The posture is **owner consent /
legitimate interest** (Indonesian PDP UU 27/2022) rather than ODbL.

**Important architectural note** · This table was NOT extended with
`canonical_business_id` in migration 169 (only food, accommodation,
service, mp_seller received the FK). Any ingestion wave for this
vertical would:

- Create business_canonical rows.
- Lack the back-reference to the legacy row (the handoff writer has no
  column to write to).
- Re-ingest the same 105 rows on every subsequent run (same stop-reason
  loop as food's 126 chain rows).

**What approval would unblock publication**

1. **Migration 191-equivalent** · add `canonical_business_id uuid NULL
   REFERENCES business_canonical(canonical_business_id)` to
   `nex.transport_acquisition_record` (consistent with how migration
   169 extended the other four tables).
2. **Per-row consent audit** · the acquisition pipeline obtained
   contact info · did the row-owner consent to **publication** (not
   just contact)? For every row with `canonical_phone_e164 IS NOT NULL`
   (7 rows), confirm consent-to-publish in writing.
3. **Attribution** · no third-party attribution owed (NEX-acquired
   directly). A "NEX-verified" badge is a product-side requirement,
   not a registry-level one.
4. **Scope decision** · publish all 105 routable rows, or publish only
   `provider_kind = 'transport_business'` (98 rows) and defer
   `logistics_operator` (7 rows) for a separate review?

**Attribution template proposal** · NULL (NEX-acquired · no
third-party attribution).

**Downstream impact if flipped** · Up to 105 canonicals (98
transport_operator + 7 transport_operator). The 2 unknown rows stay
quarantined regardless.

**Prerequisite work**

- [ ] Migration adds `canonical_business_id` column to
      `transport_acquisition_record`.
- [ ] Per-row consent audit (105 rows · small enough for manual
      review).
- [ ] Migration seeds `attribution_template = NULL` explicitly (or
      leave null and update `attribution_required = FALSE`) and flips
      `can_display = TRUE`.
- [ ] Run the transport ingestion wave (wrapper
      `_ingest-transport.mjs`).

## Clearance order recommendation (updated from V-1)

Based on V-2 audit findings:

1. **Food · handoff-writer patch** (not a clearance; a bug fix). Unblocks
   the ingestion loop halting cleanly on chain franchises. Zero new
   publishable canonicals. Lowest regulatory risk.
2. **Service (Scope-A · non-health, 1,513 rows)** · simplest ODbL
   template · smallest row count · simplest health carve-out.
3. **Accommodation (9,230 rows)** · same ODbL template · larger
   downstream unlock · requires one-off audit of the 24 "via_lab" rows.
4. **Transport (105 routable rows)** · small vertical · requires a
   migration to add `canonical_business_id` + per-row consent audit.
   Can proceed in parallel with Service and Accommodation if a legal
   reviewer is available.
5. **Marketplace Seller (Scope-A · OSM+Nominatim, 18,320 rows)** ·
   largest unlock · requires carve-out so null-source rows stay dark
   until audit.
6. **Service (Scope-B · health, 2,409 rows)** · separate wave with
   Indonesian health-ministry sign-off.
7. **Marketplace Seller (Scope-B · null-source, 5,260 rows)** ·
   separate wave with provenance audit.

Each clearance is a SINGLE SQL statement, scoped to one source_id:

```sql
UPDATE nex.source_registry
   SET can_display = TRUE,
       attribution_template = '<approved template string>'
 WHERE source_id = '<vertical source_id>';
```

That statement is **not** inside this agent's scope. This agent's
deliverables stop at: live DB audit, adapter projection diagnosis,
this matrix.

## Cross-vertical observations

- **Media coverage is 0 across all five verticals.** None of the
  canonicals (0 / 22,616 food · 0 of each other count) have a
  `business_media` row. The directory UI currently renders placeholder
  imagery per `project.ts`'s category-image-library mapping. Owner-claim
  will be the primary media-population path.

- **Essential field completeness is low across OSM-derived rows.**
  Address, phone, and website coverage are < 25 % in every OSM-sourced
  vertical. This is a well-known OSM data-quality trait. It is NOT a
  blocker for publication (the UI handles honest-null gracefully), but
  it DOES mean the first-wave listing experience will be sparse.

- **Near-duplicate rate correlates with vertical type.** mp_seller
  tops at 50.58 % (consistent with the slug-vs-name identity split in
  the legacy table). Food, accommodation, service, and transport sit
  below 2 %. The resolver's merge path is the structural answer.

- **lifecycle_state = VERIFIED on 100 % of linked rows.** No row is
  CLAIMED, OWNER_CLAIMED, OWNER_VERIFIED, SUSPENDED, or REJECTED.
  Owner-claim adoption will shift this distribution over time.

- **attribution_required = TRUE on all four pending verticals**
  (accommodation, service, mp_seller, transport); the lone exception
  is food (`attribution_required = FALSE`), set before the OSM
  attribution policy wave (migration 182). The food registry row is
  arguably inconsistent with current policy; a future wave should
  reconcile.

## Not covered by this audit

- Owner-claim flow (O agent scope · `src/lib/nex-native/directory/owner-claim/*`)
- Related-businesses tier logic (R agent scope ·
  `src/lib/nex-native/directory/related-businesses/*`)
- Cross-DB operator runbook (E agent scope)
- Harness defects (A agent scope)
- Journey proof suite (B agent scope)

This agent did not touch any of the above.
