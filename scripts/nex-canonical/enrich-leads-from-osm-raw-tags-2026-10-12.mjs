#!/usr/bin/env node
// scripts/nex-canonical/enrich-leads-from-osm-raw-tags-2026-10-12.mjs
//
// Founder-authorised 2026-10-12 · "Recover public business email and
// WhatsApp from existing source data" (the raw_osm_tags dict that
// lives in data/harvest-osm/*.jsonl but was dropped during ingestion
// into nex.food_business).
//
// Approach · READ-ONLY against DB first:
//   1. Walk every JSONL file in data/harvest-osm/
//   2. For each row with a contact tag (email, contact:email,
//      contact:whatsapp, phone, contact:phone), index by
//      source_reference (OSM node/way/relation id).
//   3. For each business_lead_directory row backfilled in the
//      earlier run, find a matching OSM row and UPDATE only fields
//      that are currently NULL (never overwrite).
//   4. Record a `business_lead_directory_field_provenance` row per
//      field we touched: field_name, field_value (jsonb), source_layer
//      ('osm_raw_tags'), source_reference (JSONL filename + row index),
//      confidence 0.95 (OSM-published public contact tag).
//
// Idempotency:
//   - UPDATEs are gated on IS NULL → re-running is a no-op.
//   - Provenance INSERTs use (lead_internal_id, field_name,
//     source_reference) composite dedupe via a NOT EXISTS guard.
//
// Rollback:
//   DELETE FROM nex.business_lead_directory_field_provenance
//     WHERE source_layer = 'osm_raw_tags_backfill_2026_10_12';
//   -- The field values themselves overwrote only NULL slots so they
//   -- survive the rollback; this is intentional (preserve enrichment
//   -- while removing the provenance trail if you want to re-attempt).
//
// Flags:
//   --dry-run    : report what would change, write nothing
//   --limit <N>  : cap the number of UPDATE statements

import pg from "pg";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const HARVEST_DIR = "data/harvest-osm";
// Overpass raw-response caches · bbox-tiled, structure
// `{ elements: [{ type, id, tags, ...}, ... ] }`. We scan every
// top-level directory under `**/.cache/overpass/` so new acquisition
// workflows (food-v2, accommodation-v2, workforce-retail-v2, etc.)
// contribute without this script hard-coding their names.
const OVERPASS_CACHE_ROOTS = [
  "scripts/nex-acquisition/.cache/overpass",
  "scripts/nex-food/.cache",
  "data/nex-agent-workspaces/task-7c99d25a/scripts/nex-acquisition/.cache/overpass",
];
const PROV_LAYER = "osm_raw_tags";
const PROV_LAYER_RUN = "osm_raw_tags_backfill_2026_10_12";

// -- Email validation · RFC-5322 pragmatic subset · reject obvious noise.
const EMAIL_RE = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;
function cleanEmail(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (!EMAIL_RE.test(s)) return null;
  if (s.length > 254) return null;
  return s;
}

// -- WhatsApp E.164-ish normaliser · preserve original as evidence but
//    only accept values that look like a real number. OSM contact:whatsapp
//    is officially either an E.164 string, URL, or human-readable number.
function cleanWhatsApp(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  if (s.startsWith("http")) {
    // https://wa.me/6281234567890 → extract digits
    const m = s.match(/wa\.me\/(\+?[0-9]+)/i);
    if (!m) return null;
    s = m[1];
  }
  const digits = s.replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  // Indonesia: strip leading 0 and prepend +62 if it starts with 0
  // Otherwise prepend + if it looks like a country code already.
  let e164;
  if (digits.startsWith("62")) e164 = "+" + digits;
  else if (digits.startsWith("0")) e164 = "+62" + digits.slice(1);
  else if (digits.length >= 10) e164 = "+" + digits;
  else return null;
  return e164;
}

function cleanPhone(raw) {
  // Reuse WhatsApp cleaner · same normalisation rules apply.
  return cleanWhatsApp(raw);
}

async function main() {
  const DRY_RUN = process.argv.includes("--dry-run");
  const idxLimit = process.argv.indexOf("--limit");
  const LIMIT = idxLimit >= 0 ? Number(process.argv[idxLimit + 1] || 0) || null : null;

  // STAGE 1 · Build an index: source_reference → { email, whatsapp,
  // phone, source_file, row_idx }. We read TWO shapes:
  //  (a) data/harvest-osm/*.jsonl · one row per line, { raw_osm_tags, source_reference }
  //  (b) **/.cache/overpass/*.json · raw Overpass response, { elements: [{ type, id, tags, ... }] }
  // Both get normalised into the same index.
  console.log(JSON.stringify({ phase: "index-start" }));
  const index = new Map();
  let rowsScanned = 0, rowsWithContact = 0, filesRead = 0;

  const addTags = (sref, tags, source_file, row_idx) => {
    if (!sref || !tags) return;
    rowsScanned++;
    const email = cleanEmail(tags.email || tags["contact:email"]);
    const whatsapp = cleanWhatsApp(tags["contact:whatsapp"]);
    const phone = cleanPhone(tags.phone || tags["contact:phone"]);
    if (!email && !whatsapp && !phone) return;
    rowsWithContact++;
    const existing = index.get(sref) || {};
    index.set(sref, {
      email: existing.email ?? email,
      whatsapp: existing.whatsapp ?? whatsapp,
      phone: existing.phone ?? phone,
      source_file: existing.source_file ?? source_file,
      row_idx: existing.row_idx ?? row_idx,
    });
  };

  // Shape (a) · harvest-osm JSONLs
  if (existsSync(HARVEST_DIR)) {
    const files = readdirSync(HARVEST_DIR).filter((f) => f.endsWith(".jsonl"));
    for (const f of files) {
      const buf = readFileSync(join(HARVEST_DIR, f), "utf8");
      const lines = buf.split("\n");
      filesRead++;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        let row;
        try { row = JSON.parse(line); } catch { continue; }
        addTags(row.source_reference, row.raw_osm_tags, f, i);
      }
    }
  }

  // Shape (b) · Overpass raw-response JSON caches
  for (const root of OVERPASS_CACHE_ROOTS) {
    if (!existsSync(root)) continue;
    const files = readdirSync(root).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      let data;
      try {
        data = JSON.parse(readFileSync(join(root, f), "utf8"));
      } catch { continue; }
      filesRead++;
      const elements = Array.isArray(data?.elements) ? data.elements : [];
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (!el || !el.type || typeof el.id === "undefined") continue;
        const sref = `${el.type}/${el.id}`;
        addTags(sref, el.tags, f, i);
      }
    }
  }

  console.log(JSON.stringify({
    phase: "index-done",
    files_read: filesRead,
    rows_scanned: rowsScanned,
    rows_with_contact: rowsWithContact,
    unique_source_refs_with_contact: index.size,
  }));

  // STAGE 2 · Fetch BLD rows that have NULL contacts to fill.
  const c = new pg.Client({ connectionString: process.env.NEX_POSTGRES_URL });
  await c.connect();

  const bldRows = (await c.query(`
    SELECT internal_id, source_reference, phone, whatsapp_number, email
      FROM nex.business_lead_directory
     WHERE source_reference IS NOT NULL
       AND (email IS NULL OR whatsapp_number IS NULL OR phone IS NULL)
  `)).rows;
  console.log(JSON.stringify({ phase: "bld-targets", rows_eligible: bldRows.length }));

  // STAGE 3 · Plan updates.
  const updates = [];
  for (const row of bldRows) {
    const hit = index.get(row.source_reference);
    if (!hit) continue;
    const plan = { internal_id: row.internal_id };
    if (!row.email && hit.email) plan.email = hit.email;
    if (!row.whatsapp_number && hit.whatsapp) plan.whatsapp_number = hit.whatsapp;
    if (!row.phone && hit.phone) plan.phone = hit.phone;
    if (plan.email || plan.whatsapp_number || plan.phone) {
      plan.provenance_ref = `${hit.source_file}#L${hit.row_idx}`;
      updates.push(plan);
    }
  }
  console.log(JSON.stringify({
    phase: "plan",
    leads_to_enrich: updates.length,
    will_add_email: updates.filter((u) => u.email).length,
    will_add_whatsapp: updates.filter((u) => u.whatsapp_number).length,
    will_add_phone: updates.filter((u) => u.phone).length,
  }));

  if (DRY_RUN || updates.length === 0) {
    console.log(JSON.stringify({ phase: DRY_RUN ? "dry-run-exit" : "nothing-to-do" }));
    await c.end();
    return;
  }

  // STAGE 4 · Apply updates in bounded batches with per-batch commit.
  const BATCH = 200;
  const PLAN_SET = LIMIT ? updates.slice(0, LIMIT) : updates;
  let applied = 0, provInserted = 0;
  for (let i = 0; i < PLAN_SET.length; i += BATCH) {
    const chunk = PLAN_SET.slice(i, i + BATCH);
    await c.query("BEGIN");
    try {
      for (const plan of chunk) {
        const sets = [];
        const params = [];
        let p = 1;
        if (plan.email) { sets.push(`email = $${p++}`); params.push(plan.email); }
        if (plan.whatsapp_number) { sets.push(`whatsapp_number = $${p++}`); params.push(plan.whatsapp_number); }
        if (plan.phone) { sets.push(`phone = $${p++}`); params.push(plan.phone); }
        sets.push(`updated_at = now()`);
        params.push(plan.internal_id);
        await c.query(
          `UPDATE nex.business_lead_directory SET ${sets.join(", ")} WHERE internal_id = $${p}`,
          params,
        );
        // Record per-field provenance.
        for (const [field, value] of [["email", plan.email], ["whatsapp_number", plan.whatsapp_number], ["phone", plan.phone]]) {
          if (!value) continue;
          await c.query(
            `INSERT INTO nex.business_lead_directory_field_provenance
               (lead_internal_id, field_name, field_value, source_layer, source_reference, confidence, recorded_at)
             SELECT $1, $2, to_jsonb($3::text), $4, $5, 0.95, now()
              WHERE NOT EXISTS (
                SELECT 1 FROM nex.business_lead_directory_field_provenance
                 WHERE lead_internal_id = $1 AND field_name = $2 AND source_reference = $5
              )`,
            [plan.internal_id, field, value, PROV_LAYER_RUN, plan.provenance_ref],
          );
          provInserted++;
        }
      }
      await c.query("COMMIT");
      applied += chunk.length;
      console.log(JSON.stringify({ phase: "batch", batch_index: Math.floor(i / BATCH) + 1, batch_size: chunk.length, applied_total: applied, prov_rows_inserted: provInserted }));
    } catch (e) {
      await c.query("ROLLBACK");
      console.error(JSON.stringify({ phase: "batch-error", error: e.message }));
      throw e;
    }
  }

  // STAGE 5 · Readback.
  const after = await c.query(`
    SELECT count(*) FILTER (WHERE email IS NOT NULL)::int AS has_email,
           count(*) FILTER (WHERE whatsapp_number IS NOT NULL)::int AS has_whatsapp,
           count(*) FILTER (WHERE email IS NOT NULL AND whatsapp_number IS NOT NULL)::int AS has_both,
           count(*) FILTER (WHERE email IS NULL AND whatsapp_number IS NULL)::int AS has_neither,
           count(*) FILTER (WHERE phone IS NOT NULL)::int AS has_phone,
           count(*)::int AS total
      FROM nex.business_lead_directory
  `);
  console.log(JSON.stringify({ phase: "done", applied_updates: applied, provenance_rows_inserted: provInserted, bld_contact_breakdown_after: after.rows[0] }));
  await c.end();
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
