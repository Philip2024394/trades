// TradeShippingReturns — trades-themed port of Hammerex's
// ShippingReturns.
//
// Hammerex's version was hard-coded to their single-brand delivery
// policy ("Quoted by the Hammerex team within 24 hours"). The trades
// version reads each merchant's actual retail_shipping_* fields on
// their hammerex_trade_off_listings row and renders three panels:
//
//   1. UK delivery — copy varies by retail_shipping_mode
//        • free              → "Free UK delivery"
//        • uk_flat           → "£X flat rate to any UK address"
//        • uk_areas          → "From £X — rate depends on delivery
//                              postcode; see table"
//        • uk_over_threshold → "Free over £X, else £Y"
//        • pickup            → "Collection only from <city>"
//        • null              → "Delivery confirmed on WhatsApp"
//
//   2. Dispatch — reads dispatchDays (matches TradeDispatchBadge copy)
//
//   3. Returns & warranty — generic 14-day policy + warranty years if
//      the product has one; kept as static copy since trades don't
//      individually author returns policies today.

import type {
  RetailShippingArea,
  RetailShippingIntl
} from "@/lib/supabase";

function formatGbp(pence: number): string {
  const pounds = pence / 100;
  return pounds % 1 === 0 ? `£${pounds}` : `£${pounds.toFixed(2)}`;
}

function ukCopy(props: {
  mode:
    | "free"
    | "uk_flat"
    | "uk_areas"
    | "pickup"
    | "uk_over_threshold"
    | null;
  ukPence: number | null;
  areas: RetailShippingArea[] | null;
  city: string | null;
}): { title: string; body: string; table?: RetailShippingArea[] } {
  const { mode, ukPence, areas, city } = props;
  if (mode === "free") {
    return {
      title: "Free UK delivery",
      body:
        "This trade covers UK shipping — no delivery charge added at checkout. Standard courier, tracked from dispatch."
    };
  }
  if (mode === "uk_flat" && ukPence !== null) {
    return {
      title: `${formatGbp(ukPence)} UK delivery`,
      body: `One flat rate to any UK address. Standard courier, tracked from dispatch.`
    };
  }
  if (mode === "uk_areas" && areas && areas.length > 0) {
    const cheapest = Math.min(...areas.map((a) => a.price_pence));
    return {
      title: `From ${formatGbp(cheapest)} UK delivery`,
      body: `Rate depends on the delivery region. Full breakdown below — the correct rate is applied at checkout based on your postcode.`,
      table: areas
    };
  }
  if (mode === "uk_over_threshold" && ukPence !== null) {
    return {
      title: `Free UK delivery over ${formatGbp(ukPence)}`,
      body: `Orders below the threshold ship for a flat rate. Threshold applies to the order subtotal, not per line item.`
    };
  }
  if (mode === "pickup") {
    return {
      title: city ? `Collection only — ${city}` : "Collection only",
      body:
        "This trade doesn't ship — arrange collection direct on WhatsApp after ordering. They'll confirm times and location."
    };
  }
  return {
    title: "Delivery confirmed on WhatsApp",
    body:
      "This trade quotes delivery per order after checkout. They'll message you with the best rate and expected arrival window before you're charged for shipping."
  };
}

function dispatchCopy(dispatchDays: number | null | undefined): string {
  if (dispatchDays === null || dispatchDays === undefined) {
    return "Dispatch times confirmed on WhatsApp after checkout.";
  }
  const d = Math.max(0, Math.floor(dispatchDays));
  if (d === 0) return "Same-day dispatch when ordered before the daily cutoff.";
  if (d === 1) return "Dispatched the next business day after checkout.";
  return `Dispatched within ${d} business days. Tracking link sent on dispatch.`;
}

export function TradeShippingReturns({
  shippingMode,
  shippingUkPence,
  shippingUkAreas,
  shippingIntl,
  shipsFromCity,
  dispatchDays,
  warrantyYears
}: {
  shippingMode:
    | "free"
    | "uk_flat"
    | "uk_areas"
    | "pickup"
    | "uk_over_threshold"
    | null;
  shippingUkPence: number | null;
  shippingUkAreas: RetailShippingArea[] | null;
  shippingIntl: RetailShippingIntl[] | null;
  shipsFromCity: string | null;
  dispatchDays: number | null | undefined;
  warrantyYears?: number | null;
}) {
  const uk = ukCopy({
    mode: shippingMode,
    ukPence: shippingUkPence,
    areas: shippingUkAreas,
    city: shipsFromCity
  });
  const dispatchText = dispatchCopy(dispatchDays);
  const hasIntl = !!shippingIntl && shippingIntl.length > 0;

  return (
    <section
      id="delivery"
      className="border-t border-[#1B1A17]/10 bg-[#FBF6EC] py-8"
    >
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-2">
            <h2 className="text-[18px] font-black text-[#1B1A17] md:text-[22px]">
              Delivery &amp; returns
            </h2>
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-400 text-[#0A0A0A] transition group-open:rotate-180"
            >
              ▾
            </span>
          </summary>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <article className="rounded-2xl border border-[#1B1A17]/10 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700">
                UK delivery
              </p>
              <h3 className="mt-1 text-[14px] font-black text-[#1B1A17]">
                {uk.title}
              </h3>
              <p className="mt-2 text-[12.5px] leading-[1.55] text-[#1B1A17]/70">
                {uk.body}
              </p>
              {uk.table && (
                <table className="mt-3 w-full text-[11.5px]">
                  <thead>
                    <tr className="text-left text-[10px] font-black uppercase tracking-widest text-[#1B1A17]/45">
                      <th className="pb-1">Area</th>
                      <th className="pb-1 text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uk.table.map((a) => (
                      <tr
                        key={a.area}
                        className="border-t border-[#1B1A17]/8 text-[#1B1A17]/85"
                      >
                        <td className="py-1">{a.area}</td>
                        <td className="py-1 text-right font-black tabular-nums">
                          {formatGbp(a.price_pence)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>

            <article className="rounded-2xl border border-[#1B1A17]/10 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700">
                Dispatch
              </p>
              <h3 className="mt-1 text-[14px] font-black text-[#1B1A17]">
                {dispatchDays === 0
                  ? "Ships same day"
                  : dispatchDays === 1
                    ? "Ships next business day"
                    : dispatchDays
                      ? `Ships in ${dispatchDays} business days`
                      : "Confirmed on WhatsApp"}
              </h3>
              <p className="mt-2 text-[12.5px] leading-[1.55] text-[#1B1A17]/70">
                {dispatchText}
              </p>
              {shipsFromCity && (
                <p className="mt-2 text-[11.5px] font-semibold text-[#1B1A17]/45">
                  Ships from {shipsFromCity}
                </p>
              )}
            </article>

            <article className="rounded-2xl border border-[#1B1A17]/10 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700">
                Returns &amp; warranty
              </p>
              <h3 className="mt-1 text-[14px] font-black text-[#1B1A17]">
                14-day return window
              </h3>
              <p className="mt-2 text-[12.5px] leading-[1.55] text-[#1B1A17]/70">
                Not right for the job? Return unused, in original
                packaging, within 14 days of receipt for a full product
                refund. Delivery charge isn&apos;t refunded — the courier
                already provided the service.
                {warrantyYears
                  ? ` ${warrantyYears}-year manufacturer's warranty against defects.`
                  : ""}
              </p>
            </article>
          </div>

          {hasIntl && (
            <div className="mt-4 rounded-2xl border border-[#1B1A17]/10 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700">
                International delivery
              </p>
              <table className="mt-2 w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest text-[#1B1A17]/45">
                    <th className="pb-1">Country</th>
                    <th className="pb-1 text-right">Rate</th>
                    <th className="pb-1 text-right">Dispatch</th>
                    <th className="pb-1 text-right">Delivery</th>
                  </tr>
                </thead>
                <tbody>
                  {shippingIntl!.map((row) => (
                    <tr
                      key={row.country_code}
                      className="border-t border-[#1B1A17]/8 text-[#1B1A17]/85"
                    >
                      <td className="py-1">{row.country_name}</td>
                      <td className="py-1 text-right font-black tabular-nums">
                        {formatGbp(row.price_pence)}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {row.dispatch_days}d
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {row.delivery_days}d
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      </div>
    </section>
  );
}
