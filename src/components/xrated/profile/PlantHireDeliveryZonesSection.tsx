// PlantHireDeliveryZonesSection — read-only delivery zones preview for
// the plant hire home showcase. Shows the header, an "Open zone map"
// button linking to the dedicated /plant-hire/delivery-zones page, and
// a grid of zone rate cards. The full live-postcode calculator lives on
// the delivery-zones page.

import Link from "next/link";
import type { PlantDeliveryZone } from "@/lib/plantHire";

function fmtPounds(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) return "";
  const pounds = pence / 100;
  return pounds % 1 === 0 ? `£${pounds}` : `£${pounds.toFixed(2)}`;
}

export function PlantHireDeliveryZonesSection({
  zones,
  merchantSlug
}: {
  zones: PlantDeliveryZone[];
  depotPostcode?: string;
  yardAddress?: string;
  merchantSlug: string;
}) {
  return (
    <div id="delivery-zones" className="mt-10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            Delivery zones + rates
          </p>
          <h3 className="mt-1 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
            Where we deliver, and what it costs.
          </h3>
        </div>
        <Link
          href={`/${encodeURIComponent(merchantSlug)}/plant-hire/delivery-zones`}
          className="hidden shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-[11px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90 sm:inline-flex"
          style={{ background: "#FFB300" }}
        >
          Open zone map →
        </Link>
      </div>

      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {zones.map((z, i) => (
          <li
            key={i}
            className="rounded-2xl border border-neutral-200 bg-white p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-extrabold text-neutral-900">{z.label}</p>
              {z.free_radius_miles !== null &&
                z.free_radius_miles !== undefined &&
                z.free_radius_miles > 0 && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
                    style={{ background: "#0F7A3F" }}
                  >
                    Free within {z.free_radius_miles} mi
                  </span>
                )}
            </div>
            <ul className="mt-2 space-y-1 text-[12px] text-neutral-700">
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
  );
}
