#!/usr/bin/env node
// NEX Food · Enrichment agent 'osm_reextract' · Phase 8.0.
//
// Pulls every field we ALREADY have in nex.food_business_source_snapshot
// (raw OSM tags) but didn't extract into typed columns during Phase 2.
// Writes each finding as an evidence row · never overwrites nex.food_business
// directly (that's the application step · respects the trust hierarchy).
//
// Zero external calls · zero cost · zero ToS risk · runs against local
// Postgres. Should be the FIRST enrichment agent to run.
//
// Fields we probe from the raw OSM payload:
//   contact:whatsapp   →  whatsapp_number
//   phone / contact:phone → phone
//   website / contact:website → website
//   instagram / contact:instagram → social:instagram
//   facebook / contact:facebook → social:facebook
//   opening_hours → opening_hours (raw string)
//   cuisine → cuisine
//   diet:vegetarian / diet:vegan / diet:halal → dietary tags
//   payment:* → payment methods
//   delivery, takeaway, dine_in → service methods
//   addr:full, addr:street/housenumber/suburb/city/postcode → address parts
//   name:en, name:id → localised names
//   description → description
//   brand → brand
//   wheelchair → accessibility
//   internet_access → wifi
//
// USAGE
//   NEX_POSTGRES_URL=... node scripts/nex-food/enrich-from-osm-snapshots.mjs [--dry-run]

import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OSM_CACHE = join(__dirname, ".cache", "osm-yogyakarta.json");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

// Map OSM tag → NEX evidence field. Priority-ordered: first match wins per field.
const FIELD_MAPPERS = [
  { field: "whatsapp_number",   tags: ["contact:whatsapp", "whatsapp"],           confidence: 0.85 },
  { field: "phone",             tags: ["contact:phone", "phone"],                 confidence: 0.85 },
  { field: "website",           tags: ["contact:website", "website"],             confidence: 0.90 },
  { field: "social:instagram",  tags: ["contact:instagram", "instagram"],         confidence: 0.85 },
  { field: "social:facebook",   tags: ["contact:facebook", "facebook"],           confidence: 0.85 },
  { field: "social:tiktok",     tags: ["contact:tiktok", "tiktok"],               confidence: 0.85 },
  { field: "social:youtube",    tags: ["contact:youtube", "youtube"],             confidence: 0.85 },
  { field: "opening_hours",     tags: ["opening_hours"],                          confidence: 0.85 },
  { field: "cuisine",           tags: ["cuisine"],                                confidence: 0.75 },
  { field: "diet:vegetarian",   tags: ["diet:vegetarian"],                        confidence: 0.80 },
  { field: "diet:vegan",        tags: ["diet:vegan"],                             confidence: 0.80 },
  { field: "diet:halal",        tags: ["diet:halal"],                             confidence: 0.80 },
  { field: "service:delivery",  tags: ["delivery"],                               confidence: 0.75 },
  { field: "service:takeaway",  tags: ["takeaway"],                               confidence: 0.75 },
  { field: "service:dine_in",   tags: ["dine_in"],                                confidence: 0.75 },
  { field: "service:drive_through", tags: ["drive_through"],                      confidence: 0.75 },
  { field: "name:en",           tags: ["name:en"],                                confidence: 0.90 },
  { field: "name:id",           tags: ["name:id"],                                confidence: 0.90 },
  { field: "brand",             tags: ["brand"],                                  confidence: 0.85 },
  { field: "description",       tags: ["description", "note"],                    confidence: 0.60 },
  { field: "wheelchair_access", tags: ["wheelchair"],                             confidence: 0.75 },
  { field: "internet_access",   tags: ["internet_access"],                        confidence: 0.75 },
  { field: "addr:street",       tags: ["addr:street"],                            confidence: 0.90 },
  { field: "addr:housenumber",  tags: ["addr:housenumber"],                       confidence: 0.90 },
  { field: "addr:suburb",       tags: ["addr:suburb"],                            confidence: 0.90 },
  { field: "addr:postcode",     tags: ["addr:postcode"],                          confidence: 0.90 },
];

/**
 * Load the raw OSM cache (all 812 elements with their untranslated tags).
 * Match each element back to its NEX business via source_reference (osm/node/<id>).
 */
async function loadRawOsmMappedToBusinesses() {
  const cache = JSON.parse(readFileSync(OSM_CACHE, "utf8"));
  const elementsByNodeId = new Map();
  for (const el of cache.elements ?? []) {
    if (el.type === "node" && el.id != null) elementsByNodeId.set(String(el.id), el);
  }
  // Query businesses to get source_reference → we look them up in the raw cache
  const r = await pool.query(`
    SELECT public_listing_ref, source_reference, claim_status, owner_status
    FROM nex.food_business
    WHERE source = 'openstreetmap_overpass_v1'
      AND source_reference IS NOT NULL
  `);
  const mapped = [];
  for (const row of r.rows) {
    const osmId = row.source_reference.replace(/^osm\/node\//, "");
    const el = elementsByNodeId.get(osmId);
    if (!el) continue;
    mapped.push({
      businessRef: row.public_listing_ref,
      claimStatus: row.claim_status,
      ownerStatus: row.owner_status,
      sourceReference: row.source_reference,
      tags: el.tags ?? {},
    });
  }
  return mapped;
}

// Fetch existing provenance per (business, field) so we don't overwrite
// owner_verified · admin_verified. Also skip if we already wrote evidence
// for this exact (business, field, source_url) recently (idempotent).
async function loadProvenance() {
  const r = await pool.query(`
    SELECT business_ref, field_name, trust_layer
    FROM nex.food_business_field_provenance
  `);
  const m = new Map();
  for (const row of r.rows) {
    m.set(`${row.business_ref}|${row.field_name}`, row.trust_layer);
  }
  return m;
}

async function loadExistingEvidence() {
  const r = await pool.query(`
    SELECT DISTINCT business_ref, field_name
    FROM nex.food_enrichment_evidence
    WHERE agent_name = 'osm_reextract'
  `);
  const s = new Set();
  for (const row of r.rows) s.add(`${row.business_ref}|${row.field_name}`);
  return s;
}

function extractFieldValue(tags, mapper) {
  // OSM tags are keyed as-is (e.g. "contact:whatsapp"). Direct lookup.
  for (const tagName of mapper.tags) {
    const v = tags[tagName];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

async function main() {
  console.log("── NEX Food · OSM snapshot re-extraction ──");
  console.log(`  mode: ${dryRun ? "DRY RUN" : "APPLY"}`);
  console.log("");

  const [mapped, provenance, existing] = await Promise.all([
    loadRawOsmMappedToBusinesses(),
    loadProvenance(),
    loadExistingEvidence(),
  ]);
  console.log(`  businesses with raw OSM tags matched: ${mapped.length}`);
  console.log("");

  let evidenceRowsWritten = 0;
  let evidenceRowsSkipped = 0;
  let evidenceRowsBlockedByOwner = 0;
  const perField = {};

  for (const item of mapped) {
    for (const mapper of FIELD_MAPPERS) {
      const val = extractFieldValue(item.tags, mapper);
      if (val == null) continue;

      const provKey = `${item.businessRef}|${mapper.field}`;
      const existingLayer = provenance.get(provKey);
      if (existingLayer === "owner_verified" || existingLayer === "admin_verified") {
        evidenceRowsBlockedByOwner++;
        continue;
      }
      if (existing.has(provKey)) {
        evidenceRowsSkipped++;
        continue;
      }

      perField[mapper.field] = (perField[mapper.field] ?? 0) + 1;

      if (!dryRun) {
        await pool.query(
          `INSERT INTO nex.food_enrichment_evidence
             (business_ref, field_name, value, value_normalised,
              source, source_type, source_url,
              confidence, agent_name, provenance_layer, raw_snippet)
           VALUES ($1, $2, $3, $4, 'openstreetmap_overpass_v1', 'openstreetmap', $5, $6, 'osm_reextract', 'source_import', $7)`,
          [
            item.businessRef,
            mapper.field,
            val,
            val.toLowerCase().replace(/\s+/g, " ").trim(),
            item.sourceReference,
            mapper.confidence,
            val.slice(0, 500),
          ]
        );
        existing.add(provKey);
      }
      evidenceRowsWritten++;
    }
  }

  console.log("── Summary ──");
  console.log(`  evidence rows written        : ${evidenceRowsWritten}`);
  console.log(`  skipped (already extracted)  : ${evidenceRowsSkipped}`);
  console.log(`  blocked (owner/admin verified): ${evidenceRowsBlockedByOwner}`);
  console.log("");
  console.log("  per-field discovery counts:");
  Object.entries(perField).sort((a, b) => b[1] - a[1]).forEach(([f, n]) => {
    console.log(`    ${f.padEnd(24)} ${n}`);
  });

  await pool.end();
}

main().catch((err) => { console.error(`FATAL: ${err.message}`); console.error(err.stack); process.exit(1); });
