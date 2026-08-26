// src/lib/nex-transport-acquisition/query-universe.ts
//
// TRANSPORT WALKER · discovery query universe.
//
// Doctrine:
//   · Public-source only · never leaked/private
//   · Platform names (Gojek/Grab/etc.) are SEARCH SIGNALS ONLY · never
//     converted into affiliation claims. Discovered records remain
//     DISCOVERED regardless of which keyword surfaced them.
//   · Bounded combinations · no uncontrolled explosion.
//   · Deterministic ordering · same input → same output.

import type { TransportVehicleOntology } from "./types";

// ── Location universe · Yogyakarta area ──────────────────────────────
export const YOGYA_LOCATION_TERMS: readonly string[] = [
  "Jogja",
  "Yogyakarta",
  "Kota Yogyakarta",
  "Sleman",
  "Bantul",
  "Kulon Progo",
  "Gunungkidul",
  "Depok Sleman",
  "Gamping",
  "Mlati",
  "Ngaglik",
  "Kasihan",
  "Banguntapan",
  "Wates",
  "Prambanan",
];

// The subset used by primary keyword building. The full list is used by the
// walker across cycles · the primary list keeps per-cycle load bounded.
const PRIMARY_LOCATION_TERMS: readonly string[] = ["Jogja", "Yogyakarta"];

// ── Category families ─────────────────────────────────────────────────

export interface QueryFamily {
  familyKey: string;
  vehicleKindHint: TransportVehicleOntology;
  supportsPassenger?: boolean;
  supportsLogistics?: boolean;
  isPlatformSignal?: boolean;   // TRUE for Gojek/Grab/Maxim/Shopee terms — never used to label a record
  keywordsSingular: readonly string[];  // combined with PRIMARY_LOCATION_TERMS
  keywordsAlreadyLocalised: readonly string[]; // used as-is (already contain city name or standalone)
}

const DRIVER_OJEK_FAMILY: QueryFamily = {
  familyKey: "driver_ojek",
  vehicleKindHint: "motorcycle",
  supportsPassenger: true,
  keywordsSingular: [
    "ojek",
    "ojol",
    "driver motor",
    "jasa driver",
    "supir",
    "supir pribadi",
    "driver pribadi",
    "driver harian",
    "driver freelance",
    "driver lepas",
  ],
  keywordsAlreadyLocalised: [
    "ojek jogja",
    "ojek yogyakarta",
    "driver jogja",
    "driver yogyakarta",
  ],
};

const PASSENGER_CAR_FAMILY: QueryFamily = {
  familyKey: "passenger_car",
  vehicleKindHint: "car",
  supportsPassenger: true,
  keywordsSingular: [
    "sewa mobil",
    "sewa mobil dengan driver",
    "rental mobil",
    "rental mobil driver",
    "car rental",
    "private driver",
    "private car",
    "chauffeur",
    "jasa transportasi",
    "antar jemput",
  ],
  keywordsAlreadyLocalised: [
    "transport jogja",
    "antar jemput jogja",
  ],
};

const TAXI_FAMILY: QueryFamily = {
  familyKey: "taxi",
  vehicleKindHint: "taxi",
  supportsPassenger: true,
  keywordsSingular: ["taxi"],
  keywordsAlreadyLocalised: [
    "taxi jogja",
    "taxi yogyakarta",
    "Bluebird Yogyakarta",   // widely-known public brand · discovery signal only
  ],
};

// Platform signals — Gojek/Grab/Maxim/Shopee. USED ONLY AS SEARCH VOCABULARY.
// The walker MUST NOT label a discovered record as "Gojek driver" etc.
const PLATFORM_SIGNAL_FAMILY: QueryFamily = {
  familyKey: "platform_signal",
  vehicleKindHint: "unknown",
  isPlatformSignal: true,
  keywordsSingular: [],
  keywordsAlreadyLocalised: [
    "Gojek Yogyakarta",
    "Go-Jek Jogja",
    "Grab Yogyakarta",
    "Grab Jogja",
    "Maxim Jogja",
    "ShopeeFood Jogja",
    "Shopee Express Jogja",
    "GrabExpress Jogja",
  ],
};

const COURIER_FAMILY: QueryFamily = {
  familyKey: "courier",
  vehicleKindHint: "courier",
  supportsLogistics: true,
  keywordsSingular: [
    "kurir",
    "kurir motor",
    "kurir mobil",
    "delivery driver",
    "jasa kirim barang",
    "jasa antar barang",
    "jasa pengiriman",
    "local delivery",
    "same day delivery",
    "courier",
    "courier service",
    "ekspedisi",
  ],
  keywordsAlreadyLocalised: [
    "kurir jogja",
    "kurir yogyakarta",
    "delivery jogja",
  ],
};

const GOODS_PICKUP_TRUCK_FAMILY: QueryFamily = {
  familyKey: "goods_pickup_truck",
  vehicleKindHint: "pickup",
  supportsLogistics: true,
  keywordsSingular: [
    "pickup",
    "sewa pickup",
    "jasa pickup",
    "angkut barang",
    "angkutan barang",
    "truk",
    "sewa truk",
    "jasa truk",
    "truck rental",
    "cargo",
    "cargo transport",
    "logistics",
    "logistik",
    "jasa logistik",
    "pindahan",
    "jasa pindahan",
  ],
  keywordsAlreadyLocalised: [
    "sewa pickup jogja",
    "sewa truk jogja",
    "pindahan jogja",
  ],
};

const TOURISM_AIRPORT_FAMILY: QueryFamily = {
  familyKey: "tourism_airport",
  vehicleKindHint: "tourist_driver",
  supportsPassenger: true,
  keywordsSingular: [
    "driver wisata",
    "tour driver",
    "private tour driver",
    "airport transfer",
    "airport driver",
    "antar jemput bandara",
  ],
  keywordsAlreadyLocalised: [
    "YIA airport transfer",
    "Yogyakarta airport transport",
    "hotel airport transfer jogja",
    "tourist transport jogja",
    "driver wisata jogja",
  ],
};

const VAN_MINIBUS_BUS_FAMILY: QueryFamily = {
  familyKey: "van_minibus_bus",
  vehicleKindHint: "minibus",
  supportsPassenger: true,
  keywordsSingular: [
    "sewa van",
    "rental van",
    "minibus",
    "sewa minibus",
    "sewa bus",
    "bus pariwisata",
    "travel",
    "shuttle",
  ],
  keywordsAlreadyLocalised: [
    "sewa elf jogja",
    "sewa bus jogja",
    "bus pariwisata jogja",
    "travel yogyakarta",
    "shuttle jogja",
  ],
};

// Individual-driver social family · designed for public-social providers
// (Facebook public pages · public Instagram business profiles · etc.).
// The Nominatim provider IGNORES this family (map data has no individual-driver
// records). The Facebook provider CONSUMES this family exclusively.
//
// Doctrine: even when this family surfaces a name+phone from a public post,
// the record enters at stage='discovered' with contactability evaluated on
// canonical-E.164 · NEVER at 'active' or 'verified'.
const INDIVIDUAL_DRIVER_SOCIAL_FAMILY: QueryFamily = {
  familyKey: "individual_driver_social",
  vehicleKindHint: "motorcycle",   // most Indonesian individual drivers advertise motorbike work
  supportsPassenger: true,
  keywordsSingular: [
    "driver",
    "ojek",
    "ojol",
    "supir",
    "jasa driver",
    "driver motor",
    "driver antar jemput",
    "driver wisata",
    "driver airport",
    "driver pribadi",
  ],
  keywordsAlreadyLocalised: [
    "driver Jogja",
    "driver Yogyakarta",
    "driver Sleman",
    "driver Bantul",
    "driver Kulon Progo",
    "driver Gunungkidul",
    "driver Wates",
    "driver Prambanan",
    "ojek Jogja",
    "ojol Jogja",
    "supir Jogja",
    "supir Sleman",
    "driver wisata Jogja",
    "driver antar jemput Jogja",
  ],
};

export const QUERY_FAMILIES: readonly QueryFamily[] = [
  DRIVER_OJEK_FAMILY,
  PASSENGER_CAR_FAMILY,
  TAXI_FAMILY,
  PLATFORM_SIGNAL_FAMILY,
  COURIER_FAMILY,
  GOODS_PICKUP_TRUCK_FAMILY,
  TOURISM_AIRPORT_FAMILY,
  VAN_MINIBUS_BUS_FAMILY,
  INDIVIDUAL_DRIVER_SOCIAL_FAMILY,
];

export interface GeneratedQuery {
  query: string;
  familyKey: string;
  vehicleKindHint: TransportVehicleOntology;
  supportsPassenger: boolean;
  supportsLogistics: boolean;
  isPlatformSignal: boolean;
}

/**
 * Generate the query set for one cycle. Deterministic + bounded.
 *
 * - Each family contributes its keywordsAlreadyLocalised in full.
 * - Each family contributes keywordsSingular × PRIMARY_LOCATION_TERMS (2 cities).
 * - Total is bounded roughly to (sum of already-localised) + (sum of singular × 2).
 * - Platform signals are always included but limited to already-localised
 *   (never combined) · they are search vocabulary only.
 */
export function generateQueries(): GeneratedQuery[] {
  const out: GeneratedQuery[] = [];
  for (const fam of QUERY_FAMILIES) {
    for (const kw of fam.keywordsAlreadyLocalised) {
      out.push(toGenerated(kw, fam));
    }
    if (!fam.isPlatformSignal) {
      for (const kw of fam.keywordsSingular) {
        for (const loc of PRIMARY_LOCATION_TERMS) {
          out.push(toGenerated(`${kw} ${loc}`, fam));
        }
      }
    }
  }
  // Deduplicate on query text · deterministic order preserved.
  const seen = new Set<string>();
  return out.filter((q) => {
    const k = q.query.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function toGenerated(query: string, fam: QueryFamily): GeneratedQuery {
  return {
    query,
    familyKey: fam.familyKey,
    vehicleKindHint: fam.vehicleKindHint,
    supportsPassenger: !!fam.supportsPassenger,
    supportsLogistics: !!fam.supportsLogistics,
    isPlatformSignal: !!fam.isPlatformSignal,
  };
}

/**
 * Filter generated queries to the subset a given provider is capable of
 * consuming. Nominatim searches locations/businesses on OSM · it should NOT
 * consume individual_driver_social queries (map data has no individual-driver
 * records). Facebook public-provider consumes only individual_driver_social
 * (+ driver_ojek) · never platform-signal · never non-driver commerce.
 */
export function queriesForProvider(
  provider: "nominatim" | "overpass" | "facebook_public",
  queries: GeneratedQuery[],
): GeneratedQuery[] {
  switch (provider) {
    case "nominatim":
    case "overpass":
      return queries.filter((q) => q.familyKey !== "individual_driver_social");
    case "facebook_public":
      return queries.filter((q) => q.familyKey === "individual_driver_social" || q.familyKey === "driver_ojek");
  }
}
