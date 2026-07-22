"use client";

// Van composer — live preview of a signwritten van. Renders the van
// image + logo overlay + business name + phone strip using CSS
// absolute positioning driven by percentage zones from the template.
//
// Zones are draggable + resizable in an "adjust mode" so we can dial
// in the sweet spot per van angle. When the layout looks right, the
// numbers get baked back into vans.ts.

import { useState } from "react";
import type { VanTemplate } from "@/lib/logo/vans";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";

type Props = {
  van:          VanTemplate;
  logoUrl:      string | null;
  businessName: string;
  phone:        string;
  strapLine?:   string;
  colour?:      string;      // colour of the text overlays
  showZones?:   boolean;     // debug — draws zone rectangles
};

export function VanComposer({
  van, logoUrl, businessName, phone, strapLine, colour = BRAND_BLACK, showZones = false
}: Props) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-neutral-50">
      {/* Van image — natural aspect ratio via CSS */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={van.imageUrl}
        alt={`${van.model} — ${van.angle}`}
        className="block h-auto w-full"
        style={{ maxHeight: "70vh", objectFit: "contain" }}
      />

      {/* Overlay layer sits inside the same box, positioned via % */}
      <div className="pointer-events-none absolute inset-0">
        {/* Logo */}
        {logoUrl && (
          <div
            className="absolute"
            style={{
              left:   `${van.zones.logo.xPct}%`,
              top:    `${van.zones.logo.yPct}%`,
              width:  `${van.zones.logo.wPct}%`,
              height: `${van.zones.logo.hPct ?? 20}%`
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="logo" className="h-full w-full object-contain drop-shadow-md"/>
          </div>
        )}

        {/* Business name — big + bold */}
        {businessName && (
          <div
            className="absolute font-black leading-none tracking-tight"
            style={{
              left:  `${van.zones.businessName.xPct}%`,
              top:   `${van.zones.businessName.yPct}%`,
              width: `${van.zones.businessName.wPct}%`,
              color: colour,
              fontSize: "clamp(14px, 2.6vw, 44px)",
              textShadow: "0 1px 2px rgba(255,255,255,0.6)"
            }}
          >
            {businessName.toUpperCase()}
            {strapLine && (
              <div className="mt-1 text-[0.35em] font-bold tracking-widest opacity-70">
                {strapLine.toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* Phone strip — bold horizontal band */}
        {phone && (
          <div
            className="absolute flex items-center justify-center rounded-md font-black"
            style={{
              left:   `${van.zones.phone.xPct}%`,
              top:    `${van.zones.phone.yPct}%`,
              width:  `${van.zones.phone.wPct}%`,
              backgroundColor: BRAND_BLACK,
              color:  BRAND_YELLOW,
              fontSize: "clamp(11px, 1.8vw, 26px)",
              padding: "0.3em 0.6em",
              letterSpacing: "0.06em"
            }}
          >
            {phone}
          </div>
        )}

        {/* Debug — draw zone rectangles */}
        {showZones && (
          <>
            <ZoneOutline zone={van.zones.logo}         label="Logo"    colour="#22C55E"/>
            <ZoneOutline zone={van.zones.businessName} label="Name"    colour="#3B82F6"/>
            <ZoneOutline zone={van.zones.phone}        label="Phone"   colour="#F59E0B"/>
          </>
        )}
      </div>
    </div>
  );
}

function ZoneOutline({ zone, label, colour }: { zone: VanTemplate["zones"]["logo"]; label: string; colour: string }) {
  return (
    <div
      className="absolute border-2 border-dashed"
      style={{
        left:   `${zone.xPct}%`,
        top:    `${zone.yPct}%`,
        width:  `${zone.wPct}%`,
        height: `${zone.hPct ?? 15}%`,
        borderColor: colour
      }}
    >
      <span
        className="absolute -top-4 left-0 rounded px-1 text-[9px] font-black text-white"
        style={{ backgroundColor: colour }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Adjust mode ────────────────────────────────────────────────
//
// A separate helper used only in dev — lets you drag sliders to
// dial each zone in and copy-paste the numbers back into vans.ts.

type Zone = VanTemplate["zones"]["logo"];

export function ZoneEditor({
  label, zone, onChange
}: {
  label:  string;
  zone:   Zone;
  onChange: (next: Zone) => void;
}) {
  const [z, setZ] = useState<Zone>(zone);
  function push(patch: Partial<Zone>) {
    const next = { ...z, ...patch };
    setZ(next);
    onChange(next);
  }
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Slider label="X %" value={z.xPct} onChange={(v) => push({ xPct: v })} max={100}/>
        <Slider label="Y %" value={z.yPct} onChange={(v) => push({ yPct: v })} max={100}/>
        <Slider label="W %" value={z.wPct} onChange={(v) => push({ wPct: v })} max={80}/>
        <Slider label="H %" value={z.hPct ?? 15} onChange={(v) => push({ hPct: v })} max={60}/>
      </div>
    </div>
  );
}

function Slider({ label, value, onChange, max }: { label: string; value: number; onChange: (v: number) => void; max: number }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="flex items-baseline justify-between font-black text-neutral-600">
        <span>{label}</span>
        <span className="text-neutral-900">{Math.round(value)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}
