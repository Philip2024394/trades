"use client";

/**
 * @fileoverview MERCHANT-ONLY component.
 * @merchantOnly Only renders when isStorefrontOn(listing) === true.
 * Importing this from a service-trade context is a code smell — use
 * the service/ siblings instead.
 */


// ProductDetailsTabs — full-width tabbed details panel for the Xrated PDP.
//
// Tabs (only rendered when the relevant per-listing toggle is on):
//   – Description       (always shown — falls back to "No description yet.")
//   – Spec              (shown when listing.addons_enabled.spec_tab !== false)
//   – Delivery Details  (shown when listing.addons_enabled.delivery_tab !== false)
//
// Features tab + Video tab + Ref tab were dropped in this pass — the
// Description body absorbed Features when relevant, the Video URL is
// surfaced in the gallery as a separate concern, and Ref now lives in
// the buy column.
//
// The PDP passes plain booleans (specTabOn / deliveryTabOn) — we don't
// import the addon helpers in this client component to keep the bundle
// tight and to keep the listing shape opaque.
//
// Pill bar scrolls horizontally on mobile using the same hidden-scrollbar
// pattern the ProductModal uses. Active pill: #FFB300 background. Inactive
// pill: border + neutral text. All copy held at 13px (the Hammerex floor).

import { useMemo, useState } from "react";
import type { HammerexXratedProduct } from "@/lib/supabase";

type TabKey = "description" | "spec" | "delivery";

type Tab = { key: TabKey; label: string };

export function ProductDetailsTabs({
  product,
  specTabOn = true,
  deliveryTabOn = true,
  shipsFromCity
}: {
  product: HammerexXratedProduct;
  specTabOn?: boolean;
  deliveryTabOn?: boolean;
  shipsFromCity?: string | null;
}) {
  const hasSpecs = Array.isArray(product.specs) && product.specs.length > 0;
  const showSpec = specTabOn && hasSpecs;
  const showDelivery = deliveryTabOn;

  const tabs = useMemo<Tab[]>(() => {
    const out: Tab[] = [{ key: "description", label: "Description" }];
    if (showSpec) out.push({ key: "spec", label: "Spec" });
    if (showDelivery) out.push({ key: "delivery", label: "Delivery Details" });
    return out;
  }, [showSpec, showDelivery]);

  const [active, setActive] = useState<TabKey>("description");
  // If we land on a tab that no longer exists (parent re-render or toggle
  // flipped off), fall back to Description so the panel never goes blank.
  const safeActive: TabKey = tabs.some((t) => t.key === active)
    ? active
    : "description";

  return (
    <div>
      {/* Tab pill bar. Horizontal scroll on mobile with the scrollbar
          hidden — matches the ProductModal pattern. */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const on = t.key === safeActive;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[13px] font-extrabold uppercase tracking-wider transition ${
                on
                  ? "text-neutral-900"
                  : "border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
              }`}
              style={on ? { background: "#FFB300" } : undefined}
              aria-pressed={on}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
        {safeActive === "description" && <DescriptionBody product={product} />}
        {safeActive === "spec" && showSpec && (
          <SpecsBody specs={product.specs as { label: string; value: string }[]} />
        )}
        {safeActive === "delivery" && showDelivery && (
          <DeliveryBody product={product} shipsFromCity={shipsFromCity ?? null} />
        )}
      </div>
    </div>
  );
}

function DescriptionBody({ product }: { product: HammerexXratedProduct }) {
  const text = (product.description ?? "").trim();
  if (text.length === 0) {
    return (
      <p className="text-[13px] text-neutral-500">No description yet.</p>
    );
  }
  return (
    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-700">
      {text}
    </p>
  );
}

function SpecsBody({
  specs
}: {
  specs: { label: string; value: string }[];
}) {
  return (
    <dl className="overflow-hidden rounded-xl border border-neutral-200">
      {specs.map((row, i) => (
        <div
          key={`${row.label}-${i}`}
          className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3 px-4 py-3 text-[13px] ${
            i % 2 === 0 ? "bg-neutral-50" : "bg-white"
          }`}
        >
          <dt className="font-extrabold text-neutral-900">{row.label}</dt>
          <dd className="text-neutral-700">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Delivery Details — small grid of facts pulled from the product and
// listing. Honest about WhatsApp coordination (delivery cost + tracking
// are confirmed manually); covers the buyer's top five questions
// without padding the panel.
function DeliveryBody({
  product,
  shipsFromCity
}: {
  product: HammerexXratedProduct;
  shipsFromCity: string | null;
}) {
  const dispatchDays = product.dispatch_days;
  const dispatchText =
    typeof dispatchDays === "number" && dispatchDays >= 0
      ? dispatchDays === 0
        ? "Ships same day"
        : `Ships in ${dispatchDays} ${dispatchDays === 1 ? "day" : "days"}`
      : "Available on enquiry";

  const fromText = shipsFromCity ? `${shipsFromCity}, UK` : "UK";

  const returnsText =
    (product.returns_text ?? "").trim().length > 0
      ? (product.returns_text as string).trim()
      : "14 days — buyer arranges return delivery";

  const rows: { label: string; value: string }[] = [
    { label: "Dispatch", value: dispatchText },
    { label: "Ships from", value: fromText },
    { label: "Returns", value: returnsText },
    { label: "Delivery cost", value: "Confirmed by WhatsApp before payment" },
    { label: "Tracking", value: "Tracking shared by WhatsApp once dispatched" }
  ];

  return (
    <dl className="overflow-hidden rounded-xl border border-neutral-200">
      {rows.map((row, i) => (
        <div
          key={row.label}
          className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3 px-4 py-3 text-[13px] ${
            i % 2 === 0 ? "bg-neutral-50" : "bg-white"
          }`}
        >
          <dt className="font-extrabold text-neutral-900">{row.label}</dt>
          <dd className="text-neutral-700">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
