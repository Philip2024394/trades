// Server-side coverage loader.
//
// Reads studio_brand_outcomes for a brand, resolves the merchant's
// coverage postcode to lat/lng via postcodes.io, returns a plain object
// that the client CoverageProvider can hydrate from.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { lookupPostcode } from "./postcodesIo";

export type BrandCoverage = {
  postcode: string | null;
  radiusMi: number | null;
  centerLat: number | null;
  centerLng: number | null;
  national: boolean;
};

type OutcomesRow = {
  coverage_postcode: string | null;
  coverage_radius_mi: number | null;
};

export async function loadBrandCoverage(
  brandId: string
): Promise<BrandCoverage> {
  const res = await supabaseAdmin
    .from("studio_brand_outcomes")
    .select("coverage_postcode, coverage_radius_mi")
    .eq("brand_id", brandId)
    .maybeSingle();
  const row = res.data as OutcomesRow | null;

  if (!row || (!row.coverage_postcode && !row.coverage_radius_mi)) {
    return {
      postcode: null,
      radiusMi: null,
      centerLat: null,
      centerLng: null,
      national: true
    };
  }

  if (!row.coverage_postcode) {
    return {
      postcode: null,
      radiusMi: row.coverage_radius_mi,
      centerLat: null,
      centerLng: null,
      national: true
    };
  }

  const point = await lookupPostcode(row.coverage_postcode);
  if (!point) {
    return {
      postcode: row.coverage_postcode,
      radiusMi: row.coverage_radius_mi,
      centerLat: null,
      centerLng: null,
      national: false
    };
  }

  return {
    postcode: row.coverage_postcode,
    radiusMi: row.coverage_radius_mi,
    centerLat: point.latitude,
    centerLng: point.longitude,
    national: false
  };
}
