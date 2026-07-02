"use client";

// PostcodeDeliveryCalculator — customer enters a delivery postcode,
// component looks up the depot postcode + zones and returns an estimated
// delivery cost. Simple UK-only heuristic: postcode area distances via a
// small lookup table, otherwise falls back to "we'll quote".
//
// This is a first-pass estimator, not a real distance API — good enough
// to give the customer a live number and drive an enquiry.

import { useMemo, useState } from "react";
import type { PlantDeliveryZone } from "@/lib/plantHire";

// Coarse UK postcode area distances (miles) — rows are FROM the depot's
// postcode area TO the delivery postcode area. Only a handful of common
// FROM areas seeded; add more per merchant later.
const DIST_MAP: Record<string, Record<string, number>> = {
  HU: { HU: 3, YO: 30, LS: 55, DN: 25, LN: 45, S: 60, M: 100, L: 130, B: 140, LN1: 50 },
  YO: { YO: 5, HU: 30, LS: 25, DN: 40, S: 45 },
  LS: { LS: 3, HU: 55, YO: 25, S: 30, M: 40, DN: 30 }
};

function extractArea(pc: string): string {
  const clean = pc.replace(/\s+/g, "").toUpperCase();
  const m = clean.match(/^([A-Z]{1,2})/);
  return m ? m[1] : "";
}

function fmtPounds(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) return "";
  const pounds = pence / 100;
  return pounds % 1 === 0 ? `£${pounds}` : `£${pounds.toFixed(2)}`;
}

export function PostcodeDeliveryCalculator({
  depotPostcode,
  zones
}: {
  depotPostcode: string;
  zones: PlantDeliveryZone[];
}) {
  const [pc, setPc] = useState("");

  const result = useMemo(() => {
    const trimmed = pc.trim().toUpperCase();
    if (trimmed.length < 2) return null;
    const fromArea = extractArea(depotPostcode);
    const toArea = extractArea(trimmed);
    if (!fromArea || !toArea) return null;
    const miles = DIST_MAP[fromArea]?.[toArea] ?? null;
    if (miles === null) {
      return { miles: null, cost: null, zone: null as PlantDeliveryZone | null, quoted: true };
    }
    // Match against the first zone whose free_radius covers it, or use
    // per-mile pricing.
    for (const z of zones) {
      if (z.free_radius_miles !== null && miles <= z.free_radius_miles) {
        return { miles, cost: z.fixed_price_pence ?? 0, zone: z, quoted: false };
      }
    }
    // Fall back to first per-mile zone.
    const perMile = zones.find((z) => z.price_per_mile_pence !== null && z.price_per_mile_pence > 0);
    if (perMile && perMile.price_per_mile_pence) {
      const cost = perMile.price_per_mile_pence * miles * 2; // each way
      return { miles, cost, zone: perMile, quoted: false };
    }
    return { miles, cost: null, zone: null, quoted: true };
  }, [pc, depotPostcode, zones]);

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2">
      <label className="block">
        <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
          Delivery postcode → estimated cost
        </span>
        <input
          type="text"
          value={pc}
          onChange={(e) => setPc(e.target.value.toUpperCase().slice(0, 8))}
          placeholder="HU1"
          className="mt-1 h-9 w-full rounded-md border border-neutral-200 bg-white px-2 font-mono text-[12px] text-neutral-900 outline-none focus:border-[#FFB300]"
          maxLength={8}
        />
      </label>
      {result && (
        <p className="mt-2 text-[11px] font-bold text-neutral-800">
          {result.quoted ? (
            <>Outside standard zones — WhatsApp for a quote.</>
          ) : result.cost === null ? (
            <>~{result.miles} miles — quoted per job.</>
          ) : result.cost === 0 ? (
            <>~{result.miles} miles — <span className="text-[#0F7A3F]">free delivery</span> in this zone.</>
          ) : (
            <>
              ~{result.miles} miles ({result.zone?.label}) — approx{" "}
              <span className="font-extrabold text-neutral-900">{fmtPounds(result.cost)}</span> both ways.
            </>
          )}
        </p>
      )}
    </div>
  );
}
