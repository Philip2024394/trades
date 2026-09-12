#!/usr/bin/env node
// scripts/nex-isg-phase-7-benchmark.mjs
//
// NEX ISG · Phase 7 · Speed benchmark WITH vs WITHOUT storage grid
// Founder BEGIN 2026-09-08 · §34
//
// Directly exercises the new AccommodationStorageGridAdapter against Postgres
// AND the RelationshipStore. Produces MEASURED latency + counts for:
//   - country partition read
//   - category partition read
//   - city partition read
//   - single-entity lookup
//   - list-in-city
//   - count-in-city
//   - full observation snapshot (growth + storage + coverage)
//   - relationship create + query + traverse
//
// Zero fabrication. Zero cache warming trickery. Every timing captured
// via performance.now() with individual sample values reported.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);

if (!process.env.NEX_ISG_BM_INNER) {
  const envFileArgs = fs.existsSync(path.join(repoRoot, ".env.local")) ? ["--env-file=.env.local"] : [];
  const child = spawn("npx", ["tsx", ...envFileArgs, entryFile, ...process.argv.slice(2)], {
    stdio: "inherit", cwd: repoRoot, shell: true,
    env: { ...process.env, NEX_ISG_BM_INNER: "1" },
  });
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const startedAtIso = new Date().toISOString();
  const startedAtEpoch = Date.now();
  const benchmarkId = "V5.4.6-AUTH-ISG-PHASE-7-BENCHMARK-001";

  console.log("═".repeat(72));
  console.log("NEX ISG · PHASE 7 · SPEED BENCHMARK");
  console.log("═".repeat(72));
  console.log(`Benchmark ID : ${benchmarkId}`);
  console.log(`Started      : ${startedAtIso}`);

  if (!process.env.NEX_POSTGRES_URL) {
    console.error("NEX_POSTGRES_URL unset · aborting");
    process.exit(2);
  }

  const pg = await import("pg");
  const { Pool } = pg.default ?? pg;
  const pool = new Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 3, connectionTimeoutMillis: 10000 });

  const { AccommodationStorageGridAdapter } = await import("../src/lib/nex/intelligence-storage-grid/accommodation/adapter-postgres.ts");
  const { RelationshipStore } = await import("../src/lib/nex/intelligence-storage-grid/relationship-layer/store-jsonl.ts");

  const adapter = new AccommodationStorageGridAdapter(pool);

  const measurements = {};

  const measure = async (label, iterations, fn) => {
    const samples = [];
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      try {
        await fn(i);
      } catch (e) {
        console.error(`  ${label} sample ${i} FAILED: ${e.message}`);
        samples.push({ ok: false, ms: performance.now() - t0, err: e.message });
        continue;
      }
      samples.push({ ok: true, ms: performance.now() - t0 });
    }
    const okSamples = samples.filter((s) => s.ok).map((s) => s.ms).sort((a, b) => a - b);
    const p = (f) => okSamples[Math.min(okSamples.length - 1, Math.floor(okSamples.length * f))] ?? 0;
    const stat = {
      iterations,
      ok_count: okSamples.length,
      failed_count: samples.length - okSamples.length,
      p50_ms: round(p(0.50)),
      p95_ms: round(p(0.95)),
      p99_ms: round(p(0.99)),
      max_ms: round(okSamples[okSamples.length - 1] ?? 0),
      min_ms: round(okSamples[0] ?? 0),
      samples_ms: okSamples.map(round),
    };
    measurements[label] = stat;
    console.log(`  ${label.padEnd(45)} · n=${iterations} · P50=${stat.p50_ms}ms P95=${stat.p95_ms}ms P99=${stat.p99_ms}ms max=${stat.max_ms}ms`);
  };

  console.log("\n─── Adapter benchmarks (MEASURED · via real Postgres) ─────────────────");
  await measure("listCountries", 3, () => adapter.listCountries());
  await measure("listCategories", 3, () => adapter.listCategories());
  await measure("listCitiesInCountry(ID)", 3, () => adapter.listCitiesInCountry("ID"));

  // Pick real listing_ref for entity lookup
  const refRes = await pool.query(`SELECT public_listing_ref FROM nex.accommodation_business WHERE claim_status='listed' LIMIT 20`);
  const refs = refRes.rows.map((r) => r.public_listing_ref);
  await measure("getEntityByRef (real refs · 20 iterations)", 20, (i) => adapter.getEntityByRef(refs[i % refs.length]));
  await measure("listEntitiesInCity(ID, yogyakarta, hotel, 25)", 10, () => adapter.listEntitiesInCity("ID", "yogyakarta", "hotel", 25));
  await measure("countEntitiesInCity(ID, yogyakarta)", 10, () => adapter.countEntitiesInCity("ID", "yogyakarta"));
  await measure("getFieldProvenance (real ref)", 10, (i) => adapter.getFieldProvenance(refs[i % refs.length]));
  await measure("getSourceSnapshot (real ref)", 10, (i) => adapter.getSourceSnapshot(refs[i % refs.length]));
  await measure("knowledgeRecordsForEntity (real ref)", 10, (i) => adapter.knowledgeRecordsForEntity(refs[i % refs.length]));

  console.log("\n─── Full observation snapshot ──────────────────────────────────────────");
  await measure("currentObservationSnapshot", 3, () => adapter.currentObservationSnapshot());

  console.log("\n─── Relationship layer (JSONL · in-memory) ─────────────────────────────");
  const relStore = new RelationshipStore(path.join(repoRoot, "data", "intelligence-storage-grid", "relationships", `bench_${startedAtEpoch}.jsonl`));

  // Create some relationships between real accommodation entities and simulated landmarks
  const landmarks = [
    { ref: "landmark_malioboro", lat: -7.7924, lng: 110.3657 },
    { ref: "landmark_kraton", lat: -7.8053, lng: 110.3642 },
    { ref: "landmark_prambanan", lat: -7.7520, lng: 110.4915 },
  ];
  const hotels = await pool.query(`SELECT public_listing_ref, coordinates_lat, coordinates_lng FROM nex.accommodation_business WHERE claim_status='listed' AND coordinates_lat IS NOT NULL LIMIT 25`);

  await measure("relStore.create × 75 (25 hotels × 3 landmarks)", 1, () => {
    for (const h of hotels.rows) {
      for (const l of landmarks) {
        const dKm = haversineKm(Number(h.coordinates_lat), Number(h.coordinates_lng), l.lat, l.lng);
        relStore.create({
          source_domain: "accommodation",
          source_entity_kind: "property",
          source_entity_ref: h.public_listing_ref,
          target_domain: "travel",
          target_entity_kind: "landmark",
          target_entity_ref: l.ref,
          relationship_type: "NEARBY",
          distance_km: Math.round(dKm * 1000) / 1000,
          confidence: 0.95,
          freshness_state: "FRESH",
          status: "VERIFIED",
        });
      }
    }
  });

  await measure("relStore.query by source_domain=accommodation", 10, () =>
    Promise.resolve(relStore.query({ source_domain: "accommodation", limit: 100 })),
  );
  await measure("relStore.query with max_distance_km=2", 10, () =>
    Promise.resolve(relStore.query({ source_domain: "accommodation", max_distance_km: 2, limit: 100 })),
  );
  await measure("relStore.traverse (max_hops=2)", 10, () => {
    const h = hotels.rows[0];
    return Promise.resolve(relStore.traverse({
      start_domain: "accommodation",
      start_entity_ref: h.public_listing_ref,
      max_hops: 2,
      relationship_types: ["NEARBY"],
    }));
  });

  console.log("\n─── Relationship store stats ───────────────────────────────────────────");
  const rstats = relStore.stats();
  console.log(`  total_records     : ${rstats.total_records}`);
  console.log(`  active_records    : ${rstats.active_records}`);
  console.log(`  superseded_records: ${rstats.superseded_records}`);
  console.log(`  by_type           : ${JSON.stringify(rstats.by_type)}`);

  // WITH vs WITHOUT storage grid · WITHOUT = raw pg.query, WITH = adapter methods
  console.log("\n─── WITH vs WITHOUT storage grid ───────────────────────────────────────");
  const withoutStats = {};
  const withStats = {};

  // 25 city lookups WITHOUT (raw SQL)
  const rawCityLookup = async () => {
    await pool.query(`SELECT public_listing_ref, business_name, city FROM nex.accommodation_business WHERE claim_status='listed' AND LOWER(city)=LOWER($1) ORDER BY business_name LIMIT 25`, ["yogyakarta"]);
  };
  const gridCityLookup = async () => {
    await adapter.listEntitiesInCity("ID", "yogyakarta", "hotel", 25);
  };
  const samplesRaw = [], samplesGrid = [];
  for (let i = 0; i < 15; i++) {
    let t = performance.now(); await rawCityLookup(); samplesRaw.push(performance.now() - t);
    t = performance.now(); await gridCityLookup(); samplesGrid.push(performance.now() - t);
  }
  const p = (arr, f) => arr.sort((a,b)=>a-b)[Math.min(arr.length-1, Math.floor(arr.length*f))];
  withoutStats.city_lookup = { p50: round(p(samplesRaw, 0.5)), p95: round(p(samplesRaw, 0.95)), max: round(Math.max(...samplesRaw)), n: samplesRaw.length };
  withStats.city_lookup = { p50: round(p(samplesGrid, 0.5)), p95: round(p(samplesGrid, 0.95)), max: round(Math.max(...samplesGrid)), n: samplesGrid.length };
  console.log(`  WITHOUT (raw pg SQL)   · city_lookup · P50=${withoutStats.city_lookup.p50}ms P95=${withoutStats.city_lookup.p95}ms`);
  console.log(`  WITH    (grid adapter) · city_lookup · P50=${withStats.city_lookup.p50}ms P95=${withStats.city_lookup.p95}ms`);
  console.log(`  Delta                                 · P50=${round(withStats.city_lookup.p50 - withoutStats.city_lookup.p50)}ms (adapter overhead)`);

  await pool.end();

  // Persist
  const outDir = path.join(repoRoot, "data", "intelligence-storage-grid", "benchmarks");
  fs.mkdirSync(outDir, { recursive: true });
  const stampSafe = startedAtIso.replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `phase_7_benchmark_${stampSafe}.json`);
  const record = {
    label: benchmarkId,
    schema_version: "v1.0",
    started_at_iso: startedAtIso,
    completed_at_iso: new Date().toISOString(),
    duration_ms: Date.now() - startedAtEpoch,
    postgres_url_set: !!process.env.NEX_POSTGRES_URL,
    adapter_measurements: measurements,
    relationship_stats: rstats,
    with_vs_without: {
      without: withoutStats,
      with: withStats,
      note: "adapter wraps raw pg query · overhead attributable to normalization + typing",
    },
    final_status: null,
  };
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2), "utf8");
  console.log("\n═".repeat(72));
  console.log(`MEASUREMENT COMPLETE · ${path.relative(repoRoot, outPath)}`);
  console.log(`Duration ${record.duration_ms}ms · final_status:null`);
  process.exit(0);
}

function round(n) { return Math.round(n * 100) / 100; }
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
