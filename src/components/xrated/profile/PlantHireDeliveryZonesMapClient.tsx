"use client";

// PlantHireDeliveryZonesMapClient — client wrapper around YardMapPreview.
// Accepts a customer postcode input, looks up lat/lng via the shared
// postcode API, and re-renders the map with the customer pin + the
// resolved zone highlighted.

import { useCallback, useMemo, useState } from "react";
import { YardMapPreview } from "./YardMapPreview";
import type { PlantDeliveryZone } from "@/lib/plantHire";

const MILES_PER_KM = 0.621371;

function milesToKm(mi: number): number {
  return mi / MILES_PER_KM;
}

function fmtPounds(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) return "";
  const pounds = pence / 100;
  return pounds % 1 === 0 ? `£${pounds}` : `£${pounds.toFixed(2)}`;
}

type CustomerLoc = { lat: number; lng: number; postcode: string } | null;

export function PlantHireDeliveryZonesMapClient({
  yardLat,
  yardLng,
  yardLabel,
  zones
}: {
  yardLat: number;
  yardLng: number;
  yardLabel: string;
  zones: PlantDeliveryZone[];
}) {
  const [postcode, setPostcode] = useState("");
  const [customer, setCustomer] = useState<CustomerLoc>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bands the map understands: km + a price for the label. Use miles →
  // km, then compact into free radius + bands.
  const { freeRadiusKm, bands } = useMemo(() => {
    // First zone with a free radius becomes the green "free" zone.
    const freeZone = zones.find(
      (z) => z.free_radius_miles !== null && z.free_radius_miles !== undefined && z.free_radius_miles > 0
    );
    const freeKm = freeZone ? milesToKm(freeZone.free_radius_miles as number) : null;

    // Everything else becomes a band ring. Use the free_radius as the
    // ring for the free zone entry itself, and use per-mile / fixed
    // pricing to synthesise a max_km for the yellow + red rings.
    const bandList: { max_km: number; price_pence: number; label: string }[] = [];
    let runningKm = freeKm ?? 5;
    for (const z of zones) {
      if (z.free_radius_miles !== null && z.free_radius_miles !== undefined && z.free_radius_miles > 0) {
        continue; // already the green zone
      }
      // Estimate a band max_km: fixed_price zone uses runningKm+15,
      // per-mile zone uses runningKm+30, national uses runningKm+80.
      const step = z.price_per_mile_pence && z.price_per_mile_pence > 0 ? 25 : 60;
      runningKm += step;
      bandList.push({
        max_km: Math.round(runningKm),
        price_pence:
          z.fixed_price_pence !== null && z.fixed_price_pence !== undefined
            ? z.fixed_price_pence
            : (z.price_per_mile_pence ?? 0) * (runningKm - (freeKm ?? 0)) * 0.621371 * 2,
        label: z.label
      });
    }
    return { freeRadiusKm: freeKm, bands: bandList };
  }, [zones]);

  const submit = useCallback(async () => {
    const pc = postcode.trim().toUpperCase();
    if (pc.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`
      );
      if (res.ok) {
        const j = (await res.json()) as {
          result?: { latitude?: number; longitude?: number };
        };
        if (
          j.result &&
          typeof j.result.latitude === "number" &&
          typeof j.result.longitude === "number"
        ) {
          setCustomer({
            lat: j.result.latitude,
            lng: j.result.longitude,
            postcode: pc
          });
          return;
        }
      }
      setError("Postcode not found. Try a different one.");
      setCustomer(null);
    } catch {
      setError("Postcode lookup failed. Try again.");
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, [postcode]);

  // Which band would apply given the customer distance (used to pass
  // appliedBandKm to the map so the matching ring highlights).
  const appliedBandKm = useMemo(() => {
    if (!customer) return null;
    // Haversine
    const R = 6371;
    const dLat = ((customer.lat - yardLat) * Math.PI) / 180;
    const dLng = ((customer.lng - yardLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((yardLat * Math.PI) / 180) *
        Math.cos((customer.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const d = 2 * R * Math.asin(Math.sqrt(a)) * 1.4;
    if (freeRadiusKm !== null && d <= freeRadiusKm) return freeRadiusKm;
    for (const b of bands) {
      if (d <= b.max_km) return b.max_km;
    }
    return null;
  }, [customer, yardLat, yardLng, freeRadiusKm, bands]);

  const distanceKm = useMemo(() => {
    if (!customer) return null;
    const R = 6371;
    const dLat = ((customer.lat - yardLat) * Math.PI) / 180;
    const dLng = ((customer.lng - yardLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((yardLat * Math.PI) / 180) *
        Math.cos((customer.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a)) * 1.4;
  }, [customer, yardLat, yardLng]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr]">
      <div
        className="overflow-hidden rounded-2xl border border-neutral-200 p-2"
        style={{ background: "#F8FAFC" }}
      >
        <YardMapPreview
          yardLat={yardLat}
          yardLng={yardLng}
          customerLat={customer?.lat ?? null}
          customerLng={customer?.lng ?? null}
          freeRadiusKm={freeRadiusKm}
          bands={bands.map((b) => ({ max_km: b.max_km, price_pence: b.price_pence }))}
          appliedBandKm={appliedBandKm}
          yardLabel={yardLabel}
          customerLabel={customer?.postcode ?? "You"}
          height={360}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div
          className="rounded-2xl border border-neutral-200 bg-white p-5"
        >
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            Check your postcode
          </p>
          <p className="mt-1 text-[13px] text-neutral-600">
            Enter your site postcode — the map pins your location and highlights the matching zone.
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="e.g. LS1 4AP"
              maxLength={8}
              className="h-11 min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-3 font-mono text-[13px] text-neutral-900 outline-none focus:border-[#FFB300]"
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-[12px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90 disabled:opacity-60"
              style={{ background: "#FFB300" }}
            >
              {loading ? "…" : "Check"}
            </button>
          </form>
          {error && (
            <p className="mt-2 rounded-md bg-red-50 px-2 py-1.5 text-[11px] font-bold text-red-700">
              {error}
            </p>
          )}
          {customer && distanceKm !== null && (
            <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                {customer.postcode}
              </p>
              <p className="mt-1 text-[13px] font-extrabold text-neutral-900">
                {distanceKm.toFixed(1)} km ({(distanceKm * 0.621371).toFixed(1)} miles) from the yard
              </p>
            </div>
          )}
        </div>

        {/* Zone legend */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            Zone key
          </p>
          <ul className="mt-3 space-y-2">
            <li className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full"
                style={{ background: "#10B981" }}
              />
              <div className="text-[12px] text-neutral-700">
                <span className="font-extrabold text-neutral-900">Green — free zone.</span>{" "}
                Delivery + collection at no extra cost.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2"
                style={{ borderColor: "#FFB300" }}
              />
              <div className="text-[12px] text-neutral-700">
                <span className="font-extrabold text-neutral-900">Yellow — regional zone.</span>{" "}
                Delivered at the per-mile rate below.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-dashed"
                style={{ borderColor: "#EF4444" }}
              />
              <div className="text-[12px] text-neutral-700">
                <span className="font-extrabold text-neutral-900">Red — national edge.</span>{" "}
                Quoted per job — WhatsApp us the site postcode.
              </div>
            </li>
          </ul>
        </div>

        {/* Zone rate cards */}
        <ul className="grid grid-cols-1 gap-2">
          {zones.map((z, i) => (
            <li
              key={i}
              className="rounded-2xl border border-neutral-200 bg-white p-4"
              style={{
                borderColor:
                  appliedBandKm !== null &&
                  ((z.free_radius_miles !== null &&
                    z.free_radius_miles !== undefined &&
                    Math.abs(milesToKm(z.free_radius_miles) - appliedBandKm) < 0.5) ||
                    bands.some(
                      (b) => b.label === z.label && Math.abs(b.max_km - appliedBandKm) < 0.5
                    ))
                    ? "#FFB300"
                    : undefined
              }}
            >
              <p className="text-[13px] font-extrabold text-neutral-900">{z.label}</p>
              <ul className="mt-1 space-y-0.5 text-[12px] text-neutral-700">
                {z.free_radius_miles !== null &&
                  z.free_radius_miles !== undefined &&
                  z.free_radius_miles > 0 && (
                    <li>
                      <span className="font-bold text-[#10B981]">Free within {z.free_radius_miles} miles.</span>
                    </li>
                  )}
                {z.price_per_mile_pence !== null &&
                  z.price_per_mile_pence !== undefined &&
                  z.price_per_mile_pence > 0 && (
                    <li>
                      <span className="font-bold">Per mile:</span> {fmtPounds(z.price_per_mile_pence)}
                    </li>
                  )}
                {z.fixed_price_pence !== null &&
                  z.fixed_price_pence !== undefined &&
                  z.fixed_price_pence > 0 && (
                    <li>
                      <span className="font-bold">Fixed:</span> {fmtPounds(z.fixed_price_pence)}
                    </li>
                  )}
                {z.note && <li className="text-neutral-500">{z.note}</li>}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
