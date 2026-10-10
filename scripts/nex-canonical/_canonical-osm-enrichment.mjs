// scripts/nex-canonical/_canonical-osm-enrichment.mjs
//
// NEX Canonical · OSM re-probe enrichment runner for nex.business_canonical.
//
// Reads food canonicals in country=ID that carry an OSM reference (via the
// linked nex.food_business.source_reference — the current ingestion did not
// project osm_id onto business_canonical), re-probes OpenStreetMap through
// the SEALED adapter from `resolveProductionHarvestAdapters`, and fills
// null-only identity fields on business_canonical:
//    phone_e164, website_apex, address, services_products
//
// Governance hard-locks (never bypassed):
//   · DB identity: refuses to write unless current_database() === 'nex_dev'
//   · Allowlist: refuses to run unless data/nex-page-fetcher-allowlist.json
//     is signed_by === 'founder' AND contains the chosen host
//   · Activation: refuses to run unless NEX_PAGE_FETCHER_ACTIVATION === 'on'
//   · Adapter: refuses to run if resolveProductionHarvestAdapters returns
//     source === 'null_defaults'
//   · Zero fabrication: every enriched value is copied verbatim from an OSM
//     tag; nulls stay null if OSM has nothing
//   · Only-if-null writes: never overwrites existing non-null canonical data
//   · Lifecycle: NEVER writes business_canonical.lifecycle_state
//   · Rate-limited: the sealed adapter enforces min_interval_ms per allowlist
//     (we rely on this; we never bypass with raw HTTP)
//
// CLI:
//   node --env-file=.env.local scripts/nex-canonical/_canonical-osm-enrichment.mjs \
//     [--limit=200]            default 200 (bounded)
//     [--host=overpass-api.de] default overpass-api.de (allowlisted)
//     [--dry-run]              default false; no DB writes if present
//     [--min-age-minutes=60]   skip canonicals created recently (avoids racing
//                              the continuous ingestion loop)
//     [--activation-on]        sets NEX_PAGE_FETCHER_ACTIVATION='on' for this
//                              process only (never persisted to .env.local)
//
// EXIT CODES
//   0  · completed (dry-run or live)
//   1  · pre-flight refused (CLI / DB identity / allowlist / activation / adapter)
//  99  · unexpected error

import { promises as fs } from "node:fs";
import * as path from "node:path";
import pg from "pg";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// We register tsx to be able to import the TS helpers and the sealed harvest
// modules from a .mjs runner without a build step.
require("tsx/cjs");
const helpers = require("./_osm-enrichment-support.ts");
const sealedBoot = require("../../src/lib/nex/harvest/production-boot.ts");

const {
  parseOsmRef,
  buildBatchOverpassQuery,
  MAX_REFS_PER_QUERY,
  extractEnrichmentFields,
  buildUpdateSql,
  buildEvidenceInsertSql,
} = helpers;
const { resolveProductionHarvestAdapters } = sealedBoot;

const DEFAULT_HOST = "overpass-api.de";
const DEFAULT_LIMIT = 200;
const DEFAULT_MIN_AGE_MIN = 60;
const BATCH_SIZE = 25; // ≤ MAX_REFS_PER_QUERY · smaller = faster Overpass response · survives 504s
const MAX_RETRIES_PER_BATCH = 2; // Retry transient 504/unavailable before giving up on a batch
const RETRY_BACKOFF_MS = 8_000;
const FOUNDER_ID = "philip";

// ─── parseCli ───────────────────────────────────────────────────────
function parseCli(argv) {
  const get = (name) => {
    const needle = `--${name}=`;
    for (const a of argv) if (a.startsWith(needle)) return a.slice(needle.length);
    return null;
  };
  const has = (name) => argv.includes(`--${name}`);

  const limitRaw = get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : DEFAULT_LIMIT;
  if (!Number.isFinite(limit) || limit <= 0 || limit > 500) {
    throw new Error(`--limit must be an integer in [1, 500]; got ${limitRaw ?? "<null>"}`);
  }

  const host = get("host") ?? DEFAULT_HOST;
  const dryRun = has("dry-run");
  const minAgeRaw = get("min-age-minutes");
  const minAge = minAgeRaw ? Number.parseInt(minAgeRaw, 10) : DEFAULT_MIN_AGE_MIN;
  if (!Number.isFinite(minAge) || minAge < 0) {
    throw new Error(`--min-age-minutes must be a non-negative integer; got ${minAgeRaw}`);
  }

  const activationOn = has("activation-on");

  return { limit, host, dryRun, minAge, activationOn };
}

// ─── Pre-flight: DB identity ────────────────────────────────────────
async function verifyDbIdentity(client) {
  const r = await client.query("SELECT current_database() AS db, current_user AS u");
  const db = r.rows[0].db;
  const u = r.rows[0].u;
  if (db !== "nex_dev") {
    throw new Error(
      `DB identity refused · current_database='${db}' but expected 'nex_dev'. Aborting before any HTTP call.`,
    );
  }
  return { db, u };
}

// ─── Pre-flight: allowlist ──────────────────────────────────────────
async function verifyAllowlist(host) {
  const p = path.resolve(process.cwd(), "data/nex-page-fetcher-allowlist.json");
  const text = await fs.readFile(p, "utf8");
  const al = JSON.parse(text);
  if (al.signed_by !== "founder") {
    throw new Error(`allowlist refused · signed_by='${al.signed_by}' not 'founder' (${p})`);
  }
  if (!Array.isArray(al.allowed_hosts) || al.allowed_hosts.length === 0) {
    throw new Error(`allowlist refused · empty allowed_hosts (${p})`);
  }
  const hostEntry = al.allowed_hosts.find((h) => h.host === host);
  if (!hostEntry) {
    throw new Error(
      `allowlist refused · host '${host}' not in allowed_hosts: [${al.allowed_hosts.map((h) => h.host).join(", ")}]`,
    );
  }
  return { path: p, entry: hostEntry };
}

// ─── Pre-flight: activation ─────────────────────────────────────────
function verifyActivation() {
  if (process.env.NEX_PAGE_FETCHER_ACTIVATION !== "on") {
    throw new Error(
      "activation refused · NEX_PAGE_FETCHER_ACTIVATION !== 'on' · pass --activation-on to set it in-process for this run",
    );
  }
}

// ─── Load canonicals via food_business.source_reference ─────────────
async function loadCanonicalBatch(client, limit, minAgeMinutes) {
  const sql = `
    SELECT
      bc.canonical_business_id,
      fb.source_reference AS osm_ref,
      bc.name_canonical,
      bc.city,
      bc.phone_e164,
      bc.website_apex,
      bc.address,
      bc.services_products
    FROM nex.business_canonical bc
    JOIN LATERAL (
      SELECT source_reference
        FROM nex.food_business
       WHERE canonical_business_id = bc.canonical_business_id
         AND source_reference ~ '^(node|way|relation)/[0-9]+$'
       ORDER BY source_ingested_at ASC
       LIMIT 1
    ) fb ON TRUE
    WHERE bc.entity_type = 'food'
      AND bc.country = 'ID'
      AND bc.created_at < now() - ($2 || ' minutes')::interval
      -- Only pick rows that still have at least one enrichable field null
      AND (
        bc.phone_e164 IS NULL
        OR bc.website_apex IS NULL
        OR bc.address IS NULL
        OR bc.services_products IS NULL
      )
    ORDER BY bc.created_at ASC
    LIMIT $1
  `;
  const r = await client.query(sql, [limit, String(minAgeMinutes)]);
  return r.rows.map((row) => ({
    canonical_business_id: row.canonical_business_id,
    osm_ref: row.osm_ref,
    name_canonical: row.name_canonical,
    city: row.city,
    existing: {
      phone_e164: row.phone_e164 ?? null,
      website_apex: row.website_apex ?? null,
      address: row.address ?? null,
      services_products: row.services_products ?? null,
    },
  }));
}

// ─── Chunking helpers ────────────────────────────────────────────────
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  const cli = parseCli(process.argv.slice(2));
  const runId = `canonical-osm-enrich-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

  log(`run_id=${runId}`);
  log(
    `cli · limit=${cli.limit} host=${cli.host} dry_run=${cli.dryRun} min_age_minutes=${cli.minAge} activation_on=${cli.activationOn}`,
  );

  // Opt-in activation BEFORE any adapter resolution attempt.
  if (cli.activationOn) {
    process.env.NEX_PAGE_FETCHER_ACTIVATION = "on";
    log("activation · NEX_PAGE_FETCHER_ACTIVATION='on' set in-process (NOT persisted)");
  }

  // 1. DB identity
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) {
    console.error("fatal · NEX_POSTGRES_URL is not set in environment");
    process.exit(1);
  }
  const dbClient = new pg.Client({ connectionString: url });
  await dbClient.connect();
  try {
    const ident = await verifyDbIdentity(dbClient);
    log(`db-identity · db=${ident.db} user=${ident.u} ✓`);
  } catch (e) {
    console.error(`fatal · ${e.message}`);
    await dbClient.end();
    process.exit(1);
  }

  // 2. Allowlist
  let allowlistEntry;
  try {
    const r = await verifyAllowlist(cli.host);
    allowlistEntry = r.entry;
    log(
      `allowlist · signed_by=founder · host=${cli.host} max_bytes=${r.entry.max_bytes} min_interval_ms=${r.entry.min_interval_ms} ✓`,
    );
  } catch (e) {
    console.error(`fatal · ${e.message}`);
    await dbClient.end();
    process.exit(1);
  }

  // 3. Activation
  try {
    verifyActivation();
    log(`activation · NEX_PAGE_FETCHER_ACTIVATION='on' ✓`);
  } catch (e) {
    console.error(`fatal · ${e.message}`);
    console.error(
      `operator · re-run with  --activation-on  flag OR  NEX_PAGE_FETCHER_ACTIVATION=on  env var`,
    );
    await dbClient.end();
    process.exit(1);
  }

  // 4. Adapter construction via sealed boot
  const resolved = await resolveProductionHarvestAdapters({ env: process.env });
  if (resolved.source !== "production" || !resolved.overpass_adapter) {
    console.error(
      `fatal · sealed boot refused · source=${resolved.source} · reason=${resolved.reason}`,
    );
    await dbClient.end();
    process.exit(1);
  }
  log(`adapter · source=production · ${resolved.reason}`);
  const adapter = resolved.overpass_adapter;

  // 5. Load canonicals
  const canonicals = await loadCanonicalBatch(dbClient, cli.limit, cli.minAge);
  log(`canonicals_scanned=${canonicals.length}`);
  if (canonicals.length === 0) {
    log("nothing to enrich · exiting");
    await dbClient.end();
    process.exit(0);
  }

  // Map osm_ref → canonical row for post-probe matching
  const byOsmRef = new Map();
  const refs = [];
  for (const c of canonicals) {
    const parsed = parseOsmRef(c.osm_ref);
    if (!parsed) continue;
    byOsmRef.set(`${parsed.kind}/${parsed.id}`, c);
    refs.push(parsed);
  }

  // 6. Batches
  const batches = chunk(refs, BATCH_SIZE);
  log(`batches=${batches.length} · batch_size=${BATCH_SIZE}`);

  const summary = {
    canonicals_scanned: canonicals.length,
    batches_sent: 0,
    probes_responded: 0,
    probes_other: 0,
    elements_returned: 0,
    canonicals_updated: 0,
    fields_populated: {
      phone_e164: 0,
      website_apex: 0,
      address: 0,
      services_products: 0,
    },
    evidence_rows_written: 0,
    failures: 0,
    rate_limit_hits: 0,
    dry_run: cli.dryRun,
  };

  const startedAt = Date.now();

  // Honour the allowlist's per-host min_interval_ms (Overpass politeness).
  // The sealed adapter does NOT self-throttle between calls, so we do it here.
  const hostMinIntervalMs = Number(allowlistEntry.min_interval_ms) || 5000;
  let lastProbeAt = 0;

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    const query = buildBatchOverpassQuery(batch);
    log(`batch ${bi + 1}/${batches.length} · refs=${batch.length} · bytes=${query.length}`);

    // Politeness delay since last probe
    const sinceLast = Date.now() - lastProbeAt;
    if (sinceLast < hostMinIntervalMs) {
      const wait = hostMinIntervalMs - sinceLast;
      await new Promise((r) => setTimeout(r, wait));
    }

    // Retry loop for transient 504 / unavailable / rate_limited.
    let probe = null;
    for (let attempt = 0; attempt <= MAX_RETRIES_PER_BATCH; attempt++) {
      if (attempt > 0) {
        log(`  retry ${attempt}/${MAX_RETRIES_PER_BATCH} after ${RETRY_BACKOFF_MS}ms backoff`);
        await new Promise((res) => setTimeout(res, RETRY_BACKOFF_MS));
      }
      try {
        probe = await adapter.probe({ host: cli.host, query, timeout_ms: 60_000 });
        lastProbeAt = Date.now();
      } catch (e) {
        summary.failures++;
        log(`  probe threw · ${e.message}`);
        probe = null;
        break;
      }
      log(
        `  probe.kind=${probe.kind} elements=${probe.elements?.length ?? 0} bytes=${probe.bytes ?? 0} ms=${probe.ms ?? 0} note=${probe.note ?? "(none)"}`,
      );
      if (probe.kind === "responded" || probe.kind === "responded_zero") break;
      // Retry both unavailable (transient 504) and rate_limited (429) with backoff.
      // The adapter's internal retry count only tracks the batch loop here.
      if (probe.kind === "rate_limited") summary.rate_limit_hits++;
      if (probe.kind !== "unavailable" && probe.kind !== "rate_limited") break;
    }

    if (!probe) continue;
    summary.batches_sent++;
    if (probe.kind !== "responded" && probe.kind !== "responded_zero") {
      summary.probes_other++;
      continue;
    }
    summary.probes_responded++;

    const elements = probe.elements ?? [];
    summary.elements_returned += elements.length;

    for (const el of elements) {
      const refKey = `${el.type}/${el.id}`;
      const canonical = byOsmRef.get(refKey);
      if (!canonical) continue;
      const result = extractEnrichmentFields(el.tags ?? {}, canonical.existing);
      if (result.evidence_fields_new.length === 0) continue;

      // Count per-field BEFORE write so dry-run reflects what WOULD land.
      for (const f of result.evidence_fields_new) {
        if (f in summary.fields_populated) {
          summary.fields_populated[f] = (summary.fields_populated[f] ?? 0) + 1;
        }
      }

      if (cli.dryRun) {
        log(
          `  dry-run · would enrich ${refKey} canonical=${canonical.canonical_business_id} fields=[${result.evidence_fields_new.join(",")}]`,
        );
        continue;
      }

      const update = buildUpdateSql(result.updates, canonical.canonical_business_id);
      const evidence = buildEvidenceInsertSql({
        canonical_business_id: canonical.canonical_business_id,
        osm_ref: refKey,
        fields_new: result.evidence_fields_new,
        run_id: runId,
        founder_id: FOUNDER_ID,
        observation_generated_at: new Date().toISOString(),
      });

      try {
        await dbClient.query("BEGIN");
        if (update) await dbClient.query(update.sql, update.params);
        await dbClient.query(evidence.sql, evidence.params);
        await dbClient.query("COMMIT");
        summary.canonicals_updated++;
        summary.evidence_rows_written++;
        log(
          `  enriched ${refKey} canonical=${canonical.canonical_business_id} fields=[${result.evidence_fields_new.join(",")}]`,
        );
      } catch (e) {
        await dbClient.query("ROLLBACK").catch(() => {});
        summary.failures++;
        log(`  TX failed for ${refKey} · ${e.message}`);
      }
    }
  }

  const elapsed_s = ((Date.now() - startedAt) / 1000).toFixed(1);
  await dbClient.end();

  console.log("");
  console.log("=== canonical-osm-enrichment summary ===");
  console.log(
    JSON.stringify(
      {
        run_id: runId,
        host: cli.host,
        allowlist: {
          max_bytes: allowlistEntry.max_bytes,
          min_interval_ms: allowlistEntry.min_interval_ms,
        },
        elapsed_s,
        ...summary,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("unexpected error:", e?.message ?? e);
  process.exit(99);
});
