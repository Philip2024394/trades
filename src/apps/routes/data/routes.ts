// Route Optimiser (R02) — data model + fixtures.
//
// The trade-side answer to "how do I get every material for this job
// with the least driving, without waiting?" Trade Center reads the
// job's materials list (from Job Cost Mode / Notebook), matches each
// item to a nearby verified merchant, then recommends PICKUP vs
// DELIVERY per line based on distance + time-sensitivity + merchant
// same-day cutoffs.
//
// Constitution alignment: Trade Center never advises a specific
// merchant to increase margin — the ordering is distance-driven with
// verified-quality tie-breaking. Merchants that don't stock the item
// simply aren't options.

export type RouteStopMode = "pickup" | "delivery-same-day" | "delivery-next-day" | "delivery-scheduled";

export type RouteStop = {
  id: string;
  merchantSlug: string;
  items: string[];                 // free-text descriptions of what's being picked up / delivered
  totalGbp: number;
  mode: RouteStopMode;
  /** Miles from the PREVIOUS stop (or from the trade's start location
   *  for stop #1). Populated by the optimiser. */
  legMiles?: number;
  legMinutes?: number;
  /** Cutoff for the merchant's same-day dispatch. */
  sameDayCutoff?: string;
};

export type JobRoute = {
  id: string;
  jobSlug: string;
  jobTitle: string;
  destinationCity: string;         // "Withington, M20" — using merchant city for distance calc
  startCity: string;                // trade's start-of-day location
  stops: RouteStop[];
  /** Total pickup distance in miles (excludes delivery-only legs). */
  totalPickupMiles: number;
  /** Miles saved vs the naive "hit every merchant in the order I
   *  added them" baseline. */
  milesSavedVsNaive: number;
  /** Estimated total time on the road including brief stop times. */
  estimatedTotalMinutes: number;
  /** Deliveries scheduled for this route (no driving) — surfaced so
   *  the trade sees them alongside the pickups. */
  deliveryStops: RouteStop[];
};

// ─── Fixtures ────────────────────────────────────────────────────────
// Bob Watson has the Watson Job in Withington (M20). He needs plaster
// from Manchester Tools (0mi), scrim tape from Leeds Builders (~40mi),
// and scaffold from Glasgow Scaffolding (~215mi). The optimiser should
// recommend Manchester Tools = pickup, Leeds = delivery next-day,
// Glasgow = delivery scheduled — no way it's efficient to drive to
// Glasgow for a scaffold.

export const ROUTE_FIXTURES: JobRoute[] = [
  {
    id: "r-watson-2026-11",
    jobSlug: "watson-full-reskim",
    jobTitle: "Watson full re-skim + hallway ceiling",
    destinationCity: "Manchester",   // Withington sits in Manchester
    startCity: "Manchester",
    stops: [
      {
        id: "s1",
        merchantSlug: "manchester-tools-direct",
        items: [
          "40 × British Gypsum Multi-Finish 25kg",
          "12 × Bonding coat 25kg",
          "Scrim tape + PVA + beads"
        ],
        totalGbp: 706,
        mode: "pickup",
        sameDayCutoff: "2pm"
      }
    ],
    totalPickupMiles: 0,       // Manchester Tools is in Manchester, same as start
    milesSavedVsNaive: 258,    // vs driving to Leeds + Glasgow too
    estimatedTotalMinutes: 45, // one stop, loading + short drive
    deliveryStops: [
      {
        id: "s2",
        merchantSlug: "leeds-builders-supplies",
        items: ["1 pack × premium scrim (backup)"],
        totalGbp: 24,
        mode: "delivery-next-day",
        legMiles: 40
      },
      {
        id: "s3",
        merchantSlug: "glasgow-scaffolding-co",
        items: ["Scaffold day rate — 4 storey", "Toe boards × 8"],
        totalGbp: 480,
        mode: "delivery-scheduled",
        legMiles: 215
      }
    ]
  }
];

export function findRoute(jobSlug: string): JobRoute | undefined {
  return ROUTE_FIXTURES.find((r) => r.jobSlug === jobSlug);
}
