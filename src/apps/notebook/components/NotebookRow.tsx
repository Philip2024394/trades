// One row per Trade Notebook item. Renders the trade's item description
// on the LEFT and the nearest-merchant match on the RIGHT. On mobile
// the row stacks; on desktop it's a two-column layout.
//
// Constitution reminder rendered in the badge: "Nearest, not cheapest."

import Link from "next/link";
import {
  CheckCircle2,
  AlertCircle,
  Package,
  MapPin,
  Truck,
  ShoppingBasket,
  Circle
} from "lucide-react";
import { formatMiles } from "@/apps/marketplace/lib/distance";
import type { NotebookItem, NotebookItemStatus } from "../data/notebook";
import type { NearestMatch } from "../lib/findNearestMerchant";

type Props = {
  item: NotebookItem;
  match: NearestMatch | null;
};

function statusVisuals(status: NotebookItemStatus) {
  switch (status) {
    case "on-hand":     return { bg: "#DCFCE7", fg: "#166534", label: "On hand"     };
    case "running-low": return { bg: "#FEF3C7", fg: "#B45309", label: "Running low" };
    case "out":         return { bg: "#FEE2E2", fg: "#B91C1C", label: "Out"         };
  }
}

export function NotebookRow({ item, match }: Props) {
  const status = statusVisuals(item.status);

  return (
    <li
      className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm md:flex-row md:items-stretch md:gap-4"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* LEFT — the trade's notebook item */}
      <div className="flex flex-1 gap-3">
        <div
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: "#F5F0E4" }}
          aria-hidden
        >
          <Package size={22} className="text-neutral-500" strokeWidth={1.8}/>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[13px] font-black leading-tight text-neutral-900">
              {item.productName}
            </div>
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
              style={{ backgroundColor: status.bg, color: status.fg }}
            >
              {status.label}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] leading-snug text-neutral-500">
            {item.spec}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-neutral-600">
            <span className="inline-flex items-center gap-1">
              <ShoppingBasket size={10}/>
              Usual: {item.usualQty} {item.unit}
            </span>
            {item.lastOrderedIso && (
              <span>
                Last ordered {new Date(item.lastOrderedIso).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
              </span>
            )}
          </div>
          {item.notes && (
            <div className="mt-1 rounded-md bg-neutral-50 px-2 py-1 text-[10.5px] italic text-neutral-600">
              "{item.notes}"
            </div>
          )}
        </div>
      </div>

      {/* Vertical rule on desktop */}
      <div
        className="hidden w-px flex-shrink-0 md:block"
        style={{ backgroundColor: "rgba(139,69,19,0.10)" }}
        aria-hidden
      />

      {/* RIGHT — nearest merchant match */}
      {match ? (
        <div className="flex flex-1 flex-col gap-2 md:w-[320px] md:flex-shrink-0">
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-black"
              style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
            >
              {match.merchant.logoInitials}
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={`/tc/trade-center/merchant/${match.merchant.slug}`}
                className="block truncate text-[12px] font-black text-neutral-900 hover:underline"
              >
                {match.merchant.displayName}
              </Link>
              <div className="flex items-center gap-1 text-[10.5px] text-neutral-500">
                <MapPin size={9}/>
                {match.merchant.homeCity}
              </div>
            </div>
            <span
              className="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
              style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
              title="Nearest, not cheapest — Trade Center never pushes price competition between merchants."
            >
              <CheckCircle2 size={9} strokeWidth={2.5}/>
              Nearest · {formatMiles(match.distanceMi)}
            </span>
          </div>

          <div className="text-[11px] font-bold text-neutral-800">
            {match.product.name}
          </div>
          <div className="text-[10.5px] leading-snug text-neutral-500">
            {match.product.spec}
          </div>

          <div className="flex flex-wrap items-center gap-1 text-[10px] font-bold">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
              style={{ backgroundColor: "#F5F0E4" }}
            >
              <Truck size={10}/>
              {match.product.deliveryPromise}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
              style={{ backgroundColor: match.product.stockState === "in" ? "#DCFCE7" : "#FEF3C7", color: match.product.stockState === "in" ? "#166534" : "#B45309" }}
            >
              <Circle size={8} fill="currentColor"/>
              {match.product.stockState === "in" ? "In stock" : match.product.stockState === "low" ? "Low stock" : match.product.stockState}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <span className="text-[15px] font-black text-neutral-900">
              £{match.product.priceGbp}
            </span>
            <span className="text-[10.5px] text-neutral-500">retail</span>
            <Link
              href={`/tc/trade-center/merchant/${match.merchant.slug}`}
              className="ml-auto inline-flex min-h-[40px] items-center gap-1 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: "#166534" }}
            >
              Order Now
            </Link>
          </div>
        </div>
      ) : (
        // No merchant near enough carries a matching product.
        <div className="flex flex-1 flex-col justify-center gap-2 rounded-lg border border-dashed p-3 md:w-[320px] md:flex-shrink-0" style={{ borderColor: "rgba(139,69,19,0.25)", backgroundColor: "#FFFBEB" }}>
          <div className="flex items-center gap-2 text-[11.5px] font-black text-neutral-800">
            <AlertCircle size={13} className="text-amber-600"/>
            No nearby merchant carries this yet
          </div>
          <p className="text-[10.5px] leading-snug text-neutral-600">
            We couldn't match a verified merchant within your area. Try widening the search radius or invite a merchant you already use to join Trade Center.
          </p>
          <button
            type="button"
            className="mt-1 inline-flex self-start rounded-full border bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-700 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            Invite a merchant
          </button>
        </div>
      )}
    </li>
  );
}
