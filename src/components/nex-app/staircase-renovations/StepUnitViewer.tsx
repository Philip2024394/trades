"use client";

// StepUnitViewer (2026-08-12 rebuild) — customer-facing browsing surface for
// staircase refacing.
//
// LAYOUT:
//   · Main image (big background) = WHOLE-STAIRCASE hero photo · what the
//     customer's refaced staircase could look like
//   · Right rail = 4 material family chips (Metal · Painted · Wood · Glass) ·
//     tapping filters the swatches shown in the footer
//   · Footer carousel = STEP-UNIT swatches (isometric single-step renders)
//     scrolling left/right · tapping one changes the MAIN image to a
//     whole-staircase photo matching that swatch's material+species
//
// FALLBACK per doctrine (never fake fullness):
//   · If a swatch has no matching hero photos (e.g. Metal today), the main
//     image shows the swatch's own isometric render with a note explaining
//     full-staircase photos are coming.
//   · If a family has no swatches at all (e.g. Glass today), the right chip
//     is dimmed and selecting it shows an honest empty state.
//
// Data shape is pre-resolved in page.tsx · viewer is pure UI.
// Architecture per project_nex_refacing_step_unit_taxonomy_2026_08_12.md.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Hammer, Paintbrush, TreePine, GlassWater, Sparkles } from "lucide-react";

export type FamilyKey = "metal" | "painted" | "wood" | "glass";

export type HeroImage = {
  src: string;
  alt: string;
};

export type Swatch = {
  swatch_src: string;
  swatch_alt: string;
  pattern?: string;
  tread_species?: string;
  sub_material?: string;
  hero_pool: HeroImage[];
};

export type ResolvedFamily = {
  family: FamilyKey;
  label: string;
  swatches: Swatch[];
  family_hero_pool: HeroImage[];
};

type Props = {
  families: ResolvedFamily[];
};

const FAMILY_ORDER: FamilyKey[] = ["metal", "painted", "wood", "glass"];

const FAMILY_ICONS: Record<FamilyKey, typeof Hammer> = {
  metal:   Hammer,
  painted: Paintbrush,
  wood:    TreePine,
  glass:   GlassWater,
};

const SWIPE_TRIGGER_PX = 60;
const SWIPE_TRIGGER_V  = 300;

function humanize(s?: string): string {
  if (!s) return "";
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function swatchCaption(s: Swatch): string {
  const species = humanize(s.tread_species);
  const pattern = humanize(s.pattern);
  if (species && pattern) return `${species} · ${pattern}`;
  return species || pattern || "Design";
}

export function StepUnitViewer({ families }: Props) {
  // Sort families to canonical order.
  const ordered = useMemo(() => {
    const map = new Map(families.map((f) => [f.family, f]));
    return FAMILY_ORDER
      .map((key) => map.get(key))
      .filter((f): f is ResolvedFamily => Boolean(f));
  }, [families]);

  // Default: first family with any swatches OR any hero pool.
  const defaultFamily: FamilyKey = useMemo(() => {
    const firstUsable = ordered.find((f) => f.swatches.length > 0 || f.family_hero_pool.length > 0);
    return firstUsable?.family ?? FAMILY_ORDER[0];
  }, [ordered]);

  // Flatten every swatch across every family into one strip · always visible.
  type FlatSwatch = Swatch & { family: FamilyKey; familyLabel: string };
  const allSwatches: FlatSwatch[] = useMemo(
    () =>
      ordered.flatMap((f) =>
        f.swatches.map((s) => ({ ...s, family: f.family, familyLabel: f.label }))
      ),
    [ordered]
  );

  // Default active swatch = first swatch of first non-empty family.
  const defaultSwatchIndex = useMemo(() => {
    const idx = allSwatches.findIndex((s) => s.family === defaultFamily);
    return idx >= 0 ? idx : 0;
  }, [allSwatches, defaultFamily]);

  const [swatchIndex, setSwatchIndex] = useState<number>(defaultSwatchIndex);
  const [heroIndex, setHeroIndex]     = useState<number>(0);

  const activeSwatch   = allSwatches[swatchIndex];
  const activeFamily   = useMemo(
    () => ordered.find((f) => f.family === activeSwatch?.family),
    [ordered, activeSwatch]
  );
  const familyKey      = activeSwatch?.family ?? defaultFamily;
  const activeHeroPool = activeSwatch?.hero_pool ?? [];
  const activeHero     = activeHeroPool[heroIndex];

  // Refs to each swatch button so family-chip taps can scroll into view.
  const swatchRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // What the main <img> shows:
  //   1. active swatch's active hero photo (preferred)
  //   2. active swatch's own step-unit image (fallback with note)
  //   3. null (fully empty family) → honest empty state
  const mainImageSrc = activeHero?.src ?? activeSwatch?.swatch_src ?? null;
  const mainImageAlt = activeHero?.alt ?? activeSwatch?.swatch_alt ?? "Refacing preview";
  const usingFallback = !activeHero && Boolean(activeSwatch);

  // Family chip is a quick-jump: activate + scroll first swatch of that
  // family into view. Footer keeps ALL swatches visible at all times.
  const selectFamily = useCallback((key: FamilyKey) => {
    const idx = allSwatches.findIndex((s) => s.family === key);
    if (idx < 0) return;
    setSwatchIndex(idx);
    setHeroIndex(0);
    const btn = swatchRefs.current[idx];
    if (btn) btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [allSwatches]);

  const selectSwatch = useCallback((i: number) => {
    setSwatchIndex(i);
    setHeroIndex(0);
  }, []);

  const advanceHero = useCallback((delta: number) => {
    if (activeHeroPool.length === 0) return;
    setHeroIndex((i) => (i + delta + activeHeroPool.length) % activeHeroPool.length);
  }, [activeHeroPool.length]);

  // Keyboard: left/right cycles hero photos within current swatch.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") advanceHero(+1);
      if (e.key === "ArrowLeft")  advanceHero(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advanceHero]);

  function onDragEnd(_: unknown, info: PanInfo) {
    const magnitude = Math.abs(info.offset.x);
    const velocity  = Math.abs(info.velocity.x);
    if (magnitude < SWIPE_TRIGGER_PX && velocity < SWIPE_TRIGGER_V) return;
    advanceHero(info.offset.x < 0 ? +1 : -1);
  }

  return (
    <div
      className="relative flex h-[100dvh] w-full flex-col overflow-hidden"
      style={{ background: "var(--nex-cream, #F7F2E8)" }}
    >
      {/* Full-bleed hero · fills entire viewport · swatches float on top with glass containers */}
      {mainImageSrc ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={`bg-${familyKey}-${swatchIndex}-${heroIndex}`}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-0"
            drag={activeHeroPool.length > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={onDragEnd}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mainImageSrc}
              alt={mainImageAlt}
              className="absolute inset-0 h-full w-full select-none object-cover"
              draggable={false}
            />
            {/* Top scrim so header stays readable */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/45 via-black/15 to-transparent" />
            {/* Very light bottom scrim for caption legibility — the floor in the image
                already provides context; no heavy fade needed. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[140px] bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className="absolute inset-0 z-0 flex items-center justify-center">
          <EmptyFamilyState family={activeFamily} />
        </div>
      )}

      {/* Header · overlays hero · z-10 */}
      <header className="relative z-10 px-5 pt-6 pb-2">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-white/90 drop-shadow-sm">
          NEX Refacing
        </div>
        <h1 className="mt-1 text-[22px] font-semibold leading-tight text-white drop-shadow">
          Keep your staircase. Change its appearance.
        </h1>
        <p className="mt-1 text-[13px] leading-snug text-white/85 drop-shadow-sm">
          Pick your riser material on the right. Choose a design below.
        </p>
      </header>

      {/* Stage spacer + right rail overlay · flex-1 pushes footer to bottom */}
      <section className="relative z-10 flex-1">
        {/* Right rail · floating orange panel containing 4 family buttons */}
        <nav
          aria-label="Riser material"
          className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2 rounded-2xl p-2 shadow-2xl backdrop-blur-md"
          style={{
            background: "rgba(255, 255, 255, 0.85)",
            border: "1px solid rgba(255, 255, 255, 0.6)",
          }}
        >
          {ordered.map((fam) => {
            const Icon = FAMILY_ICONS[fam.family];
            const isActive = fam.family === familyKey;
            const isEmpty  = fam.swatches.length === 0;
            return (
              <button
                key={fam.family}
                type="button"
                onClick={() => selectFamily(fam.family)}
                aria-pressed={isActive}
                aria-label={`${fam.label}${isEmpty ? " (coming soon)" : ""}`}
                className={`group flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all ${
                  isActive ? "scale-105" : "scale-100"
                }`}
                style={{
                  background: isActive
                    ? "#F97316"
                    : "transparent",
                  color: isActive
                    ? "#FFFFFF"
                    : isEmpty
                      ? "#C9C4B8"
                      : "#F97316",
                  boxShadow: isActive
                    ? "0 4px 12px rgba(249, 115, 22, 0.35)"
                    : "none",
                  border: isActive
                    ? "none"
                    : "1px solid rgba(249, 115, 22, 0.35)",
                  opacity: isEmpty && !isActive ? 0.55 : 1,
                }}
              >
                <Icon size={18} strokeWidth={2} />
                <span className="mt-0.5 text-[8.5px] font-semibold leading-none">
                  {fam.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Desktop prev/next for hero cycling within swatch */}
        {activeHeroPool.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => advanceHero(-1)}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full p-2 md:block"
              style={{
                background: "var(--nex-cream-elev, #FFFFFF)",
                border: "1px solid var(--nex-neutral-200, #E7E1D2)",
                color: "var(--nex-neutral-700, #3d3d3d)",
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => advanceHero(+1)}
              aria-label="Next photo"
              className="absolute right-16 top-1/2 hidden -translate-y-1/2 rounded-full p-2 md:block"
              style={{
                background: "var(--nex-cream-elev, #FFFFFF)",
                border: "1px solid var(--nex-neutral-200, #E7E1D2)",
                color: "var(--nex-neutral-700, #3d3d3d)",
              }}
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </section>

      {/* Caption · design name · optional hero-pool position · overlays hero */}
      {activeSwatch && (
        <div className="relative z-10 px-5 py-2 text-center">
          <div className="text-[13px] font-semibold text-white drop-shadow">
            {swatchCaption(activeSwatch)}
          </div>
          {activeHeroPool.length > 1 && (
            <div className="mt-0.5 text-[10px] text-white/85 drop-shadow-sm">
              Photo {heroIndex + 1} of {activeHeroPool.length}
            </div>
          )}
          {usingFallback && (
            <div className="mt-0.5 text-[10px] italic text-white/85 drop-shadow-sm">
              Design sample shown · full-staircase photos coming
            </div>
          )}
        </div>
      )}

      {/* Footer · each swatch is its own floating glass card · no outer bar */}
      <footer className="relative z-10 mb-4 w-full overflow-x-auto">
        {allSwatches.length === 0 ? (
          <div className="mx-3 rounded-2xl px-5 py-4 text-center text-[12px] text-white shadow-lg backdrop-blur-md"
            style={{
              background: "rgba(255, 255, 255, 0.20)",
              border: "1px solid rgba(255, 255, 255, 0.35)",
            }}
          >
            No designs available yet. New designs added regularly.
          </div>
        ) : (
          <div className="flex min-w-max gap-3 px-3">
            {allSwatches.map((swatch, i) => {
              const isActive = i === swatchIndex;
              return (
                <button
                  key={`${swatch.family}-${swatch.swatch_src}`}
                  ref={(el) => { swatchRefs.current[i] = el; }}
                  type="button"
                  onClick={() => selectSwatch(i)}
                  aria-label={`${swatch.familyLabel} · ${swatch.swatch_alt || swatchCaption(swatch)}`}
                  aria-pressed={isActive}
                  className="flex flex-col items-center rounded-2xl p-2 backdrop-blur-md transition-all active:scale-95"
                  style={{
                    // Glass background in both states — never fills with solid orange.
                    background: "rgba(255, 255, 255, 0.10)",
                    // Active = glowing orange rim; inactive = subtle white rim.
                    border: isActive
                      ? "1.5px solid #F97316"
                      : "1.5px solid rgba(255, 255, 255, 0.35)",
                    boxShadow: isActive
                      ? "0 0 0 1px rgba(249, 115, 22, 0.9), 0 0 16px 2px rgba(249, 115, 22, 0.55), 0 0 32px rgba(249, 115, 22, 0.25)"
                      : "0 4px 12px rgba(0, 0, 0, 0.35)",
                  }}
                >
                  <div
                    className="grid h-16 w-20 place-items-center overflow-hidden rounded-lg"
                    style={{ background: "rgba(255, 255, 255, 0.90)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={swatch.swatch_src}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                      loading="lazy"
                      draggable={false}
                    />
                  </div>
                  <div
                    className="mt-1 max-w-[80px] truncate text-[10px] font-semibold drop-shadow-sm"
                    style={{ color: "#FFFFFF" }}
                  >
                    {swatchCaption(swatch)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </footer>
    </div>
  );
}

function EmptyFamilyState({ family }: { family?: ResolvedFamily }) {
  const label = family?.label ?? "Designs";
  return (
    <div className="flex max-w-[280px] flex-col items-center gap-2 text-center">
      <span
        className="grid h-14 w-14 place-items-center rounded-full"
        style={{
          background: "var(--nex-cream-elev, #FFFFFF)",
          border: "1px solid var(--nex-neutral-200, #E7E1D2)",
          color: "var(--nex-neutral-500, #6b6b6b)",
        }}
      >
        <Sparkles size={22} strokeWidth={1.75} />
      </span>
      <div
        className="text-[14px] font-semibold"
        style={{ color: "var(--nex-neutral-900, #1a1a1a)" }}
      >
        {label} designs coming soon
      </div>
      <p
        className="text-[12px] leading-snug"
        style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
      >
        NEX only shows what genuinely exists. New {label.toLowerCase()} designs will appear here as they land.
      </p>
    </div>
  );
}
