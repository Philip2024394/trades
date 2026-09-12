// src/lib/nex/lab/executors/activities-executor.ts
//
// Founder ADR-0304 · Per-domain promotion executor · ACTIVITIES.
//
// Target: nex.brain_attractions (existing table)
// Source: nex_lab_activities.verified (via nex_lab.promotion_rows join)
//
// SAVEPOINT per row · idempotent by (location_slug, name_en).

import type { PoolClient } from "pg";

export interface ActivitiesExecuteResult {
  inserted: number;
  updated:  number;
  skipped:  number;
  errors:   string[];
}

function slugify(s: string): string {
  return String(s || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "unknown";
}

// nex.brain_attractions.attraction_kind CHECK constraint · only these:
//   'temple' 'beach' 'waterfall' 'mountain' 'national_park' 'museum'
//   'monument' 'historical_site' 'viewpoint' 'market' 'village' 'other'
function attractionKind(name: string, rawTags: Record<string, unknown> | undefined): string {
  const tourism = String(rawTags?.tourism ?? "");
  const leisure = String(rawTags?.leisure ?? "");
  const historic = String(rawTags?.historic ?? "");
  const nameL = name.toLowerCase();
  if (tourism === "museum") return "museum";
  if (tourism === "viewpoint") return "viewpoint";
  if (tourism === "monument" || historic === "monument") return "monument";
  if (leisure === "beach_resort" || nameL.includes("beach") || nameL.includes("pantai")) return "beach";
  if (nameL.includes("temple") || nameL.includes("pura") || nameL.includes("candi")) return "temple";
  if (nameL.includes("waterfall") || nameL.includes("air terjun") || nameL.includes("curug")) return "waterfall";
  if (nameL.includes("mountain") || nameL.includes("gunung") || nameL.includes("volcano")) return "mountain";
  if (nameL.includes("market") || nameL.includes("pasar")) return "market";
  if (nameL.includes("national park") || nameL.includes("taman nasional")) return "national_park";
  if (historic) return "historical_site";
  if (nameL.includes("village") || nameL.includes("desa") || nameL.includes("kampung")) return "village";
  return "other";
}

export async function executeActivitiesPromotion(
  client: PoolClient,
  promotion_id: string,
): Promise<ActivitiesExecuteResult> {
  const out: ActivitiesExecuteResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };

  const rows = (await client.query(
    `SELECT pr.subject_ref, v.field_value, v.confidence, v.evidence_refs, v.source_count
     FROM nex_lab.promotion_rows pr
     JOIN nex_lab_activities.verified v ON v.subject_ref = pr.subject_ref
     WHERE pr.promotion_id = $1 AND v.field_name = 'identity'`,
    [promotion_id],
  )).rows;

  for (const r of rows) {
    const fv = r.field_value ?? {};
    const name = String(fv.name ?? "").trim();
    const lat = fv.coordinates?.lat;
    const lon = fv.coordinates?.lon;
    if (!name || typeof lat !== "number" || typeof lon !== "number") { out.skipped++; continue; }
    const location = slugify(fv.city ?? "indonesia");
    const kind = attractionKind(name, fv.raw_tags as Record<string, unknown> | undefined);
    const sp = `sp_${r.subject_ref.slice(0, 8)}`;

    await client.query(`SAVEPOINT ${sp}`);
    try {
      // Check existing by (location_slug, name_en)
      const existing = await client.query(
        `SELECT attraction_id FROM nex.brain_attractions WHERE location_slug=$1 AND name_en=$2 LIMIT 1`,
        [location, name],
      );
      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE nex.brain_attractions SET last_verified_at=now(),
             verification_source=$1, coordinates_lat=$2, coordinates_lng=$3
           WHERE attraction_id=$4`,
          [`lab_promotion:${promotion_id}`, lat, lon, existing.rows[0].attraction_id],
        );
        out.updated++;
        await client.query(`RELEASE SAVEPOINT ${sp}`);
        continue;
      }
      const result = await client.query(`
        INSERT INTO nex.brain_attractions
          (location_slug, attraction_kind, name_en, coordinates_lat, coordinates_lng,
           source, source_reference, source_licence_terms,
           first_discovered_at, last_verified_at, verification_source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now(), $9)
        RETURNING attraction_id
      `, [
        location, kind, name, lat, lon,
        "osm_overpass_via_lab",
        Array.isArray(r.evidence_refs) ? r.evidence_refs.join(",") : null,
        "openstreetmap:odbl-1.0",
        `lab_promotion:${promotion_id}`,
      ]);
      if (result.rows[0]?.attraction_id) out.inserted++;
      await client.query(`RELEASE SAVEPOINT ${sp}`);
    } catch (err) {
      out.skipped++;
      if (out.errors.length < 5) out.errors.push(`${name}: ${String(err).slice(0, 200)}`);
      try { await client.query(`ROLLBACK TO SAVEPOINT ${sp}`); } catch { /* txn broken */ }
    }
  }
  return out;
}
