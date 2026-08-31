// src/lib/nex/brain/world-adapters/service-postgres.ts
//
// Stage 3.34d · Phase 27h · Service Postgres adapter (Philip 2026-08-31).
//
// Reads nex.service_business through the same pool the /services page
// uses. NOTE: service_business uses a DIFFERENT visibility model than
// accommodation/food. Its gate combines `visibility='public'` +
// `status='live'` rather than the claim_status enum. Adapter respects
// the service-specific rule verbatim · does not fork.

import type {
  WorldAdapter,
  WorldRecord,
  WorldSearchInput,
  WorldSearchResult,
} from "./types";

// Service business visibility gate · matches the /services page loader
// verbatim (src/lib/nex-service/list-businesses.ts): status='listed' +
// visibility='public'. Phase 1 walkers insert directly at this state ·
// no separate promotion step required for service (unlike accommodation
// where 'listed' is a promotion FROM 'discovered'). This is the same
// public rule the customer page uses · doctrine parity preserved.
const VISIBILITY_FILTER = "visibility = 'public' AND status = 'listed'";

const SELECT_COLS = [
  "public_listing_ref",
  "business_name",
  "category_slug",
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
  "owner_status",
  "claimed",
  "verified",
  "status",
  "commercial_status",
  "updated_at",
].join(", ");

async function getPool() {
  // service uses the same physical DB · same pool per infra doctrine.
  const { getFoodDbPool } = await import("@/lib/nex-food/db");
  return getFoodDbPool();
}

function rowToRecord(r: Record<string, unknown>, readAt: string): WorldRecord {
  const cat = String(r.category_slug ?? "");
  const rawCategories = Array.isArray(r.categories)
    ? (r.categories as unknown[]).filter((x): x is string => typeof x === "string")
    : undefined;
  const social = r.public_social_links && typeof r.public_social_links === "object"
    ? (r.public_social_links as Record<string, string>)
    : undefined;
  // Service uses boolean claimed + verified · map to the canonical
  // ownership tier so cards render honest labels.
  let claimStatus: WorldRecord["claimStatus"] = undefined;
  if (r.claimed === true) {
    // commercial_status may indicate paying member vs merely claimed.
    claimStatus = r.commercial_status === "paying" ? "paying" : "claimed";
  } else if (r.status === "listed" || r.status === "live") {
    // Listed-but-unclaimed rows are legitimately visible per the
    // visibility=public gate. Map to "listed" so the UI says "Listed
    // on NEX" not "NEX partner". Accept both "listed" (the current
    // production value) and "live" (a possible future promotion state)
    // so the adapter tolerates the schema evolving without a code
    // change.
    claimStatus = "listed";
  }
  const heroImage = r.hero_image_url != null ? String(r.hero_image_url) : undefined;

  return {
    id:       String(r.public_listing_ref),
    name:     String(r.business_name ?? "(unnamed)"),
    vertical: "service",
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
    // Services do NOT publish rating/review_count in this schema ·
    // adapter never fabricates. Composer's honesty boundary applies
    // when the user asks "who has the best rating".
    claimStatus,
    verified: r.verified === true,
    provenance: {
      sourceKey:  "nex.service_business",
      sourceTier: "directory_live",
      readAt,
    },
    updatedAt: r.updated_at != null ? String(r.updated_at) : undefined,
  };
}

export const ServicePostgresAdapter: WorldAdapter = {
  vertical: "service",

  async search(input: WorldSearchInput): Promise<WorldSearchResult> {
    const t0 = performance.now();
    const readAt = new Date().toISOString();
    if (input.market !== "ID") {
      return {
        vertical: "service", market: input.market,
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
    if (input.category) {
      params.push(input.category);
      clauses.push(`category_slug = $${params.length}`);
    }
    if (input.query) {
      params.push(`%${input.query.replace(/[%_]/g, "\\$&")}%`);
      clauses.push(`business_name ILIKE $${params.length}`);
    }
    // Stage 3.35 · Phase 1 · area filter · matches district or address
    // (services stored per human-readable district similarly to food).
    if (input.area) {
      params.push(`%${input.area.replace(/[%_]/g, "\\$&")}%`);
      clauses.push(`(district ILIKE $${params.length} OR address ILIKE $${params.length})`);
    }
    const where = clauses.join(" AND ");
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const offset = Math.max(input.offset ?? 0, 0);
    const orderBy =
      input.sort === "recent" ? "updated_at DESC NULLS LAST" :
      "business_name ASC";

    const [countRes, rowsRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM nex.service_business WHERE ${where}`, params),
      pool.query(
        `SELECT ${SELECT_COLS}
           FROM nex.service_business
          WHERE ${where}
          ORDER BY ${orderBy}
          LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
    ]);
    const records = rowsRes.rows.map((r) => rowToRecord(r as Record<string, unknown>, readAt));
    return {
      vertical: "service", market: "ID",
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
         FROM nex.service_business
        WHERE public_listing_ref = $1 AND ${VISIBILITY_FILTER}
        LIMIT 1`,
      [id],
    );
    const row = q.rows[0];
    return row ? rowToRecord(row as Record<string, unknown>, readAt) : null;
  },
};
