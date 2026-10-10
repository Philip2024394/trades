# NEX Enrichment Runners · OSM re-probe + Wikidata cross-reference

**Status:** DORMANT-SAFE · authored on `nex/directory-work` · 2026-10-09
**Owner:** Founder
**Scope:** `scripts/nex-canonical/enrich-osm-reference.ts`
            `scripts/nex-canonical/enrich-wikidata-crossref.ts`

## Why these runners exist

A full-corpus audit of 22,757 food rows shows massive enrichment headroom:

| Field          | Fill-rate on `nex.food_business` |
| -------------- | -------------------------------- |
| website        | 4.4 %                            |
| phone          | 7.9 %                            |
| address        | 24.4 %                           |
| street_line    | 0.9 %                            |
| neighbourhood  | 3.0 %                            |

The 7 published canonicals have patchy fill too (only 1/7 has phone,
3/7 have website, 5/7 have address, 7/7 have coordinates, 0/7 have
`category_ids`). Both runners target that gap by surfacing — not
inventing — fields that already exist on public, auditable sources.

Both runners write to `nex.discovery_business_evidence` (Founder-only
surface, migration `nex_world_discovery.sql §5`). Neither runner
promotes `lifecycle_state`, writes to `nex.business_canonical`, or
mutates `nex.food_business`. Promotion remains admin-attested (Rule-5m).

## Hard-locked governance (both runners)

* **Zero fabrication** — every value is copied verbatim from a public
  tag/binding or recorded as `null`. The shared `canonicaliseWebsite()`
  pure helper (sealed in
  `src/lib/nex/harvest/overpass-adapter.ts`) is the only website
  normaliser used for equality.
* **Sealed gate** — adapter construction goes through
  `resolveProductionHarvestAdapters()` in
  `src/lib/nex/harvest/production-boot.ts`. The gate requires BOTH:
    1. `NEX_PAGE_FETCHER_ACTIVATION === "on"`
    2. a founder-signed `data/nex-page-fetcher-allowlist.json`
       containing the target host.
* **Dormant default** — when the gate denies activation, the runner
  reports `stage: "dormant"` and exits 0 without issuing a single HTTP
  request.
* **Rate-limited** — the `min_interval_ms` for each host comes from the
  allowlist. OSM Overpass defaults to **5 000 ms**, Wikidata to
  **5 000 ms**.
* **Dry-run default** — `--live` is required to open a DB connection
  and append to `nex.discovery_business_evidence`. Dry-run writes only
  to the JSONL evidence log (`.gitignore`d).
* **Append-only evidence** — the table's
  `UNIQUE (programme_id, iso_alpha_2, business_name, website_url)`
  index prevents duplicates. Re-runs are idempotent (`ON CONFLICT DO
  UPDATE SET last_seen_at`).
* **Never auto-promotes lifecycle_state** — Rule-5m. Founder decides.

## Allowlist status snapshot (2026-10-09)

The current founder-signed `data/nex-page-fetcher-allowlist.json` lists:

| Host               | min_interval_ms | max_bytes   |
| ------------------ | --------------- | ----------- |
| overpass.osm.ch    | 2 000           | 5 MiB       |
| overpass-api.de    | 5 000           | 10 MiB      |
| www.robotstxt.org  | 1 000           | 256 KiB     |

**Wikidata is NOT on the allowlist.** The Wikidata runner is therefore
`stage: "dormant"` on every operator invocation until the founder
adds (and signs) `query.wikidata.org` / `www.wikidata.org`.

## Runner 1 — `enrich-osm-reference.ts`

**Objective.** For each candidate in `data/nex-canonical/pending-review*.jsonl`
that carries an OSM source reference in its `caveats` (shape
`source="osm_overpass" · source_reference="node/<id>"`), re-probe
OpenStreetMap via the sealed Overpass adapter and surface tags the
legacy import did not project: `website`, `phone`, `addr:*`,
`opening_hours`, `wikidata`, `email`.

### CLI

```
tsx scripts/nex-canonical/enrich-osm-reference.ts \
  --pending-queue=data/nex-canonical/pending-review.jsonl \
  --limit=50 \
  [--offset=0] \
  [--evidence-log=data/nex-canonical/enrichment-log-<utc>.jsonl] \
  [--live] \
  [--programme-slug=nex-food-id-enrichment]
```

| Flag                | Required | Default |
| ------------------- | -------- | ------- |
| `--pending-queue`   | ✓        | —       |
| `--limit`           | ✓        | — (range 1..1000) |
| `--offset`          |          | `0` · counts OSM-eligible candidates only, so resuming is stable across queue regenerations. |
| `--evidence-log`    |          | `data/nex-canonical/enrichment-log-<utc>.jsonl` (gitignored) |
| `--live`            |          | `false` (dry-run) |
| `--programme-slug`  |          | `nex-food-id-enrichment` |

### Dry-run output (one JSONL line per probed candidate)

```json
{
  "at": "2026-10-09T22:00:00.000Z",
  "candidate_id": "cand-nex-food-7f8a21cd14f3c587",
  "osm_ref": "node/9797682461",
  "business_name": "Adore Mexicola",
  "country": "ID",
  "existing_identity": { "...": "snapshot before re-probe" },
  "probed_values": {
    "website": "https://example.com",
    "phone": "+62 ...",
    "address": "...",
    "opening_hours": "Mo-Fr 09:00-17:00",
    "wikidata_qid": "Q4201",
    "email": null
  },
  "delta_fields_new": ["website", "phone"],
  "probe_kind": "responded",
  "bytes": 420,
  "ms": 311
}
```

### Report (printed to stdout)

```
{
  "stage": "probed" | "dormant",
  "adapter_source": "production" | "null_defaults",
  "candidates_read": 50,
  "osm_tagged": 50,
  "probes_attempted": 50,
  "probes_responded": 44,
  "probes_dormant": 0,
  "probes_rate_limited": 0,
  "fields_new_counts": { "website": 12, "phone": 7, "address": 3 },
  "evidence_rows_dryrun_logged": 44,
  "evidence_rows_written": 0,
  "min_interval_ms": 5000,
  "offset_applied": 0
}
```

### Exit codes

| Code | Meaning                                                     |
| ---- | ----------------------------------------------------------- |
| 0    | Completed (dormant OR probed)                               |
| 1    | CLI preflight refused                                       |
| 2    | Pending queue unreadable                                    |
| 3    | `--live` requested but adapter did not activate (safety stop) · OR `NEX_POSTGRES_URL` missing |
| 99   | Unexpected error                                            |

## Runner 2 — `enrich-wikidata-crossref.ts`

**Objective.** For each candidate with a `name_canonical`, cross-reference
Wikidata by `(name, country, [coordinates])`. Surface `QID`, `P131`
(admin territorial entity), `P625` (coordinates), `P856` (official
website), `P1329` (phone), `P18` (image file name).

**Attribution.** Per migration 182 Section-M rules, Wikidata is a
`can_display=FALSE` source. Evidence is stored for **internal
fact-checking only** — never published verbatim without an
independently-verified source.

### Current operational reality

**The Wikidata runner is DORMANT today.** The founder-signed allowlist
does not include `query.wikidata.org` or `www.wikidata.org`. The sealed
gate therefore returns `NULL_WIKIDATA_FETCHER` and the runner reports:

```
stage: "dormant"
fetcher_source: "null_defaults"
fetcher_reason: "no wikidata.org host in Founder-signed allowlist · fetcher dormant"
```

The runner authors the SPARQL query, the parser, the delta computer,
the evidence row shape, and the full orchestration — all of which run
cleanly in dry-run mode against the fixture fetcher — so when the
founder authorises Wikidata the code lights up with zero refactor.

### CLI

```
tsx scripts/nex-canonical/enrich-wikidata-crossref.ts \
  --pending-queue=data/nex-canonical/pending-review.jsonl \
  --limit=50 \
  [--offset=0] \
  [--evidence-log=data/nex-canonical/wikidata-xref-log-<utc>.jsonl] \
  [--live] \
  [--programme-slug=nex-wikidata-crossref]
```

Flags are identical in shape to the OSM runner.

## Operator sequence — turning the runners on

The runners are **safe to invoke at any time** (dry-run default is a
no-op in production). The sequence below is for the explicit activation
of the live write path, under founder authority.

### 1 · Dry-run baseline (zero authorisation needed)

```powershell
# OSM re-probe · dry run against the current pending queue
npx tsx scripts/nex-canonical/enrich-osm-reference.ts `
  --pending-queue=data/nex-canonical/pending-review.jsonl `
  --limit=10

# Wikidata cross-reference · dry run (will report dormant · correct)
npx tsx scripts/nex-canonical/enrich-wikidata-crossref.ts `
  --pending-queue=data/nex-canonical/pending-review.jsonl `
  --limit=10
```

Both runners should exit `0` with a human-readable report. The OSM
runner will show `stage: "dormant"` unless the activation env is set.

### 2 · OSM live activation (Founder-attested)

Prerequisites:

* `NEX_PAGE_FETCHER_ACTIVATION=on` is set in the shell.
* `data/nex-page-fetcher-allowlist.json` is signed by the founder and
  lists at least one `overpass*` host (true today).
* `NEX_POSTGRES_URL` is set to the Section-M canonical database.

Invocation:

```powershell
$env:NEX_PAGE_FETCHER_ACTIVATION = "on"
$env:NEX_POSTGRES_URL = "postgresql://..."

npx tsx scripts/nex-canonical/enrich-osm-reference.ts `
  --pending-queue=data/nex-canonical/pending-review.jsonl `
  --limit=50 `
  --live
```

The runner opens exactly one DB connection, issues at most 50 Overpass
requests at the allowlist-configured rate (`min_interval_ms`), and
appends up to 50 rows to `nex.discovery_business_evidence`. On
re-invocation, `ON CONFLICT (programme_id, iso_alpha_2, business_name,
website_url) DO UPDATE SET last_seen_at = now()` makes the write
idempotent.

### 3 · Resumable batching

For a larger backfill, iterate `--offset`:

```powershell
# First 500 candidates
npx tsx scripts/nex-canonical/enrich-osm-reference.ts `
  --pending-queue=data/nex-canonical/pending-review.jsonl --limit=500 --offset=0 --live

# Next 500
npx tsx scripts/nex-canonical/enrich-osm-reference.ts `
  --pending-queue=data/nex-canonical/pending-review.jsonl --limit=500 --offset=500 --live
```

`--offset` counts **OSM-eligible candidates only** (not raw JSONL lines),
so a regenerated pending queue remains resumable at the same cursor.

### 4 · Wikidata live activation (currently BLOCKED)

To unblock, the founder must:

1. Add a signed entry to `data/nex-page-fetcher-allowlist.json`, e.g.:

   ```json
   {
     "host": "query.wikidata.org",
     "reason": "Wikidata SPARQL · cross-reference by name+country · internal evidence only",
     "max_bytes": 2097152,
     "min_interval_ms": 5000
   }
   ```

   Resign (`signed_by: "founder"`, update `signed_at`).

2. Author and inject a `make_production` factory for `WikidataFetcher`
   (same shape as `ProductionOverpassAdapter`). The resolver refuses
   to activate without an explicit injected factory — this is a
   deliberate second gate ensuring no accidental activation.

3. Invoke:

   ```powershell
   $env:NEX_PAGE_FETCHER_ACTIVATION = "on"
   $env:NEX_POSTGRES_URL = "postgresql://..."
   npx tsx scripts/nex-canonical/enrich-wikidata-crossref.ts `
     --pending-queue=data/nex-canonical/pending-review.jsonl --limit=50 --live
   ```

Both allowlist edit and factory injection are founder-attested
decisions — not operator shortcuts.

## Tests

```powershell
npx vitest run --config scripts/nex-canonical/vitest.local.config.ts `
  scripts/nex-canonical/enrich-osm-reference.test.ts `
  scripts/nex-canonical/enrich-wikidata-crossref.test.ts
```

Expected: all tests pass (69 at time of writing). Both suites exercise:

* dormant-mode behaviour (zero network · zero DB writes)
* fabrication guards (empty inputs → `null` + empty `fields_new`)
* evidence row shape (fields match `nex.discovery_business_evidence`)
* rate-limit respect (inter-probe `sleep` is called exactly `n - 1` times)
* governance invariants via string-grep on the source files

## File map

| Path                                                           | Purpose                                   |
| -------------------------------------------------------------- | ----------------------------------------- |
| `scripts/nex-canonical/enrich-osm-reference.ts`                | OSM re-probe runner (extended)            |
| `scripts/nex-canonical/enrich-osm-reference.test.ts`           | OSM runner tests                          |
| `scripts/nex-canonical/enrich-wikidata-crossref.ts`            | Wikidata cross-reference runner (dormant) |
| `scripts/nex-canonical/enrich-wikidata-crossref.test.ts`       | Wikidata runner tests                     |
| `scripts/nex-canonical/tsconfig.enrich-check.json`             | Scoped `tsc --noEmit` config              |
| `src/lib/nex/harvest/overpass-adapter.ts`                      | Sealed · `canonicaliseWebsite()` lives here |
| `src/lib/nex/harvest/production-boot.ts`                       | Sealed · gate for both runners            |
| `data/nex-page-fetcher-allowlist.json`                         | Founder-signed · the only host source     |
| `db/migrations/nex_world_discovery.sql §5`                     | `nex.discovery_business_evidence` schema  |

## Known limits

* Both runners read the pending-review JSONL file. A Postgres-first
  loader is deliberately out of scope here — the pending queue is the
  single source of truth for which candidates are "live" for review.
* The Wikidata resolver intentionally refuses to activate without an
  explicitly injected `make_production` factory. There is no built-in
  production fetcher yet — adding one is a separate founder-attested
  commit.
* The OSM re-probe uses `[out:json][timeout:60]; <type>(<id>); out tags
  center;` — the most conservative per-id probe possible. We do not
  issue area or regex probes from this runner.
