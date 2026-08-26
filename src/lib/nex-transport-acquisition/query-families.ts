// src/lib/nex-transport-acquisition/query-families.ts
//
// QUERY FAMILIES · deterministic discovery query templates per transport class.
//
// The Transport Walker (future) reads these families to compose search queries
// for public sources. Data-driven · a new class or query group adds via
// registration · never hard-coded inside a walker.

import type { TransportVehicleOntology } from "./types";

export interface QueryFamily {
  vehicleClass: TransportVehicleOntology;
  jurisdiction: string;                // e.g. 'ID/DIY/Yogyakarta'
  languages: ("id" | "en")[];
  queries: string[];
  notes?: string;
}

export const YOGYA_QUERY_FAMILIES: QueryFamily[] = [
  {
    vehicleClass: "motorcycle",
    jurisdiction: "ID/DIY/Yogyakarta",
    languages: ["id"],
    queries: [
      "ojek Jogja",
      "ojek motor Jogja",
      "driver motor Jogja",
      "jasa antar Jogja motor",
      "kurir motor Jogja",
      "delivery motor Jogja",
      "driver ojol Jogja",
    ],
  },
  {
    vehicleClass: "car",
    jurisdiction: "ID/DIY/Yogyakarta",
    languages: ["id", "en"],
    queries: [
      "driver Jogja",
      "private driver Jogja",
      "rental mobil dengan driver Jogja",
      "chauffeur Jogja",
      "driver airport Jogja",
      "driver YIA",
      "airport transfer Jogja",
    ],
  },
  {
    vehicleClass: "pickup",
    jurisdiction: "ID/DIY/Yogyakarta",
    languages: ["id"],
    queries: [
      "sewa pickup Jogja",
      "pickup delivery Jogja",
      "jasa angkut Jogja",
      "jasa pindahan Jogja",
    ],
  },
  {
    vehicleClass: "small_truck",
    jurisdiction: "ID/DIY/Yogyakarta",
    languages: ["id"],
    queries: [
      "truk engkel Jogja",
      "truk box Jogja",
      "jasa angkut barang Jogja",
      "truk sewa Jogja",
    ],
  },
  {
    vehicleClass: "lorry",
    jurisdiction: "ID/DIY/Yogyakarta",
    languages: ["id"],
    queries: [
      "truk fuso Jogja",
      "logistik Jogja",
      "angkutan barang Jogja",
      "jasa logistik Jogja",
    ],
  },
  {
    vehicleClass: "bus",
    jurisdiction: "ID/DIY/Yogyakarta",
    languages: ["id", "en"],
    queries: [
      "sewa bus Jogja",
      "bus pariwisata Jogja",
      "minibus Jogja",
      "sewa elf Jogja",
      "transport wisata Jogja",
      "Yogyakarta tour bus rental",
    ],
  },
  {
    vehicleClass: "courier",
    jurisdiction: "ID/DIY/Yogyakarta",
    languages: ["id"],
    queries: [
      "kurir Jogja",
      "jasa kirim barang Jogja",
      "delivery Jogja",
      "kurir instant Jogja",
    ],
  },
];

/**
 * Return the query families relevant for a set of vehicle classes in a
 * jurisdiction. Deterministic order · never randomised.
 */
export function queryFamiliesFor(
  vehicleClasses: TransportVehicleOntology[],
  jurisdiction: string,
): QueryFamily[] {
  return YOGYA_QUERY_FAMILIES.filter(
    (f) => f.jurisdiction === jurisdiction && vehicleClasses.includes(f.vehicleClass),
  );
}
