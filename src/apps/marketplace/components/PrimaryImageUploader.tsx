// Primary product image uploader — enforces the "clean background" rule
// on the ONE image that appears on category grids + PDP hero. Runs
// @imgly/background-removal client-side, then shows the merchant a
// side-by-side preview so they choose which to keep.
//
// Merchant flow:
//   1. Drop / pick a photo
//   2. Trade Center runs the naive corner-sample heuristic
//        - Already clean? → passes through unchanged, no model needed
//        - Cluttered?     → runs @imgly (loads ~28MB model once, cached)
//   3. Preview: [Original] | [Cleaned] side-by-side
//   4. Merchant taps [Use cleaned] (default) or [Keep original]
//   5. Save → transparent PNG stored, merchant returns to product edit
//
// This is a demo component using localStorage for persistence — the same
// public API works when swapped to real storage (S3 / ImageKit / R2).

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Loader2,
  Info,
  Package
} from "lucide-react";
import {
  removeImageBackground,
  releaseResult,
  type RemovalResult
} from "../lib/backgroundRemoval";

type SavedImage = {
  slug: string;
  cleanedDataUrl: string;
  originalDataUrl: string;
  keptOriginal: boolean;
  savedAtIso: string;
};

const STORAGE_KEY = "tc.primary-images.demo";

function loadSaved(): Record<string, SavedImage> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

type Props = {
  productSlug: string;
  productName: string;
  currentImageUrl?: string;
};

export function PrimaryImageUploader({
  productSlug,
  productName,
  currentImageUrl
}: Props) {
  const [phase, setPhase] = useState<"idle" | "processing" | "review" | "saved">("idle");
  const [result, setResult] = useState<RemovalResult | null>(null);
  const [choice, setChoice] = useState<"cleaned" | "original">("cleaned");
  const [error, setError] = useState<string | null>(null);
  const [savedForThis, setSavedForThis] = useState<SavedImage | null>(null);
  const dropRef = useRef<HTMLLabelElement | null>(null);

  useEffect(() => {
    const map = loadSaved();
    setSavedForThis(map[productSlug] ?? null);
  }, [productSlug]);

  // Clean up object URLs on unmount / new upload
  useEffect(() => {
    return () => {
      if (result) releaseResult(result);
    };
  }, [result]);

  async function handleFile(file: File) {
    setError(null);
    setPhase("processing");
    if (result) releaseResult(result);

    try {
      const r = await removeImageBackground(file);
      setResult(r);
      setChoice(r.detectedNeedsClean ? "cleaned" : "original");
      setPhase("review");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setPhase("idle");
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  const onDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
  }, []);

  async function save() {
    if (!result) return;
    const kept = choice === "original";
    const chosen = kept ? result.originalBlob : result.cleanedBlob;
    const cleanedDataUrl = await blobToDataUrl(chosen);
    const originalDataUrl = await blobToDataUrl(result.originalBlob);
    const saved: SavedImage = {
      slug: productSlug,
      cleanedDataUrl,
      originalDataUrl,
      keptOriginal: kept,
      savedAtIso: new Date().toISOString()
    };
    const map = loadSaved();
    map[productSlug] = saved;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    setSavedForThis(saved);
    setPhase("saved");
  }

  function resetAll() {
    if (result) releaseResult(result);
    setResult(null);
    setPhase("idle");
  }

  const perfLabel = useMemo(() => {
    if (!result) return null;
    return result.detectedNeedsClean
      ? `Auto-cleaned in ${(result.processingMs / 1000).toFixed(1)}s`
      : `Background already clean (${Math.round(result.processingMs)}ms detection)`;
  }, [result]);

  return (
    <section
      className="rounded-2xl border bg-white p-4 shadow-sm md:p-5"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Primary product image
          </div>
          <h2 className="mt-0.5 text-[15px] font-black text-neutral-900">
            {productName}
          </h2>
        </div>
        <p className="text-[10.5px] text-neutral-500">
          This is the image shown on category grids + PDP hero. Additional gallery images have no restrictions.
        </p>
      </header>

      {/* Current on-file image, if any */}
      {(savedForThis || currentImageUrl) && phase === "idle" && (
        <div
          className="mt-4 flex items-center gap-4 rounded-lg border p-3"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div
            className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg"
            style={{ backgroundColor: "#F5F0E4" }}
          >
            {(savedForThis?.cleanedDataUrl || currentImageUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={savedForThis?.cleanedDataUrl ?? currentImageUrl}
                alt=""
                className="h-full w-full object-contain p-1"
              />
            ) : (
              <Package size={20} strokeWidth={1.5} className="text-neutral-400"/>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-black text-neutral-800">
              Current image on file
            </div>
            <div className="mt-0.5 text-[10.5px] text-neutral-500">
              {savedForThis
                ? `Saved ${new Date(savedForThis.savedAtIso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} — ${savedForThis.keptOriginal ? "original kept" : "auto-cleaned"}`
                : "From the merchant catalogue"}
            </div>
          </div>
        </div>
      )}

      {/* Uploader */}
      {phase === "idle" && (
        <div className="mt-4">
          <label
            ref={dropRef}
            htmlFor={`file-${productSlug}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-neutral-50 p-6 text-center hover:bg-neutral-100"
            style={{ borderColor: "rgba(139,69,19,0.25)" }}
          >
            <Upload size={26} className="text-neutral-500" strokeWidth={1.8}/>
            <div className="text-[12.5px] font-black text-neutral-900">
              Drop a photo or tap to browse
            </div>
            <div className="text-[10.5px] leading-snug text-neutral-500">
              JPG or PNG · up to 8MB · we'll auto-clean the background if needed
            </div>
            <input
              id={`file-${productSlug}`}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileInput}
            />
          </label>
          {error && (
            <div className="mt-2 rounded-md bg-red-50 p-2 text-[11px] text-red-700">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Processing */}
      {phase === "processing" && (
        <div
          className="mt-4 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8"
          style={{ borderColor: "rgba(139,69,19,0.25)" }}
        >
          <Loader2 size={26} className="animate-spin text-neutral-600"/>
          <div className="text-[12.5px] font-black text-neutral-900">
            Cleaning up your image
          </div>
          <div className="text-[10.5px] leading-snug text-neutral-500 max-w-xs text-center">
            First run downloads the model (~28MB), later uploads are instant.
          </div>
        </div>
      )}

      {/* Review */}
      {phase === "review" && result && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <ReviewPane
              label="Original"
              url={result.originalUrl}
              selected={choice === "original"}
              onSelect={() => setChoice("original")}
            />
            <ReviewPane
              label="Cleaned"
              url={result.cleanedUrl}
              selected={choice === "cleaned"}
              onSelect={() => setChoice("cleaned")}
              badge={result.detectedNeedsClean ? "Auto-processed" : "Already clean"}
            />
          </div>
          {perfLabel && (
            <div className="flex items-center gap-1.5 text-[10.5px] text-neutral-500">
              <Sparkles size={11}/>
              {perfLabel}
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-full border bg-white px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-700 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <RotateCcw size={12}/>
              Try another
            </button>
            <button
              type="button"
              onClick={save}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-6 text-[12px] font-black uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: "#166534" }}
            >
              <CheckCircle2 size={13}/>
              Save {choice === "cleaned" ? "cleaned" : "original"}
            </button>
          </div>
        </div>
      )}

      {/* Saved */}
      {phase === "saved" && savedForThis && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border p-4" style={{ borderColor: "rgba(22,101,52,0.35)", backgroundColor: "#F0FDF4" }}>
          <div className="flex items-center gap-2 text-[12.5px] font-black text-neutral-900">
            <CheckCircle2 size={14} className="text-[#166534]"/>
            Saved — this image is now live on the category grid + PDP hero
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg"
              style={{ backgroundColor: "#F5F0E4" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={savedForThis.cleanedDataUrl} alt="" className="h-full w-full object-contain p-1"/>
            </div>
            <div className="text-[11px] leading-snug text-neutral-700">
              {savedForThis.keptOriginal ? (
                <>Original preserved — no auto-cleaning applied.</>
              ) : (
                <>Cleaned to transparent PNG. Renders naturally on cream cards, white PDP surfaces, and any future dark-mode variant.</>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-full border bg-white px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-700 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              Replace image
            </button>
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="mt-4 flex items-start gap-2 rounded-md bg-neutral-50 p-3">
        <Info size={13} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
        <p className="text-[10.5px] leading-snug text-neutral-600">
          Trade Center processes the primary image so category grids look consistent. Additional
          gallery images, your merchant profile banner, and any lifestyle photos have no
          background restrictions — those are yours to express brand.
        </p>
      </div>
    </section>
  );
}

function ReviewPane({
  label,
  url,
  selected,
  onSelect,
  badge
}: {
  label: string;
  url: string;
  selected: boolean;
  onSelect: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="group relative flex flex-col overflow-hidden rounded-xl border-2 bg-white text-left shadow-sm transition"
      style={{
        borderColor: selected ? "#166534" : "rgba(139,69,19,0.15)"
      }}
    >
      <div
        className="relative aspect-square w-full overflow-hidden"
        style={{
          backgroundColor: "#F5F0E4",
          backgroundImage:
            "linear-gradient(45deg, #E8E1D0 25%, transparent 25%, transparent 75%, #E8E1D0 75%), linear-gradient(45deg, #E8E1D0 25%, transparent 25%, transparent 75%, #E8E1D0 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 8px 8px"
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="absolute inset-0 h-full w-full object-contain p-3"/>
        {selected && (
          <span
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full shadow-md"
            style={{ backgroundColor: "#166534" }}
          >
            <CheckCircle2 size={13} className="text-white" strokeWidth={2.5}/>
          </span>
        )}
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11.5px] font-black uppercase tracking-wider text-neutral-800">
          {label}
        </span>
        {badge && (
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
            style={{ backgroundColor: "#FEF3C7", color: "#78350F" }}
          >
            {badge}
          </span>
        )}
      </div>
    </button>
  );
}
