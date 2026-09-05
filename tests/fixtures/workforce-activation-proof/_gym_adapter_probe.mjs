// Phase 4 · Gym/Fitness directory adapter probe
// (Philip 2026-09-05 · phased workforce activation)
//
// Reads nex.service_business filtered by category_slug='gyms' (per migration 110).
// Same read-only pattern as _hotel_adapter_probe.mjs.

import pg from "pg";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");

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
  category_slug: "gyms",
  row_count: null,
  sample_rows: [],
  cities_seen: [],
  claim_status_seen: [],
  owner_status_seen: [],
  error: null,
};

async function main() {
  if (!url) {
    probeOutput.status = "FAILED";
    probeOutput.error = "NEX_POSTGRES_URL is not set";
    return;
  }
  const pool = new pg.Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 15_000 });
  try {
    const countRes = await pool.query(
      "SELECT COUNT(*)::int AS n FROM nex.service_business WHERE category_slug = 'gyms'",
    );
    probeOutput.row_count = countRes.rows[0].n;

    if (probeOutput.row_count > 0) {
      const sampleRes = await pool.query(
        "SELECT public_listing_ref, business_name, city, district, phone, website, owner_status, source FROM nex.service_business WHERE category_slug = 'gyms' ORDER BY created_at DESC NULLS LAST LIMIT 10",
      );
      probeOutput.sample_rows = sampleRes.rows;

      const citiesRes = await pool.query(
        "SELECT city, COUNT(*)::int AS n FROM nex.service_business WHERE category_slug = 'gyms' GROUP BY city ORDER BY n DESC LIMIT 10",
      );
      probeOutput.cities_seen = citiesRes.rows;

      const ownerRes = await pool.query(
        "SELECT COALESCE(owner_status,'null') AS owner_status, COUNT(*)::int AS n FROM nex.service_business WHERE category_slug = 'gyms' GROUP BY owner_status ORDER BY n DESC",
      );
      probeOutput.owner_status_seen = ownerRes.rows;
    }

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

const outPath = join(HERE, "_gym_probe.json");
writeFileSync(outPath, JSON.stringify(probeOutput, null, 2) + "\n", "utf8");

console.log("Phase 4 · Gym Adapter Probe");
console.log("  status:", probeOutput.status);
console.log("  row_count:", probeOutput.row_count);
if (probeOutput.cities_seen.length > 0) console.log("  cities:", probeOutput.cities_seen.map((c) => `${c.city}=${c.n}`).slice(0, 5).join(" · "));
if (probeOutput.owner_status_seen.length > 0) console.log("  owner_status:", probeOutput.owner_status_seen.map((s) => `${s.owner_status}=${s.n}`).join(" · "));
if (probeOutput.error) console.log("  error:", probeOutput.error);
console.log(`  → ${outPath}`);
