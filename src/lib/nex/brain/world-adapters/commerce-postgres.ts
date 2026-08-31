// src/lib/nex/brain/world-adapters/commerce-postgres.ts
//
// Stage 3.34d · Phase 27h · Commerce Postgres adapter (Philip 2026-08-31).
//
// Reads nex.mp_product joined with nex.mp_seller. Products carry REAL
// PRICES in IDR (base_price_idr column) and REAL STOCK signals
// (base_stock) · WorldRecord surfaces both when present. Never
// fabricates a price · when base_price_idr is null, WorldRecord.price
// stays undefined and Presentation shows no price line.
//
// Doctrine parity with accommodation/food/service:
//   · visibility gate = product.active = true AND seller.status = 'active'
//   · market gate rejects non-ID (mp_seller.jurisdiction filter)
//   · every record carries provenance with readAt
//   · null DB fields → undefined WorldRecord fields
//   · buy / add_to_cart actions REMAIN DISABLED at the Presentation
//     layer until Stage 6 payment integration lands (Presentation
//     already handles this · commerce vertical gets disabled buy/cart
//     actions with reason "no_commerce_checkout_yet")

import type {
  WorldAdapter,
  WorldRecord,
  WorldSearchInput,
  WorldSearchResult,
} from "./types";

const VISIBILITY_FILTER = "p.active = true AND s.status = 'active'";

const SELECT_COLS = [
  "p.product_id",
  "p.slug",
  "p.name AS product_name",
  "p.description AS product_description",
  "p.condition",
  "p.base_price_idr",
  "p.base_stock",
  "p.category_id",
  "p.updated_at AS product_updated_at",
  "s.seller_id",
  "s.slug AS seller_slug",
  "s.display_name AS seller_name",
  "s.city AS seller_city",
  "s.jurisdiction",
  "s.status AS seller_status",
  "s.cover_image_ref",
  "s.logo_image_ref",
  // Stage 3.34e · lateral subquery pulls the first product-specific
  // image from mp_product_image when present · falls back to seller
  // cover downstream. Real image · never a placeholder.
  `(SELECT url FROM nex.mp_product_image
     WHERE product_id = p.product_id
     ORDER BY sort_order NULLS LAST, url ASC
     LIMIT 1) AS product_image_url`,
].join(", ");

async function getPool() {
  // Commerce shares the same physical DB per Philip's infra doctrine.
  const { getFoodDbPool } = await import("@/lib/nex-food/db");
  return getFoodDbPool();
}

function rowToRecord(r: Record<string, unknown>, readAt: string): WorldRecord {
  const price = r.base_price_idr != null ? Number(r.base_price_idr) : undefined;
  const stock = r.base_stock != null ? Number(r.base_stock) : undefined;
  const availability: WorldRecord["availability"] = stock == null
    ? undefined
    : stock <= 0
      ? "unavailable"
      : stock < 5
        ? "limited"
        : "available";

  return {
    id:       String(r.product_id),
    name:     String(r.product_name ?? "(unnamed)"),
    vertical: "commerce",
    market:   "ID",
    category: r.condition != null ? String(r.condition) : undefined,
    city:     r.seller_city != null ? String(r.seller_city) : undefined,
    description: r.product_description != null ? String(r.product_description) : undefined,
    // Commerce hero image priority: product-specific image (mp_product_image
    // via lateral subquery) FIRST · seller cover_image_ref FALLBACK · null
    // when neither exists. Never fabricates a placeholder.
    heroImage: r.product_image_url != null
      ? String(r.product_image_url)
      : r.cover_image_ref != null
        ? String(r.cover_image_ref)
        : undefined,
    price,
    availability,
    // Commerce seller doesn't publish phone/whatsapp/website directly
    // in mp_seller · contact_ref points to a separate contact record
    // (not joined this iteration · adapter honestly omits the fields).
    claimStatus: r.seller_status === "active" ? "listed" : undefined,
    verified: false, // marketplace has no verified-seller flag yet
    provenance: {
      sourceKey:  "nex.mp_product + nex.mp_seller",
      sourceTier: "directory_live",
      readAt,
    },
    updatedAt: r.product_updated_at != null ? String(r.product_updated_at) : undefined,
  };
}

export const CommercePostgresAdapter: WorldAdapter = {
  vertical: "commerce",

  async search(input: WorldSearchInput): Promise<WorldSearchResult> {
    const t0 = performance.now();
    const readAt = new Date().toISOString();
    if (input.market !== "ID") {
      return {
        vertical: "commerce", market: input.market,
        records: [], totalAvailable: 0,
        latencyMs: performance.now() - t0,
        degradedReason: "market_not_supported",
      };
    }
    const pool = await getPool();
    const params: unknown[] = ["ID%"];
    // Seller jurisdiction · nex.mp_seller stores compound codes like
    // "ID", "ID/DIY/Yogyakarta", "ID/DKI/Jakarta" etc. LIKE prefix
    // match keeps every ID-market seller in scope regardless of the
    // regional subdivision, while still excluding non-ID markets.
    const clauses: string[] = ["s.jurisdiction LIKE $1", VISIBILITY_FILTER];
    if (input.city) {
      params.push(input.city);
      clauses.push(`s.city ILIKE $${params.length}`);
    }
    if (input.query) {
      params.push(`%${input.query.replace(/[%_]/g, "\\$&")}%`);
      clauses.push(`(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
    }
    const where = clauses.join(" AND ");
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const offset = Math.max(input.offset ?? 0, 0);
    const orderBy =
      input.sort === "price_asc"  ? "p.base_price_idr ASC NULLS LAST" :
      input.sort === "price_desc" ? "p.base_price_idr DESC NULLS LAST" :
      input.sort === "recent"     ? "p.updated_at DESC NULLS LAST" :
      "p.name ASC";

    const [countRes, rowsRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS n
           FROM nex.mp_product p JOIN nex.mp_seller s ON s.seller_id = p.seller_id
          WHERE ${where}`,
        params,
      ),
      pool.query(
        `SELECT ${SELECT_COLS}
           FROM nex.mp_product p JOIN nex.mp_seller s ON s.seller_id = p.seller_id
          WHERE ${where}
          ORDER BY ${orderBy}
          LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
    ]);
    const records = rowsRes.rows.map((r) => rowToRecord(r as Record<string, unknown>, readAt));
    return {
      vertical: "commerce", market: "ID",
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
         FROM nex.mp_product p JOIN nex.mp_seller s ON s.seller_id = p.seller_id
        WHERE p.product_id = $1::uuid AND s.jurisdiction LIKE 'ID%' AND ${VISIBILITY_FILTER}
        LIMIT 1`,
      [id],
    );
    const row = q.rows[0];
    return row ? rowToRecord(row as Record<string, unknown>, readAt) : null;
  },
};
