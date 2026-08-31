// src/lib/nex-service/list-businesses.ts
//
// NEX Services · SSR loader for public /services/[category] directories.
// Philip 2026-08-27.
//
// Reads nex.service_business filtered by:
//   · category_slug = <job registry slug, e.g. 'gyms'>
//   · status = 'listed'   (default value from migration 110)
//   · visibility = 'public'
//
// Same visibility posture as accommodation: rows that haven't passed admin
// verification never surface to customers. Service_business defaults every
// insert to status='listed' + visibility='public' because Phase 1 walkers
// are Overpass-native (single source · public OSM data · already deduped) ·
// no admin-promotion gate needed before display. If we later add stricter
// verification, this loader picks it up automatically via the WHERE clause.

import { getFoodDbPool } from "@/lib/nex-food/db";

export interface ServiceListing {
  publicListingRef: string;
  businessName:    string;
  categorySlug:    string;
  categories:      string[];
  city:            string;
  district:        string | null;
  address:         string | null;
  coordinatesLat:  number | null;
  coordinatesLng:  number | null;
  phone:           string | null;
  whatsappNumber:  string | null;
  website:         string | null;
  heroImageUrl:    string | null;
  commercialStatus: string;
}

export const DEFAULT_PUBLIC_LIMIT = 1500;

export async function loadServiceListings(opts: {
  categorySlug:  string;
  city?:         string | null;
  limit?:        number;
  offset?:       number;
}): Promise<ServiceListing[]> {
  const pool = getFoodDbPool();
  const limit  = Math.min(Math.max(opts.limit ?? DEFAULT_PUBLIC_LIMIT, 1), 2000);
  const offset = Math.max(opts.offset ?? 0, 0);

  const params: (string | number)[] = [opts.categorySlug];
  let whereCity = "";
  if (opts.city && opts.city !== "All") {
    params.push(opts.city);
    whereCity = ` AND city = $${params.length}`;
  }

  const sql = `
    SELECT
      public_listing_ref, business_name, category_slug, categories,
      city, district, address,
      coordinates_lat, coordinates_lng,
      phone, whatsapp_number, website,
      hero_image_url,
      commercial_status
    FROM nex.service_business
    WHERE category_slug = $1
      AND status = 'listed'
      AND visibility = 'public'
      ${whereCity}
    ORDER BY (hero_image_url IS NULL) ASC,       -- rows WITH images first
             commercial_status DESC,              -- marketing_ready > contactable > qualified > discovered
             created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const r = await pool.query<{
    public_listing_ref: string;
    business_name: string;
    category_slug: string;
    categories: string[] | null;
    city: string;
    district: string | null;
    address: string | null;
    coordinates_lat: string | null;
    coordinates_lng: string | null;
    phone: string | null;
    whatsapp_number: string | null;
    website: string | null;
    hero_image_url: string | null;
    commercial_status: string;
  }>(sql, params);

  return r.rows.map((row) => ({
    publicListingRef: row.public_listing_ref,
    businessName:    row.business_name,
    categorySlug:    row.category_slug,
    categories:      row.categories ?? [],
    city:            row.city,
    district:        row.district,
    address:         row.address,
    coordinatesLat:  row.coordinates_lat != null ? Number(row.coordinates_lat) : null,
    coordinatesLng:  row.coordinates_lng != null ? Number(row.coordinates_lng) : null,
    phone:           row.phone,
    whatsappNumber:  row.whatsapp_number,
    website:         row.website,
    heroImageUrl:    row.hero_image_url,
    commercialStatus: row.commercial_status,
  }));
}

export interface ServiceCounts {
  total:            number;
  totalWithImage:   number;
  totalMarketingReady: number;
  distinctCities:   number;
}

export async function countServiceListings(categorySlug: string): Promise<ServiceCounts> {
  const pool = getFoodDbPool();
  const r = await pool.query<{
    total: string; with_image: string; marketing_ready: string; cities: string;
  }>(
    `SELECT
       count(*)::text                                                                  AS total,
       count(*) FILTER (WHERE hero_image_url IS NOT NULL)::text                        AS with_image,
       count(*) FILTER (WHERE commercial_status = 'marketing_ready')::text             AS marketing_ready,
       count(DISTINCT city)::text                                                       AS cities
     FROM nex.service_business
     WHERE category_slug = $1
       AND status = 'listed'
       AND visibility = 'public'`,
    [categorySlug],
  );
  const row = r.rows[0];
  return {
    total:               Number(row?.total ?? 0),
    totalWithImage:      Number(row?.with_image ?? 0),
    totalMarketingReady: Number(row?.marketing_ready ?? 0),
    distinctCities:      Number(row?.cities ?? 0),
  };
}
