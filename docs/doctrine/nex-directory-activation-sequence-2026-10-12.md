# NEX Directory · Activation Sequence
_Author: founder-authorised recovery doc · 2026-10-12 · branch `nex/directory-work`_

**Purpose.** The entire business-discovery + directory-publication pipeline
is built, committed and dormant. This doc captures the exact
founder-only activation sequence that moves the pipeline from
"architecture sealed" to "businesses visible in NEX Search", and lists the
readback queries that prove each step worked.

Nothing in this document asks a reader to invent architecture. Every
command points at code that already exists in this repo and tables that
already exist (migrations 166–207) in `nex_dev` Postgres.

---

## 0 · Pre-flight

Verify repo + spine:

```sh
git -C /d/trades rev-parse HEAD
git -C /d/trades remote get-url origin          # → …/Philip2024394/trades.git
ls /d/trades/deploy/postgres/init/166*          # 166_nex_source_registry.sql
ls /d/trades/deploy/postgres/init/175*          # 175_nex_business_directory_v.sql
ls /d/trades/deploy/postgres/init/183*          # 183_nex_directory_dp3_grant_revoke.sql
```

Verify the dormant handlers:

```sh
grep -l "NEX_DISCOVERY_CRON_ACTIVATION" /d/trades/src/app/api/cron/*/route.ts
```

You should see at minimum `nex-harvest-tick`, `nex-continuous-tick`.

---

## 1 · Env vars (Vercel → Project → Settings → Environment Variables)

Set once per environment (Preview + Production):

| Name | Value | Purpose |
|---|---|---|
| `CRON_SECRET` | 32-byte random string | Authorises every `/api/cron/*` call via `Authorization: Bearer <secret>` |
| `NEX_DISCOVERY_CRON_ACTIVATION` | `on` | Flips `nex-harvest-tick`, `nex-continuous-tick` out of 503-dormant |
| `NEX_POSTGRES_URL` | existing nex_dev connection string | Required by every canonical script and handler |

After saving, trigger a redeploy so the new env values take effect.

**Verification** (manual curl, authenticated):

```sh
curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/nex-harvest-tick?programme_id=<probe>
# → 200 { ok:true, ... }   ← if 503 { state:"endpoint_dormant" } the env var didn't propagate
```

---

## 2 · Authorise sources for display (migration 175 D-2 gate)

Migration 175 refuses to project a canonical row into `business_directory_v`
unless at least one of its evidence rows cites a source whose
`source_registry.can_display = TRUE`. By default every source ships
`FALSE` for safety.

Decide which sources are launch-authorised. For Bali/Yogya food via the
legacy backfill, that's `nex_food_business_legacy`:

```sql
BEGIN;
UPDATE nex.source_registry
   SET can_display            = TRUE,
       display_authorized_at  = now(),
       display_authorized_by  = 'philip',
       display_authorization_note = 'founder sign-off 2026-10-12 · ODbL attribution satisfied in business_directory_v projection'
 WHERE source_id = 'nex_food_business_legacy';
-- SELECT the row back and verify before committing:
SELECT source_id, can_display, display_authorized_at, display_authorized_by
  FROM nex.source_registry
 WHERE source_id = 'nex_food_business_legacy';
COMMIT;
```

For OSM accommodation (Bali / Yogyakarta) register the source first (if
not already present), then flip `can_display` the same way. Example:

```sql
INSERT INTO nex.source_registry (
  source_id, display_name, source_kind,
  attribution_required, attribution_template,
  can_display, can_derive, can_redistribute
) VALUES (
  'osm_accommodation', 'OpenStreetMap · tourism=hotel/guesthouse/hostel',
  'open_data_overpass', TRUE, '© OpenStreetMap contributors · ODbL 1.0',
  FALSE, TRUE, TRUE
) ON CONFLICT (source_id) DO NOTHING;
```

Then flip `can_display=TRUE` the same way as above, with the attribution
template filled.

**Readback** (should return 0 before step 2, >0 after):

```sql
SELECT count(*) FROM nex.business_directory_v;   -- the real directory
```

---

## 3 · Process the existing harvest (Bali, Yogyakarta)

### 3a · Manual one-shot (fastest path to a first batch)

```sh
cd /d/trades
NEX_POSTGRES_URL=<...> node scripts/nex-canonical/_continuous-food-ingestion.mjs
```

Behaviour (verified from the script header):
- Loops in 500-row batches until `food_business` has no `canonical_business_id IS NULL` rows left
- Each batch: real-ingestion-runner → bulk-approve → write-approved-candidates → bulk-admin-promote-discovered
- pg_dump snapshot to `D:/nex-backups/` every 10 batches (`BACKUP_EVERY_BATCHES`)
- Writes progress log to `data/nex-canonical/continuous-food-ingestion-<ts>.log`
- Env vars accepted: `BATCH_SIZE` (default 500), `MAX_BATCHES` (default 60), `BACKUP_EVERY_BATCHES` (default 10)

### 3b · Readback (what you expect to see rise)

```sql
-- lifecycle distribution
SELECT lifecycle_state, count(*) FROM nex.business_canonical GROUP BY 1;

-- publishable set (should be > 0 after step 2 flips can_display)
SELECT count(*) FROM nex.business_directory_v;

-- geographic distribution of what's publishable
SELECT country, admin1 AS province, count(*)
  FROM nex.business_directory_v
 GROUP BY 1,2 ORDER BY 3 DESC;
```

---

## 4 · Contact enrichment status (email · phone · WhatsApp)

The OSM JSONL schema **already captures** structured contact fields at
both the top level AND in `raw_osm_tags`. Confirmed from
`data/harvest-osm/osm-bali-2026-09-10T07-09-18Z.jsonl` row for *Puri Rai*:

```json
{
  "phone": "+62 363 41385",
  "website": "http://puriraihotels.com/",
  "raw_osm_tags": {
    "email": "info@puriraihotels.com",
    "phone": "+62 363 41385",
    "contact:whatsapp": null
  }
}
```

What this means operationally:

- **Email**: already captured by OSM in `raw_osm_tags.email` and
  `raw_osm_tags["contact:email"]`. Verify the resolver extracts both into
  `business_evidence.contact_json` or whichever column your canonical
  evidence schema expects. Grep check:
  `grep -nE "contact:email|raw_osm_tags.email" /d/trades/scripts/nex-canonical/*.mjs`
- **Phone**: already captured in top-level `phone` + `raw_osm_tags.phone`.
  Normalise to E.164 (+62…) during the evidence insert; preserve the
  original string as source value.
- **WhatsApp**: captured in `raw_osm_tags["contact:whatsapp"]` **when
  the OSM contributor added it**. OSM typically does not have this tag.
  Do **not** infer WhatsApp from a phone number. Mark
  `whatsapp_source = "osm_contact_tag"` only when the tag is present.

If the current resolver drops any of these fields on the floor, that's
the single next code change — I'll make it a separate PR once you confirm
step 2 has flipped `can_display` and step 3a has produced its first batch.
Until then I'd be writing extraction code against a schema I haven't
confirmed.

---

## 5 · Marketing readiness (do NOT send yet)

The handler `/api/cron/nex-marketing-send-tick` exists but **must stay
unscheduled** until:

1. A real suppression list exists in Postgres
2. Opt-out intake is wired (web form + inbound WhatsApp "stop" handler)
3. Indonesian PDPL business-contact position is documented in a doctrine
   doc (public-facing business contact details are a different regime
   from personal data — but you should still log the rationale)
4. WhatsApp Business API template approval exists for whichever template
   you'd send
5. First-touch messaging passes legal review

Until all five hold, step 1's `CRON_SECRET` + env flag are enough to run
the discovery pipeline but **not** the send pipeline. The two
responsibilities are intentionally separated in the handler layout.

---

## 6 · Scheduling (vercel.json)

**Do not add cron entries until step 2 (can_display) is done.** Scheduling
dormant handlers is harmless (they return 503 cleanly) but entries that
suddenly go live when `NEX_DISCOVERY_CRON_ACTIVATION=on` and `can_display=TRUE`
land together is operationally cleaner.

When ready, append to `vercel.json` → `crons`:

```jsonc
// Step-by-step activation · one at a time
{ "path": "/api/cron/nex-discovery-tick",       "schedule": "*/5 * * * *"  },
{ "path": "/api/cron/nex-harvest-tick?programme_id=food-id",      "schedule": "*/10 * * * *" },
{ "path": "/api/cron/nex-continuous-tick",      "schedule": "*/5 * * * *"  },
```

Deploy, then watch Vercel's function invocation logs for 200s. First
successful invocations will appear in `nex.business_evidence` with
`created_at > <deploy-ts>`.

---

## 7 · Province expansion (beyond Bali + Yogyakarta)

`data/indonesia/geo/provinces.json` is already committed. The existing
Overpass adapter (`src/lib/nex/indonesia/live/osm-overpass.ts`) only
has a hardcoded Yogyakarta accommodation bbox; expansion for the other
36 provinces is a separate PR that:

1. Adds per-province bbox + country-claim rows (`claimCountry` in
   `src/lib/nex/discovery-world/index.ts`)
2. Lets `runDiscoveryCycle` rotate provinces through `programme_id`
3. Registers each new source with `can_display=FALSE` by default

Scope that work after step 3b proves the Bali/Yogya pipeline writes to
`business_directory_v`. Don't open 38 fronts before you've verified one.

---

## 8 · Rollback / kill-switch

Each gate can be flipped back:

```sh
# Env (Vercel UI): set NEX_DISCOVERY_CRON_ACTIVATION='' → every handler returns 503
```

```sql
-- Un-authorise a source (rows disappear from business_directory_v immediately)
UPDATE nex.source_registry
   SET can_display           = FALSE,
       display_authorized_at = NULL,
       display_authorized_by = NULL
 WHERE source_id = 'nex_food_business_legacy';
```

```jsonc
// Remove the cron entry from vercel.json → next deploy stops it
```

Nothing in this activation sequence applies a schema migration, so
there is no "undo migration" step. All rollbacks are either env flips
or data flips.

---

## 9 · Done checklist

- [ ] Step 1: `CRON_SECRET` + `NEX_DISCOVERY_CRON_ACTIVATION=on` set in Vercel
- [ ] Step 2: `source_registry.can_display=TRUE` for at least one source
- [ ] Step 3a: `_continuous-food-ingestion.mjs` ran to completion once
- [ ] Step 3b: `SELECT count(*) FROM nex.business_directory_v` returns > 0
- [ ] Step 4: Resolver confirmed to pass `raw_osm_tags.email` + `phone` + `contact:whatsapp` into evidence
- [ ] Step 6: one cron entry added to `vercel.json`, deployed, invoked
- [ ] Readback: `/nex-native/directory` renders at least one listing
- [ ] Marketing kept OFF until section 5's five preconditions all hold
