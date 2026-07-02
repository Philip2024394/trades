"use client";

// MachineOverviewTabs — 3-tab summary panel above the price card on the
// machine detail page. Tabs: Description · Specs · Delivery. Each tab
// is a compact synopsis; full-length sections live further down the
// page (What's included / Technical specifications / Delivery zones).

import { useState } from "react";
import type { PlantDeliveryZone, PlantSpec } from "@/lib/plantHire";

type Tab = "description" | "specs" | "delivery";

export function MachineOverviewTabs({
  shortDesc,
  longDesc,
  specs,
  saleYear,
  saleHoursUsed,
  depotPostcode,
  yardAddress,
  zones,
  fuelPolicy
}: {
  shortDesc: string;
  longDesc?: string;
  specs: PlantSpec;
  saleYear?: number | null;
  saleHoursUsed?: number | null;
  depotPostcode?: string;
  yardAddress?: string;
  zones: PlantDeliveryZone[];
  fuelPolicy?: string;
}) {
  const [tab, setTab] = useState<Tab>("description");

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      {/* Tab row */}
      <div
        role="tablist"
        aria-label="Machine overview"
        className="flex border-b border-neutral-200"
      >
        <TabButton
          active={tab === "description"}
          onClick={() => setTab("description")}
        >
          Description
        </TabButton>
        <TabButton active={tab === "specs"} onClick={() => setTab("specs")}>
          Specs
        </TabButton>
        <TabButton
          active={tab === "delivery"}
          onClick={() => setTab("delivery")}
        >
          Delivery
        </TabButton>
      </div>

      {/* Tab body */}
      <div className="p-4">
        {tab === "description" && <DescriptionTab short={shortDesc} long={longDesc} />}
        {tab === "specs" && (
          <SpecsTab specs={specs} saleYear={saleYear} saleHoursUsed={saleHoursUsed} />
        )}
        {tab === "delivery" && (
          <DeliveryTab
            depotPostcode={depotPostcode}
            yardAddress={yardAddress}
            zones={zones}
            fuelPolicy={fuelPolicy}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="relative flex-1 py-3 text-[11px] font-extrabold uppercase tracking-widest transition"
      style={{
        color: active ? "#0A0A0A" : "#737373",
        background: active ? "#FFF8E1" : "transparent"
      }}
    >
      {children}
      {active && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
          style={{ background: "#FFB300" }}
        />
      )}
    </button>
  );
}

function DescriptionTab({ short, long }: { short: string; long?: string }) {
  return (
    <div className="space-y-2 text-[13px] leading-relaxed text-neutral-700">
      <p className="font-bold text-neutral-900">{short}</p>
      {long && (
        <p className="line-clamp-4 whitespace-pre-line">{long}</p>
      )}
      {!long && (
        <p className="text-neutral-500">
          Full &ldquo;What&rsquo;s included&rdquo; details appear further down the page.
        </p>
      )}
    </div>
  );
}

function SpecsTab({
  specs,
  saleYear,
  saleHoursUsed
}: {
  specs: PlantSpec;
  saleYear?: number | null;
  saleHoursUsed?: number | null;
}) {
  const rows: { label: string; value: string }[] = [];
  if (specs.weight_kg) rows.push({ label: "Weight", value: `${specs.weight_kg.toLocaleString()} kg` });
  if (specs.hp) rows.push({ label: "Power", value: `${specs.hp} hp` });
  if (specs.dig_depth_mm)
    rows.push({ label: "Dig depth", value: `${(specs.dig_depth_mm / 1000).toFixed(2)} m` });
  if (specs.reach_mm)
    rows.push({ label: "Reach", value: `${(specs.reach_mm / 1000).toFixed(2)} m` });
  if (specs.bucket_l) rows.push({ label: "Bucket", value: `${specs.bucket_l} L` });
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
        specs.emission === "stage_v"
          ? "Stage V"
          : specs.emission === "stage_iiib"
            ? "Stage IIIB"
            : "Euro 6"
    });
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
  if (saleYear) rows.push({ label: "Year", value: String(saleYear) });
  if (saleHoursUsed !== null && saleHoursUsed !== undefined)
    rows.push({ label: "Hours", value: saleHoursUsed.toLocaleString() });

  if (rows.length === 0) {
    return (
      <p className="text-[13px] text-neutral-500">
        Specs not yet configured — WhatsApp us for exact details.
      </p>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
        {rows.slice(0, 8).map((r) => (
          <li key={r.label} className="flex justify-between border-b border-neutral-100 py-1">
            <span className="text-neutral-500">{r.label}</span>
            <span className="font-extrabold text-neutral-900">{r.value}</span>
          </li>
        ))}
      </ul>
      {rows.length > 8 && (
        <p className="mt-3 text-[11px] font-bold text-neutral-500">
          Full technical spec table below.
        </p>
      )}
    </>
  );
}

function DeliveryTab({
  depotPostcode,
  yardAddress,
  zones,
  fuelPolicy
}: {
  depotPostcode?: string;
  yardAddress?: string;
  zones: PlantDeliveryZone[];
  fuelPolicy?: string;
}) {
  const freeZone = zones.find(
    (z) => z.free_radius_miles !== null && z.free_radius_miles !== undefined && z.free_radius_miles > 0
  );
  const perMileZone = zones.find(
    (z) =>
      z.price_per_mile_pence !== null &&
      z.price_per_mile_pence !== undefined &&
      z.price_per_mile_pence > 0
  );

  const fuelLabel =
    fuelPolicy === "refuel_on_return"
      ? "Refuel on return"
      : fuelPolicy === "pay_refuel_charge"
        ? "Pay refuel charge (£/L)"
        : fuelPolicy === "diesel_included"
          ? "Diesel included"
          : fuelPolicy === "electric_only"
            ? "Electric — charge included"
            : "";

  return (
    <ul className="space-y-2 text-[13px]">
      {depotPostcode && (
        <li className="flex items-start gap-2 rounded-md border border-neutral-100 p-2">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md"
            style={{ background: "#FFF8E1" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a6 6 0 0 0-6 6c0 5 6 12 6 12s6-7 6-12a6 6 0 0 0-6-6z" />
              <circle cx="12" cy="10" r="2" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              Depot
            </p>
            <p className="mt-0.5 font-mono text-[12px] font-bold text-neutral-900">
              {depotPostcode}
            </p>
            {yardAddress && (
              <p className="mt-0.5 truncate text-[11px] text-neutral-500">{yardAddress.split("\n")[0]}</p>
            )}
          </div>
        </li>
      )}
      {freeZone && (
        <li className="flex items-start gap-2 rounded-md border border-neutral-100 p-2">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md"
            style={{ background: "#DCFCE7" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              Free delivery zone
            </p>
            <p className="mt-0.5 font-extrabold text-neutral-900">
              Within {freeZone.free_radius_miles} miles
            </p>
          </div>
        </li>
      )}
      {perMileZone && perMileZone.price_per_mile_pence && (
        <li className="flex items-start gap-2 rounded-md border border-neutral-100 p-2">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md"
            style={{ background: "#FFF8E1" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h18" />
              <path d="m6 7-5 5 5 5" />
              <path d="m18 7 5 5-5 5" />
            </svg>
          </span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              Regional delivery
            </p>
            <p className="mt-0.5 font-extrabold text-neutral-900">
              £{(perMileZone.price_per_mile_pence / 100).toFixed(2)}/mile beyond free zone
            </p>
          </div>
        </li>
      )}
      {fuelLabel && (
        <li className="flex items-start gap-2 rounded-md border border-neutral-100 p-2">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md"
            style={{ background: "#FFF8E1" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 21h11V4H4z" />
              <path d="M15 8h3l2 2v9a2 2 0 0 1-2 2h-1" />
            </svg>
          </span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              Fuel policy
            </p>
            <p className="mt-0.5 font-extrabold text-neutral-900">{fuelLabel}</p>
          </div>
        </li>
      )}
      <li>
        <p className="mt-1 text-[11px] text-neutral-500">
          Full delivery zone map and postcode calculator on the dedicated Delivery Zones page.
        </p>
      </li>
    </ul>
  );
}
