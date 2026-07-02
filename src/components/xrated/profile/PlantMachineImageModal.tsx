"use client";

// PlantMachineImageModal — click the machine image on a tile to open a
// lightbox with a yellow-rimmed frame, close button, big image, machine
// name, spec table, from-price line, and a green WhatsApp Enquire CTA.
//
// The trigger button IS the machine's tile image, so drop-in replaces
// the existing <img> element inside the tile. Modal renders via fixed
// positioning so it escapes the tile's overflow constraints.

import { useEffect, useState } from "react";
import { mergeSpecs, type PlantCategorySlug, type PlantSpec } from "@/lib/plantHire";

export function PlantMachineImageModal({
  imageUrl,
  label,
  categorySlug,
  specs,
  dayPricePence,
  weekPricePence,
  merchantName,
  waHref,
  forSale = false,
  salePricePence = null,
  saleCondition = "",
  saleYear = null,
  saleHoursUsed = null,
  saleNote = "",
  saleStockCount = null,
  triggerClassName
}: {
  imageUrl: string;
  label: string;
  categorySlug: PlantCategorySlug;
  specs?: PlantSpec;
  dayPricePence: number | null;
  weekPricePence: number | null;
  merchantName: string;
  waHref: string | null;
  forSale?: boolean;
  salePricePence?: number | null;
  saleCondition?: "new" | "used" | "refurbished" | "ex_demo" | "";
  saleYear?: number | null;
  saleHoursUsed?: number | null;
  saleNote?: string;
  saleStockCount?: number | null;
  triggerClassName: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const specRows = buildSpecRows(mergeSpecs(categorySlug, specs));
  const enquireText = encodeURIComponent(
    `Hi ${merchantName}, I'd like to enquire about hiring a ${label}. Please send availability, delivery cost and next free date.`
  );
  const enquireHref = waHref ? `${waHref}?text=${enquireText}` : "#";

  const canBuy = forSale && salePricePence !== null && salePricePence > 0;
  const buyText = encodeURIComponent(
    `Hi ${merchantName}, I'd like to buy the ${label}${saleYear ? ` (${saleYear})` : ""}${saleCondition ? ` — ${prettyCondition(saleCondition)}` : ""}${saleHoursUsed !== null && saleHoursUsed !== undefined ? `, ${saleHoursUsed.toLocaleString()} hrs` : ""}. Advertised at £${((salePricePence ?? 0) / 100).toLocaleString()}. Please send purchase details.`
  );
  const buyHref = waHref ? `${waHref}?text=${buyText}` : "#";

  function onEnquireClick() {
    if (!waHref) return;
    try {
      const payload = JSON.stringify({
        kind: "page",
        event_type: "cart_view",
        product_id: `plant_hire__${categorySlug}__modal`,
        path: window.location.pathname
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
      }
    } catch {
      /* silent */
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${triggerClassName} group relative cursor-zoom-in rounded-md transition hover:opacity-90`}
        aria-label={`View ${label} details`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={label} className="h-full w-auto object-contain" />
        {/* Eye badge — signals the image is clickable. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full shadow-lg transition group-hover:scale-110"
          style={{ background: "#0A0A0A" }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFB300"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label} details`}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white p-4 shadow-2xl sm:p-5"
            style={{ boxShadow: "0 0 0 4px #FFB300, 0 20px 60px rgba(0,0,0,0.45)" }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full text-[24px] font-extrabold transition hover:opacity-90"
              style={{ background: "#0A0A0A", color: "#FFB300" }}
              aria-label="Close"
            >
              ×
            </button>

            <div className="grid min-h-0 flex-1 place-items-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={label}
                className="max-h-[45vh] w-auto max-w-full object-contain"
              />
            </div>

            <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
              Plant Hire
            </p>
            <h3 className="mt-0.5 text-xl font-extrabold leading-tight text-neutral-900 sm:text-2xl">
              {label}
            </h3>

            {dayPricePence !== null && dayPricePence > 0 && (
              <p className="mt-1 text-[13px] text-neutral-700">
                <span className="font-extrabold text-neutral-900">
                  From £{(dayPricePence / 100).toFixed(2)}
                </span>{" "}
                / day
                {weekPricePence !== null && weekPricePence > 0 && (
                  <>
                    {" · "}
                    £{(weekPricePence / 100).toFixed(2)} / week
                  </>
                )}
              </p>
            )}

            {specRows.length > 0 && (
              <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-2">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                  Specs
                </p>
                <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] sm:grid-cols-3">
                  {specRows.map((r) => (
                    <li key={r.label} className="flex justify-between gap-2">
                      <span className="text-neutral-500">{r.label}</span>
                      <span className="font-bold text-neutral-900">{r.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {canBuy && (
              <div
                className="mt-3 rounded-md p-3 text-white"
                style={{ background: "#052E1A" }}
              >
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#22C55E]">
                  Also for sale
                </p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-[22px] font-extrabold">
                    £{(salePricePence! / 100).toLocaleString()}
                  </p>
                  {saleCondition && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest">
                      {prettyCondition(saleCondition)}
                    </span>
                  )}
                  {saleYear && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest">
                      {saleYear}
                    </span>
                  )}
                  {saleHoursUsed !== null && saleHoursUsed !== undefined && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest">
                      {saleHoursUsed.toLocaleString()} hrs
                    </span>
                  )}
                  {saleStockCount !== null && saleStockCount !== undefined && saleStockCount > 1 && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest">
                      {saleStockCount} in stock
                    </span>
                  )}
                </div>
                {saleNote && (
                  <p className="mt-2 text-[12px] leading-relaxed text-neutral-300">{saleNote}</p>
                )}
              </div>
            )}

            <a
              href={enquireHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onEnquireClick}
              aria-disabled={!waHref}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-extrabold uppercase tracking-widest text-white transition hover:opacity-90 active:scale-[0.98]"
              style={{ background: "#0F7A3F" }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
              </svg>
              Enquire on WhatsApp
            </a>

            {canBuy && (
              <a
                href={buyHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!waHref}
                className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90 active:scale-[0.98]"
                style={{ background: "#FFB300" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
                Buy Now — £{(salePricePence! / 100).toLocaleString()}
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function prettyCondition(v: string): string {
  return v === "new"
    ? "New"
    : v === "used"
      ? "Used"
      : v === "refurbished"
        ? "Refurbished"
        : v === "ex_demo"
          ? "Ex-demo"
          : "";
}

function buildSpecRows(specs: PlantSpec): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (specs.weight_kg) rows.push({ label: "Weight", value: `${specs.weight_kg.toLocaleString()} kg` });
  if (specs.hp) rows.push({ label: "Power", value: `${specs.hp} hp` });
  if (specs.dig_depth_mm)
    rows.push({ label: "Dig depth", value: `${(specs.dig_depth_mm / 1000).toFixed(2)} m` });
  if (specs.reach_mm) rows.push({ label: "Reach", value: `${(specs.reach_mm / 1000).toFixed(2)} m` });
  if (specs.bucket_l) rows.push({ label: "Bucket", value: `${specs.bucket_l} L` });
  if (specs.transport_length_mm)
    rows.push({
      label: "Transport L",
      value: `${(specs.transport_length_mm / 1000).toFixed(2)} m`
    });
  if (specs.transport_width_mm)
    rows.push({
      label: "Transport W",
      value: `${(specs.transport_width_mm / 1000).toFixed(2)} m`
    });
  if (specs.transport_height_mm)
    rows.push({
      label: "Transport H",
      value: `${(specs.transport_height_mm / 1000).toFixed(2)} m`
    });
  if (specs.fuel_type)
    rows.push({
      label: "Fuel",
      value:
        specs.fuel_type === "diesel"
          ? "Diesel"
          : specs.fuel_type === "petrol"
            ? "Petrol"
            : specs.fuel_type === "electric"
              ? "Electric"
              : "Hybrid"
    });
  if (specs.emission)
    rows.push({
      label: "Emission",
      value:
        specs.emission === "stage_v" ? "Stage V" : specs.emission === "stage_iiib" ? "Stage IIIB" : "Euro 6"
    });
  return rows;
}
