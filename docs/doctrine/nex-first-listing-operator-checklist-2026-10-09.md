# NEX Directory · First-Listing Operator Checklist · 2026-10-09

**Target:** one visible, legitimate food business listing on
`https://thenetworkers.app/nex-native/directory`.

**Decision path:** Path 3 (NEX-internal data, nex_food_business_legacy).
Admin-attested promotion. No third-party legal review required.

**Live DB state (verified read-only 2026-10-09):**
- `nex.business_canonical` has **7 real rows + 1 synthetic**, all `DISCOVERED`
- `nex.business_evidence` has 8 rows, 7 citing `nex_food_business_legacy`
- `nex.source_registry.nex_food_business_legacy.can_display = FALSE`
- `nex.business_directory_v` = **0 rows** (correct empty state)
- Migrations 166/167/170/178/179/180/181 are **applied**
- Migrations 168/172/173/174/176/177/182/183 are **not applied**

**Shortest safe path:** three operator SQL steps + one TypeScript runner.

---

## Prerequisites (operator confirms)

- You have `NEX_POSTGRES_URL` with a role that can `UPDATE nex.source_registry`
  and `CREATE TABLE nex.business_canonical_lifecycle_log`.
- You have reviewed migration 168 (`168_nex_business_canonical_lifecycle.sql`)
  and migration 182 (`182_nex_source_registry_attribution_templates.sql`) in
  `D:/trades/deploy/postgres/init/`.
- You accept the sealed decision (confirmed in-session 2026-10-09): a single
  admin-attested lifecycle promotion is NOT Rule-5m-gated. Rule-5m gates the
  bulk legacy backfill (migration 169's row-level FK population), not
  one-row admin promotion on an already-existing canonical.

---

## Step 1 · Apply migration 168 (lifecycle log table)

```bash
psql $NEX_POSTGRES_URL -f D:/trades/deploy/postgres/init/168_nex_business_canonical_lifecycle.sql
```

**Verify:**

```sql
SELECT EXISTS(
  SELECT 1 FROM information_schema.tables
   WHERE table_schema='nex' AND table_name='business_canonical_lifecycle_log'
) AS created;
-- Expected: true
```

**Rollback (if needed):**

```sql
DROP TABLE nex.business_canonical_lifecycle_log;
```

---

## Step 2 · Apply migration 182 (attribution templates)

```bash
psql $NEX_POSTGRES_URL -f D:/trades/deploy/postgres/init/182_nex_source_registry_attribution_templates.sql
```

**Verify:**

```sql
SELECT source_id, attribution_required, attribution_template
  FROM nex.source_registry
 WHERE source_id IN ('nex_food_business_legacy','osm_overpass','wikidata','owner_upload')
 ORDER BY source_id;
```

Expected shape:

| source_id | attribution_required | attribution_template |
|---|---|---|
| nex_food_business_legacy | false | NULL |
| osm_overpass | true | '© OpenStreetMap contributors (ODbL)' |
| owner_upload | false | NULL |
| wikidata | false | NULL |

**Why this matters:** migration 180's `ck_sr_attribution_template_present`
CHECK refuses `can_display=TRUE + attribution_required=TRUE + template IS
NULL`. By setting `nex_food_business_legacy.attribution_required = FALSE`
first (via 182), Step 3's can_display flip won't violate the CHECK.

---

## Step 3 · Flip `nex_food_business_legacy.can_display = TRUE`

```sql
BEGIN;
UPDATE nex.source_registry
   SET can_display = TRUE
 WHERE source_id = 'nex_food_business_legacy'
   AND can_display = FALSE;
-- Expected: UPDATE 1
SELECT source_id, can_display, can_derive, attribution_required, attribution_template
  FROM nex.source_registry
 WHERE source_id = 'nex_food_business_legacy';
-- Verify can_display=TRUE, attribution_required=FALSE
COMMIT;
```

**Audit note:** this is an A-3-wave operator action. The sealed decision
is NEX-owned data (`nex.food_business`) does not require third-party
attribution — NEX authored it. Operator is the founder-level actor.

**Rollback (if needed):**

```sql
UPDATE nex.source_registry
   SET can_display = FALSE
 WHERE source_id = 'nex_food_business_legacy';
```

---

## Step 4 · Pick one canonical and admin-promote lifecycle

**Candidate pool** (verified read-only 2026-10-09; 7 real canonicals):

| canonical_business_id | name_canonical | city |
|---|---|---|
| e406e98e-bf29-4a6e-ad96-91f249d5bc0e | Go! Go! CURRY | Jakarta |
| 06220821-0e8a-48f9-bed3-b8d6fadf9a82 | Hakata Ikkousha | Medan |
| a424580a-b99d-49a8-82b0-e1cccec4bd55 | Toko Kue Lakker | Bandung |
| d006d9dd-0605-4b3a-aba2-cf8d49171efd | Shae Cafe and Eatery | Surabaya |
| a1a5f6ed-69f7-41aa-b1b7-5b80ce308bf3 | Warung Es Bubble Mama Dani | Jakarta |
| d38a85e6-ca09-4d32-9bef-23626ed4ed5b | Padang Murah Meriah | Yogyakarta |
| 61c76931-18db-45ae-8232-a2e9856d91b5 | Ronde Mak Pari | Yogyakarta |

**Pick one (recommended: `Ronde Mak Pari` · Yogyakarta — matches the sealed
first-wave Yogyakarta scope from migration 054).** Replace `<CHOSEN_UUID>`
below.

**Run the sealed admin-promotion runner:**

```bash
cd D:/trades
NEX_POSTGRES_URL="$NEX_POSTGRES_URL" npx tsx -e "
  import('./scripts/nex-canonical/admin-promote-lifecycle.ts').then(async (m) => {
    const plan = m.planAdminPromotion({
      canonical_business_id: '61c76931-18db-45ae-8232-a2e9856d91b5',
      current_lifecycle_state: 'DISCOVERED',
      target_lifecycle_state: 'VERIFIED',
      admin_id: 'philip',
      transition_reason: 'admin_verify',
      now: new Date(),
    });
    if (!plan.ok) { console.error('PLAN REFUSED:', plan.reason); process.exit(1); }
    const result = await m.executeAdminPromotion({
      plan: plan.plan,
      connectionString: process.env.NEX_POSTGRES_URL,
    });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
  });
"
```

**Expected output:**

```json
{
  "ok": true,
  "updated_canonical_rows": 1,
  "inserted_log_rows": 1
}
```

**Rollback (if needed):**

```sql
BEGIN;
UPDATE nex.business_canonical
   SET lifecycle_state = 'DISCOVERED',
       last_verified_at = NULL,
       updated_at = now()
 WHERE canonical_business_id = '<CHOSEN_UUID>'
   AND lifecycle_state = 'VERIFIED';
DELETE FROM nex.business_canonical_lifecycle_log
 WHERE canonical_business_id = '<CHOSEN_UUID>'
   AND to_state = 'VERIFIED'
   AND transition_reason = 'admin_verify';
COMMIT;
```

---

## Step 5 · Verify the listing appears

**SQL check:**

```sql
SELECT canonical_business_id, name_canonical, city, lifecycle_state
  FROM nex.business_directory_v
 WHERE canonical_business_id = '<CHOSEN_UUID>';
-- Expected: 1 row returned with lifecycle_state='VERIFIED'
```

**Page check (deployed):**

Open `https://thenetworkers.app/nex-native/directory?country=ID` in a
browser (or curl the HTML; the SSR'd page includes the listing in the
first render).

Expected: the chosen business name appears as a listing card. The
"No listings yet" empty state is gone.

**API check (deployed or local):**

```bash
curl 'https://thenetworkers.app/api/nex-directory/v1/listings?country=ID'
# or against local dev:
curl 'http://localhost:3008/api/nex-directory/v1/listings?country=ID'
```

Expected: `listings` array now has one entry. `attributions` remains empty
(nex_food_business_legacy.attribution_required = FALSE, correctly).

---

## Step 6 · Final acceptance proof

Produce the acceptance screenshot (operator responsibility):

1. Open `https://thenetworkers.app/nex-native/directory` in a browser.
2. Confirm the listing card renders with the business name, city, and
   (if coordinates are present) the location signal.
3. Confirm NO fabricated attribution footer appears (the row's cited
   source does not require attribution).
4. Capture screenshot + the sealed audit SQL:

```sql
SELECT bc.canonical_business_id, bc.name_canonical, bc.lifecycle_state,
       bcll.transition_reason, bcll.transitioned_by, bcll.transitioned_at
  FROM nex.business_canonical bc
  JOIN nex.business_canonical_lifecycle_log bcll
    ON bcll.canonical_business_id = bc.canonical_business_id
 WHERE bc.canonical_business_id = '<CHOSEN_UUID>';
```

The row is now permanently in the Directory until explicitly rolled back
or lifecycle-moved to SUPERSEDED/DORMANT.

---

## What this does NOT do

- Does NOT apply migrations 173/174/176/177/183 (business_media /
  fact_conflict / claim / walker_attribution / DP-3 lockdown) · those
  remain gated and are not blockers for the first listing.
- Does NOT run the Rule-5m 7-proof pipeline · bulk backfill still gated.
- Does NOT populate `canonical_business_id` on 22,757 legacy food rows ·
  that is a separate Rule-5m-gated wave.
- Does NOT flip `can_display` on OSM / Wikidata / Wikimedia · third-party
  sources still require their own legal review before publication.
- Does NOT prevent a second listing · to add more, pick another UUID from
  the 7-row candidate pool and re-run Step 4 with that id.

## What this DOES do

- Unblocks the architectural "0 listings forever" condition.
- Produces one visible, legitimate, audit-logged, rollbackable listing.
- Preserves every sealed invariant: handoff integrity, publication gate,
  attribution policy, source permissions, append-only evidence,
  append-only lifecycle log.
- Takes approximately 5 minutes of operator time.

---

## Expected end-to-end time

- Step 1 (apply migration 168): ~5 seconds
- Step 2 (apply migration 182): ~2 seconds
- Step 3 (can_display flip): ~1 second
- Step 4 (admin promotion): ~2 seconds (one UPDATE + one INSERT in one txn)
- Step 5 (verification): ~10 seconds (SQL + curl)
- Step 6 (deployed browser check): ~30 seconds (page load + visual verify)

**Total: ~1 minute of DB operations, ~5 minutes operator time.**

The deployed `https://thenetworkers.app` version will reflect the change
on the next page render (no deploy needed · the SSR'd page reads the
live `business_directory_v` on every request · `dynamic = "force-dynamic"`
is set on the page).
