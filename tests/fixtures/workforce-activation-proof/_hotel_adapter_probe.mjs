// Phase 3 · Hotel/Accommodation directory adapter probe
// (Philip 2026-09-05 · phased workforce activation)
//
// A minimum read-only adapter that connects to the local NEX_POSTGRES_URL,
// counts rows in nex.accommodation_business, samples 10 records, and writes
// an evidence file the workforce runner can attribute to hotel_accommodation.
//
// SAFETY:
//   · READ-ONLY (SELECT COUNT · SELECT LIMIT 10 · no writes · no schema changes)
//   · Fail-loud on any connection issue (never silently succeeds)
//   · No production DB targeting (uses NEX_POSTGRES_URL · local PG17 :5433 per repo convention)
//   · Emits _hotel_probe.json for downstream attribution · not raw dump
//
// USAGE: node tests/fixtures/workforce-activation-proof/_hotel_adapter_probe.mjs

import pg from "pg";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");

// Load .env.local like the walker script does
if (existsSync(join(ROOT, ".env.local"))) {
  for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEX_POSTGRES_URL;
const probeOutput = {
  startedAt: new Date().toISOString(),
  completedAt: null,
  status: "PENDING",
  db_url_present: !!url,
  row_count: null,
  sample_rows: [],
  categories_seen: [],
  cities_seen: [],
  claim_status_seen: [],
  error: null,
};

async function main() {
  if (!url) {
    probeOutput.status = "FAILED";
    probeOutput.error = "NEX_POSTGRES_URL is not set · adapter cannot connect · Phase 3 NEVER_PROVEN honestly";
    return;
  }

  const pool = new pg.Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 15_000 });

  try {
    const countRes = await pool.query("SELECT COUNT(*)::int AS n FROM nex.accommodation_business");
    probeOutput.row_count = countRes.rows[0].n;

    const sampleRes = await pool.query(
      "SELECT public_listing_ref, business_name, category, city, district, claim_status, coordinates_lat, coordinates_lng, worker_id, cycle_run_id FROM nex.accommodation_business ORDER BY created_at DESC NULLS LAST LIMIT 10",
    );
    probeOutput.sample_rows = sampleRes.rows;

    const catsRes = await pool.query(
      "SELECT category, COUNT(*)::int AS n FROM nex.accommodation_business GROUP BY category ORDER BY n DESC",
    );
    probeOutput.categories_seen = catsRes.rows;

    const citiesRes = await pool.query(
      "SELECT city, COUNT(*)::int AS n FROM nex.accommodation_business GROUP BY city ORDER BY n DESC LIMIT 10",
    );
    probeOutput.cities_seen = citiesRes.rows;

    const statusRes = await pool.query(
      "SELECT claim_status, COUNT(*)::int AS n FROM nex.accommodation_business GROUP BY claim_status ORDER BY n DESC",
    );
    probeOutput.claim_status_seen = statusRes.rows;

    probeOutput.status = "PROVEN";
    probeOutput.completedAt = new Date().toISOString();
  } catch (e) {
    probeOutput.status = "FAILED";
    probeOutput.error = String(e && e.message ? e.message : e);
    probeOutput.completedAt = new Date().toISOString();
  } finally {
    await pool.end().catch(() => {});
  }
}

await main();

const outPath = join(HERE, "_hotel_probe.json");
writeFileSync(outPath, JSON.stringify(probeOutput, null, 2) + "\n", "utf8");

console.log("Phase 3 · Hotel Adapter Probe");
console.log("  status:", probeOutput.status);
console.log("  row_count:", probeOutput.row_count);
console.log("  categories:", probeOutput.categories_seen.map((c) => `${c.category}=${c.n}`).join(" · "));
console.log("  cities:", probeOutput.cities_seen.map((c) => `${c.city}=${c.n}`).slice(0, 5).join(" · "));
console.log("  claim_status:", probeOutput.claim_status_seen.map((s) => `${s.claim_status}=${s.n}`).join(" · "));
if (probeOutput.error) console.log("  error:", probeOutput.error);
console.log(`  → ${outPath}`);

if (probeOutput.status !== "PROVEN") process.exit(1);
