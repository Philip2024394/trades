"use client";

// /logo/van — first-cut van signwriting demo.
//
// Pick a van image, pick a logo, type your business name + phone,
// see the composite. Zone-adjust panel exposes the placement sliders
// so we can dial in each van until the numbers feel right, then bake
// them into src/lib/logo/vans.ts.

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, SlidersHorizontal, Download } from "lucide-react";
import { VAN_TEMPLATES, vanBySlug, type VanTemplate } from "@/lib/logo/vans";
import { LOGO_STYLES } from "@/lib/logo/catalog";
import { VanComposer, ZoneEditor } from "@/components/logo/VanComposer";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";

// Pull every real sample across every style so the logo picker has
// something visual to choose from right now.
const AVAILABLE_LOGOS = LOGO_STYLES.flatMap((s) =>
  s.samples.map((sample) => ({ styleName: s.name, imageUrl: sample.imageUrl, tradeSlug: sample.tradeSlug }))
);

export default function VanPage() {
  const [vanSlug, setVanSlug]           = useState(VAN_TEMPLATES[0].slug);
  const [logoUrl, setLogoUrl]           = useState<string | null>(AVAILABLE_LOGOS[0]?.imageUrl ?? null);
  const [businessName, setBusinessName] = useState("Bob's Kitchens");
  const [phone, setPhone]               = useState("0800 555 1234");
  const [strapLine, setStrapLine]       = useState("Kitchens · Bathrooms · Fitting");
  const [adjust, setAdjust]             = useState(false);
  const [showZones, setShowZones]       = useState(false);
  const [textColour, setTextColour]     = useState<string>(BRAND_BLACK);

  // Local override of zones for the currently-picked van so ZoneEditor
  // sliders can move things without touching the persisted catalog.
  const baseVan = vanBySlug(vanSlug) ?? VAN_TEMPLATES[0];
  const [zoneOverride, setZoneOverride] = useState<VanTemplate["zones"] | null>(null);
  const van: VanTemplate = { ...baseVan, zones: zoneOverride ?? baseVan.zones };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/logo/build" className="mb-6 inline-flex items-center gap-1.5 text-[12px] font-black text-neutral-600 hover:text-neutral-900">
        <ArrowLeft size={13}/> Back to Logo Studio
      </Link>

      <div className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Preview · Van Signwriting</p>
          <h1 className="mt-1 text-3xl font-black">Try it on a Transit</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowZones((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-black hover:bg-neutral-100"
            aria-pressed={showZones}
          >
            {showZones ? <EyeOff size={12}/> : <Eye size={12}/>} Zones
          </button>
          <button
            onClick={() => setAdjust((a) => !a)}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-black hover:bg-neutral-100"
            aria-pressed={adjust}
          >
            <SlidersHorizontal size={12}/> {adjust ? "Hide" : "Adjust"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <VanComposer
            van={van}
            logoUrl={logoUrl}
            businessName={businessName}
            phone={phone}
            strapLine={strapLine}
            colour={textColour}
            showZones={showZones}
          />

          {/* Van thumbnails */}
          <div className="mt-3 flex gap-2">
            {VAN_TEMPLATES.map((v) => (
              <button
                key={v.slug}
                onClick={() => { setVanSlug(v.slug); setZoneOverride(null); }}
                className={
                  "flex-1 overflow-hidden rounded-xl border-2 bg-white p-1 transition " +
                  (v.slug === vanSlug ? "border-neutral-900" : "border-transparent hover:border-neutral-300")
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.imageUrl} alt={v.model} className="h-16 w-full object-contain"/>
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <Field label="Business name">
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px]"
            />
          </Field>
          <Field label="Strap line">
            <input
              value={strapLine}
              onChange={(e) => setStrapLine(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px]"
              placeholder="e.g. Kitchens · Bathrooms · Fitting"
            />
          </Field>
          <Field label="Phone number">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px]"
              placeholder="0800 000 0000"
            />
          </Field>
          <Field label="Text colour">
            <div className="flex gap-2">
              {[
                { label: "Black",  value: BRAND_BLACK  },
                { label: "Yellow", value: BRAND_YELLOW },
                { label: "White",  value: "#ffffff"    },
                { label: "Red",    value: "#DC2626"    }
              ].map((c) => (
                <button
                  key={c.value}
                  onClick={() => setTextColour(c.value)}
                  className={
                    "h-8 w-8 rounded-full border-2 transition " +
                    (textColour === c.value ? "border-neutral-900 scale-110" : "border-neutral-200")
                  }
                  style={{ backgroundColor: c.value }}
                  aria-label={c.label}
                />
              ))}
            </div>
          </Field>
          <Field label="Logo">
            <div className="grid max-h-64 grid-cols-4 gap-1 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1">
              {AVAILABLE_LOGOS.length === 0 && (
                <p className="col-span-4 p-3 text-center text-[11px] text-neutral-500">
                  No logos in the catalog yet. Add samples in src/lib/logo/catalog.ts.
                </p>
              )}
              {AVAILABLE_LOGOS.map((lg) => (
                <button
                  key={lg.imageUrl}
                  onClick={() => setLogoUrl(lg.imageUrl)}
                  className={
                    "aspect-square overflow-hidden rounded transition " +
                    (logoUrl === lg.imageUrl ? "ring-2 ring-neutral-900" : "hover:ring-1 hover:ring-neutral-300")
                  }
                  title={`${lg.styleName} · ${lg.tradeSlug}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={lg.imageUrl} alt={lg.styleName} className="h-full w-full object-contain"/>
                </button>
              ))}
            </div>
          </Field>

          {adjust && (
            <div className="space-y-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Placement sliders</p>
              <ZoneEditor
                label="Logo zone"
                zone={van.zones.logo}
                onChange={(z) => setZoneOverride({ ...van.zones, logo: z })}
              />
              <ZoneEditor
                label="Business name zone"
                zone={van.zones.businessName}
                onChange={(z) => setZoneOverride({ ...van.zones, businessName: z })}
              />
              <ZoneEditor
                label="Phone strip zone"
                zone={van.zones.phone}
                onChange={(z) => setZoneOverride({ ...van.zones, phone: z })}
              />
              <p className="mt-2 text-[10px] text-neutral-500">
                When it looks right, copy these numbers into src/lib/logo/vans.ts for {van.slug}.
              </p>
              <pre className="mt-1 overflow-x-auto rounded bg-neutral-900 p-2 text-[10px] leading-tight text-neutral-100">
{`zones: {
  logo:         { xPct: ${van.zones.logo.xPct.toFixed(1)},  yPct: ${van.zones.logo.yPct.toFixed(1)},  wPct: ${van.zones.logo.wPct.toFixed(1)},  hPct: ${(van.zones.logo.hPct ?? 20).toFixed(1)} },
  businessName: { xPct: ${van.zones.businessName.xPct.toFixed(1)},  yPct: ${van.zones.businessName.yPct.toFixed(1)},  wPct: ${van.zones.businessName.wPct.toFixed(1)} },
  phone:        { xPct: ${van.zones.phone.xPct.toFixed(1)},  yPct: ${van.zones.phone.yPct.toFixed(1)},  wPct: ${van.zones.phone.wPct.toFixed(1)} }
}`}
              </pre>
            </div>
          )}

          <button
            disabled
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-[12px] font-black opacity-40"
            style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
          >
            <Download size={12}/> Download mockup PNG (soon)
          </button>
          <p className="text-center text-[10px] text-neutral-500">
            PNG export lands when the html2canvas step is wired.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      {children}
    </div>
  );
}
