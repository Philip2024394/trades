#!/usr/bin/env node
// seed-geo.mjs · deterministic province + city EntityRecord seed.
//
// Reads two authoritative datasets that already exist in the repo:
//   · data/indonesia/geo/provinces.json      (38 provinces · ISO 3166-2)
//   · data/nex-city-catalogue.json           (518 cities · coords + bbox)
//
// Emits one `place` EntityRecord per province + per city and merges
// into data/indonesia/knowledge-entities.json. Idempotent by id
// (rerunning does not duplicate) · UPDATES existing seeded rows if
// upstream registries changed.
//
// Provenance:
//   Tier B · seed source is a curated reference registry, not a
//   primary observation. Live sources (BMKG) stay Tier A · this
//   never displaces them.
//
// Freshness: long_lived · administrative geography rarely changes.
//
// Run: npm run data:seed-geo

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

if (!process.env.__SEED_GEO_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __SEED_GEO_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

async function inner() {
  const { scoreEntity } = await import("../../src/lib/nex/indonesia/data/quality.ts");
  const { stampVerified } = await import("../../src/lib/nex/indonesia/data/freshness.ts");

  const provincesFile = path.join(repoRoot, "data/indonesia/geo/provinces.json");
  const citiesFile = path.join(repoRoot, "data/nex-city-catalogue.json");
  const entFile = path.join(repoRoot, "data/indonesia/knowledge-entities.json");

  const provinces = JSON.parse(readFileSync(provincesFile, "utf8"));
  const citiesRoot = JSON.parse(readFileSync(citiesFile, "utf8"));
  const cities = Array.isArray(citiesRoot) ? citiesRoot : (Array.isArray(citiesRoot.cities) ? citiesRoot.cities : []);
  const existing = existsSync(entFile) ? JSON.parse(readFileSync(entFile, "utf8")) : { entities: [] };
  const existingById = new Map(existing.entities.map((e) => [e.id, e]));

  const now = new Date();
  const nowIso = now.toISOString();
  const newOrUpdated = [];

  // ─── PROVINCES · 38 records ────────────────────────────────────
  for (const p of provinces) {
    const id = `place:province:${p.slug}`;
    const record = {
      id,
      kind: "place",
      category: "geo.province",
      name: p.name,
      description: `${p.name} is a province of Indonesia (ISO ${p.code}) in the ${p.region} region of ${p.island}. Provincial capital: ${p.capital}.`,
      // Keywords are DISTINGUISHING tokens only · no generic terms
      // like "province"/"provinsi" that appear on every record and
      // swamp specific-topic queries. Deduped · lowercased.
      keywords: uniq([
        p.name.toLowerCase(),
        p.slug,
        p.capital.toLowerCase(),
        // Only include island if it isn't the same as the province name
        // (e.g. don't add "bali" island for the Bali province).
        p.island.toLowerCase() !== p.name.toLowerCase() ? p.island.toLowerCase() : null,
      ].filter(Boolean)),
      lifecycle: "PUBLISHED",
      lifecycleChangedAt: nowIso,
      provenance: [{
        walkerId: "seed.geo.provinces",
        sourceKey: "nex.geo.provinces.json",
        sourceName: "NEX Geographic Registry (provinces.json)",
        sourceTier: "B",
        market: "ID",
        firstDiscoveredAt: nowIso,
        lastCheckedAt: nowIso,
        lastChangedAt: nowIso,
        observedAt: nowIso,
      }],
      freshness: stampVerified("long_lived", now),
      geo: {
        province: p.slug,
        island: p.island,
      },
      attributes: {
        iso3166_2: p.code,
        capital: p.capital,
        region: p.region,
        island: p.island,
      },
    };
    // Preserve existing provenance if id already exists (append semantics
    // handled by future merge · here we replace idempotently since the
    // seed source is the sole authority for this record).
    record.quality = scoreEntity(record, now);
    newOrUpdated.push({ record, existed: existingById.has(id) });
    existingById.set(id, record);
  }

  // ─── CITIES · 518 records ──────────────────────────────────────
  for (const c of cities) {
    if (!c.slug || !c.canonical) continue;
    const id = `place:city:${c.slug}`;
    // Best-effort province-slug: match by name against provinces registry
    const provinceMatch = provinces.find((p) => p.name.toLowerCase() === (c.province ?? "").toLowerCase());
    const provinceSlug = provinceMatch?.slug ?? (c.province ?? "").toLowerCase().replace(/\s+/g, "-");
    const record = {
      id,
      kind: "place",
      category: "geo.city",
      name: c.canonical,
      description: `${c.canonical} is a city/regency in ${c.province ?? "Indonesia"}${c.region && c.region !== c.province ? ` (${c.region})` : ""}.`,
      // Distinguishing tokens only · no generic city/kota/regency terms.
      // Deliberately does NOT include the province slug or island name
      // in keywords · a query about "Bali" should surface the Bali
      // province/tourism record, not every city inside Bali. Aliases
      // that equal the province/island name are filtered out too (the
      // catalogue lists "Bali" as an alias of Denpasar for user-facing
      // reasons but retrieval must not treat "Bali" as denpasar's
      // signal · surfaced by real guardian regression).
      keywords: uniq([
        c.canonical.toLowerCase(),
        c.slug,
        ...(Array.isArray(c.aliases) ? c.aliases.map((a) => String(a).toLowerCase()) : []),
      ].filter((k) => k !== (c.province ?? "").toLowerCase() && k !== (provinceMatch?.island ?? "").toLowerCase())),
      lifecycle: "PUBLISHED",
      lifecycleChangedAt: nowIso,
      provenance: [{
        walkerId: "seed.geo.cities",
        sourceKey: "nex.geo.city-catalogue.json",
        sourceName: "NEX City Catalogue (518 Indonesian cities)",
        sourceTier: "B",
        market: "ID",
        firstDiscoveredAt: nowIso,
        lastCheckedAt: nowIso,
        lastChangedAt: nowIso,
        observedAt: nowIso,
      }],
      freshness: stampVerified("long_lived", now),
      geo: {
        province: provinceSlug,
        regency: c.canonical.toLowerCase(),
        island: provinceMatch?.island,
        lat: c.centroid?.lat,
        lng: c.centroid?.lng,
        geoConfidence: c.centroid ? 1 : 0.4,
      },
      // Filter aliases the same way as keywords · retrieval scoring
      // grants +0.7 per alias-match, so a "Bali"-as-alias-of-Denpasar
      // pull the city record ahead of Bali-scoped records.
      aliases: Array.isArray(c.aliases)
        ? c.aliases.filter((a) => {
            const s = String(a).toLowerCase();
            return s !== (c.province ?? "").toLowerCase() && s !== (provinceMatch?.island ?? "").toLowerCase();
          })
        : undefined,
      attributes: {
        provinceName: c.province,
        region: c.region,
        bboxSw: c.bboxSw,
        bboxNe: c.bboxNe,
        priority: c.priority,
      },
    };
    record.quality = scoreEntity(record, now);
    newOrUpdated.push({ record, existed: existingById.has(id) });
    existingById.set(id, record);
  }

  // ─── WRITE ATOMICALLY ──────────────────────────────────────────
  const allEntities = [...existingById.values()];
  const out = {
    generatedAt: nowIso,
    schemaVersion: 1,
    count: allEntities.length,
    entities: allEntities,
  };
  mkdirSync(path.dirname(entFile), { recursive: true });
  const tmp = entFile + ".tmp";
  writeFileSync(tmp, JSON.stringify(out, null, 2) + "\n");
  renameSync(tmp, entFile);

  // ─── REPORT ────────────────────────────────────────────────────
  const provincesEmitted = newOrUpdated.filter((r) => r.record.category === "geo.province").length;
  const provincesNew = newOrUpdated.filter((r) => r.record.category === "geo.province" && !r.existed).length;
  const citiesEmitted = newOrUpdated.filter((r) => r.record.category === "geo.city").length;
  const citiesNew = newOrUpdated.filter((r) => r.record.category === "geo.city" && !r.existed).length;
  const qualityHi = newOrUpdated.filter((r) => (r.record.quality?.overall ?? 0) >= 0.7).length;

  console.log(`\n═════════════ SEED GEO REPORT ═════════════`);
  console.log(`Provinces emitted: ${provincesEmitted}  (new: ${provincesNew} · updated: ${provincesEmitted - provincesNew})`);
  console.log(`Cities emitted:    ${citiesEmitted}  (new: ${citiesNew} · updated: ${citiesEmitted - citiesNew})`);
  console.log(`Quality ≥ 0.7:     ${qualityHi} / ${newOrUpdated.length}`);
  console.log(`Total corpus:      ${allEntities.length} entities`);
  console.log(`Written:           ${path.relative(repoRoot, entFile)}`);
  console.log(`═══════════════════════════════════════════\n`);
}
