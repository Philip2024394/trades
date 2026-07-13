// A single stop card on the ordered route. Merchant identity + items
// pickup or delivery + distance from the previous point.

import Link from "next/link";
import {
  MapPin,
  Truck,
  ShoppingBag,
  Clock,
  ArrowRight,
  Package
} from "lucide-react";
import { findMerchant } from "@/apps/marketplace/data/merchants";
import type { RouteStop } from "../data/routes";

type Props = {
  stop: RouteStop;
  index?: number;
};

function modeVisuals(mode: RouteStop["mode"]) {
  switch (mode) {
    case "pickup":
      return { bg: "#FEF3C7", fg: "#B45309", label: "Pick up", Icon: ShoppingBag };
    case "delivery-same-day":
      return { bg: "#DCFCE7", fg: "#166534", label: "Same-day delivery", Icon: Truck };
    case "delivery-next-day":
      return { bg: "#DBEAFE", fg: "#1E40AF", label: "Next-day delivery", Icon: Truck };
    case "delivery-scheduled":
      return { bg: "#F5F0E4", fg: "#525252", label: "Scheduled delivery", Icon: Truck };
  }
}

export function RouteStopCard({ stop, index }: Props) {
  const merchant = findMerchant(stop.merchantSlug);
  const v = modeVisuals(stop.mode);

  return (
    <article
      className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm md:flex-row md:items-start"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* Left: index pill + merchant */}
      <div className="flex items-start gap-3 md:min-w-[220px] md:flex-shrink-0">
        {index !== undefined && (
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-black"
            style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
            aria-label={`Stop ${index + 1}`}
          >
            {index + 1}
          </div>
        )}
        <div className="min-w-0">
          {merchant ? (
            <Link
              href={`/tc/trade-center/merchant/${merchant.slug}`}
              className="text-[13px] font-black text-neutral-900 hover:underline"
            >
              {merchant.displayName}
            </Link>
          ) : (
            <div className="text-[13px] font-black text-neutral-900">{stop.merchantSlug}</div>
          )}
          {merchant && (
            <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-neutral-500">
              <MapPin size={9}/> {merchant.homeCity}
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
              style={{ backgroundColor: v.bg, color: v.fg }}
            >
              <v.Icon size={10} strokeWidth={2.5}/>
              {v.label}
            </span>
            {stop.sameDayCutoff && stop.mode === "pickup" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                <Clock size={9}/> Cutoff {stop.sameDayCutoff}
              </span>
            )}
            {stop.legMiles !== undefined && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                <ArrowRight size={9}/> {stop.legMiles} mi
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: items */}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
          Items
        </div>
        <ul className="mt-1 flex flex-col gap-1">
          {stop.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[11.5px] leading-snug text-neutral-800">
              <Package size={10} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 text-[13px] font-black text-neutral-900">
          £{stop.totalGbp.toLocaleString()}
        </div>
      </div>
    </article>
  );
}
