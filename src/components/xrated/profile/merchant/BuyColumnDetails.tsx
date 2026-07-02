"use client";

/**
 * @fileoverview MERCHANT-ONLY component.
 * @merchantOnly Only renders when isStorefrontOn(listing) === true.
 * Importing this from a service-trade context is a code smell — use
 * the service/ siblings instead.
 */


// BuyColumnDetails — compact 3-button toggle that lives DIRECTLY UNDER
// StarsRating in the PDP buy column. Replaces the old full-width
// ProductDetailsTabs panel by surfacing Description / Spec / Delivery
// inline, where the buyer's eyes already are.
//
// Pill bar: three small rounded-full buttons. Active pill is yellow
// (#FFB300). Inactive is white with a neutral border. Below the pills,
// a scrollable panel shows the active tab's body capped at ~360px.
//
// Spec tab only renders when the per-listing toggle is on AND there's
// at least one row in product.specs. Delivery tab only renders when the
// per-listing toggle is on. Description always shows.

import { useMemo, useState, type ReactNode } from "react";
import type {
  HammerexXratedProduct,
  RetailShippingArea,
  RetailShippingIntl
} from "@/lib/supabase";

type TabKey = "description" | "spec" | "delivery";

type Tab = { key: TabKey; label: string };

export function BuyColumnDetails({
  product,
  specTabOn,
  deliveryTabOn,
  shipsFromCity,
  dispatchDays,
  returnsText,
  rightSlot,
  shippingMode,
  shippingUkPence,
  shippingUkAreas,
  shippingIntl
}: {
  product: HammerexXratedProduct;
  specTabOn: boolean;
  deliveryTabOn: boolean;
  shipsFromCity: string;
  dispatchDays: number | null;
  returnsText: string | null;
  /** Right-aligned slot on the tab row. Previously held the Ref code;
   *  now hosts the calculator-open button (when the product has a
   *  calculator) since the Ref code moved onto the gallery image. */
  rightSlot?: ReactNode;
  /** Listing-level retail delivery config — surfaced in the Delivery
   *  tab body. NULL ⇒ "confirmed by WhatsApp" copy. */
  shippingMode?: "free" | "uk_flat" | "uk_areas" | "pickup" | "uk_over_threshold" | null;
  shippingUkPence?: number | null;
  shippingUkAreas?: RetailShippingArea[] | null;
  shippingIntl?: RetailShippingIntl[] | null;
}) {
  const showSpec = specTabOn;
  const showDelivery = deliveryTabOn;

  const tabs = useMemo<Tab[]>(() => {
    const out: Tab[] = [{ key: "description", label: "Description" }];
    if (showSpec) out.push({ key: "spec", label: "Spec" });
    if (showDelivery) out.push({ key: "delivery", label: "Delivery" });
    return out;
  }, [showSpec, showDelivery]);

  const [active, setActive] = useState<TabKey>("description");
  const safeActive: TabKey = tabs.some((t) => t.key === active)
    ? active
    : "description";

  return (
    <div className="mt-5">
      {/* Plain-text label row — no row-level underline; each label has its
          own short bar. Active = yellow; inactive = thin neutral grey.
          Ref code hugs the right edge on the same row. mt-5 (20px) keeps
          the row clear of the StarsRating "No reviews yet" line above. */}
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          {tabs.map((t) => {
            const on = t.key === safeActive;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActive(t.key)}
                aria-pressed={on}
                className={`flex flex-col items-stretch gap-1.5 pb-1 text-[13px] transition ${
                  on
                    ? "font-extrabold text-neutral-900"
                    : "font-bold text-neutral-500 hover:text-neutral-900"
                }`}
              >
                <span className="text-center">{t.label}</span>
                <span
                  aria-hidden="true"
                  className="h-0.5 w-full rounded-sm"
                  style={{ background: on ? "#FFB300" : "#E5E5E5" }}
                />
              </button>
            );
          })}
        </div>
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>

      <div
        className="mt-3 overflow-y-auto [&::-webkit-scrollbar]:hidden"
        style={{ maxHeight: "360px", scrollbarWidth: "none" }}
      >
        {safeActive === "description" && <DescriptionBody product={product} />}
        {safeActive === "spec" && showSpec && (
          <SpecsBody specs={product.specs} fallbackDescription={product.description} />
        )}
        {safeActive === "delivery" && showDelivery && (
          <DeliveryBody
            shipsFromCity={shipsFromCity}
            dispatchDays={dispatchDays}
            returnsText={returnsText}
            shippingMode={shippingMode ?? null}
            shippingUkPence={shippingUkPence ?? null}
            shippingUkAreas={shippingUkAreas ?? null}
            shippingIntl={shippingIntl ?? null}
          />
        )}
      </div>
    </div>
  );
}

function DescriptionBody({ product }: { product: HammerexXratedProduct }) {
  const text = (product.description ?? "").trim();
  const body = text.length > 0 ? text : "No description yet.";
  // Max 5 visible lines on first render. The Show more / Show less toggle
  // flips a flag; once expanded the full body shows unclamped.
  return <ExpandableText body={body} />;
}

function ExpandableText({ body }: { body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p
        className="whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-700"
        style={
          open
            ? undefined
            : {
                display: "-webkit-box",
                WebkitLineClamp: 5,
                WebkitBoxOrient: "vertical",
                overflow: "hidden"
              }
        }
      >
        {body}
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-auto mt-2 block text-[13px] font-extrabold uppercase tracking-wider"
        style={{ color: "#FFB300" }}
      >
        {open ? "Show less" : "Show more"}
      </button>
    </div>
  );
}

// Tries to harvest "Label: Value" lines from the description so the Spec
// tab isn't empty when the trade only filled in description text. Falls
// back to nothing when no key-value rows are detected.
function specsFromDescription(text: string | null | undefined): { label: string; value: string }[] {
  const raw = (text ?? "").trim();
  if (raw.length === 0) return [];
  const lines = raw.split(/\r?\n/);
  const rows: { label: string; value: string }[] = [];
  for (const line of lines) {
    const m = line.match(/^[\s•\-\*]*([^:]{1,80})\s*:\s*(.+)$/);
    if (!m) continue;
    const label = m[1].trim();
    const value = m[2].trim();
    if (label.length === 0 || value.length === 0) continue;
    rows.push({ label, value });
    if (rows.length >= 20) break;
  }
  return rows;
}

function SpecsBody({
  specs,
  fallbackDescription
}: {
  specs: { label: string; value: string }[] | null;
  fallbackDescription: string | null;
}) {
  const entered = Array.isArray(specs) ? specs : [];
  const derived = entered.length === 0 ? specsFromDescription(fallbackDescription) : [];
  const rows = entered.length > 0 ? entered : derived;
  if (rows.length === 0) {
    return (
      <p className="text-[13px] text-neutral-500">
        No specifications added yet.
      </p>
    );
  }
  return (
    <dl className="overflow-hidden rounded-xl border border-neutral-200">
      {rows.map((row, i) => (
        <div
          key={`${row.label}-${i}`}
          className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3 px-3 py-2 text-[13px] ${
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

function formatGbpPence(pence: number | null | undefined): string {
  if (typeof pence !== "number" || !Number.isFinite(pence) || pence < 0) return "£0";
  const pounds = pence / 100;
  return pounds % 1 === 0
    ? `£${pounds.toLocaleString("en-GB")}`
    : `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ukShippingLabel(
  mode:
    | "free"
    | "uk_flat"
    | "uk_areas"
    | "pickup"
    | "uk_over_threshold"
    | null
    | undefined,
  ukPence: number | null | undefined,
  ukAreas: RetailShippingArea[] | null | undefined
): string {
  if (mode === "free") return "Free UK delivery";
  if (mode === "uk_flat") {
    return `UK delivery: ${formatGbpPence(ukPence ?? 0)}`;
  }
  if (mode === "uk_areas") {
    const rows = Array.isArray(ukAreas) ? ukAreas : [];
    if (rows.length === 0) return "UK delivery: confirmed by WhatsApp";
    const min = Math.min(...rows.map((r) => r.price_pence ?? 0));
    return `UK delivery: from ${formatGbpPence(min)} (per area)`;
  }
  if (mode === "pickup") return "Local pickup only";
  if (mode === "uk_over_threshold") {
    // Free UK delivery once the buyer is over a per-listing spend
    // threshold; under it, a flat UK price applies. We surface both
    // numbers when the flat pence is set, otherwise show the rule.
    return typeof ukPence === "number" && ukPence > 0
      ? `Free UK delivery over threshold (otherwise ${formatGbpPence(ukPence)})`
      : "Free UK delivery over threshold";
  }
  return "UK delivery: confirmed by WhatsApp";
}

function DeliveryBody({
  shipsFromCity,
  dispatchDays,
  returnsText,
  shippingMode,
  shippingUkPence,
  shippingUkAreas,
  shippingIntl
}: {
  shipsFromCity: string;
  dispatchDays: number | null;
  returnsText: string | null;
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
}) {
  const dispatchText =
    typeof dispatchDays === "number" && dispatchDays >= 0
      ? dispatchDays === 0
        ? "Ships same day"
        : `Ships in ${dispatchDays} ${dispatchDays === 1 ? "day" : "days"}`
      : "Available on enquiry";

  const fromText = shipsFromCity ? `${shipsFromCity}, UK` : "UK";

  const returns =
    (returnsText ?? "").trim().length > 0
      ? (returnsText as string).trim()
      : "Unused items returnable within the manufacturer's stated window for a full refund";

  const ukLabel = ukShippingLabel(shippingMode, shippingUkPence, shippingUkAreas);
  const showAreasList =
    shippingMode === "uk_areas" &&
    Array.isArray(shippingUkAreas) &&
    shippingUkAreas.length > 0;

  const intlRows = Array.isArray(shippingIntl) ? shippingIntl : [];
  const intlLabel =
    intlRows.length > 0
      ? `Yes — ${intlRows.length} countr${intlRows.length === 1 ? "y" : "ies"}`
      : "Not currently shipping internationally";

  const rows: { label: string; value: string }[] = [
    { label: "UK delivery", value: ukLabel },
    { label: "International shipping", value: intlLabel },
    { label: "Dispatch", value: dispatchText },
    { label: "Ships from", value: fromText },
    { label: "Returns", value: returns },
    { label: "Delivery cost", value: "Confirmed by WhatsApp" },
    { label: "Tracking", value: "Shared by WhatsApp once dispatched" }
  ];

  return (
    <div className="space-y-3">
      <dl className="overflow-hidden rounded-xl border border-neutral-200">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3 px-3 py-2 text-[13px] ${
              i % 2 === 0 ? "bg-neutral-50" : "bg-white"
            }`}
          >
            <dt className="font-extrabold text-neutral-900">{row.label}</dt>
            <dd className="text-neutral-700">{row.value}</dd>
          </div>
        ))}
      </dl>
      {showAreasList && (
        <AreasExpand areas={shippingUkAreas as RetailShippingArea[]} />
      )}
    </div>
  );
}

function AreasExpand({ areas }: { areas: RetailShippingArea[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] font-extrabold text-neutral-900"
      >
        <span>UK areas ({areas.length})</span>
        <span aria-hidden="true" style={{ color: "#FFB300" }}>
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <ul className="border-t border-neutral-200">
          {areas.map((a, i) => (
            <li
              key={`${a.area}-${i}`}
              className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2 text-[13px] ${
                i % 2 === 0 ? "bg-neutral-50" : "bg-white"
              }`}
            >
              <span className="truncate text-neutral-700">{a.area}</span>
              <span className="font-extrabold text-neutral-900">
                {formatGbpPence(a.price_pence)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
