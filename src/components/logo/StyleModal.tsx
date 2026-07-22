"use client";

// Style preview modal — opens when a user taps a style card. Shows a
// bigger preview, the description, which trades it suits, and two
// buttons: Choose this style (primary) or Close (ghost). Arrows for
// browsing through this style's samples, or across styles when the
// current style has no samples.

import { useEffect, useState } from "react";
import { X, ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { LogoStyle } from "@/lib/logo/catalog";
import { LOGO_STYLES, tradeBySlug } from "@/lib/logo/catalog";
import { StylePreviewTile } from "./StylePreviewTile";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";

export function StyleModal({
  style, onClose, onSelect, onNavigate, tradeSlug = null
}: {
  style:      LogoStyle;
  onClose:    () => void;
  onSelect:   (slug: string) => void;
  onNavigate: (slug: string) => void;
  /** If set, prioritise samples matching this trade in the browse index. */
  tradeSlug?: string | null;
}) {
  // Sample browser — if the style has samples, arrows step through the
  // samples (trade-filtered first). Otherwise arrows navigate styles.
  const sampleList = tradeSlug
    ? [...style.samples.filter((s) => s.tradeSlug === tradeSlug), ...style.samples.filter((s) => s.tradeSlug !== tradeSlug)]
    : style.samples;
  const [sampleIdx, setSampleIdx] = useState(0);
  const activeSample = sampleList[sampleIdx] ?? null;

  // Reset sample index when the style changes.
  useEffect(() => { setSampleIdx(0); }, [style.slug]);

  const stepSample = (dir: 1 | -1) => {
    if (sampleList.length <= 1) {
      // No siblings — fall through to style navigation.
      const i = LOGO_STYLES.findIndex((s) => s.slug === style.slug);
      onNavigate(LOGO_STYLES[(i + dir + LOGO_STYLES.length) % LOGO_STYLES.length].slug);
      return;
    }
    setSampleIdx((idx) => (idx + dir + sampleList.length) % sampleList.length);
  };

  // Keyboard: Esc to close, arrows to step samples (or styles if no samples).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") stepSample(1);
      if (e.key === "ArrowLeft")  stepSample(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style.slug, sampleList.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${style.name} preview`}>
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-neutral-600">{style.vibe}</span>
            <p className="text-[13px] font-black">{style.name}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label="Close">
            <X size={16}/>
          </button>
        </div>

        {/* Body — preview + meta */}
        <div className="grid gap-4 overflow-y-auto p-4 sm:grid-cols-[1fr_240px] sm:gap-6 sm:p-6">
          <div className="relative">
            <StylePreviewTile
              style={style}
              size="lg"
              tradeSlug={activeSample?.tradeSlug ?? tradeSlug}
              imageUrl={activeSample?.imageUrl}
            />
            {/* Navigation arrows over the preview edges */}
            <button
              onClick={() => stepSample(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
              aria-label="Previous sample"
            ><ArrowLeft size={14}/></button>
            <button
              onClick={() => stepSample(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
              aria-label="Next sample"
            ><ArrowRight size={14}/></button>
            {sampleList.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-black text-white">
                {sampleIdx + 1} / {sampleList.length}
              </div>
            )}
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Tagline</p>
            <p className="mt-0.5 text-[13px] font-semibold text-neutral-800">{style.tagline}</p>

            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Description</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-neutral-700">{style.description}</p>

            {style.suitedTrades.length > 0 && (
              <>
                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Best for</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {style.suitedTrades.map((slug) => {
                    const t = tradeBySlug(slug);
                    return (
                      <span key={slug} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                        {t?.label ?? slug}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer — actions */}
        <div className="flex items-center justify-between gap-2 border-t border-neutral-100 bg-neutral-50 px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-[12px] font-black text-neutral-700 hover:bg-neutral-50"
          >
            Close
          </button>
          <button
            onClick={() => onSelect(style.slug)}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-black transition hover:brightness-95"
            style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
          >
            <Check size={13}/> Select this style
          </button>
        </div>
      </div>
    </div>
  );
}
