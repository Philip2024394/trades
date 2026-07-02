"use client";

// MachineSizeModal — click "Size & access" button on a machine detail
// page → modal opens with a scaled top-down silhouette + labelled
// dimensions + tow weight + minimum access width. Uses the merchant's
// per-category specs (transport_length_mm / width_mm / height_mm /
// weight_kg). Renders "size not yet configured" if the merchant hasn't
// entered dims — never a broken diagram.

import { useEffect, useState } from "react";
import type { PlantCategorySlug, PlantSpec } from "@/lib/plantHire";
import { PlantMachineSilhouette } from "./PlantMachineSilhouettes";

export function MachineSizeModal({
  label,
  categorySlug,
  imageUrl,
  diagramUrl,
  specs
}: {
  label: string;
  categorySlug: PlantCategorySlug;
  imageUrl?: string;
  diagramUrl?: string;
  specs: PlantSpec;
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

  const L = specs.transport_length_mm ?? null;
  const W = specs.transport_width_mm ?? null;
  const H = specs.transport_height_mm ?? null;
  const wt = specs.weight_kg ?? null;
  const hasAny = L !== null || W !== null || H !== null || wt !== null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90 active:scale-[0.98]"
        style={{ background: "#FFB300" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="7" width="18" height="10" rx="1" />
          <path d="M7 7v10M17 7v10M3 12h18" />
        </svg>
        Machine size & access
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label} size and access`}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white p-5 shadow-2xl"
            style={{ boxShadow: "0 0 0 4px #FFB300, 0 20px 60px rgba(0,0,0,0.45)" }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-[24px] font-extrabold transition hover:opacity-90"
              style={{ background: "#0A0A0A", color: "#FFB300" }}
              aria-label="Close"
            >
              ×
            </button>

            <div className="flex items-center gap-3">
              {imageUrl ? (
                <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </span>
              ) : null}
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
                  Size & access
                </p>
                <h3 className="mt-0.5 text-xl font-extrabold text-neutral-900">{label}</h3>
              </div>
            </div>

            {!hasAny ? (
              <p className="mt-4 rounded-md bg-neutral-50 p-4 text-[13px] text-neutral-600">
                Size not yet configured for this machine — WhatsApp us for exact dimensions.
              </p>
            ) : (
              <>
                {/* Merchant-supplied diagram if set, else auto SVG silhouette. */}
                <div className="mt-4 rounded-md border border-neutral-200 bg-white p-3">
                  {diagramUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={diagramUrl}
                      alt={`${label} dimensions`}
                      className="mx-auto block h-auto w-full max-w-md object-contain"
                    />
                  ) : (
                    <PlantMachineSilhouette slug={categorySlug} className="mx-auto block h-auto w-full max-w-sm" />
                  )}
                  {!diagramUrl && (L || W) && (
                    <p className="mt-1 text-center text-[11px] font-bold text-neutral-600">
                      {L ? `L ${(L / 1000).toFixed(2)} m` : ""}
                      {L && W ? " · " : ""}
                      {W ? `W ${(W / 1000).toFixed(2)} m` : ""}
                      {H ? ` · H ${(H / 1000).toFixed(2)} m` : ""}
                    </p>
                  )}
                </div>

                {/* Facts grid */}
                <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
                  {L !== null && (
                    <Fact label="Length" value={`${(L / 1000).toFixed(2)} m`} />
                  )}
                  {W !== null && (
                    <Fact label="Width" value={`${(W / 1000).toFixed(2)} m`} />
                  )}
                  {H !== null && (
                    <Fact label="Height" value={`${(H / 1000).toFixed(2)} m`} />
                  )}
                  {wt !== null && (
                    <Fact label="Weight" value={`${wt.toLocaleString()} kg`} />
                  )}
                  {W !== null && (
                    <Fact
                      label="Min access"
                      value={`${((W + 200) / 1000).toFixed(2)} m`}
                    />
                  )}
                </dl>

                <p className="mt-3 rounded-md bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600">
                  <strong>Access note:</strong> add ~200mm for safe manoeuvring beyond the raw width.
                  For non-tracked machines confirm the tow-weight is within your trailer/tow-vehicle rating.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-2">
      <dt className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13px] font-extrabold text-neutral-900">{value}</dd>
    </div>
  );
}
