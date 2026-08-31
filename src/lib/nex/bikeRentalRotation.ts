// src/lib/nex/bikeRentalRotation.ts · Philip 2026-08-29
//
// Deterministic bike-image picker for the rental directory. Rental companies
// often list "we rent scooters/sport bikes/etc" without a specific model.
// Given a rental_company_id + optional category, pick one taxonomy bike
// deterministically so the same company always shows the same image (no
// visual jitter across page loads) but different companies show different bikes.

export type BikeCategory =
  | "matic" | "maxi" | "sport" | "commuter" | "bebek"
  | "adventure" | "retro" | "electric";

export type TaxonomyBike = {
  slug: string;
  brand: string;
  model: string;
  category: BikeCategory;
  cc: number;
  base_color: string;
  common_colors: string[];
};

// FNV-1a hash · deterministic, no crypto dependency.
function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Pick a single bike from the taxonomy pool for a rental company.
 *
 * @param rentalCompanyId  Stable identifier (slug, public_listing_ref, etc.)
 * @param taxonomy         Full bike list (from /api/nex/bike-models)
 * @param preferCategories If given, filter pool to these categories first.
 *                         If pool is empty after filter, fall back to full pool.
 */
export function pickBikeForRental(
  rentalCompanyId: string,
  taxonomy: TaxonomyBike[],
  preferCategories?: BikeCategory[],
): TaxonomyBike | null {
  if (taxonomy.length === 0) return null;
  let pool = taxonomy;
  if (preferCategories && preferCategories.length > 0) {
    const filtered = taxonomy.filter((b) => preferCategories.includes(b.category));
    if (filtered.length > 0) pool = filtered;
  }
  const idx = hash32(rentalCompanyId) % pool.length;
  return pool[idx];
}

/**
 * Pick a paint color for the rental bike deterministically. Uses a different
 * hash seed so the color choice doesn't correlate with the model choice.
 */
export function pickPaintForRental(
  rentalCompanyId: string,
  commonColors: string[] = [],
): string {
  const palette = commonColors.length > 0 ? commonColors : ["red","black","white","blue","silver"];
  const hexMap: Record<string,string> = {
    red: "#dc2626", orange: "#f97316", yellow: "#eab308", green: "#22c55e",
    cyan: "#06b6d4", blue: "#3b82f6", "light-blue": "#60a5fa", purple: "#8b5cf6",
    pink: "#ec4899", brown: "#78350f", cream: "#f5f5dc", beige: "#e7dcc4",
    silver: "#94a3b8", white: "#f1f5f9", "matte-grey": "#4b5563",
    "matte-black": "#1f2937", black: "#111827", turquoise: "#5eead4",
    "white-green": "#a7f3d0", "black-green": "#065f46",
  };
  const idx = hash32(rentalCompanyId + ":paint") % palette.length;
  const name = palette[idx];
  return hexMap[name] ?? "#dc2626";
}

/**
 * One-call convenience for the card. Returns everything the card needs.
 */
export function bikeRentalCardData(
  rentalCompanyId: string,
  taxonomy: TaxonomyBike[],
  preferCategories?: BikeCategory[],
) {
  const bike = pickBikeForRental(rentalCompanyId, taxonomy, preferCategories);
  if (!bike) return null;
  const paintHex = pickPaintForRental(rentalCompanyId, bike.common_colors);
  return { bike, paintHex };
}
