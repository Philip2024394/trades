// Phase 5 · Audit probe for expansion positions
// (Philip 2026-09-05 · phased workforce activation)
//
// AUDIT ONLY · no position registration · no PositionRun persistence.
// Counts existing rows in candidate directory tables so a subsequent
// AUTHORIZE literal can be issued for the specific positions worth activating.

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
const out = {
  startedAt: new Date().toISOString(),
  completedAt: null,
  status: "PENDING",
  service_business_by_category: [],
  food_business_count: null,
  mp_seller_count: null,
  transport_record_count: null,
  business_country_count: null,
  location_intelligence_count: null,
  category_registry_count: null,
  error: null,
};

async function tryQuery(pool, sql) {
  try { const r = await pool.query(sql); return r; } catch (e) { return { rows: [], _err: String(e.message) }; }
}

async function main() {
  if (!url) { out.status = "FAILED"; out.error = "NEX_POSTGRES_URL missing"; return; }
  const pool = new pg.Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 15_000 });
  try {
    const svc = await tryQuery(pool, "SELECT category_slug, COUNT(*)::int AS n FROM nex.service_business GROUP BY category_slug ORDER BY n DESC");
    out.service_business_by_category = svc.rows.length ? svc.rows : (svc._err ?? null);

    const food = await tryQuery(pool, "SELECT COUNT(*)::int AS n FROM nex.food_business");
    out.food_business_count = food.rows.length ? food.rows[0].n : (food._err ?? null);

    const mp = await tryQuery(pool, "SELECT COUNT(*)::int AS n FROM nex.mp_seller");
    out.mp_seller_count = mp.rows.length ? mp.rows[0].n : (mp._err ?? null);

    const tr = await tryQuery(pool, "SELECT COUNT(*)::int AS n FROM nex.transport_acquisition_record");
    out.transport_record_count = tr.rows.length ? tr.rows[0].n : (tr._err ?? null);

    const bc = await tryQuery(pool, "SELECT COUNT(*)::int AS n FROM nex.business_country");
    out.business_country_count = bc.rows.length ? bc.rows[0].n : (bc._err ?? null);

    const li = await tryQuery(pool, "SELECT COUNT(*)::int AS n FROM nex.location_intelligence");
    out.location_intelligence_count = li.rows.length ? li.rows[0].n : (li._err ?? null);

    const cr = await tryQuery(pool, "SELECT COUNT(*)::int AS n FROM nex.category_registry");
    out.category_registry_count = cr.rows.length ? cr.rows[0].n : (cr._err ?? null);

    out.status = "PROVEN";
    out.completedAt = new Date().toISOString();
  } catch (e) {
    out.status = "FAILED"; out.error = String(e.message); out.completedAt = new Date().toISOString();
  } finally { await pool.end().catch(() => {}); }
}

await main();
const outPath = join(HERE, "_phase5_audit.json");
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

console.log("Phase 5 · Expansion Audit Probe");
console.log("  status:", out.status);
console.log("  service_business by category:", Array.isArray(out.service_business_by_category)
  ? out.service_business_by_category.map((r) => `${r.category_slug}=${r.n}`).join(" · ")
  : out.service_business_by_category);
console.log("  food_business:", out.food_business_count);
console.log("  mp_seller:", out.mp_seller_count);
console.log("  transport_acquisition_record:", out.transport_record_count);
console.log("  business_country:", out.business_country_count);
console.log("  location_intelligence:", out.location_intelligence_count);
console.log("  category_registry:", out.category_registry_count);
if (out.error) console.log("  error:", out.error);
console.log(`  → ${outPath}`);
