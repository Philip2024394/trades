// src/lib/nex-accommodation/smart-discovery-signals.ts
//
// NEX Smart Discovery signal computation (2026-08-24 prototype).
//
// Doctrine (Philip 2026-08-24):
//   · "NEX should not merely show a place. NEX should understand what is
//      useful around that place."
//   · "Build the first examples around these real What's nearby signals,
//      rather than creating fake recommendation data."
//   · "If a real nearby attraction/service cannot be established, use a
//      clearly marked prototype/demo signal rather than pretending it is live."
//
// Signal types + reality:
//   food_cluster            REAL · haversine on nex.food_business coords
//   attraction_nearby       REAL · haversine on nex.geo_landmark (category='attraction')
//   shopping_nearby         REAL · haversine on nex.geo_landmark (category='shopping')
//   transport_hub_nearby    REAL · haversine on nex.geo_landmark (category='transport')
//   motorbike_rental_prototype   DEMO · clearly marked · no NEX motorbike-rental vertical yet
//
// Selection: `pickDemonstrationSet` returns 3-5 accommodations · deterministic
// (input-order + signal-score) · diverse-typed where possible so the grid
// shows varied Smart Discovery examples not five identical food-cluster flips.

import { getAccommodationDbPool } from "./db";

export type SmartDiscoverySignalType =
  | "food_cluster"
  | "attraction_nearby"
  | "shopping_nearby"
  | "transport_hub_nearby"
  | "motorbike_rental_prototype";

export interface SmartDiscoverySignal {
  type: SmartDiscoverySignalType;
  emoji: string;
  title: string;             // "Food is right outside your door"
  body:  string;              // "6 restaurants & cafés within 170m"
  cta:   string;              // "Explore nearby →"
  isDemo: boolean;            // false = real DB evidence · true = clearly-marked prototype
  evidence: {
    nearbyCount?: number;
    nearestMeters?: number;
    landmarkName?: string;
    landmarkCategory?: string;
  };
}

interface AccommodationCoords {
  publicListingRef: string;
  coordinatesLat: number;
  coordinatesLng: number;
}

/**
 * Compute the strongest Smart Discovery signal for each accommodation.
 * Batch-runs one aggregation query so N inputs cost ~O(1) round-trips.
 * Returns a Map keyed by publicListingRef. Accommodations without a strong
 * enough signal are simply absent from the map (the caller decides fallback).
 */
export async function computeSmartDiscoverySignals(
  accommodations: AccommodationCoords[],
): Promise<Map<string, SmartDiscoverySignal>> {
  if (accommodations.length === 0) return new Map();
  const pool = getAccommodationDbPool();

  const refs = accommodations.map((a) => a.publicListingRef);
  const lats = accommodations.map((a) => a.coordinatesLat);
  const lngs = accommodations.map((a) => a.coordinatesLng);

  // Batch food-cluster counts within 200m per accommodation.
  const foodQ = pool.query<{ ref: string; food_within_200m: number }>(
    `WITH input AS (
       SELECT ref, lat, lng
         FROM unnest($1::text[], $2::float8[], $3::float8[]) AS t(ref, lat, lng)
     )
     SELECT input.ref,
            (SELECT COUNT(*)::int
               FROM nex.food_business f
              WHERE f.claim_status IN ('listed','invited','claimed','paying')
                AND f.coordinates_lat IS NOT NULL
                AND (6371 * acos(GREATEST(-1, LEAST(1,
                      cos(radians(input.lat)) * cos(radians(f.coordinates_lat)) *
                      cos(radians(f.coordinates_lng) - radians(input.lng)) +
                      sin(radians(input.lat)) * sin(radians(f.coordinates_lat))))
                )) < 0.2
            ) AS food_within_200m
       FROM input`,
    [refs, lats, lngs],
  );

  // Batch nearest-landmark per accommodation (any category).
  const landmarkQ = pool.query<{
    ref: string;
    landmark_name: string | null;
    landmark_category: string | null;
    dist_km: number | null;
  }>(
    `WITH input AS (
       SELECT ref, lat, lng
         FROM unnest($1::text[], $2::float8[], $3::float8[]) AS t(ref, lat, lng)
     ),
     ranked AS (
       SELECT input.ref, l.name, l.category,
              (6371 * acos(GREATEST(-1, LEAST(1,
                cos(radians(input.lat)) * cos(radians(l.centroid_lat)) *
                cos(radians(l.centroid_lng) - radians(input.lng)) +
                sin(radians(input.lat)) * sin(radians(l.centroid_lat))))
              )) AS dist_km,
              ROW_NUMBER() OVER (
                PARTITION BY input.ref
                ORDER BY (6371 * acos(GREATEST(-1, LEAST(1,
                  cos(radians(input.lat)) * cos(radians(l.centroid_lat)) *
                  cos(radians(l.centroid_lng) - radians(input.lng)) +
                  sin(radians(input.lat)) * sin(radians(l.centroid_lat))))
                )) ASC
              ) AS rn
         FROM input
         JOIN nex.geo_landmark l ON l.city = 'Yogyakarta'
     )
     SELECT ref, name AS landmark_name, category AS landmark_category, dist_km
       FROM ranked WHERE rn = 1`,
    [refs, lats, lngs],
  );

  const [foodR, landmarkR] = await Promise.all([foodQ, landmarkQ]);
  const foodByRef = new Map(foodR.rows.map((r) => [r.ref, Number(r.food_within_200m)]));
  const landmarkByRef = new Map(
    landmarkR.rows.map((r) => [r.ref, {
      name: r.landmark_name ?? "",
      category: r.landmark_category ?? "",
      km: r.dist_km == null ? Infinity : Number(r.dist_km),
    }]),
  );

  const out = new Map<string, SmartDiscoverySignal>();
  for (const ref of refs) {
    const foodCount = foodByRef.get(ref) ?? 0;
    const lm = landmarkByRef.get(ref);

    // Score signals · pick the strongest.
    const candidates: SmartDiscoverySignal[] = [];

    // Food cluster: strong at 5+ within 200m
    if (foodCount >= 5) {
      candidates.push({
        type: "food_cluster",
        emoji: "🍜",
        title: "Food is right outside your door",
        body: `${foodCount} restaurants & cafés within 200 m`,
        cta: "Explore nearby →",
        isDemo: false,
        evidence: { nearbyCount: foodCount },
      });
    }

    // Landmark-based signals · strong at <1km · very strong <400m
    if (lm && Number.isFinite(lm.km) && lm.km < 1) {
      const meters = Math.round(lm.km * 1000);
      const nearby = lm.km < 0.4 ? "right next to" : "close to";
      if (lm.category === "attraction") {
        candidates.push({
          type: "attraction_nearby",
          emoji: "📍",
          title: `${meters < 400 ? "Right next to" : "Close to"} ${lm.name}`,
          body: `Explore attractions within walking distance · ${meters} m`,
          cta: "See what's nearby →",
          isDemo: false,
          evidence: { nearestMeters: meters, landmarkName: lm.name, landmarkCategory: lm.category },
        });
      } else if (lm.category === "shopping") {
        candidates.push({
          type: "shopping_nearby",
          emoji: "🛍",
          title: `Shopping ${nearby} you`,
          body: `${lm.name} · ${meters} m`,
          cta: "Explore local shops →",
          isDemo: false,
          evidence: { nearestMeters: meters, landmarkName: lm.name, landmarkCategory: lm.category },
        });
      } else if (lm.category === "transport") {
        candidates.push({
          type: "transport_hub_nearby",
          emoji: "🚉",
          title: "Easy to get around from here",
          body: `${lm.name} · ${meters} m`,
          cta: "See transport nearby →",
          isDemo: false,
          evidence: { nearestMeters: meters, landmarkName: lm.name, landmarkCategory: lm.category },
        });
      }
    }

    // Pick the STRONGEST candidate. Priority: attraction < 400m > food_cluster(20+) > transport < 500m > any attraction < 1km > food_cluster(5+) > shopping.
    const strongest = pickStrongest(candidates, foodCount, lm?.km ?? Infinity);
    if (strongest) out.set(ref, strongest);
  }
  return out;
}

function pickStrongest(
  candidates: SmartDiscoverySignal[],
  foodCount: number,
  landmarkKm: number,
): SmartDiscoverySignal | null {
  if (candidates.length === 0) return null;
  // Prefer a landmark < 400m attraction (that's Malioboro-scale · very compelling).
  const veryCloseAttraction = candidates.find((c) => c.type === "attraction_nearby" && (c.evidence.nearestMeters ?? Infinity) < 400);
  if (veryCloseAttraction) return veryCloseAttraction;
  // Then a food cluster with 15+ real neighbours.
  const bigFood = candidates.find((c) => c.type === "food_cluster" && (c.evidence.nearbyCount ?? 0) >= 15);
  if (bigFood) return bigFood;
  // Then close transport hub (<800m).
  const transport = candidates.find((c) => c.type === "transport_hub_nearby" && (c.evidence.nearestMeters ?? Infinity) < 800);
  if (transport) return transport;
  // Then any other attraction.
  const anyAttraction = candidates.find((c) => c.type === "attraction_nearby");
  if (anyAttraction) return anyAttraction;
  // Then shopping.
  const shopping = candidates.find((c) => c.type === "shopping_nearby");
  if (shopping) return shopping;
  // Then a smaller food cluster.
  const smallFood = candidates.find((c) => c.type === "food_cluster");
  if (smallFood) return smallFood;
  // Suppress unused-arg lint · both are decision inputs above.
  void foodCount; void landmarkKm;
  return null;
}

/**
 * A clearly-marked demonstration signal for the motorbike-rental type · NEX
 * has no motorbike-rental data yet · this exists solely so Philip can see
 * the "future signal shape" alongside real signals. Never present as live.
 */
export function motorbikeRentalDemoSignal(): SmartDiscoverySignal {
  return {
    type: "motorbike_rental_prototype",
    emoji: "🏍",
    title: "Motorbike rental nearby",
    body: "Prototype signal · NEX motorbike-rental vertical not yet live",
    cta: "Coming to NEX →",
    isDemo: true,
    evidence: {},
  };
}

export interface DemonstrationPick {
  publicListingRef: string;
  signal: SmartDiscoverySignal;
}

/**
 * Deterministically pick 3-5 accommodations to demonstrate Smart Discovery.
 * Chooses diverse signal types where possible so the grid shows variety.
 * Optionally seeds a clearly-marked motorbike-rental prototype if the caller
 * requests including a demo (never fabricates a REAL motorbike signal).
 */
export function pickDemonstrationSet(
  signalsByRef: Map<string, SmartDiscoverySignal>,
  opts: { max?: number; includeMotorbikeDemo?: boolean; motorbikeDemoRef?: string } = {},
): DemonstrationPick[] {
  const max = opts.max ?? 5;
  // Group by signal type · pick the highest-scoring per type first · then fill from remaining.
  const byType = new Map<SmartDiscoverySignalType, Array<{ ref: string; signal: SmartDiscoverySignal }>>();
  for (const [ref, signal] of signalsByRef) {
    const arr = byType.get(signal.type) ?? [];
    arr.push({ ref, signal });
    byType.set(signal.type, arr);
  }
  // Rank each type-bucket by descending score (nearby count for food, closer meters for landmark).
  for (const arr of byType.values()) {
    arr.sort((a, b) => {
      const scoreA = scoreForRank(a.signal);
      const scoreB = scoreForRank(b.signal);
      return scoreB - scoreA;
    });
  }
  const picked: DemonstrationPick[] = [];
  const typeOrder: SmartDiscoverySignalType[] = [
    "attraction_nearby", "food_cluster", "transport_hub_nearby", "shopping_nearby",
  ];
  // Round-robin one per type first · maximises variety.
  for (const type of typeOrder) {
    const arr = byType.get(type);
    if (arr && arr.length > 0 && picked.length < max) {
      const pick = arr.shift()!;
      picked.push({ publicListingRef: pick.ref, signal: pick.signal });
    }
  }
  // Second pass · fill up to max from whatever's left · still ranked.
  for (const type of typeOrder) {
    const arr = byType.get(type);
    while (arr && arr.length > 0 && picked.length < max) {
      const pick = arr.shift()!;
      picked.push({ publicListingRef: pick.ref, signal: pick.signal });
    }
  }
  // Optionally add the motorbike-rental DEMO signal · never replaces a real pick.
  if (opts.includeMotorbikeDemo && opts.motorbikeDemoRef && picked.length < max && !picked.some((p) => p.publicListingRef === opts.motorbikeDemoRef)) {
    picked.push({ publicListingRef: opts.motorbikeDemoRef, signal: motorbikeRentalDemoSignal() });
  }
  return picked.slice(0, max);
}

function scoreForRank(s: SmartDiscoverySignal): number {
  if (s.type === "food_cluster")            return (s.evidence.nearbyCount ?? 0) * 10;
  if (s.type === "attraction_nearby")       return 5000 - (s.evidence.nearestMeters ?? 5000);
  if (s.type === "transport_hub_nearby")    return 2500 - (s.evidence.nearestMeters ?? 2500);
  if (s.type === "shopping_nearby")         return 1500 - (s.evidence.nearestMeters ?? 1500);
  return 0;
}
