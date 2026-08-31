// src/lib/nex/brain/world-adapters/transport-postgres.ts
//
// Stage 3.34d · Phase 27h · Transport Postgres adapter (Philip 2026-08-31).
//
// Reads nex.provider_profile · the discoverable side of the mobility
// pipeline (nex.service_request is transactional · handled by the
// mobility library at accept/complete time · NOT this adapter's job).
//
// provider_profile carries REAL data: whatsapp_e164 · rating_avg ·
// rating_count · price_per_service_idr · is_available · plate · bike
// details. This is one of the richest verticals · almost every field
// is either populated or explicitly known-null.
//
// Currently only 7 provider rows exist in the DB. Adapter still ships
// so the same 3-card + expanded surface + evidence-driven actions
// work · when workforce onboards more providers the adapter
// automatically scales.

import type {
  WorldAdapter,
  WorldRecord,
  WorldSearchInput,
  WorldSearchResult,
} from "./types";

// Only providers whose status is approved/active AND flagged available
// count as surfaceable. Approved-but-offline providers stay hidden
// (they can't take a request right now anyway).
const VISIBILITY_FILTER = "status IN ('approved','active','live') AND is_available = true";

const SELECT_COLS = [
  "provider_id",
  "full_name",
  "whatsapp_e164",
  "photo_url",
  "bike_slug",
  "bike_year",
  "bike_color_hex",
  "plate",
  "city",
  "status",
  "rating_avg",
  "rating_count",
  "price_per_service_idr",
  "is_available",
  "provides_raincoat",
  "secondary_language",
  "updated_at",
].join(", ");

async function getPool() {
  const { getFoodDbPool } = await import("@/lib/nex-food/db");
  return getFoodDbPool();
}

function rowToRecord(r: Record<string, unknown>, readAt: string): WorldRecord {
  const price = r.price_per_service_idr != null ? Number(r.price_per_service_idr) : undefined;
  // Provider is definitely available (visibility gate proved it) ·
  // WorldRecord.availability signals that unambiguously.
  const availability: WorldRecord["availability"] = "available";
  // Bike + plate + raincoat details ride in amenities so cards can
  // surface the ride profile without a schema fork.
  const amenities: string[] = [];
  if (r.bike_slug) amenities.push(String(r.bike_slug));
  if (r.provides_raincoat === true) amenities.push("raincoat_available");
  if (r.plate) amenities.push(`plate:${String(r.plate)}`);
  if (r.secondary_language) amenities.push(`speaks:${String(r.secondary_language)}`);

  return {
    id:       String(r.provider_id),
    name:     String(r.full_name ?? "(unnamed)"),
    vertical: "transport",
    market:   "ID",
    category: r.bike_slug != null ? String(r.bike_slug) : "provider",
    city:     r.city != null ? String(r.city) : undefined,
    whatsapp: r.whatsapp_e164 != null ? String(r.whatsapp_e164) : undefined,
    heroImage: r.photo_url != null ? String(r.photo_url) : undefined,
    rating:      r.rating_avg != null ? Number(r.rating_avg) : undefined,
    reviewCount: r.rating_count != null ? Number(r.rating_count) : undefined,
    amenities: amenities.length > 0 ? amenities : undefined,
    price,
    availability,
    // Provider profile is claimed by the provider themselves · always
    // "claimed" ownership (not "listed unclaimed" · these people opted in).
    claimStatus: "claimed",
    verified: r.status === "approved" || r.status === "active",
    provenance: {
      sourceKey:  "nex.provider_profile",
      sourceTier: "directory_live",
      readAt,
      ownerProvided: true, // provider profile is provider-created
    },
    updatedAt: r.updated_at != null ? String(r.updated_at) : undefined,
  };
}

export const TransportPostgresAdapter: WorldAdapter = {
  vertical: "transport",

  async search(input: WorldSearchInput): Promise<WorldSearchResult> {
    const t0 = performance.now();
    const readAt = new Date().toISOString();
    if (input.market !== "ID") {
      return {
        vertical: "transport", market: input.market,
        records: [], totalAvailable: 0,
        latencyMs: performance.now() - t0,
        degradedReason: "market_not_supported",
      };
    }
    const pool = await getPool();
    const params: unknown[] = [];
    const clauses: string[] = [VISIBILITY_FILTER];
    if (input.city) {
      params.push(input.city);
      clauses.push(`city ILIKE $${params.length}`);
    }
    if (input.query) {
      params.push(`%${input.query.replace(/[%_]/g, "\\$&")}%`);
      clauses.push(`(full_name ILIKE $${params.length} OR bike_slug ILIKE $${params.length})`);
    }
    const where = clauses.join(" AND ");
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const offset = Math.max(input.offset ?? 0, 0);
    const orderBy =
      input.sort === "rating"     ? "rating_avg DESC NULLS LAST, rating_count DESC NULLS LAST" :
      input.sort === "price_asc"  ? "price_per_service_idr ASC NULLS LAST" :
      input.sort === "price_desc" ? "price_per_service_idr DESC NULLS LAST" :
      input.sort === "recent"     ? "updated_at DESC NULLS LAST" :
      "full_name ASC";

    const [countRes, rowsRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM nex.provider_profile WHERE ${where}`, params),
      pool.query(
        `SELECT ${SELECT_COLS}
           FROM nex.provider_profile
          WHERE ${where}
          ORDER BY ${orderBy}
          LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
    ]);
    const records = rowsRes.rows.map((r) => rowToRecord(r as Record<string, unknown>, readAt));
    return {
      vertical: "transport", market: "ID",
      records,
      totalAvailable: Number(countRes.rows[0]?.n ?? 0),
      latencyMs: performance.now() - t0,
    };
  },

  async getById({ id, market }): Promise<WorldRecord | null> {
    if (market !== "ID") return null;
    const readAt = new Date().toISOString();
    const pool = await getPool();
    const q = await pool.query(
      `SELECT ${SELECT_COLS}
         FROM nex.provider_profile
        WHERE provider_id = $1::uuid AND ${VISIBILITY_FILTER}
        LIMIT 1`,
      [id],
    );
    const row = q.rows[0];
    return row ? rowToRecord(row as Record<string, unknown>, readAt) : null;
  },
};
