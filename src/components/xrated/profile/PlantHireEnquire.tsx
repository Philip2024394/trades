"use client";

// PlantHireEnquire — per-category enquire card.
//
// Single container holding everything the customer needs to compose a
// hire enquiry: start date, duration, delivery postcode (+ live cost),
// and the WhatsApp CTA. Also renders the availability-conflict warning
// and the break-even nudge inline.
//
// The delivery postcode is optional — when both depot_postcode and
// delivery_zones are configured the postcode row appears and the
// message auto-includes the cost estimate; when they're not, that row
// is hidden.

import { useMemo, useState } from "react";
import { isDateBlocked, type PlantDeliveryZone } from "@/lib/plantHire";

// Coarse UK postcode area distances (miles) — first-pass estimator.
const DIST_MAP: Record<string, Record<string, number>> = {
  HU: { HU: 3, YO: 30, LS: 55, DN: 25, LN: 45, S: 60, M: 100, L: 130, B: 140 },
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

function calcDelivery(
  fromPc: string,
  toPc: string,
  zones: PlantDeliveryZone[]
): { miles: number | null; cost: number | null; zone: PlantDeliveryZone | null; quoted: boolean } | null {
  if (toPc.length < 2) return null;
  const fromArea = extractArea(fromPc);
  const toArea = extractArea(toPc);
  if (!fromArea || !toArea) return null;
  const miles = DIST_MAP[fromArea]?.[toArea] ?? null;
  if (miles === null) return { miles: null, cost: null, zone: null, quoted: true };
  for (const z of zones) {
    if (z.free_radius_miles !== null && miles <= z.free_radius_miles) {
      return { miles, cost: z.fixed_price_pence ?? 0, zone: z, quoted: false };
    }
  }
  const perMile = zones.find((z) => z.price_per_mile_pence !== null && z.price_per_mile_pence > 0);
  if (perMile && perMile.price_per_mile_pence) {
    const cost = perMile.price_per_mile_pence * miles * 2;
    return { miles, cost, zone: perMile, quoted: false };
  }
  return { miles, cost: null, zone: null, quoted: true };
}

export function PlantHireEnquire({
  merchantName,
  categoryLabel,
  categorySlug,
  dayPricePence,
  weekPricePence,
  monthPricePence = null,
  operatorPremiumDayPence = null,
  breakEvenNudge = false,
  blockedRanges = [],
  depotPostcode = "",
  zones = [],
  buyNowSalePricePence = null,
  buyNowSaleYear = null,
  waHref
}: {
  merchantName: string;
  categoryLabel: string;
  categorySlug: string;
  dayPricePence: number | null;
  weekPricePence: number | null;
  monthPricePence?: number | null;
  operatorPremiumDayPence?: number | null;
  breakEvenNudge?: boolean;
  blockedRanges?: { from: string; to: string; note?: string }[];
  depotPostcode?: string;
  zones?: PlantDeliveryZone[];
  /** When set + > 0, shows a yellow "Buy now — £X" button beside the
   *  green Enquire button inside the booking card. Blank / 0 hides it. */
  buyNowSalePricePence?: number | null;
  buyNowSaleYear?: number | null;
  waHref: string | null;
}) {
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState("");
  const [deliveryPc, setDeliveryPc] = useState("");
  const [withOperator, setWithOperator] = useState<"self_drive" | "with_operator">(
    "self_drive"
  );

  const operatorOffered =
    operatorPremiumDayPence !== null && operatorPremiumDayPence > 0;

  const showPostcodeRow = depotPostcode.length > 0 && zones.length > 0;

  const delivery = useMemo(() => {
    if (!showPostcodeRow) return null;
    return calcDelivery(depotPostcode, deliveryPc, zones);
  }, [showPostcodeRow, depotPostcode, deliveryPc, zones]);

  const nudge = useMemo(() => {
    if (!breakEvenNudge) return null;
    if (!dayPricePence) return null;
    if (duration === "1 day") return null;
    const dayCount = duration === "Weekend" ? 2 : duration === "1 week" ? 7 : 0;
    if (dayCount === 0) return null;
    if (weekPricePence && dayCount >= 4 && dayCount < 8) {
      const dailyCost = dayPricePence * dayCount;
      if (weekPricePence < dailyCost) {
        const saving = dailyCost - weekPricePence;
        return {
          message: `At ${dayCount} days you're above the week rate — switch to weekly and save £${(saving / 100).toFixed(2)}.`,
          suggestDuration: "1 week"
        };
      }
    }
    if (monthPricePence && weekPricePence) {
      const weeks = Math.ceil(dayCount / 7);
      if (weeks >= 3 && weeks * weekPricePence > monthPricePence) {
        const saving = weeks * weekPricePence - monthPricePence;
        return {
          message: `At ${weeks} weeks the month rate is cheaper — switch and save £${(saving / 100).toFixed(2)}.`,
          suggestDuration: "1 month"
        };
      }
    }
    return null;
  }, [breakEvenNudge, dayPricePence, weekPricePence, monthPricePence, duration]);

  const conflict = useMemo(() => {
    if (!start) return null;
    if (!isDateBlocked(start, blockedRanges)) return null;
    return blockedRanges.find((r) => start >= r.from && start <= r.to) ?? null;
  }, [start, blockedRanges]);

  function buildMessage(): string {
    const deliveryLine = delivery
      ? delivery.quoted
        ? `Delivery postcode ${deliveryPc} — outside standard zones, please quote.`
        : delivery.cost === 0
          ? `Delivery to ${deliveryPc} (~${delivery.miles} miles) — free zone.`
          : delivery.cost !== null
            ? `Delivery to ${deliveryPc} (~${delivery.miles} miles) — estimated £${(delivery.cost / 100).toFixed(2)} both ways.`
            : ""
      : "Delivery or collect: [ delivery / collect ].";
    const operatorLine = operatorOffered
      ? withOperator === "with_operator"
        ? `With CPCS operator (+ £${(operatorPremiumDayPence! / 100).toFixed(2)}/day).`
        : "Self-drive (no operator)."
      : "";
    const parts = [
      `Hi ${merchantName}, I'd like to hire a ${categoryLabel}.`,
      start ? `Start: ${start}.` : "",
      duration ? `Duration: ${duration}.` : "",
      deliveryLine,
      operatorLine,
      dayPricePence
        ? `I see the day rate is from £${(dayPricePence / 100).toFixed(2)}${
            weekPricePence ? ` (week from £${(weekPricePence / 100).toFixed(2)})` : ""
          }.`
        : "",
      conflict
        ? `NB — your site shows this machine is on hire ${conflict.from} to ${conflict.to}${
            conflict.note ? ` (${conflict.note})` : ""
          }; please suggest the next free date.`
        : ""
    ]
      .filter(Boolean)
      .join(" ");
    return parts;
  }

  function onClick() {
    if (!waHref) return;
    try {
      const payload = JSON.stringify({
        kind: "page",
        event_type: "cart_view",
        product_id: `plant_hire__${categorySlug}`,
        path: window.location.pathname
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
      }
    } catch {
      /* silent */
    }
    const url = `${waHref}?text=${encodeURIComponent(buildMessage())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mt-auto rounded-lg border border-neutral-200 bg-white p-3 text-neutral-900">
      <p className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        Book this machine
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
            Start date
          </span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-neutral-200 bg-white px-2 text-[12px] text-neutral-900 outline-none focus:border-[#FFB300]"
            style={{ borderColor: conflict ? "#DC2626" : undefined }}
          />
        </label>
        <label className="block">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
            Duration
          </span>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-neutral-200 bg-white px-2 text-[12px] text-neutral-900 outline-none focus:border-[#FFB300]"
          >
            <option value="">Choose…</option>
            <option value="1 day">1 day</option>
            <option value="Weekend">Weekend</option>
            <option value="1 week">1 week</option>
            <option value="2 weeks">2 weeks</option>
            <option value="1 month">1 month</option>
            <option value="Long-term">Long-term contract</option>
          </select>
        </label>
      </div>

      {operatorOffered && (
        <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 p-2">
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
            Operator
          </p>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setWithOperator("self_drive")}
              className="flex flex-col items-start rounded-md border px-2 py-1.5 text-left transition"
              style={{
                borderColor: withOperator === "self_drive" ? "#FFB300" : "#E5E7EB",
                background: withOperator === "self_drive" ? "#FFF8E1" : "#FFFFFF"
              }}
              aria-pressed={withOperator === "self_drive"}
            >
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-900">
                Self-drive
              </span>
              <span className="text-[10px] text-neutral-500">Standard rate</span>
            </button>
            <button
              type="button"
              onClick={() => setWithOperator("with_operator")}
              className="flex flex-col items-start rounded-md border px-2 py-1.5 text-left transition"
              style={{
                borderColor: withOperator === "with_operator" ? "#FFB300" : "#E5E7EB",
                background: withOperator === "with_operator" ? "#FFF8E1" : "#FFFFFF"
              }}
              aria-pressed={withOperator === "with_operator"}
            >
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-900">
                With operator
              </span>
              <span className="text-[10px] text-neutral-500">
                + £{(operatorPremiumDayPence! / 100).toFixed(0)}/day CPCS
              </span>
            </button>
          </div>
        </div>
      )}

      {showPostcodeRow && (
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5">
          <label className="block">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
              Delivery postcode
            </span>
            <input
              type="text"
              value={deliveryPc}
              onChange={(e) => setDeliveryPc(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="HU1"
              className="mt-1 h-8 w-full rounded-md border border-neutral-200 bg-white px-2 font-mono text-[12px] text-neutral-900 outline-none focus:border-[#FFB300]"
              maxLength={8}
            />
          </label>
          <div className="text-right">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
              Est. delivery
            </span>
            <p className="mt-1 h-8 whitespace-nowrap text-[11px] font-bold leading-8">
              {delivery === null || deliveryPc.length < 2 ? (
                <span className="text-neutral-400">—</span>
              ) : delivery.quoted ? (
                <span className="text-neutral-500">Quoted per job</span>
              ) : delivery.cost === 0 ? (
                <span className="text-[#0F7A3F]">Free zone</span>
              ) : delivery.cost !== null ? (
                <span className="text-neutral-900">
                  ~{delivery.miles}mi · {fmtPounds(delivery.cost)}
                </span>
              ) : (
                <span className="text-neutral-500">Quoted</span>
              )}
            </p>
          </div>
        </div>
      )}

      {conflict && (
        <p className="mt-2 rounded-md bg-red-50 px-2 py-1.5 text-[11px] font-bold text-red-700">
          Not available on that date — booked {conflict.from} to {conflict.to}
          {conflict.note ? ` (${conflict.note})` : ""}. Try a later start or WhatsApp us for the next free slot.
        </p>
      )}
      {nudge && !conflict && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-900">
          <span className="flex-1">{nudge.message}</span>
          <button
            type="button"
            onClick={() => setDuration(nudge.suggestDuration)}
            className="inline-flex h-7 items-center rounded-md bg-white px-2 text-[10px] font-extrabold uppercase tracking-widest text-amber-900 transition hover:bg-amber-100"
          >
            Switch
          </button>
        </div>
      )}
      <div
        className={
          buyNowSalePricePence && buyNowSalePricePence > 0
            ? "mt-2 grid grid-cols-2 gap-2"
            : "mt-2"
        }
      >
      <button
        type="button"
        onClick={onClick}
        disabled={!waHref}
        className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
        style={{ background: conflict ? "#DC2626" : "#0F7A3F" }}
        aria-label={`Enquire about ${categoryLabel} on WhatsApp`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.68 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.32 1.85.55 2.81.68A2 2 0 0 1 22 16.92z" />
        </svg>
        Enquire / Rent now
      </button>

      {buyNowSalePricePence && buyNowSalePricePence > 0 && (
        <a
          href={
            waHref
              ? `${waHref}?text=${encodeURIComponent(
                  `Hi ${merchantName}, I'd like to buy the ${categoryLabel}${buyNowSaleYear ? ` (${buyNowSaleYear})` : ""}. Advertised at £${(buyNowSalePricePence / 100).toLocaleString()}. Please send purchase details.`
                )}`
              : "#"
          }
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90 active:scale-[0.98]"
          style={{ background: "#FFB300" }}
          aria-label={`Buy ${categoryLabel} for £${(buyNowSalePricePence / 100).toLocaleString()}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          Buy £{(buyNowSalePricePence / 100).toLocaleString()}
        </a>
      )}
      </div>
    </div>
  );
}
