// NEX Food Directory · Yogyakarta V1 mock data + types.
//
// Backend-agnostic mock so the Food Directory panel can be built + tuned
// visually WITHOUT the Business Acquisition Pipeline + Universal Listings
// Engine infrastructure (Priority 4+ per pinned doctrine).
//
// Types mirror the pinned `project_nex_food_discovery_yogyakarta_v1`
// data model — Owner-Provenanced Pricing rules apply: NEX never invents
// dishes/prices; unclaimed listings show identity only, no menu.
//
// Image strategy: Unsplash direct URLs as PLACEHOLDERS. Philip supplies
// approved images in Phase 2 — the field name is `heroImageUrl` and
// swapping is a one-line change per record when the approved image lands.

export type FoodCategory =
  | "coffee-cafe"
  | "ice-cream-dessert"
  | "fast-food"
  | "restaurant";

export type ClaimStatus = "unclaimed" | "invited" | "claimed";

export type FoodListing = {
  id: string;
  publicListingRef: string;           // #6728-style stable public reference
  cityCode: "YOG";                    // Yogyakarta V1 · scale to JKT/BDG/BALI later
  category: FoodCategory;
  // Task #85 (2026-08-22) · secondary categories from richer OSM tags
  // (shop=bakery · cuisine=japanese · warung · takeaway · etc.) · empty
  // when a row was ingested before Task #85 or when OSM had no extra evidence.
  categories?: string[];
  name: string;
  district: string;                   // "Malioboro" · "Prawirotaman" · etc.
  distanceKm?: number;                // mock distance from mock "user location"
  heroImageUrl: string;
  heroImageApproved: boolean;         // per Owner-Provenanced image doctrine
  heroImageSource: "nex_curated_v1" | "owner_uploaded" | "owner_authorised";
  rating?: number;                    // 1-5
  ratingSource?: "google_places" | "internal";
  reviewCount?: number;
  openingStatus: "open" | "closed" | "unknown";
  description?: string;               // NEX-curated OR owner-authorised
  phone?: string;
  claimStatus: ClaimStatus;
  provenance: "nex_curated_v1" | "owner_direct";
};

export type FoodDish = {
  id: string;
  listingId: string;
  publicDishRef: string;
  name: string;
  imageUrl?: string;
  imageApproved: boolean;
  description?: string;
  price?: number;                     // owner-supplied · never invented
  currency?: string;                  // "IDR"
  availability: "available" | "unavailable" | "unknown";
  provenance: "owner_direct";         // dishes ONLY exist post-claim
};

// ── Category metadata ─────────────────────────────────────

export const FOOD_CATEGORIES: readonly {
  slug: FoodCategory;
  labelEn: string;
  labelId: string;
  emoji: string;
}[] = [
  { slug: "coffee-cafe",       labelEn: "Coffee & Cafés",        labelId: "Kopi & Kafe",     emoji: "☕" },
  { slug: "ice-cream-dessert", labelEn: "Ice Cream & Desserts",  labelId: "Es Krim & Kue",   emoji: "🍦" },
  { slug: "fast-food",         labelEn: "Fast Food",              labelId: "Makanan Cepat",   emoji: "🍔" },
  { slug: "restaurant",        labelEn: "Restaurants",            labelId: "Restoran",        emoji: "🍽️" },
];

// ── Mock listings for Yogyakarta launch ───────────────────
// Real business names in Yogyakarta (public knowledge) · placeholder
// Unsplash images. Philip swaps these for approved images in Phase 2.

export const MOCK_FOOD_LISTINGS: readonly FoodListing[] = [
  // ── Coffee & Cafés ──
  {
    id: "yog-cc-01",
    publicListingRef: "#YOG-1001",
    cityCode: "YOG",
    category: "coffee-cafe",
    name: "Filosofi Kopi Yogyakarta",
    district: "Prawirotaman",
    distanceKm: 1.2,
    heroImageUrl: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80",
    heroImageApproved: true,
    heroImageSource: "nex_curated_v1",
    rating: 4.6,
    ratingSource: "google_places",
    reviewCount: 4820,
    openingStatus: "open",
    description: "Iconic Indonesian speciality-coffee spot inspired by the film. Single-origin arabica, calm interior.",
    claimStatus: "claimed",              // shows NEX MEMBER badge + menu
    provenance: "owner_direct",
  },
  {
    id: "yog-cc-02",
    publicListingRef: "#YOG-1002",
    cityCode: "YOG",
    category: "coffee-cafe",
    name: "Legend Coffee Malioboro",
    district: "Malioboro",
    distanceKm: 0.6,
    heroImageUrl: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800&q=80",
    heroImageApproved: true,
    heroImageSource: "nex_curated_v1",
    rating: 4.4,
    ratingSource: "google_places",
    reviewCount: 2160,
    openingStatus: "open",
    description: "24-hour café near Malioboro · popular with locals + travellers.",
    claimStatus: "unclaimed",            // shows "Business info being verified"
    provenance: "nex_curated_v1",
  },
  // ── Ice Cream & Desserts ──
  {
    id: "yog-id-01",
    publicListingRef: "#YOG-1101",
    cityCode: "YOG",
    category: "ice-cream-dessert",
    name: "Tempo Gelato",
    district: "Prawirotaman",
    distanceKm: 1.4,
    heroImageUrl: "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=800&q=80",
    heroImageApproved: true,
    heroImageSource: "nex_curated_v1",
    rating: 4.7,
    ratingSource: "google_places",
    reviewCount: 3540,
    openingStatus: "open",
    description: "Small-batch artisanal gelato · rotating flavours daily.",
    claimStatus: "claimed",
    provenance: "owner_direct",
  },
  {
    id: "yog-id-02",
    publicListingRef: "#YOG-1102",
    cityCode: "YOG",
    category: "ice-cream-dessert",
    name: "Es Krim Puro Pakualaman",
    district: "Pakualaman",
    distanceKm: 2.1,
    heroImageUrl: "https://images.unsplash.com/photo-1488900128323-21503983a07e?w=800&q=80",
    heroImageApproved: true,
    heroImageSource: "nex_curated_v1",
    openingStatus: "closed",
    description: "Traditional Javanese ice cream · local favourite for generations.",
    claimStatus: "unclaimed",
    provenance: "nex_curated_v1",
  },
  // ── Fast Food ──
  {
    id: "yog-ff-01",
    publicListingRef: "#YOG-1201",
    cityCode: "YOG",
    category: "fast-food",
    name: "Ayam Geprek Bensu",
    district: "Sleman",
    distanceKm: 3.8,
    heroImageUrl: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&q=80",
    heroImageApproved: true,
    heroImageSource: "nex_curated_v1",
    rating: 4.2,
    ratingSource: "google_places",
    reviewCount: 1280,
    openingStatus: "open",
    description: "Fast-service crispy fried chicken with sambal.",
    claimStatus: "unclaimed",
    provenance: "nex_curated_v1",
  },
  // ── Restaurants ──
  {
    id: "yog-r-01",
    publicListingRef: "#YOG-1301",
    cityCode: "YOG",
    category: "restaurant",
    name: "Gudeg Yu Djum",
    district: "Wijilan",
    distanceKm: 1.8,
    heroImageUrl: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80",
    heroImageApproved: true,
    heroImageSource: "nex_curated_v1",
    rating: 4.5,
    ratingSource: "google_places",
    reviewCount: 8940,
    openingStatus: "open",
    description: "Legendary Yogyakarta gudeg since 1950 · slow-cooked jackfruit stew with chicken and egg.",
    claimStatus: "claimed",
    provenance: "owner_direct",
  },
  {
    id: "yog-r-02",
    publicListingRef: "#YOG-1302",
    cityCode: "YOG",
    category: "restaurant",
    name: "Sate Klathak Pak Bari",
    district: "Bantul",
    distanceKm: 8.2,
    heroImageUrl: "https://images.unsplash.com/photo-1529042410759-befb1204b468?w=800&q=80",
    heroImageApproved: true,
    heroImageSource: "nex_curated_v1",
    rating: 4.6,
    ratingSource: "google_places",
    reviewCount: 5210,
    openingStatus: "open",
    description: "Famous grilled goat satay skewered on iron rods · a Yogyakarta signature dish.",
    claimStatus: "unclaimed",
    provenance: "nex_curated_v1",
  },
  {
    id: "yog-r-03",
    publicListingRef: "#YOG-1303",
    cityCode: "YOG",
    category: "restaurant",
    name: "Warung Padang Ratu",
    district: "Malioboro",
    distanceKm: 0.9,
    heroImageUrl: "https://images.unsplash.com/photo-1517244683847-7456b63c5969?w=800&q=80",
    heroImageApproved: true,
    heroImageSource: "nex_curated_v1",
    rating: 4.3,
    ratingSource: "google_places",
    reviewCount: 1620,
    openingStatus: "open",
    description: "Classic Padang rijsttafel · rendang, sambal, sayur nangka.",
    claimStatus: "invited",              // outreach in flight
    provenance: "nex_curated_v1",
  },
];

// Mock dishes for the two CLAIMED listings that have menus.
// Owner-provenanced only — unclaimed listings NEVER carry dish data
// (per pinned Owner-Provenanced Pricing doctrine).
export const MOCK_FOOD_DISHES: readonly FoodDish[] = [
  // Filosofi Kopi Yogyakarta menu
  { id: "d-filo-01", listingId: "yog-cc-01", publicDishRef: "#YOG-1001-D1", name: "Iced Latte",     imageUrl: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&q=80", imageApproved: true, description: "Double espresso · fresh milk · ice.",              price: 35000, currency: "IDR", availability: "available",   provenance: "owner_direct" },
  { id: "d-filo-02", listingId: "yog-cc-01", publicDishRef: "#YOG-1001-D2", name: "Cappuccino",    imageUrl: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80", imageApproved: true, description: "Balanced espresso + steamed milk foam.",           price: 32000, currency: "IDR", availability: "available",   provenance: "owner_direct" },
  { id: "d-filo-03", listingId: "yog-cc-01", publicDishRef: "#YOG-1001-D3", name: "Filosofi Kopi", imageUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80", imageApproved: true, description: "House-signature single-origin · notes of caramel + citrus.", price: 45000, currency: "IDR", availability: "available",   provenance: "owner_direct" },
  { id: "d-filo-04", listingId: "yog-cc-01", publicDishRef: "#YOG-1001-D4", name: "Croissant",     imageUrl: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80", imageApproved: true, description: "Butter croissant · baked fresh each morning.",       price: 25000, currency: "IDR", availability: "unavailable", provenance: "owner_direct" },
  // Tempo Gelato menu (3 rotating flavours)
  { id: "d-tempo-01", listingId: "yog-id-01", publicDishRef: "#YOG-1101-D1", name: "Pistachio",         imageUrl: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&q=80", imageApproved: true, description: "Sicilian pistachio · house-roasted.",  price: 45000, currency: "IDR", availability: "available", provenance: "owner_direct" },
  { id: "d-tempo-02", listingId: "yog-id-01", publicDishRef: "#YOG-1101-D2", name: "Dark Chocolate",    imageUrl: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&q=80", imageApproved: true, description: "70% Belgian dark chocolate.",           price: 40000, currency: "IDR", availability: "available", provenance: "owner_direct" },
  { id: "d-tempo-03", listingId: "yog-id-01", publicDishRef: "#YOG-1101-D3", name: "Salak (Snake Fruit)", imageUrl: "https://images.unsplash.com/photo-1488900128323-21503983a07e?w=400&q=80", imageApproved: true, description: "Local Yogyakarta fruit · seasonal.",   price: 42000, currency: "IDR", availability: "available", provenance: "owner_direct" },
  // Gudeg Yu Djum menu
  { id: "d-gudeg-01", listingId: "yog-r-01", publicDishRef: "#YOG-1301-D1", name: "Gudeg Complete Set", imageUrl: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&q=80", imageApproved: true, description: "Gudeg + chicken + egg + krecek + rice.", price: 45000, currency: "IDR", availability: "available", provenance: "owner_direct" },
  { id: "d-gudeg-02", listingId: "yog-r-01", publicDishRef: "#YOG-1301-D2", name: "Gudeg Kering",       imageUrl: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&q=80", imageApproved: true, description: "Dry-style gudeg · travels well · takeaway favourite.", price: 30000, currency: "IDR", availability: "available", provenance: "owner_direct" },
];

// ── Helpers ────────────────────────────────────────────────

export function dishesForListing(listingId: string): FoodDish[] {
  return MOCK_FOOD_DISHES.filter((d) => d.listingId === listingId);
}

export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export function formatDistance(km?: number): string {
  if (km == null) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
