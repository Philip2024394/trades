"use client";

// Site services calculator — inline section on the plant hire home
// showcase. Customer types area + depth + material → instant tonnes /
// cost / delivery. Submits via WhatsApp for confirmation.

import { useMemo, useState } from "react";
import type { PlantSiteCalculator } from "@/lib/plantHire";

export function PlantSiteCalculatorSection({
  cfg,
  waHref,
  merchantName
}: {
  cfg: PlantSiteCalculator;
  waHref: string | null;
  merchantName: string;
}) {
  const [materialSlug, setMaterialSlug] = useState(cfg.materials[0]?.slug ?? "");
  const [lengthM, setLengthM] = useState("10");
  const [widthM, setWidthM] = useState("5");
  const [depthMm, setDepthMm] = useState("150");

  const mat = cfg.materials.find((m) => m.slug === materialSlug) ?? cfg.materials[0];
  const wasteFactor = (cfg.waste_factor_percent ?? 10) / 100;

  const calc = useMemo(() => {
    if (!mat) return null;
    const l = Number(lengthM) || 0;
    const w = Number(widthM) || 0;
    const d = (Number(depthMm) || 0) / 1000;
    if (l <= 0 || w <= 0 || d <= 0) return null;
    const volumeM3 = l * w * d;
    const netTonnes = (volumeM3 * mat.density_kg_per_m3) / 1000;
    const grossTonnes = netTonnes * (1 + wasteFactor);
    const costPence =
      mat.unit_price_per_tonne_pence !== null
        ? grossTonnes * mat.unit_price_per_tonne_pence
        : null;
    return {
      volumeM3,
      netTonnes,
      grossTonnes,
      costPence
    };
  }, [mat, lengthM, widthM, depthMm, wasteFactor]);

  if (!cfg.enabled || cfg.materials.length === 0) return null;

  const submit = () => {
    if (!calc || !mat) return;
    const msg = encodeURIComponent(
      `Hi ${merchantName}, please quote materials:\n\nMaterial: ${mat.label}\nArea: ${lengthM}m × ${widthM}m × ${depthMm}mm deep\nVolume: ${calc.volumeM3.toFixed(2)} m³\nTonnes (with ${(wasteFactor * 100).toFixed(0)}% waste): ${calc.grossTonnes.toFixed(2)} T\n${calc.costPence !== null ? `Est. materials: £${(calc.costPence / 100).toFixed(2)}\n` : ""}\nSite postcode:\nDelivery date:`
    );
    const url = waHref ? `${waHref}?text=${msg}` : "#";
    if (typeof window !== "undefined") window.open(url, "_blank");
  };

  return (
    <div className="relative mt-10 overflow-hidden rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6">
      {/* Wheelbarrow / gravel scene on the lower-left corner — full opacity. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 hidden h-64 w-64 sm:block lg:h-80 lg:w-80"
        style={{
          backgroundImage:
            "url('https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2003_52_47%20PM.png')",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "bottom left"
        }}
      />
      <p className="relative text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        Site services · Live calculator
      </p>
      <h3 className="relative mt-1 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
        {cfg.heading}
      </h3>
      <p className="relative mt-1 max-w-2xl text-[13px] leading-relaxed text-neutral-600">
        {cfg.subheading}
      </p>

      <div className="relative mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <div>
          <label className="block text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
            Material
          </label>
          <select
            value={materialSlug}
            onChange={(e) => setMaterialSlug(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] text-neutral-900 outline-none focus:border-[#FFB300] focus:bg-white"
          >
            {cfg.materials.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.label}
              </option>
            ))}
          </select>
          {mat?.note && (
            <p className="mt-1 text-[11px] text-neutral-500">{mat.note}</p>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2">
            <NumField label="Length (m)" value={lengthM} onChange={setLengthM} />
            <NumField label="Width (m)" value={widthM} onChange={setWidthM} />
            <NumField label="Depth (mm)" value={depthMm} onChange={setDepthMm} />
          </div>
        </div>

        <div className="rounded-2xl bg-neutral-900 p-4 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            Estimate
          </p>
          {calc ? (
            <>
              <p className="mt-1 text-[13px] font-bold text-white/80">
                Volume · <span className="text-white">{calc.volumeM3.toFixed(2)} m³</span>
              </p>
              <p className="text-[13px] font-bold text-white/80">
                Tonnes ({(wasteFactor * 100).toFixed(0)}% waste) ·{" "}
                <span className="text-white">{calc.grossTonnes.toFixed(2)} T</span>
              </p>
              {calc.costPence !== null && (
                <p className="mt-3 text-[28px] font-extrabold leading-none">
                  £{(calc.costPence / 100).toFixed(2)}
                </p>
              )}
              <p className="mt-1 text-[10px] text-white/60">
                Estimate — final confirmed on WhatsApp with your delivery postcode.
              </p>
              <button
                type="button"
                onClick={submit}
                className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#FFB300] px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
              >
                WhatsApp the quote →
              </button>
            </>
          ) : (
            <p className="mt-2 text-[12px] text-white/60">Enter area + depth to see estimate.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={0}
        className="mt-1 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] font-bold text-neutral-900 outline-none focus:border-[#FFB300] focus:bg-white"
      />
    </label>
  );
}
