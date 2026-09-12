// src/lib/nex/lab/executors/accommodation-executor.ts
//
// Founder 2026-09-10 · Per-domain promotion executor · ACCOMMODATION.
//
// Mirrors executeFoodPromotion. Takes staged rows from
// nex_lab.promotion_rows joined against nex_lab_accommodation.verified,
// inserts into nex.accommodation_business with:
//   · public_listing_ref format '#AC-YYYY-CROCKFORD5' (CHECK-enforced)
//   · category ∈ hotel|villa|guesthouse|homestay|resort|hostel|apartment|kos
//     (deterministically mapped from OSM tags · never fabricated)
//   · location_confidence ∈ EXACT|STREET|AREA|CITY|UNKNOWN
//   · claim_status='discovered' · owner_status='unknown' (never auto-verified)
//   · SAVEPOINT per row · one bad row doesn't nuke the batch
//   · dedupe via explicit SELECT-then-INSERT (no ON CONFLICT · no unique index)

import type { PoolClient } from "pg";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function publicListingRef(dedupeHash: string): string {
  const bytes = Buffer.from(dedupeHash.slice(0, 10), "hex");
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let ref5 = "";
  for (let i = 0; i < 5; i++) {
    ref5 = CROCKFORD[Number(bits & 0x1Fn)] + ref5;
    bits >>= 5n;
  }
  return `#AC-${new Date().getUTCFullYear()}-${ref5}`;
}

// nex.accommodation_business.category CHECK · exactly 8 values allowed.
// Mapping is deterministic · no LLM · no guess. Unknown OSM tags fall
// through to "hotel" as the closest generic bucket.
function categoriseAccommodation(rawTags: Record<string, unknown> | undefined, name: string): {
  primary: "hotel" | "villa" | "guesthouse" | "homestay" | "resort" | "hostel" | "apartment" | "kos";
  all: string[];
} {
  const tourism = String(rawTags?.tourism ?? "").toLowerCase();
  const building = String(rawTags?.building ?? "").toLowerCase();
  const nm = name.toLowerCase();
  const all: string[] = [];
  let primary: "hotel" | "villa" | "guesthouse" | "homestay" | "resort" | "hostel" | "apartment" | "kos" = "hotel";
  if (tourism === "hostel" || /\bhostel\b/.test(nm)) primary = "hostel";
  else if (tourism === "guest_house" || /\bguest ?house\b/.test(nm)) primary = "guesthouse";
  else if (/\bhomestay\b/.test(nm)) primary = "homestay";
  else if (/\bvilla\b/.test(nm)) primary = "villa";
  else if (/\bresort\b/.test(nm)) primary = "resort";
  else if (building === "apartments" || /\bapart(ment)?\b/.test(nm)) primary = "apartment";
  else if (/\bkos(\b| |[-])/.test(nm)) primary = "kos";
  else primary = "hotel";
  all.push(primary);
  if (tourism) all.push(`osm:tourism=${tourism}`);
  if (building) all.push(`osm:building=${building}`);
  return { primary, all };
}

// nex.accommodation_business.location_confidence CHECK · 5 values.
// Maps from source metadata + coord precision heuristic.
function deriveLocationConfidence(fv: Record<string, unknown>): "EXACT" | "STREET" | "AREA" | "CITY" | "UNKNOWN" {
  const coords = fv.coordinates as { lat?: number; lon?: number } | undefined;
  if (!coords || typeof coords.lat !== "number" || typeof coords.lon !== "number") return "UNKNOWN";
  const addr = fv.address as { street?: string; city?: string } | undefined;
  if (addr?.street) return "STREET";
  // 6 decimals ≈ 0.1m · anything ≥ 5 decimals = building-level exact
  const latPrec = String(coords.lat).split(".")[1]?.length ?? 0;
  if (latPrec >= 5) return "EXACT";
  if (addr?.city) return "CITY";
  return "AREA";
}

export interface AccommodationExecuteResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export async function executeAccommodationPromotion(
  client: PoolClient,
  promotion_id: string,
): Promise<AccommodationExecuteResult> {
  const out: AccommodationExecuteResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };

  const rows = (await client.query(
    `SELECT pr.subject_ref, v.field_value, v.confidence, v.evidence_refs, v.source_count
     FROM nex_lab.promotion_rows pr
     JOIN nex_lab_accommodation.verified v ON v.subject_ref = pr.subject_ref
     WHERE pr.promotion_id = $1 AND v.field_name = 'identity'`,
    [promotion_id],
  )).rows;

  for (const r of rows) {
    const fv = (r.field_value ?? {}) as Record<string, unknown>;
    const name = String(fv.name ?? "").trim();
    const coords = fv.coordinates as { lat?: number; lon?: number } | undefined;
    const lat = coords?.lat;
    const lon = coords?.lon;
    if (!name) { out.skipped++; continue; }
    // Accommodation must have coordinates · CHECK constraint requires numeric lat/lon
    // via NULLable path but without them the row provides no travel value
    if (typeof lat !== "number" || typeof lon !== "number") { out.skipped++; continue; }

    const dedupeHash = r.subject_ref as string;
    const ref = publicListingRef(dedupeHash);
    const rawTags = (fv.raw_tags ?? fv.tags) as Record<string, unknown> | undefined;
    const { primary, all } = categoriseAccommodation(rawTags, name);
    const locConf = deriveLocationConfidence(fv);
    const address = fv.address as Record<string, string> | undefined;
    const addrText = address ? [address.street, address.city].filter(Boolean).join(", ") || null : null;
    const cityLabel = (address?.city ?? fv.city ?? "Yogyakarta") as string;
    const cityCased = cityLabel.charAt(0).toUpperCase() + cityLabel.slice(1);

    const sp = `sp_ac_${dedupeHash.slice(0, 8)}`;
    await client.query(`SAVEPOINT ${sp}`);
    try {
      const existing = await client.query(
        `SELECT internal_id FROM nex.accommodation_business WHERE dedupe_hash = $1 LIMIT 1`,
        [dedupeHash],
      );
      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE nex.accommodation_business SET
             last_verified_at = now(),
             verification_source = $1,
             updated_at = now()
           WHERE dedupe_hash = $2`,
          [`lab_promotion:${promotion_id}`, dedupeHash],
        );
        await client.query(`RELEASE SAVEPOINT ${sp}`);
        out.updated++;
        continue;
      }
      const result = await client.query(`
        INSERT INTO nex.accommodation_business
          (public_listing_ref, business_name, category, categories,
           address, city, country, district,
           coordinates_lng, coordinates_lat,
           phone, website, star_rating, room_count, amenities,
           source, source_reference, source_licence_terms,
           dedupe_hash, claim_status, owner_status, hero_image_approved,
           location_confidence, geocode_evidence, recovered_evidence,
           last_verified_at, verification_source, source_ingested_at)
        VALUES ($1, $2, $3, $4,
                $5, $6, 'ID', $7,
                $8, $9,
                $10, $11, $12, $13, $14,
                $15, $16, $17,
                $18, 'discovered', 'unknown', false,
                $19, $20::jsonb, '{}'::jsonb,
                now(), $21, now())
        RETURNING internal_id
      `, [
        ref, name, primary, all,
        addrText, cityCased, address?.district ?? null,
        // coordinates_lng FIRST · matches food executor lesson · avoids
        // numeric overflow when lat/lon get swapped into wrong columns
        lon, lat,
        fv.phone ?? null, fv.website ?? null,
        typeof fv.star_rating === "number" ? fv.star_rating : null,
        typeof fv.room_count === "number" && fv.room_count > 0 ? fv.room_count : null,
        Array.isArray(fv.amenities) ? fv.amenities : [],
        (fv.source as string | undefined) ?? "osm_overpass_via_lab",
        Array.isArray(r.evidence_refs) ? r.evidence_refs.join(",") : null,
        (fv.source_licence_terms as string | undefined) ?? "openstreetmap:odbl-1.0",
        dedupeHash,
        locConf,
        JSON.stringify({ confidence: r.confidence, source_count: r.source_count, evidence: r.evidence_refs }),
        `lab_promotion:${promotion_id}`,
      ]);
      if (result.rows[0]?.internal_id) out.inserted++;
      await client.query(`RELEASE SAVEPOINT ${sp}`);
    } catch (err) {
      out.skipped++;
      if (out.errors.length < 5) out.errors.push(`${name}: ${String(err).slice(0, 200)}`);
      try { await client.query(`ROLLBACK TO SAVEPOINT ${sp}`); } catch { /* outer will handle */ }
    }
  }
  return out;
}
