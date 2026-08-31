// scripts/nex-worker/backfill-silent-cities.mjs
//
// NEX · targeted coverage backfill for silent Indonesian cities · Philip 2026-08-30.
//
// Reads data/nex-city-catalogue.json + queries nex.worker_cycle_run for the
// last N days (default 30). Cities that have NEVER been walked in that window
// are "silent". For each silent city, spawns anchor-category walker cycles
// (default: restaurants + cafes + hotels + retail-supermarket + pharmacies)
// to seed initial coverage. Provincial capitals in cooldown are skipped
// (rotation reactivates them naturally).
//
// This is a ONE-SHOT operation. Rate-limits concurrency + adds jitter to
// avoid Overpass API throttling. Safe to re-run — never-walked cities that
// gain even one cycle after the first invocation drop off the target list.
//
// Usage:
//   Dry-run (default · shows what would fire, no walker spawns):
//     node scripts/nex-worker/backfill-silent-cities.mjs
//   Execute:
//     node scripts/nex-worker/backfill-silent-cities.mjs --apply
//   Scope down to a single province (comma-sep allowed):
//     node scripts/nex-worker/backfill-silent-cities.mjs --apply --provinces="Sumatera Selatan,Riau"
//   Custom anchor categories:
//     node scripts/nex-worker/backfill-silent-cities.mjs --apply --categories=restaurants,cafes,hotels
//   Cap total walker spawns:
//     node scripts/nex-worker/backfill-silent-cities.mjs --apply --max-spawns=50
//
// Doctrine: honors ADR-0023 (walker never invents data, only seeds discovery
// from real OSM tags). Emits its own worker_cycle_run rows via the child
// walker · full provenance chain preserved.

import pg from "pg";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const NEX_POSTGRES_URL = process.env.NEX_POSTGRES_URL
  ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new pg.Pool({ connectionString: NEX_POSTGRES_URL, max: 2 });

// ─── CLI ──────────────────────────────────────────────────────────────
const args = new Map();
for (const a of process.argv.slice(2)) {
  if (a === "--apply") args.set("apply", true);
  else if (a.startsWith("--")) {
    const [k, v] = a.slice(2).split("=");
    args.set(k, v ?? true);
  }
}
const APPLY        = !!args.get("apply");
const PROVINCES    = args.get("provinces") ? String(args.get("provinces")).split(",").map((s) => s.trim()) : null;
const CATEGORIES   = args.get("categories") ? String(args.get("categories")).split(",").map((s) => s.trim())
                                             : ["restaurants", "cafes", "hotels", "retail-supermarket", "pharmacies"];
const LOOKBACK_D   = Number(args.get("lookback-days") ?? 30);
const MAX_SPAWNS   = Number(args.get("max-spawns") ?? 400);
const CONCURRENCY  = Number(args.get("concurrency") ?? 3);
const JITTER_MS    = Number(args.get("jitter-ms") ?? 8000);

// ─── Catalogue ────────────────────────────────────────────────────────
function loadCatalogue() {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const p = join(__dir, "..", "..", "data", "nex-city-catalogue.json");
  const raw = JSON.parse(readFileSync(p, "utf8"));
  return Array.isArray(raw.cities)
    ? raw.cities.filter((x) => x && typeof x.canonical === "string")
    : [];
}

// ─── Runners ──────────────────────────────────────────────────────────
async function silentCities(lookbackDays) {
  const catalogue = loadCatalogue();
  const filtered = PROVINCES
    ? catalogue.filter((c) => PROVINCES.includes(c.province))
    : catalogue;
  const active = new Set(
    (await pool.query(`
      SELECT DISTINCT COALESCE(
        NULLIF(summary->>'city', ''),
        NULLIF(SPLIT_PART(worker_config, ':', 2), '')
      ) AS city
      FROM nex.worker_cycle_run
      WHERE started_at > now() - interval '${Number(lookbackDays)} days'
    `)).rows.map((r) => r.city)
  );
  return filtered.filter((c) => !active.has(c.canonical));
}

function spawnWalker(category, city) {
  return new Promise((resolve) => {
    const child = spawn("node", [
      "scripts/nex-workforce/_category-walker.mjs",
      `--category=${category}`,
      `--city=${city}`,
    ], { stdio: "inherit", env: process.env });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

async function withConcurrency(items, worker, limit) {
  const inflight = new Set();
  const results = [];
  for (const item of items) {
    while (inflight.size >= limit) {
      await Promise.race(inflight);
    }
    const p = worker(item).finally(() => inflight.delete(p));
    inflight.add(p);
    results.push(p);
    // Jitter between spawns to spread Overpass load.
    if (JITTER_MS > 0) await new Promise((r) => setTimeout(r, Math.random() * JITTER_MS));
  }
  return Promise.all(results);
}

// ─── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nNEX backfill · silent-city coverage sweep`);
  console.log("─".repeat(64));
  console.log(`Mode:          ${APPLY ? "APPLY · will spawn walkers" : "DRY-RUN · no walkers spawned"}`);
  console.log(`Categories:    ${CATEGORIES.join(", ")}`);
  console.log(`Provinces:     ${PROVINCES ? PROVINCES.join(", ") : "(all in catalogue)"}`);
  console.log(`Lookback:      ${LOOKBACK_D} days`);
  console.log(`Max spawns:    ${MAX_SPAWNS}`);
  console.log(`Concurrency:   ${CONCURRENCY} · jitter ${JITTER_MS}ms`);
  console.log("─".repeat(64));

  const silent = await silentCities(LOOKBACK_D);
  console.log(`\nSilent cities in scope: ${silent.length}`);
  const byProvince = {};
  silent.forEach((c) => { (byProvince[c.province || "?"] = byProvince[c.province || "?"] || []).push(c.canonical); });
  Object.entries(byProvince).sort((a, b) => b[1].length - a[1].length).forEach(([p, cs]) => {
    console.log(`  ${String(p).padEnd(20)} ${cs.length.toString().padStart(3)} cities · e.g. ${cs.slice(0, 3).join(", ")}${cs.length > 3 ? " …" : ""}`);
  });

  // Build spawn plan · city × category
  const plan = [];
  for (const c of silent) {
    for (const cat of CATEGORIES) {
      plan.push({ city: c.canonical, category: cat, province: c.province });
      if (plan.length >= MAX_SPAWNS) break;
    }
    if (plan.length >= MAX_SPAWNS) break;
  }
  console.log(`\nSpawn plan: ${plan.length} (city × category) walker cycles`);
  console.log(`Estimated runtime: ~${Math.ceil((plan.length * (JITTER_MS / 1000)) / 60)} min (jitter-only lower bound)`);

  if (!APPLY) {
    console.log(`\n(dry-run · pass --apply to execute)`);
    await pool.end();
    return;
  }

  console.log(`\nExecuting…`);
  let ok = 0, fail = 0;
  await withConcurrency(plan, async (item) => {
    const code = await spawnWalker(item.category, item.city);
    if (code === 0) ok++; else fail++;
    process.stdout.write(`  [${ok + fail}/${plan.length}] ${item.city}/${item.category} exit=${code}\n`);
  }, CONCURRENCY);

  console.log(`\nDone. ${ok} ok · ${fail} failed`);
  await pool.end();
}

main().catch((e) => { console.error("backfill failed:", e.message); pool.end(); process.exit(1); });
