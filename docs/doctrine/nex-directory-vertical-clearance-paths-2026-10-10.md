# NEX Directory · Vertical clearance paths · 2026-10-10

**Authored by** · verticals agent (V)
**Branch** · `nex/directory-work`
**Status** · Actionable runbook · awaiting founder / legal review per vertical

## Purpose

Food is the only vertical today where `nex.source_registry.can_display = TRUE`
(seeded by migration 179). The other four verticals have had their source
adapters authored, tested, and have passed through migrations 185–188 which
seed each vertical's `source_registry` row with `can_display = FALSE`.

This document is the checklist a reviewer needs to flip
`can_display = TRUE` for each remaining vertical. It is written per
vertical so each can clear independently.

## Common policy ceiling (migration 166 defaults)

Every vertical's `source_registry` row carries:

| Flag | Default from mig 166 | Meaning |
|---|---|---|
| `can_collect` | `TRUE` | Permission to ingest the data |
| `can_store` | `TRUE` | Permission to store in NEX DB |
| `can_display` | `FALSE` | **Publication gate · default blocked** |
| `can_derive` | `FALSE` → set `TRUE` in migrations 185–188 | Permission to derive canonical/evidence rows |
| `can_redistribute` | `FALSE` | No third-party redistribution |
| `attribution_required` | `TRUE` for 185–188 verticals | Attribution owed to upstream |

Only `can_display` remains at `FALSE` for the four verticals in this
runbook. The verticals agent authored discovery-only ingestion runners
that respect this gate.

The founder's rule, re-stated:

> Never change `source_registry.can_display`, fabricate evidence or
> promote records to verified status without the required authority
> and evidence.

Flipping `can_display = TRUE` is NOT part of the verticals agent's
scope. This document specifies what external authority is required.

## Live row counts (as of 2026-10-10, probed via `nex_dev`)

```
nex.accommodation_business            9230   (country='ID')
nex.service_business                  3922   (country='ID')
nex.mp_seller                        23580
nex.transport_acquisition_record       107   (105 routable, 2 quarantined provider_kind='unknown')
```

Downstream publication impact if `can_display` were flipped (upper
bound · actual visible count also depends on candidate review ·
`lifecycle_state ∈ {VERIFIED, CLAIMED}` · freshness band · zero open
conflicts).

---

## 1 · Accommodation · `nex_accommodation_business_legacy`

### Source
- Legacy table · `nex.accommodation_business`
- Row count · 9,230 (all `country = 'ID'`)
- Original data origin distribution
  - `osm_overpass` · 9,206 rows
  - `osm_overpass_via_lab` · 24 rows
- Source adapter · `scripts/nex-canonical/source-legacy-accommodation-business.ts`
- Migration · `deploy/postgres/init/185_nex_source_registry_legacy_accommodation.sql`

### Current registry state
```
source_id             = 'nex_accommodation_business_legacy'
source_type           = 'directory_import'
can_collect           = TRUE
can_store             = TRUE
can_display           = FALSE   ← publication gate
can_derive            = TRUE
can_redistribute      = FALSE
attribution_required  = TRUE
licence_id            = NULL    (deferred)
attribution_template  = NULL    (must be filled before can_display flip)
```

### Legal requirement blocking `can_display = TRUE`
Every row of `nex.accommodation_business` originates from OpenStreetMap
(both `osm_overpass` and `osm_overpass_via_lab` are OSM-sourced). This
places it under the **Open Database License (ODbL)**:

1. **Attribution** · OSM contributors must be credited on every public
   surface that renders this data. The attribution template is currently
   `NULL` and must be seeded via a migration (shape: migration 182-style,
   with `attribution_template` filled in `nex.source_registry`).
2. **Share-alike** · Derivative databases must be released under ODbL.
   Our derivation layer (`business_canonical` + `business_evidence`) is
   a *produced work* (textual listing surface) which, per ODbL §4.4, is
   generally fine to display without share-alike contagion, but legal
   review must confirm. Share-alike contagion only triggers if the
   *database* itself is redistributed as a database. `can_redistribute`
   is already `FALSE`.
3. **Field-level republication review** · Which OSM tags do we
   republish? `name`, `address`, `phone`, `website`, `coordinates`
   are all common OSM fields but their republication posture should be
   explicitly reviewed. Our projection reads: `business_name`,
   `category`, `address`, `city`, `district`, `coordinates_lat/lng`,
   `phone`, `website`, `source_reference` (the OSM id).

### What a founder needs to decide / sign off
- [ ] Approve the OSM attribution template string (needed to seed
      `attribution_template` in `source_registry`)
- [ ] Approve the listing-page attribution placement (footer badge
      per listing, or site-wide credit page)
- [ ] Confirm `osm_overpass_via_lab` has the same provenance (24 rows ·
      "via_lab" suggests it passed through an internal processing lab;
      confirm this did not strip ODbL metadata)
- [ ] Field-level sign-off on what we republish

### Attribution template shape (proposed)
```
"© OpenStreetMap contributors (ODbL) · source: {source_reference}"
```
Where `{source_reference}` is the OSM id (e.g. `node/4214848223`),
rendered as a link to `https://www.openstreetmap.org/{source_reference}`.

### Downstream impact if flipped
Up to 9,230 accommodation canonicals could become visible in
`business_directory_v` (bounded by individual canonical reaching
`lifecycle_state ∈ {VERIFIED, CLAIMED}` and `freshness ∈ {FRESH, AGING}`
and zero open conflicts). First-wave visible subset will be smaller;
the long tail requires owner-claim or evidence refresh.

### Risk register
- **R-A1** · Missing attribution on a public page violates ODbL ·
  mitigation: unit-test every listing page renders the attribution
  before `can_display = TRUE` ships
- **R-A2** · Share-alike contamination if we accidentally expose the
  derivation database to a third party · mitigation: keep
  `can_redistribute = FALSE` as the default; add CI guard
- **R-A3** · 24 "via_lab" rows may have had attribution context
  stripped · mitigation: run a one-off audit; quarantine the 24 rows
  until provenance is restored

---

## 2 · Service / Vehicle-Rental · `nex_service_business_legacy`

### Source
- Legacy table · `nex.service_business`
- Row count · 3,922 (all `country = 'ID'`)
- Original data origin distribution
  - `osm_overpass` · 3,922 rows (100%)
- Source adapter · `scripts/nex-canonical/source-legacy-service-business.ts`
- Migration · `deploy/postgres/init/186_nex_source_registry_legacy_service.sql`

### Current registry state
Same shape as accommodation (can_display=FALSE, can_derive=TRUE,
attribution_required=TRUE, licence_id=NULL, attribution_template=NULL).

### Legal requirement blocking `can_display = TRUE`
Pure OSM ODbL · same shape as Accommodation but 100% uniform
`osm_overpass`. The reviewer's job is simpler than accommodation
because there's no "via_lab" subset to audit.

Categories ingested include gyms, salons, dentists, opticians,
pharmacies, car-repair (per migration 186 header). Several of these are
**health-related** (dentists, opticians, pharmacies) and may trigger a
separate review (medical professional directories often carry
jurisdictional requirements beyond ODbL — e.g. Indonesian health
ministry registration numbers).

### What a founder needs to decide / sign off
- [ ] Approve the ODbL attribution template (likely identical to
      accommodation's)
- [ ] **Dedicated health-vertical review** · dentists / opticians /
      pharmacies may need Indonesian regulatory sign-off before
      publication (e.g. SIP license verification)
- [ ] Scope decision · publish all 3,922 or carve out health rows for
      a later wave? If carve-out: add a `can_display` filter at
      lifecycle level, not registry level (per-row rather than
      per-source)

### Attribution template shape (proposed)
Identical to accommodation's.

### Downstream impact if flipped
Up to 3,922 service canonicals visible. Subject to the same canonical /
lifecycle / freshness / conflict gates.

### Risk register
- **R-S1** · OSM ODbL same risks R-A1 and R-A2
- **R-S2** · Health-category listings without regulator verification
  could expose NEX to Indonesian consumer-protection complaints ·
  mitigation: publish non-health first; defer health to a per-row
  verification path
- **R-S3** · "car_repair" rows may include scrap-yards or non-licensed
  workshops · mitigation: owner-claim / verification required before
  per-row display

---

## 3 · Marketplace Seller · `nex_mp_seller_legacy`

### Source
- Legacy table · `nex.mp_seller`
- Row count · 23,580 (largest single legacy vertical)
- Original data origin distribution
  - `osm_overpass` · 16,427 rows (69.7%)
  - `null` · 5,260 rows (22.3%) · **ingested by NEX directly · no third-party source**
  - `nominatim` · 1,893 rows (8.0%)
- Source adapter · `scripts/nex-canonical/source-legacy-mp-seller.ts`
- Migration · `deploy/postgres/init/187_nex_source_registry_legacy_mp_seller.sql`

### Current registry state
Same shape (can_display=FALSE, can_derive=TRUE, attribution_required=TRUE,
licence_id=NULL, attribution_template=NULL).

### Legal requirement blocking `can_display = TRUE`
This vertical is the **most complex** of the four — three distinct
provenance posture mixtures in one table:

1. **16,427 `osm_overpass`** rows · ODbL (same as Accommodation /
   Service · attribution template required)
2. **1,893 `nominatim`** rows · Nominatim is OSM-based (ODbL) **plus**
   OSMF's Nominatim usage policy restricts geocoding query volume and
   requires attribution of the Nominatim service specifically. For
   display purposes, ODbL dominates.
3. **5,260 `null`-source** rows · these were ingested directly by NEX
   (no third-party source listed). Posture depends on how they were
   acquired:
   - Owner-provided (sign-up, claim form) · publishable with owner
     consent
   - Scraped from a public directory · requires fresh legal review of
     the scraping target
   - Internal manual data entry · publishable
   The verticals agent did not probe which category — the 5,260 null
   rows require a **provenance audit before publication**.

### What a founder needs to decide / sign off
- [ ] Approve ODbL attribution template for the 18,320 OSM-derived
      rows (osm_overpass + nominatim)
- [ ] **Provenance audit on the 5,260 `null`-source rows** · identify
      acquisition mode per row; without this audit, publishing creates
      compliance exposure
- [ ] Nominatim usage-policy sign-off (mostly backend, not display,
      but worth noting)
- [ ] Scope decision · publish OSM+Nominatim first (18,320) and defer
      null-source rows pending audit? Or hold the whole vertical
      pending audit?

### Attribution template shape (proposed)
Per-row template based on `source`:
- `osm_overpass` / `nominatim` → OSM ODbL attribution
- `null` → NO attribution if owner-provided; otherwise block

### Downstream impact if flipped (uniform)
Up to 23,580 marketplace seller canonicals.

### Downstream impact if flipped (OSM-only carve-out)
Up to 18,320 if a per-row filter restricts display to rows with
non-null `source`.

### Risk register
- **R-M1** · ODbL (same as R-A1, R-A2)
- **R-M2** · Nominatim usage-policy breach · low display-side risk,
  moderate backend risk if NEX ingestion continues to hit public
  Nominatim · mitigation: throttle backend; no action required for
  display
- **R-M3** · **5,260 null-source rows published without a provenance
  audit** · HIGHEST RISK in this vertical · mitigation: do not
  flip `can_display = TRUE` for this source until the null-source
  audit is complete OR a per-row filter is in place that excludes
  null-source rows
- **R-M4** · Marketplace sellers may be natural persons whose
  publication without consent breaches Indonesian PDP (UU 27/2022) ·
  mitigation: pair with the sealed owner-claim flow (O agent scope)
  so publication only follows explicit owner consent for identifiable-
  individual rows

---

## 4 · Transport Acquisition · `nex_transport_acquisition_legacy`

### Source
- Legacy table · `nex.transport_acquisition_record`
- Row count · 107 total
  - `transport_business` · 98 (routable to `transport_operator`)
  - `logistics_operator` · 7 (routable to `transport_operator`)
  - `unknown` · 2 (quarantined by adapter · see
    `PROVIDER_KINDS_QUARANTINED`)
- Source adapter · `scripts/nex-canonical/source-legacy-transport.ts`
- Migration · `deploy/postgres/init/188_nex_source_registry_legacy_transport.sql`

### Current registry state
Same shape (can_display=FALSE, can_derive=TRUE, attribution_required=TRUE,
licence_id=NULL, attribution_template=NULL).

### Legal requirement blocking `can_display = TRUE`
This vertical is **small (107 rows) and distinct from OSM-derived
verticals**. Reviewing the adapter and the `transport_acquisition_record`
column list, the rows were accumulated by NEX acquisition workflows
(home_jurisdiction, canonical_phone_e164 suggest direct intake rather
than OSM import). The table name "acquisition_record" strongly implies
NEX-originated data.

The legal requirement is therefore **owner consent / legitimate
interest basis** rather than ODbL. Indonesian PDP (UU 27/2022) applies
when the row identifies a natural person:
- `contact_person_name` suggests individual contact
- `canonical_phone_e164` suggests personal phone number

### What a founder needs to decide / sign off
- [ ] **Per-row consent audit** · for every row with
      `contact_person_name` populated, confirm consent-to-publish is
      on file (not just consent-to-contact)
- [ ] Decide publication posture for the 2 `unknown` provider_kind
      rows (adapter quarantines them; whether they're ever surfaced
      is a product decision)
- [ ] Attribution policy — if these are NEX-acquired, no third-party
      attribution is required, but a "NEX-verified" badge should
      precede public visibility
- [ ] Scope · publish all 105 routable rows, or publish only rows
      with `provider_kind = 'transport_business'` (98 rows) and
      defer `logistics_operator` (7) for a separate review?

### Attribution template shape (proposed)
```
NULL (NEX-acquired directly; no third-party attribution owed) ·
instead, carry a visible NEX-verified badge
```

### Downstream impact if flipped
Up to 105 transport canonicals (98 transport_business + 7
logistics_operator). The 2 unknown rows stay out regardless.

### Risk register
- **R-T1** · PDP violation if contact rows are published without
  consent · HIGHEST RISK in this vertical · mitigation: do NOT flip
  can_display until the consent audit is complete
- **R-T2** · If any row was acquired via a third-party partnership
  (e.g. a bulk list from a logistics association), the partnership
  agreement must be reviewed before publication · mitigation:
  verticals agent could not determine partnership provenance from
  the row data; founder must trace back acquisition memory

---

## Operator checklist · the order in which to clear verticals

The verticals agent recommends the following clearance order based on
risk × row count × unlock impact:

1. **Service** · lowest ODbL complexity (100% osm_overpass · 3,922
   rows) · simplest template · fastest unlock
2. **Accommodation** · same ODbL template · larger row count (9,230) ·
   requires a one-off audit of the 24 "via_lab" rows
3. **Transport** · smallest vertical (105 routable rows) · requires
   per-row consent audit · can proceed in parallel with Service and
   Accommodation if a legal reviewer is available
4. **Marketplace Seller** · largest vertical (23,580) · most complex
   provenance (3 modes) · **do not clear whole-vertical before the
   5,260 null-source audit completes**. Consider a per-source carve-
   out: ship osm_overpass + nominatim first (18,320); hold null-
   source rows for later wave

Each clearance is a SINGLE SQL statement:
```sql
UPDATE nex.source_registry
   SET can_display = TRUE,
       attribution_template = '<approved template string>'
 WHERE source_id = '<vertical source_id>';
```

That statement is **not** inside the verticals agent's scope. The
agent's deliverables stop at: migrations applied, adapters wired,
candidates landing in pending-review.jsonl, this runbook.

## Verification queries (post-clearance)

After the operator flips `can_display = TRUE` for a vertical, verify:

```sql
-- Row counts become publishable (upper bound · subject to canonical
-- lifecycle / freshness / conflict gates):
SELECT entity_type, COUNT(*) AS visible
  FROM nex.business_directory_v
 WHERE entity_type = '<vertical entity_type>'
 GROUP BY entity_type;

-- Attribution template is seeded:
SELECT source_id, can_display, attribution_template
  FROM nex.source_registry
 WHERE source_id = '<vertical source_id>';
```

## Trace back to code & migrations

| File | Role |
|---|---|
| `scripts/nex-canonical/_apply-migrations-185-188.mjs` | Verticals agent · idempotent one-shot applier |
| `deploy/postgres/init/185..188_*.sql` | Source-registry seed migrations (file-only, additive, idempotent) |
| `scripts/nex-canonical/source-legacy-{accommodation,service,mp-seller,transport}*.ts` | Sealed source adapters (DO NOT MODIFY) |
| `scripts/nex-canonical/_vertical-ingestion-core.ts` | Shared discovery-only vertical runner library |
| `scripts/nex-canonical/_vertical-ingestion-runner.ts` | Generic CLI wrapping the core |
| `scripts/nex-canonical/_ingest-{accommodation,service,mp-seller,transport}.mjs` | Per-vertical thin wrappers (verticals agent authored) |
| `scripts/nex-canonical/directory-ingestion-runner.ts` | Sealed FOOD runner (reference pattern only · DO NOT MODIFY) |

## Not covered by this runbook

- The owner-claim flow (O agent scope · `src/lib/nex-native/directory/owner-claim/*`)
- Related-businesses tier logic (R agent scope ·
  `src/lib/nex-native/directory/related-businesses/*`)
- The stabilisation wave (S1 agent scope · `tests/e2e/*.spec.ts` +
  `docs/doctrine/nex-directory-wave-stabilisation-2026-10-10.md`)

The verticals agent did not touch any of these.
