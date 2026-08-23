// Filter-intent → listing matcher.
//
// Every filter is a STRUCTURED INTENT TOKEN, not a visual chip
// (Philip 2026-08-21). This module maps a FoodFilterIntent onto the
// listing data · same vocabulary the NEX conversation layer will eventually
// use for natural-language queries like "Cari makanan pedas dekat saya."
//
// V1 · matches against the existing schema (category + cuisine string from
// OSM). Richer attributes (spicy · vegetarian · price band · open hours)
// land as the data model enriches in Phase 7+.

import type { FoodListing } from "@/lib/nexapp/foodListings";

export type TopFilter =
  | "all"
  | "makanan"
  | "dessert"
  | "minuman"
  | "kopi"
  | "promo"
  | "buka-sekarang";

export type FoodFilterIntent = {
  top: TopFilter;
  sub: string | null;   // cuisine/style token · null = top-level only
};

export const TOP_FILTER_LABELS: Record<TopFilter, string> = {
  "all":           "Semua",
  "makanan":       "Makanan",
  "dessert":       "Dessert",
  "minuman":       "Minuman",
  "kopi":          "Kopi",
  "promo":         "Promo",
  "buka-sekarang": "Buka Sekarang",
};

export const SUB_LABELS: Partial<Record<TopFilter, Array<{ id: string; label: string }>>> = {
  makanan: [
    { id: "indonesia",  label: "Indonesia" },
    { id: "jawa",       label: "Jawa" },
    { id: "padang",     label: "Padang" },
    { id: "sunda",      label: "Sunda" },
    { id: "bali",       label: "Bali" },
    { id: "chinese",    label: "Chinese" },
    { id: "japanese",   label: "Japanese" },
    { id: "korean",     label: "Korean" },
    { id: "western",    label: "Western" },
    { id: "italian",    label: "Italian" },
    { id: "indian",     label: "Indian" },
    { id: "thai",       label: "Thai" },
    { id: "fast-food",  label: "Fast Food" },
    { id: "ayam",       label: "Ayam" },
    { id: "nasi",       label: "Nasi" },
    { id: "mie",        label: "Mie" },
    { id: "seafood",    label: "Seafood" },
    { id: "daging",     label: "Daging" },
    { id: "vegetarian", label: "Vegetarian" },
    { id: "pedas",      label: "Pedas" },
  ],
  dessert: [
    { id: "cake",       label: "Cake" },
    { id: "ice-cream",  label: "Ice Cream" },
    { id: "pastry",     label: "Pastry" },
    { id: "donut",      label: "Donut" },
    { id: "bakery",     label: "Bakery" },
  ],
  minuman: [
    { id: "juice",      label: "Juice" },
    { id: "smoothie",   label: "Smoothie" },
    { id: "bubble-tea", label: "Bubble Tea" },
    { id: "tea",        label: "Tea" },
    { id: "fresh",      label: "Fresh" },
  ],
  kopi: [
    { id: "espresso",   label: "Espresso" },
    { id: "latte",      label: "Latte" },
    { id: "cold-brew",  label: "Cold Brew" },
    { id: "filter",     label: "Filter" },
  ],
};

type ListingLike = FoodListing & {
  cuisine?: string | null;
  rawClaimStatus?: string;
  // Task #85 (2026-08-22) · secondary category tokens (bakery · japanese · warung ·
  // takeaway · etc.) · empty when a row was ingested before Task #85. Included in
  // the sub-token match hay so filter chips can surface widened OSM classification.
  categories?: string[];
};

/**
 * Structured token mapping · sub-filter id → text-match candidates checked
 * against the listing's cuisine + category + business_name.
 * Keeping this small and explicit · easier to audit than substring soup.
 */
const SUB_MATCHERS: Record<string, string[]> = {
  // Cuisines
  indonesia:  ["indonesian", "local", "regional", "javanese", "padang", "sundanese", "bali"],
  jawa:       ["javanese", "jawa"],
  padang:     ["padang"],
  sunda:      ["sundanese", "sunda"],
  bali:       ["bali", "balinese"],
  chinese:    ["chinese"],
  japanese:   ["japanese", "sushi", "ramen"],
  korean:     ["korean"],
  western:    ["western", "european", "steak", "burger", "american"],
  italian:    ["italian", "pizza", "pasta"],
  indian:     ["indian"],
  thai:       ["thai"],
  "fast-food": ["fast food", "fast_food", "burger", "chicken"],
  // Dish tokens
  ayam:       ["ayam", "chicken"],
  nasi:       ["nasi", "rice"],
  mie:        ["mie", "noodle", "pasta", "ramen"],
  seafood:    ["seafood", "fish", "sushi"],
  daging:     ["daging", "beef", "steak", "meat"],
  vegetarian: ["vegetarian", "vegan"],
  pedas:      ["pedas", "spicy", "chili"],
  // Dessert
  cake:       ["cake"],
  "ice-cream": ["ice cream", "gelato", "sorbet"],
  pastry:     ["pastry"],
  donut:      ["donut", "doughnut"],
  bakery:     ["bakery", "roti"],
  // Minuman
  juice:      ["juice", "jus"],
  smoothie:   ["smoothie"],
  "bubble-tea": ["bubble tea", "boba"],
  tea:        ["tea", "teh"],
  fresh:      ["fresh"],
  // Kopi
  espresso:   ["espresso"],
  latte:      ["latte"],
  "cold-brew": ["cold brew"],
  filter:     ["filter"],
};

export function matchesIntent(listing: ListingLike, intent: FoodFilterIntent): boolean {
  // Level 1 · category / special-filter gate
  switch (intent.top) {
    case "all":
      break;   // pass
    case "makanan":
      if (listing.category !== "restaurant" && listing.category !== "fast-food") return false;
      break;
    case "dessert":
      if (listing.category !== "ice-cream-dessert") return false;
      break;
    case "minuman":
      // No dedicated Minuman category yet · treat as coffee-cafe with drink tokens
      if (listing.category !== "coffee-cafe") return false;
      break;
    case "kopi":
      if (listing.category !== "coffee-cafe") return false;
      break;
    case "promo":
      // V1 · no voucher data yet · always empty for now
      return false;
    case "buka-sekarang":
      // V1 · opening_information is stored as note-only · always empty for now
      return false;
  }

  // Level 2 · sub-token match against cuisine + business name + secondary categories
  if (intent.sub) {
    const candidates = SUB_MATCHERS[intent.sub] ?? [intent.sub];
    // Task #85 (2026-08-22) · secondary categories array joined into the hay
    // so widened OSM classification (bakery · japanese · warung · takeaway · etc.)
    // is matchable by existing filter chips without a UI redesign.
    const secondaries = Array.isArray(listing.categories) ? listing.categories.join(" ") : "";
    const hay = (
      (listing.cuisine ?? "") +
      " " +
      listing.name +
      " " +
      listing.category +
      " " +
      secondaries
    ).toLowerCase();
    if (!candidates.some((c) => hay.includes(c.toLowerCase()))) return false;
  }

  return true;
}
