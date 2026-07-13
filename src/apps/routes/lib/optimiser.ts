// Route optimisation helper.
//
// Ships two functions:
//   1. recommendMode(distanceMi, urgent)
//      Decides pickup vs delivery. Distance is the primary signal —
//      driving 200 miles for a £24 scrim pack is bad economics for
//      the trade. Time-sensitive materials get pickup preference when
//      within a reasonable radius.
//   2. optimiseOrder(startCity, stops)
//      Runs a naive nearest-neighbour ordering. For UK trade routes
//      (typically 3-8 stops), NN is within a few % of the optimal TSP
//      solution and completes in ms — no need for a heavier solver.

import { cityToLatLng, haversineMiles } from "@/apps/marketplace/lib/distance";
import type { RouteStopMode } from "../data/routes";

/** Miles below which we prefer pickup, and above which we recommend
 *  delivery. Split into three tiers to nudge merchants into the right
 *  delivery lane when a pickup would waste half a day on the M6. */
const PICKUP_MAX_MILES = 15;
const SAME_DAY_DELIVERY_MAX_MILES = 60;
const NEXT_DAY_DELIVERY_MAX_MILES = 250;

export function recommendMode(distanceMi: number, urgent: boolean): RouteStopMode {
  if (urgent && distanceMi <= PICKUP_MAX_MILES * 2) return "pickup";
  if (distanceMi <= PICKUP_MAX_MILES) return "pickup";
  if (distanceMi <= SAME_DAY_DELIVERY_MAX_MILES) return "delivery-same-day";
  if (distanceMi <= NEXT_DAY_DELIVERY_MAX_MILES) return "delivery-next-day";
  return "delivery-scheduled";
}

/**
 * Nearest-neighbour ordering from a start city. Returns the ordered
 * list of city keys + the total miles for the sequence.
 */
export function optimiseOrder(
  startCity: string,
  stopCities: string[]
): { order: string[]; totalMiles: number } {
  const start = cityToLatLng(startCity);
  const remaining = new Set(stopCities);
  const order: string[] = [];
  let totalMiles = 0;
  let current = start;
  let currentCity = startCity;

  while (remaining.size > 0 && current) {
    let bestCity: string | null = null;
    let bestMiles = Infinity;
    remaining.forEach((c) => {
      const p = cityToLatLng(c);
      if (!p) return;
      const d = haversineMiles(current!, p);
      if (d < bestMiles) {
        bestMiles = d;
        bestCity = c;
      }
    });
    if (bestCity === null) break;
    order.push(bestCity);
    totalMiles += bestMiles;
    remaining.delete(bestCity);
    current = cityToLatLng(bestCity)!;
    currentCity = bestCity;
  }

  return { order, totalMiles };
}

/**
 * Miles saved: compare the optimised NN ordering to a naive
 * "hit stops in the order I typed them" baseline. Round trip back to
 * start included in both.
 */
export function milesSaved(
  startCity: string,
  stopCities: string[]
): number {
  if (stopCities.length === 0) return 0;
  const start = cityToLatLng(startCity);
  if (!start) return 0;

  // Naive order
  let naive = 0;
  let cursor = start;
  for (const c of stopCities) {
    const p = cityToLatLng(c);
    if (!p) continue;
    naive += haversineMiles(cursor, p);
    cursor = p;
  }
  // Round trip
  naive += haversineMiles(cursor, start);

  // Optimised
  const opt = optimiseOrder(startCity, stopCities);
  const lastCity = opt.order[opt.order.length - 1];
  const lastP = lastCity ? cityToLatLng(lastCity) : undefined;
  const optRoundTrip = opt.totalMiles + (lastP ? haversineMiles(lastP, start) : 0);

  return Math.max(0, naive - optRoundTrip);
}
