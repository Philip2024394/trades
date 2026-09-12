// src/lib/nex/directory/index.ts
//
// Founder Phase 27 · P27-1 · NEX Directory (Google-surpassing).
//
// Landscape cards with per-listing product/service previews · lets user
// see what a listing offers WITHOUT opening the external website.
//
// Composition:
//   · getDirectoryCards(q) — top N landscape cards for a query
//   · getListingDetail(ref_id) — expanded listing + products/services
//   · Every card carries Doctrine #6 (verified/unconfirmed) + trust_layer
//   · Real accommodation_business columns (business_name, categories[],
//     amenities[], website, hero_image_url, star_rating, room_count,
//     rating, review_count, address, city, district, phone, whatsapp_number)

import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";

export interface DirectoryCard {
  ref_id: string;
  kind: "accommodation";
  title: string;
  primary_category: string | null;
  categories: string[];
  snippet: string;
  city: string | null;
  district: string | null;
  address: string | null;
  hero_image_url: string | null;
  website: string | null;
  phone: string | null;
  whatsapp: string | null;
  star_rating: number | null;
  rating: number | null;
  review_count: number | null;
  room_count: number | null;
  latitude: number | null;
  longitude: number | null;
  amenities_preview: string[];        // top 6 amenities as "product" chips
  product_count: number;              // total amenities + categories count
  trust_layer: "canonical_verified" | "canonical_authoritative" | "provisional" | "unknown";
  verified: boolean;
  doctrine_6_label: "verified" | "unconfirmed";
  score: number;
}

export interface DirectoryDetail extends DirectoryCard {
  amenities_full: string[];
  products: Array<{ name: string; kind: "amenity" | "category" | "room"; verified: boolean }>;
  social_links: Record<string, string> | null;
  last_verified_at: string | null;
  source_reference: string | null;
}

function classify(trust_layer: DirectoryCard["trust_layer"]): { verified: boolean; label: "verified" | "unconfirmed" } {
  const v = trust_layer === "canonical_verified" || trust_layer === "canonical_authoritative";
  return { verified: v, label: v ? "verified" : "unconfirmed" };
}

function computeTrustLayer(row: Record<string, unknown>): DirectoryCard["trust_layer"] {
  if (row.last_verified_at) return "canonical_verified";
  if (row.website && row.source_reference) return "canonical_verified";
  if (row.source_reference) return "canonical_authoritative";
  return "provisional";
}

function normArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter((x) => x.trim().length > 0);
  return [];
}

function mapCard(row: Record<string, unknown>): DirectoryCard {
  const amenities = normArray(row.amenities);
  const categories = normArray(row.categories);
  const trust_layer = computeTrustLayer(row);
  const cls = classify(trust_layer);
  return {
    ref_id: `accom:${String(row.ref_id)}`,
    kind: "accommodation",
    title: String(row.business_name ?? "(unnamed)"),
    primary_category: (row.category as string) ?? categories[0] ?? null,
    categories,
    snippet: [row.address, row.city].filter(Boolean).join(" · ").slice(0, 180),
    city: (row.city as string) ?? null,
    district: (row.district as string) ?? null,
    address: (row.address as string) ?? null,
    hero_image_url: (row.hero_image_url as string) ?? null,
    website: (row.website as string) ?? null,
    phone: (row.phone as string) ?? null,
    whatsapp: (row.whatsapp_number as string) ?? null,
    star_rating: (row.star_rating as number) ?? null,
    rating: (row.rating as number) ?? null,
    review_count: (row.review_count as number) ?? null,
    room_count: (row.room_count as number) ?? null,
    latitude: (row.coordinates_lat as number) ?? null,
    longitude: (row.coordinates_lng as number) ?? null,
    amenities_preview: amenities.slice(0, 6),
    product_count: amenities.length + categories.length + ((row.room_count as number) ? 1 : 0),
    trust_layer,
    verified: cls.verified,
    doctrine_6_label: cls.label,
    score: Number(row.score ?? 0),
  };
}

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

export interface DirectoryArgs {
  q: string;
  limit?: number;
  verified_only?: boolean;
  city?: string | null;
}

export async function getDirectoryCards(args: DirectoryArgs): Promise<{
  query: string;
  cards: DirectoryCard[];
  counts: { verified: number; unconfirmed: number };
  ms: number;
}> {
  const t0 = performance.now();
  const q = args.q.trim();
  const limit = Math.max(1, Math.min(50, args.limit ?? 18));
  let cards: DirectoryCard[] = [];
  try {
    const pool = getKnowledgeFactoryDbPool();
    // ILIKE substring · no pg_trgm dependency (extension not enabled in target db).
    const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    const r = await pool.query(
      `SELECT
         COALESCE(public_listing_ref, internal_id::text) AS ref_id,
         business_name, category, categories, address, city, district,
         website, phone, whatsapp_number, hero_image_url,
         star_rating, room_count, amenities, rating, review_count,
         coordinates_lat, coordinates_lng, source_reference, last_verified_at,
         (
           (CASE WHEN business_name ILIKE $1 THEN 4 ELSE 0 END) +
           (CASE WHEN category      ILIKE $1 THEN 3 ELSE 0 END) +
           (CASE WHEN city          ILIKE $1 THEN 2 ELSE 0 END) +
           (CASE WHEN address       ILIKE $1 THEN 1 ELSE 0 END) +
           (CASE WHEN district      ILIKE $1 THEN 1 ELSE 0 END)
         ) AS score
       FROM nex.accommodation_business
       WHERE business_name ILIKE $1
          OR category      ILIKE $1
          OR address       ILIKE $1
          OR city          ILIKE $1
          OR district      ILIKE $1
       ORDER BY score DESC, business_name ASC
       LIMIT $2`,
      [pattern, limit],
    );
    cards = (r.rows as Array<Record<string, unknown>>).map(mapCard);
  } catch { /* degrade to empty */ }

  if (args.verified_only) cards = cards.filter((c) => c.verified);
  if (args.city) cards = cards.filter((c) => !c.city || c.city.toLowerCase() === (args.city ?? "").toLowerCase());

  return {
    query: q,
    cards,
    counts: {
      verified: cards.filter((c) => c.verified).length,
      unconfirmed: cards.filter((c) => !c.verified).length,
    },
    ms: Math.round(performance.now() - t0),
  };
}

/**
 * Fetches full details for one listing including all products / amenities.
 * ref_id is the same shape the cards return ("accom:<public_listing_ref>").
 */
export async function getListingDetail(ref_id: string): Promise<DirectoryDetail | null> {
  const parts = ref_id.split(":");
  if (parts.length !== 2 || parts[0] !== "accom") return null;
  const key = parts[1];
  try {
    const pool = getKnowledgeFactoryDbPool();
    const r = await pool.query(
      `SELECT
         COALESCE(public_listing_ref, internal_id::text) AS ref_id,
         business_name, category, categories, address, city, district,
         website, phone, whatsapp_number, hero_image_url, public_social_links,
         star_rating, room_count, amenities, rating, review_count,
         coordinates_lat, coordinates_lng, source_reference, last_verified_at::text
       FROM nex.accommodation_business
       WHERE public_listing_ref = $1 OR internal_id::text = $1
       LIMIT 1`,
      [key],
    );
    const row = r.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    const card = { ...mapCard({ ...row, score: 0 }) };
    const amenities_full = normArray(row.amenities);
    const categories_full = normArray(row.categories);
    const products: DirectoryDetail["products"] = [
      ...amenities_full.map((n) => ({ name: n, kind: "amenity" as const, verified: card.verified })),
      ...categories_full.map((n) => ({ name: n, kind: "category" as const, verified: card.verified })),
    ];
    if (row.room_count) {
      products.push({ name: `${row.room_count} rooms`, kind: "room", verified: card.verified });
    }
    const social = (row.public_social_links as Record<string, string>) ?? null;
    return {
      ...card,
      amenities_full,
      products,
      social_links: social && typeof social === "object" ? social : null,
      last_verified_at: (row.last_verified_at as string) ?? null,
      source_reference: (row.source_reference as string) ?? null,
    };
  } catch { return null; }
}
