// src/lib/nex/brain/world-adapters/food-postgres.ts
//
// Stage 3.34d · Phase 27h · Food Postgres adapter (Philip 2026-08-31).
//
// Reads nex.food_business through the same pool the /food customer
// page uses. Same visibility gate. Same rows. Brain and directory
// always agree.
//
// Doctrine (world-adapters/types.ts):
//   · Never fabricates a field · unknown = null
//   · Respects the vertical's visibility rule verbatim
//   · Emits provenance on every record with the DB read timestamp
//   · Owner-provenanced hero image gate honoured (hero_image_url only
//     surfaces when hero_image_approved = true · matches the /food page
//     · never leaks unapproved OSM-scraped photos)

import type {
  WorldAdapter,
  WorldRecord,
  WorldSearchInput,
  WorldSearchResult,
} from "./types";

// SAME visibility rule as the public /food page + accommodation adapter.
const VISIBILITY_FILTER = "claim_status IN ('listed','invited','claimed','paying')";

const SELECT_COLS = [
  "public_listing_ref",
  "business_name",
  "category",
  "categories",
  "city",
  "district",
  "address",
  "coordinates_lat",
  "coordinates_lng",
  "phone",
  "whatsapp_number",
  "website",
  "public_social_links",
  "hero_image_url",
  "hero_image_approved",
  "rating",
  "review_count",
  "claim_status",
  "owner_status",
  "updated_at",
].join(", ");

async function getPool() {
  const { getFoodDbPool } = await import("@/lib/nex-food/db");
  return getFoodDbPool();
}

function rowToRecord(r: Record<string, unknown>, readAt: string): WorldRecord {
  const cat = String(r.category ?? "");
  const rawCategories = Array.isArray(r.categories)
    ? (r.categories as unknown[]).filter((x): x is string => typeof x === "string")
    : undefined;
  const social = r.public_social_links && typeof r.public_social_links === "object"
    ? (r.public_social_links as Record<string, string>)
    : undefined;
  const claim = String(r.claim_status ?? "");
  const claimStatus =
    claim === "listed" || claim === "invited" || claim === "claimed" || claim === "paying"
      ? claim
      : undefined;
  // Hero image gate: owner-provenanced doctrine · only surface approved.
  const heroImage = r.hero_image_approved === true && r.hero_image_url
    ? String(r.hero_image_url)
    : undefined;

  return {
    id:       String(r.public_listing_ref),
    name:     String(r.business_name ?? "(unnamed)"),
    vertical: "food",
    market:   "ID",
    category: cat || undefined,
    categories: rawCategories,
    city:     r.city != null ? String(r.city) : undefined,
    district: r.district != null ? String(r.district) : undefined,
    address:  r.address != null ? String(r.address) : undefined,
    latitude:  r.coordinates_lat != null ? Number(r.coordinates_lat) : undefined,
    longitude: r.coordinates_lng != null ? Number(r.coordinates_lng) : undefined,
    phone:    r.phone != null ? String(r.phone) : undefined,
    whatsapp: r.whatsapp_number != null ? String(r.whatsapp_number) : undefined,
    website:  r.website != null ? String(r.website) : undefined,
    socialLinks: social,
    heroImage,
    rating:      r.rating != null ? Number(r.rating) : undefined,
    reviewCount: r.review_count != null ? Number(r.review_count) : undefined,
    // No starRating · no roomCount · no amenities · food schema doesn't
    // publish these · adapter honestly omits · Presentation stays quiet.
    claimStatus,
    verified: r.owner_status === "verified" || r.owner_status === "claimed",
    provenance: {
      sourceKey:  "nex.food_business",
      sourceTier: "directory_live",
      readAt,
      ownerProvided: r.hero_image_approved === true,
    },
    updatedAt: r.updated_at != null ? String(r.updated_at) : undefined,
  };
}

export const FoodPostgresAdapter: WorldAdapter = {
  vertical: "food",

  async search(input: WorldSearchInput): Promise<WorldSearchResult> {
    const t0 = performance.now();
    const readAt = new Date().toISOString();
    // Founder BEGIN 2026-09-09 · SEARCHWORLD-SUB-INSTRUMENTATION
    // All timings try/catch wrapped so instrumentation NEVER breaks queries.
    const _st: Record<string, number> = {};
    const _mark = (name: string, since: number) => {
      try { _st[name] = Math.round((performance.now() - since) * 100) / 100; } catch {}
    };
    if (input.market !== "ID") {
      return {
        vertical: "food", market: input.market,
        records: [], totalAvailable: 0,
        latencyMs: performance.now() - t0,
        subTimings: _st,
        degradedReason: "market_not_supported",
      };
    }
    const _t_pool = performance.now();
    const pool = await getPool();
    _mark("pool_acquire", _t_pool);
    const _t_build = performance.now();
    const params: unknown[] = ["ID"];
    const clauses: string[] = ["country = $1", VISIBILITY_FILTER];
    if (input.city) {
      params.push(input.city);
      clauses.push(`city ILIKE $${params.length}`);
    }
    if (input.category) {
      params.push(input.category);
      clauses.push(`category = $${params.length}`);
    }
    if (input.query) {
      // 2026-09-05 · Chief-engineer widening: user queries like
      // "warung near Malioboro" fail against business_name alone.
      // Widen to also ILIKE-match address and district. Backward-safe:
      // every prior business_name match still matches. Visibility gate
      // untouched. `area` filter (structured intent) remains a
      // separate stricter filter above.
      params.push(`%${input.query.replace(/[%_]/g, "\\$&")}%`);
      const p = params.length;
      clauses.push(`(business_name ILIKE $${p} OR address ILIKE $${p} OR district ILIKE $${p})`);
    }
    // Stage 3.35 · Phase 1 · Structured query · area filter matches the
    // vertical's `district` column when the user says "near Malioboro"
    // etc. Adapter honestly narrows results · does NOT do haversine
    // (food has coords but the district column is human-readable and
    // matches how walkers publish OSM zone data).
    if (input.area) {
      params.push(`%${input.area.replace(/[%_]/g, "\\$&")}%`);
      clauses.push(`(district ILIKE $${params.length} OR address ILIKE $${params.length})`);
    }
    const where = clauses.join(" AND ");
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const offset = Math.max(input.offset ?? 0, 0);
    const orderBy =
      input.sort === "rating" ? "rating DESC NULLS LAST, review_count DESC NULLS LAST" :
      input.sort === "recent" ? "updated_at DESC NULLS LAST" :
      "business_name ASC";
    _mark("query_build", _t_build);

    // Measure both parallel queries individually so we can see if COUNT is the
    // straggler (common when Postgres seq-scans for ILIKE). Promise.all still
    // dominates end-to-end · but individual per-query time is now visible.
    const _t_sql = performance.now();
    const _t_count = performance.now();
    const countP = pool.query(`SELECT COUNT(*)::int AS n FROM nex.food_business WHERE ${where}`, params)
      .then((r) => { try { _st.sql_count = Math.round((performance.now() - _t_count) * 100) / 100; } catch {} return r; });
    const _t_rows = performance.now();
    const rowsP = pool.query(
      `SELECT ${SELECT_COLS}
         FROM nex.food_business
        WHERE ${where}
        ORDER BY ${orderBy}
        LIMIT ${limit} OFFSET ${offset}`,
      params,
    ).then((r) => { try { _st.sql_rows = Math.round((performance.now() - _t_rows) * 100) / 100; } catch {} return r; });
    const [countRes, rowsRes] = await Promise.all([countP, rowsP]);
    _mark("sql_promise_all", _t_sql);
    const _t_hydrate = performance.now();
    const records = rowsRes.rows.map((r) => rowToRecord(r as Record<string, unknown>, readAt));
    _mark("row_hydration", _t_hydrate);
    const _t_result = performance.now();
    const result = {
      vertical: "food" as const, market: "ID" as const,
      records,
      totalAvailable: Number(countRes.rows[0]?.n ?? 0),
      latencyMs: performance.now() - t0,
      subTimings: _st,
    };
    _mark("result_build", _t_result);
    try { _st.adapter_total = Math.round((performance.now() - t0) * 100) / 100; } catch {}
    return result;
  },

  async getById({ id, market }): Promise<WorldRecord | null> {
    if (market !== "ID") return null;
    const readAt = new Date().toISOString();
    const pool = await getPool();
    const q = await pool.query(
      `SELECT ${SELECT_COLS}
         FROM nex.food_business
        WHERE public_listing_ref = $1 AND country = 'ID' AND ${VISIBILITY_FILTER}
        LIMIT 1`,
      [id],
    );
    const row = q.rows[0];
    return row ? rowToRecord(row as Record<string, unknown>, readAt) : null;
  },
};
