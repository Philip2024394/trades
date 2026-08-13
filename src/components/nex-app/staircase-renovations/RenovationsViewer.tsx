"use client";

// RenovationsViewer — customer-facing full-screen visual experience.
//
// Not part of Headquarters · not part of G1-G6 · not part of the burn-in.
// A visual inspiration surface: one large staircase image + a persistent
// horizontal category carousel at the bottom. Data-driven from
// /api/nex/staircase-renovations/manifest.
//
// Interaction model:
//   · Left/right swipe (touch or mouse-drag) advances within the current
//     category. Reaching the last image loops back to the first · never
//     a "gallery end".
//   · Tapping a category tile jumps to image 1 of that category.
//   · Arrow keys work on desktop.
//   · Small progress indicator ("3 / 8") in a corner · does not break
//     the continuous-loop feeling.
//
// The staircase image is rendered object-contain per the
// Thenetworkers image-contain rule so background-removed cut-outs read
// cleanly against the cream page background.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, ImageOff, MessageSquareQuote } from "lucide-react";
import { QuoteFlow, type QuoteContext } from "./QuoteFlow";

export type ManifestImage = {
  src: string;
  alt?: string;
  sort?: number;
  // Philip 2026-08-11 · optional material tags · declare which wood species
  // the image genuinely represents in its TREADS/RISERS (the primary visual
  // element the customer picks). Newel/handrail accents do NOT qualify.
  // Consumed by the floating material picker so "tap Walnut → see a real
  // walnut staircase" stays truthful · never silently substituted.
  materials?: string[];
};

export type ManifestCategory = {
  slug: string;
  label: string;
  description?: string | null;
  images: ManifestImage[];
  image_count?: number;
};

type Props = { categories: ManifestCategory[] };

const SWIPE_TRIGGER_PX  = 60;
const SWIPE_TRIGGER_V   = 300;

// Philip 2026-08-11 · onboarding swipe hint · mirrors the StaircaseLibraryShell
// pattern (nex-library-swipe-hint-seen) but uses an independent storage key
// so a customer who's seen the Library hint still sees the Refacing hint the
// first time they visit this distinct surface. Dismisses on first successful
// swipe or arrow-key navigation · persists via localStorage · never intercepts
// the swipe gesture (pointer-events: none on the overlay).
const SWIPE_HINT_STORAGE_KEY = "nex-refacing-swipe-hint-seen";
const SWIPE_HINT_HAND_IMG =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2005_31_59%20AM.png?updatedAt=1785612000000";

// Philip 2026-08-11 · Floating material picker · right-side vertical stack
// of wood-species chips. Species without genuine library representation stay
// visible but disabled ("Examples coming soon") · NEVER silently substituted
// with a different species. This list is the picker's authoritative surface;
// the manifest's `materials` metadata is the truth about which images
// represent which species.
type MaterialId = "walnut" | "maple" | "teak" | "mahogany";
type MaterialConfig = { id: MaterialId; label: string; thumbnail: string };
const MATERIALS: readonly MaterialConfig[] = [
  { id: "walnut",   label: "Walnut",   thumbnail: "/staircase-renovations/materials/walnut.png"   },
  { id: "maple",    label: "Maple",    thumbnail: "/staircase-renovations/materials/maple.png"    },
  { id: "teak",     label: "Teak",     thumbnail: "/staircase-renovations/materials/teak.png"     },
  { id: "mahogany", label: "Mahogany", thumbnail: "/staircase-renovations/materials/mahogany.png" },
];

export function RenovationsViewer({ categories }: Props) {
  // Never crash on an empty manifest · render an honest empty state.
  const firstWithImages = categories.findIndex((c) => c.images.length > 0);
  const initialCategoryIdx = firstWithImages >= 0 ? firstWithImages : 0;

  const [categoryIdx, setCategoryIdx] = useState(initialCategoryIdx);
  const [imageIdx, setImageIdx]       = useState(0);
  // Direction · used by framer AnimatePresence for slide direction.
  const [direction, setDirection]     = useState<1 | -1>(1);
  const [quoteOpen, setQuoteOpen]     = useState(false);
  // Philip 2026-08-11 · onboarding swipe hint · centered animated hand +
  // "Swipe to explore" label · visible on first visit · dismissed on first
  // successful swipe/arrow-key navigation · persisted via localStorage.
  const [hintVisible, setHintVisible] = useState(true);

  // Load hint state from localStorage on mount (client-only). If the customer
  // has previously dismissed the hint on this surface, keep it hidden.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(SWIPE_HINT_STORAGE_KEY)) setHintVisible(false);
    } catch { /* localStorage may be blocked · default is visible */ }
  }, []);

  const dismissHint = useCallback(() => {
    setHintVisible((v) => {
      if (!v) return v;
      try { window.localStorage.setItem(SWIPE_HINT_STORAGE_KEY, "1"); } catch { /* ignore */ }
      return false;
    });
  }, []);

  const [selectedMaterial, setSelectedMaterial] = useState<MaterialId | null>(null);

  const currentCategory = categories[categoryIdx] ?? null;
  const images          = currentCategory?.images ?? [];
  const hasImages       = images.length > 0;
  // Normalised image index so we never reference outside the array.
  const normalisedImageIdx = hasImages ? ((imageIdx % images.length) + images.length) % images.length : 0;
  const currentImage       = hasImages ? images[normalisedImageIdx] : null;

  // Fire-and-forget analytics helper · uses existing /api/nex/tracking.
  // Never blocks the UI · never includes personal data · payload is ID-only.
  const emit = useCallback((event_name: string, extra: Record<string, unknown> = {}) => {
    try {
      const body = JSON.stringify({
        event_name,
        path: typeof window !== "undefined" ? window.location.pathname : "/nex-app/staircase-renovations",
        properties: extra,
      });
      // Prefer sendBeacon so the request survives page transitions.
      if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/nex/tracking", blob);
        return;
      }
      fetch("/api/nex/tracking", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
    } catch { /* analytics never fails the UX */ }
  }, []);

  // Philip 2026-08-11 · Material picker index. Flatten (categoryIdx, imageIdx)
  // pairs once so the picker can jump to the first genuinely-tagged image for
  // a given species. Deterministic order: category order × per-category image
  // order · so "tap Walnut" always lands on the same reference until images
  // change. Species without any tagged image stay disabled.
  const materialsIndex = useMemo(() => {
    const byMaterial: Record<MaterialId, Array<{ categoryIdx: number; imageIdx: number }>> = {
      walnut: [], maple: [], teak: [], mahogany: [],
    };
    categories.forEach((c, cIdx) => {
      c.images.forEach((img, iIdx) => {
        if (!img.materials) return;
        for (const m of img.materials) {
          if (m in byMaterial) byMaterial[m as MaterialId].push({ categoryIdx: cIdx, imageIdx: iIdx });
        }
      });
    });
    return byMaterial;
  }, [categories]);

  const onMaterialTap = useCallback((materialId: MaterialId) => {
    const targets = materialsIndex[materialId];
    if (!targets || targets.length === 0) return; // disabled species · no-op
    const target = targets[0];
    setDirection(1);
    setCategoryIdx(target.categoryIdx);
    setImageIdx(target.imageIdx);
    setSelectedMaterial(materialId);
    dismissHint();
    emit("renovation_material_selected", { material: materialId });
  }, [materialsIndex, dismissHint, emit]);

  // Clear the material chip's selected-ring if the customer navigates away
  // via swipe/arrow/category tap · avoids a stale "selected" indicator that
  // no longer matches what's on screen.
  useEffect(() => {
    if (selectedMaterial === null) return;
    const targets = materialsIndex[selectedMaterial];
    if (!targets) return;
    const isStillOnMaterialImage = targets.some(
      (t) => t.categoryIdx === categoryIdx && t.imageIdx === normalisedImageIdx,
    );
    if (!isStillOnMaterialImage) setSelectedMaterial(null);
  }, [categoryIdx, normalisedImageIdx, selectedMaterial, materialsIndex]);

  // Debounced `renovation_image_viewed` event · fires only after the
  // customer lands on an image for >800ms · rapid swipes don't spam.
  const viewedTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!currentImage || !currentCategory) return;
    if (viewedTimerRef.current !== null) window.clearTimeout(viewedTimerRef.current);
    viewedTimerRef.current = window.setTimeout(() => {
      emit("renovation_image_viewed", {
        collection_slug: currentCategory.slug,
        image_index:     normalisedImageIdx,
      });
    }, 800);
    return () => {
      if (viewedTimerRef.current !== null) window.clearTimeout(viewedTimerRef.current);
    };
  }, [currentCategory, normalisedImageIdx, currentImage, emit]);

  // Fire opened event once on mount.
  useEffect(() => { emit("staircase_renovations_opened"); }, [emit]);

  // Selecting a category always resets to image 1 of that category.
  const selectCategory = useCallback((idx: number) => {
    setCategoryIdx(idx);
    setImageIdx(0);
    setDirection(1);
    const cat = categories[idx];
    if (cat) emit("renovation_collection_selected", { collection_slug: cat.slug, image_count: cat.images.length });
  }, [categories, emit]);

  // Authoritative context passed to QuoteFlow · captured at open-time so
  // the customer's selection during the modal doesn't drift.
  const quoteContext: QuoteContext = useMemo(() => ({
    collection_slug:  currentCategory?.slug ?? null,
    collection_label: currentCategory?.label ?? null,
    image_src:        currentImage?.src     ?? null,
    image_alt:        currentImage?.alt     ?? null,
    image_id:         currentCategory ? `${currentCategory.slug}:${normalisedImageIdx}` : null,
    source_page:      "/nex-app/staircase-renovations",
  }), [currentCategory, currentImage, normalisedImageIdx]);

  const advance = useCallback((delta: 1 | -1) => {
    if (!hasImages) return;
    setDirection(delta);
    setImageIdx((prev) => {
      const n = images.length;
      // Wrap-around · continuous loop · never a "gallery end".
      return ((prev + delta) % n + n) % n;
    });
    // Any successful navigation dismisses the swipe hint · matches the
    // StaircaseLibraryShell pattern.
    dismissHint();
  }, [hasImages, images.length, dismissHint]);

  // Keyboard support for desktop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") advance(1);
      else if (e.key === "ArrowLeft") advance(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);

  const onDragEnd = useCallback((_e: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) < SWIPE_TRIGGER_PX && Math.abs(info.velocity.x) < SWIPE_TRIGGER_V) return;
    advance(info.offset.x < 0 ? 1 : -1);
  }, [advance]);

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-black text-white select-none"
    >
      {/* Top overlay · secondary information · never the hero.
          Philip 2026-08-11 · full-screen refacing viewer · text now sits over
          the edge-to-edge staircase image · wrapped in semi-transparent dark
          backdrop-blur pills so it remains readable over any refacing image
          (oak · walnut · white · painted · etc.). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-5 pt-5">
        <div
          className="rounded-2xl px-3 py-2 backdrop-blur"
          style={{ background: "rgba(0,0,0,0.55)" }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.24em]"
            style={{ color: "#F7B26A" }}
          >
            NEX · Staircase Renovation
          </div>
          <div
            className="mt-1 text-[13px] font-semibold text-white"
          >
            {currentCategory ? currentCategory.label : "—"}
            {currentCategory?.description
              ? <span className="ml-2 text-[11px] font-normal" style={{ color: "rgba(255,255,255,0.72)" }}>· {currentCategory.description}</span>
              : null}
          </div>
        </div>
        {hasImages ? (
          <div
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold tabular-nums backdrop-blur"
            style={{
              background: "rgba(0,0,0,0.55)",
              color:      "rgba(255,255,255,0.85)",
            }}
          >
            {normalisedImageIdx + 1} / {images.length}
          </div>
        ) : null}
      </div>

      {/* Philip 2026-08-11 · Floating material picker · right-side vertical
          stack. Four wood-species chips (Walnut · Maple · Teak · Mahogany).
          Chip enabled only if a genuinely-tagged image exists for that
          species (via manifest `materials` metadata). Disabled chips show a
          muted "Coming soon" state · NEVER silently map to a different
          species. Outer container is pointer-events-none so the vertical
          gaps between chips never intercept the horizontal swipe · each
          chip button is pointer-events-auto. Vertically centered so it
          avoids the top overlay and bottom carousel · z-30 same as the
          swipe hint so both sit above the image but below any modal. */}
      {hasImages && (
        <div
          className="pointer-events-none absolute right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2"
          role="group"
          aria-label="Material picker"
        >
          {MATERIALS.map((mat) => {
            const available = materialsIndex[mat.id].length > 0;
            const selected  = selectedMaterial === mat.id;
            return (
              <button
                key={mat.id}
                type="button"
                onClick={available ? () => onMaterialTap(mat.id) : undefined}
                disabled={!available}
                aria-label={`${mat.label} refacing material${available ? "" : " · examples coming soon"}`}
                aria-pressed={selected}
                title={available ? `${mat.label} · tap to see a ${mat.label.toLowerCase()} staircase` : `${mat.label} · examples coming soon`}
                className="pointer-events-auto flex flex-col items-center gap-1 rounded-2xl p-1.5 backdrop-blur transition"
                style={{
                  background: selected ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.55)",
                  border:     `1px solid ${selected ? "var(--nex-accent-500)" : "rgba(255,255,255,0.15)"}`,
                  opacity:    available ? 1 : 0.55,
                  cursor:     available ? "pointer" : "not-allowed",
                  width: 64,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mat.thumbnail}
                  alt=""
                  aria-hidden="true"
                  width={48}
                  height={48}
                  draggable={false}
                  className="rounded-lg object-contain"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                />
                <div
                  className="text-[9px] font-black uppercase tracking-wider text-white"
                  style={{ lineHeight: 1.1 }}
                >
                  {mat.label}
                </div>
                {!available && (
                  <div
                    className="text-[7px] font-semibold uppercase tracking-wider"
                    style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.1 }}
                  >
                    Coming
                    <br />
                    soon
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Philip 2026-08-11 · onboarding swipe hint · centered animated hand
          + "Swipe to explore" pill · mirrors the StaircaseLibraryShell pattern
          (visual · animation · label · dismissal behaviour) but uses an
          independent storage key so a customer who has already dismissed the
          hint on the Staircase Library still sees it here on their first
          Refacing visit. pointer-events:none · never intercepts swipe. */}
      {hintVisible && !quoteOpen && hasImages && images.length > 1 && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className="rounded-2xl p-2 backdrop-blur"
              style={{
                background: "rgba(0,0,0,0.55)",
                boxShadow: "0 10px 30px -8px rgba(0,0,0,0.5)",
              }}
            >
              {/* Reuses the same hand image asset as StaircaseLibraryShell so
                  the swipe interaction language is consistent across surfaces.
                  aria-hidden + no alt text · this is purely decorative. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={SWIPE_HINT_HAND_IMG}
                alt=""
                aria-hidden="true"
                width={112}
                height={112}
                className="rounded-xl object-contain"
                style={{ animation: "nex-refacing-swipe-hint 2.4s ease-in-out infinite" }}
                draggable={false}
              />
            </div>
            <div
              className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            >
              Swipe to explore
            </div>
          </div>
          {/* Keyframes scoped via a style block · same motion as the Staircase
              Library hint (slide LEFT by 70px + fade · 2.4s loop). Local name
              nex-refacing-swipe-hint to avoid conflict with the Library's own
              nex-swipe-hint keyframes when both mount on the same page. */}
          <style>{`
            @keyframes nex-refacing-swipe-hint {
              0%   { transform: translateX(0);    opacity: 0; }
              15%  { transform: translateX(0);    opacity: 1; }
              55%  { transform: translateX(-70px); opacity: 1; }
              75%  { transform: translateX(-70px); opacity: 0; }
              100% { transform: translateX(0);    opacity: 0; }
            }
          `}</style>
        </div>
      )}

      {/* Quote overlay button · always accessible · never dependent on
          reaching a particular image · sits in the bottom-right, above
          the category carousel, positioned so it never obscures the
          hero image on mobile or desktop. */}
      <button
        type="button"
        aria-label="Request a quote for this renovation"
        onClick={() => setQuoteOpen(true)}
        className="pointer-events-auto absolute right-4 z-30 inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-black uppercase tracking-wider transition-transform active:scale-95"
        style={{
          bottom: 88,   // sits above the ~72px category carousel
          background: "var(--nex-accent-500)",
          color: "#fff",
          boxShadow: "var(--nex-shadow-lg)",
        }}
      >
        <MessageSquareQuote size={16} strokeWidth={2.4} />
        Quote
      </button>

      {/* Quote flow modal · authoritative renovation context captured at open. */}
      <QuoteFlow
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        context={quoteContext}
        onEvent={emit}
      />

      {/* Hero · Philip 2026-08-11 · full-screen edge-to-edge staircase image.
          Container is absolute inset-0 · image is absolute inset-0 h-full w-full
          object-cover · no padding · no letterboxing · staircase fills the entire
          mobile viewport width and height. Mirrors the StaircaseLibraryShell
          full-screen pattern while preserving the renovation-specific overlays
          (top text · category carousel · quote button · swipe hint). */}
      <div className="absolute inset-0 overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          {currentImage ? (
            <motion.div
              key={`${currentCategory?.slug}::${normalisedImageIdx}`}
              className="absolute inset-0 touch-pan-y"
              custom={direction}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{    opacity: 0, x: -direction * 40 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.25}
              onDragEnd={onDragEnd}
            >
              {/* object-cover edge-to-edge · fills viewport in both dimensions ·
                  staircase remains centered because refacing images centre the
                  staircase in-frame. Any minor top/bottom crop on wider-aspect
                  images preserves the staircase subject. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentImage.src}
                alt={currentImage.alt ?? `${currentCategory?.label} renovation`}
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ userSelect: "none", pointerEvents: "none" }}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`empty::${currentCategory?.slug ?? "none"}`}
              className="absolute inset-0 flex flex-col items-center justify-center px-6 pt-16 pb-40 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{    opacity: 0 }}
              transition={{ duration: 0.24 }}
            >
              <ImageOff size={48} strokeWidth={1.4} style={{ color: "rgba(255,255,255,0.55)" }} />
              <div className="mt-4 text-[15px] font-semibold text-white">
                {currentCategory ? `No ${currentCategory.label.toLowerCase()} images yet` : "No categories in this manifest"}
              </div>
              <div className="mt-1 text-[12px]" style={{ color: "rgba(255,255,255,0.7)" }}>
                Pick another category from the carousel below.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop chevrons · hidden on touch-primary devices via media query.
            Philip 2026-08-11 · restyled for the full-screen dark viewer with
            semi-transparent black backdrop-blur to remain visible over any
            refacing image. */}
        {hasImages ? (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => advance(-1)}
              className="pointer-events-auto absolute left-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full p-2 backdrop-blur transition md:flex md:hover:scale-105"
              style={{
                background: "rgba(0,0,0,0.55)",
                color:      "#ffffff",
                width: 44, height: 44,
              }}
            >
              <ChevronLeft size={22} strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => advance(1)}
              className="pointer-events-auto absolute right-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full p-2 backdrop-blur transition md:flex md:hover:scale-105"
              style={{
                background: "rgba(0,0,0,0.55)",
                color:      "#ffffff",
                width: 44, height: 44,
              }}
            >
              <ChevronRight size={22} strokeWidth={2} />
            </button>
          </>
        ) : null}
      </div>

      {/* Category carousel · persistent · always accessible.
          Philip 2026-08-11 · full-screen viewer · carousel now floats OVER
          the bottom of the image using semi-transparent dark backdrop-blur
          so it remains readable on any refacing image (oak · walnut · white
          · painted · dark walnut · etc.). Position absolute-bottom rather
          than a flex sibling so it never pushes the image upward. */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 border-t"
        style={{
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderColor: "rgba(255,255,255,0.12)",
        }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((c, idx) => {
            const active = idx === categoryIdx;
            const disabled = c.images.length === 0;
            return (
              <button
                key={c.slug}
                type="button"
                onClick={() => selectCategory(idx)}
                className="flex-none rounded-full border px-4 py-2 text-[12px] font-semibold uppercase tracking-wider transition-transform active:scale-95"
                style={{
                  // Philip 2026-08-11 · full-screen refacing viewer · buttons
                  // sit over the dark blurred carousel strip · restyled for
                  // legibility over any refacing image. Active retains the
                  // orange accent (already high-contrast) · enabled uses
                  // white-on-transparent · disabled uses muted white.
                  background:  active ? "var(--nex-accent-500)" : "rgba(255,255,255,0.08)",
                  color:       active ? "#ffffff" : (disabled ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.92)"),
                  borderColor: active ? "var(--nex-accent-500)" : (disabled ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.28)"),
                  boxShadow:   active ? "0 4px 12px -4px rgba(0,0,0,0.6)" : "none",
                  opacity:     disabled ? 0.7 : 1,
                }}
                aria-pressed={active}
                title={disabled ? `${c.label} · no images yet` : c.label}
              >
                {c.label}
                {disabled ? <span className="ml-1.5 text-[10px] font-normal opacity-70">· soon</span> : null}
                {!disabled && c.image_count ? <span className="ml-1.5 text-[10px] font-normal opacity-80">· {c.image_count}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
