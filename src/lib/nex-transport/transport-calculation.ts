// src/lib/nex-transport/transport-calculation.ts
//
// TRANSPORT CALCULATION · pure function abstraction.
//
// Given regulated tariff evidence + a routed distance + effective date, returns
// a fare RANGE with full provenance. This is a REGULATED REFERENCE calculation ·
// it is NEVER a live app quote.
//
// Doctrine anchors:
//   - Transport Intelligence design (2026-08-23 CONSTITUTIONAL)
//   - NEVER hard-code a single "Indonesia taxi price"
//   - SOURCE → CLAIM → INTERPRETATION → UNKNOWN → DECISION applies
//   - DIY taxi / ASK figures stay UNKNOWN until decree text obtained
//   - Yogyakarta ojol Zone I is PROVISIONAL until primary decree text confirms minimum-fare basis
//
// Bright-line rules enforced by this function:
//   1. Refuses to compute without regulatory evidence · returns UNKNOWN result
//   2. Refuses to compute without a routed distance · never accepts straight-line
//   3. Never returns a single number · always a range with min/max
//   4. Always returns the unknown-note explaining what the number does NOT mean
//   5. Never marks a provisional tariff as VERIFIED

import type { RouteResponse } from "../nex-distance/distance-intelligence";

export type TransportModeRegulated = "motorbike-ride-hail" | "car-ride-hail" | "taxi" | "ask";

export interface TariffEvidence {
  jurisdiction: string;                   // e.g. 'ID/DIY' · 'ID/DIY/Yogyakarta' · 'ID/Central-Java'
  transportCategory: TransportModeRegulated;
  regulatoryInstrument: string;           // e.g. 'KP 564/2022' · 'Kepgub DIY 419/KEP/2023'
  effectiveFrom: Date;
  effectiveTo: Date | null;
  perKmLower: number | null;              // IDR per km · lower bound
  perKmUpper: number | null;              // IDR per km · upper bound
  minimumFareLower: number | null;        // IDR · minimum-first-ride lower
  minimumFareUpper: number | null;        // IDR · minimum-first-ride upper
  minimumFareBasis: string | null;        // e.g. 'first 4km' · null when decree text not obtained
  airportSupplement: number | null;
  currency: "IDR";
  sourceTier: "VERIFIED" | "PROVISIONAL" | "UNKNOWN";
  sourceUrl: string | null;
  rawSnippet: string | null;
  interpretationNote: string;
  unknownNote: string;
}

export interface TransportCalculationInput {
  route: RouteResponse;
  tariff: TariffEvidence | null;
  applyAirportSupplement?: boolean;
}

export interface TransportCalculationOK {
  status: "OK";
  jurisdiction: string;
  transportCategory: TransportModeRegulated;
  regulatoryInstrument: string;
  fareRangeIdr: { min: number; max: number };
  routedDistanceMeters: number;
  routedDurationSeconds: number;
  routeProvider: string;
  computedAt: Date;
  interpretation: string;
  unknown: string;
  provenance: {
    tariffSourceTier: "VERIFIED" | "PROVISIONAL";
    tariffEffectiveFrom: Date;
    tariffEffectiveTo: Date | null;
    tariffSourceUrl: string | null;
    calculationTerms: string;
  };
}

export interface TransportCalculationUnknown {
  status: "UNKNOWN";
  reason:
    | "NO_TARIFF_EVIDENCE"
    | "TARIFF_TIER_UNKNOWN"
    | "TARIFF_EFFECTIVE_DATE_INVALID"
    | "ROUTE_UNAVAILABLE"
    | "STRAIGHT_LINE_REJECTED";
  detail: string;
  interpretation: string;
  unknown: string;
}

export type TransportCalculationResult =
  | TransportCalculationOK
  | TransportCalculationUnknown;

export function calculateTransportFareRange(
  input: TransportCalculationInput,
): TransportCalculationResult {
  const { route, tariff, applyAirportSupplement = false } = input;

  if (!tariff) {
    return {
      status: "UNKNOWN",
      reason: "NO_TARIFF_EVIDENCE",
      detail:
        "No regulatory tariff evidence supplied. NEX refuses to compute a fare without an authoritative source.",
      interpretation: "",
      unknown:
        "NEX has no regulated tariff evidence for this jurisdiction and transport category. Any number would be invention.",
    };
  }

  if (tariff.sourceTier === "UNKNOWN") {
    return {
      status: "UNKNOWN",
      reason: "TARIFF_TIER_UNKNOWN",
      detail: `Tariff evidence for ${tariff.jurisdiction}/${tariff.transportCategory} is marked UNKNOWN (${tariff.regulatoryInstrument}). NEX refuses to compute.`,
      interpretation: "",
      unknown: tariff.unknownNote,
    };
  }

  const now = new Date();
  const effectiveFromValid = tariff.effectiveFrom instanceof Date && !isNaN(tariff.effectiveFrom.getTime());
  const notYetEffective = effectiveFromValid && tariff.effectiveFrom.getTime() > now.getTime();
  const alreadyExpired = tariff.effectiveTo && tariff.effectiveTo.getTime() < now.getTime();
  if (!effectiveFromValid || notYetEffective || alreadyExpired) {
    return {
      status: "UNKNOWN",
      reason: "TARIFF_EFFECTIVE_DATE_INVALID",
      detail: `Tariff ${tariff.regulatoryInstrument} is not effective at the current time.`,
      interpretation: "",
      unknown:
        "The regulatory tariff NEX has for this jurisdiction is either not yet effective or has been superseded. NEX refuses to compute a fare against a stale reference.",
    };
  }

  if (route.status !== "OK") {
    return {
      status: "UNKNOWN",
      reason: "ROUTE_UNAVAILABLE",
      detail:
        "No routed distance is available for this journey. NEX refuses to substitute straight-line distance for a routed answer in a customer transport calculation.",
      interpretation: "",
      unknown:
        "Without a routed distance NEX cannot honestly calculate a transport fare. Straight-line is not walking · not driving · not a taxi route.",
    };
  }

  if (tariff.perKmLower == null || tariff.perKmUpper == null) {
    return {
      status: "UNKNOWN",
      reason: "NO_TARIFF_EVIDENCE",
      detail: `Tariff ${tariff.regulatoryInstrument} lacks per-km lower/upper values.`,
      interpretation: "",
      unknown: tariff.unknownNote,
    };
  }

  const distanceKm = route.routedDistanceMeters / 1000;
  const perKmMin = tariff.perKmLower * distanceKm;
  const perKmMax = tariff.perKmUpper * distanceKm;

  const minBaseline = tariff.minimumFareLower ?? 0;
  const maxBaseline = tariff.minimumFareUpper ?? 0;

  // Fare is at least the minimum-fare band OR the per-km calc · whichever is
  // higher. We keep the wider range so the customer sees the uncertainty · never
  // a single "the price will be" number.
  const fareMin = Math.max(minBaseline, Math.round(perKmMin));
  const fareMax = Math.max(maxBaseline, Math.round(perKmMax));

  const supplement =
    applyAirportSupplement && tariff.airportSupplement ? tariff.airportSupplement : 0;

  const finalMin = fareMin + supplement;
  const finalMax = fareMax + supplement;

  const provisionalPreface =
    tariff.sourceTier === "PROVISIONAL"
      ? "PROVISIONAL: the primary decree text has not yet been confirmed for this figure. "
      : "";
  const interpretation =
    `${provisionalPreface}${tariff.interpretationNote} · Routed distance ${distanceKm.toFixed(2)} km via ${route.provider} · Reference fare range Rp ${finalMin.toLocaleString("id-ID")}–Rp ${finalMax.toLocaleString("id-ID")}.`;
  const unknown = `${tariff.unknownNote} Actual app quote may differ due to operator fare rules, promotions, tolls, surge, waiting, or traffic. NEX does not have live operator pricing.`;

  return {
    status: "OK",
    jurisdiction: tariff.jurisdiction,
    transportCategory: tariff.transportCategory,
    regulatoryInstrument: tariff.regulatoryInstrument,
    fareRangeIdr: { min: finalMin, max: finalMax },
    routedDistanceMeters: route.routedDistanceMeters,
    routedDurationSeconds: route.routedDurationSeconds,
    routeProvider: route.provider,
    computedAt: new Date(),
    interpretation,
    unknown,
    provenance: {
      tariffSourceTier: tariff.sourceTier,
      tariffEffectiveFrom: tariff.effectiveFrom,
      tariffEffectiveTo: tariff.effectiveTo,
      tariffSourceUrl: tariff.sourceUrl,
      calculationTerms: `min(basis)=${minBaseline} max(basis)=${maxBaseline} perKm=[${tariff.perKmLower},${tariff.perKmUpper}] distance_km=${distanceKm.toFixed(3)} supplement=${supplement}`,
    },
  };
}

// ── Registered tariff references (evidence only · not customer-facing until greenlit) ──
//
// Yogyakarta motorcycle ride-hailing · Zone I · PROVISIONAL until primary decree text obtained.
// Figures per Ministry of Transport press coverage · minimum-fare basis (first-km bracket)
// is the outstanding unknown that prevents customer-facing use.
export const YOGYA_OJOL_ZONE_I_PROVISIONAL: TariffEvidence = {
  jurisdiction: "ID/DIY/Yogyakarta",
  transportCategory: "motorbike-ride-hail",
  regulatoryInstrument: "KP 564/2022 · Ministry of Transport · Zone I",
  effectiveFrom: new Date("2022-08-11T00:00:00Z"),
  effectiveTo: null,
  perKmLower: 1850,
  perKmUpper: 2300,
  minimumFareLower: 9250,
  minimumFareUpper: 11500,
  minimumFareBasis: null,
  airportSupplement: null,
  currency: "IDR",
  sourceTier: "PROVISIONAL",
  sourceUrl: null,
  rawSnippet: "Ministry of Transport press coverage · Zone I motorcycle ride-hail tariff",
  interpretationNote:
    "Ministry of Transport Zone I motorcycle ride-hailing reference tariff for Yogyakarta area",
  unknownNote:
    "Minimum-fare basis (which km-bracket the minimum applies to) has NOT been confirmed from primary decree text. This calculation is a reference range · not a live app quote.",
};

// Yogyakarta DIY taxi / ASK · UNKNOWN until decree text confirmed. Registered so
// callers see the honest UNKNOWN result instead of getting nothing.
export const YOGYA_TAXI_UNKNOWN: TariffEvidence = {
  jurisdiction: "ID/DIY/Yogyakarta",
  transportCategory: "taxi",
  regulatoryInstrument: "Kepgub DIY 420/KEP/2023 (figures unresolved)",
  effectiveFrom: new Date("2023-01-01T00:00:00Z"),
  effectiveTo: null,
  perKmLower: null,
  perKmUpper: null,
  minimumFareLower: null,
  minimumFareUpper: null,
  minimumFareBasis: null,
  airportSupplement: null,
  currency: "IDR",
  sourceTier: "UNKNOWN",
  sourceUrl: null,
  rawSnippet: null,
  interpretationNote: "",
  unknownNote:
    "NEX has not obtained the primary decree text for DIY taxi tariff figures. NEX cannot honestly quote a taxi fare range for Yogyakarta until this is resolved.",
};

export const YOGYA_ASK_UNKNOWN: TariffEvidence = {
  jurisdiction: "ID/DIY/Yogyakarta",
  transportCategory: "ask",
  regulatoryInstrument: "Kepgub DIY 419/KEP/2023 (figures unresolved)",
  effectiveFrom: new Date("2023-01-01T00:00:00Z"),
  effectiveTo: null,
  perKmLower: null,
  perKmUpper: null,
  minimumFareLower: null,
  minimumFareUpper: null,
  minimumFareBasis: null,
  airportSupplement: null,
  currency: "IDR",
  sourceTier: "UNKNOWN",
  sourceUrl: null,
  rawSnippet: null,
  interpretationNote: "",
  unknownNote:
    "NEX has not obtained the primary decree text for DIY Angkutan Sewa Khusus (ASK) tariff figures. NEX cannot honestly quote an ASK fare range for Yogyakarta until this is resolved.",
};
