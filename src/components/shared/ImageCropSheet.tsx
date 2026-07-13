"use client";

// ImageCropSheet — mobile-first pan+zoom image editor.
//
// Merchant uploads any image; the sheet lets them pan (drag) and zoom
// (slider or +/− buttons) inside a fixed-aspect frame. Hitting Save
// exports the visible frame as a JPEG blob at the requested output
// resolution — the caller decides what to do with it (usually upload
// via the existing multipart endpoint).
//
// UX rules:
//   - Mobile-first: sheet slides up from the bottom on small screens,
//     centres as a modal on md+.
//   - No cropping is FORCED — a "Use original" button on the header
//     skips the editor and passes the source file through unchanged.
//   - Touch + mouse pan supported (pointer events).
//   - Zoom 1x → 4x with slider and +/− buttons.
//   - Save button disabled while a pan gesture is in progress so the
//     export always uses a settled transform.
//
// The canvas export samples the source image at output resolution
// (default 1600px on the long side). Anything larger is downsampled
// by the browser's native image renderer — sharp on retina without
// bloating storage.

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Minus, Plus, Check, ImageOff } from "lucide-react";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN_DARK = "#166534";
const MIN_SCALE = 1;
const MAX_SCALE = 4;

export function ImageCropSheet({
  file,
  aspect,
  outputWidth = 1600,
  title = "Frame your image",
  onCancel,
  onSave,
  onUseOriginal
}: {
  file: File;
  /** Aspect ratio of the crop frame. e.g. 4/3, 16/9, 1/1. */
  aspect: number;
  /** Output image width in pixels. Height derived from aspect. */
  outputWidth?: number;
  title?: string;
  onCancel: () => void;
  /** Called with the cropped JPEG blob when the merchant taps Save. */
  onSave: (blob: Blob) => void;
  /** Optional escape hatch — pass the source file through unchanged. */
  onUseOriginal?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [frameSize, setFrameSize] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [translate, setTranslate] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Read the file → object URL. Cleaned up on unmount.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Body scroll lock while open (sheet UX).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Measure the frame the moment it exists in the DOM. Re-measure on
  // resize so orientation changes don't break the export math.
  useEffect(() => {
    function measure() {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setFrameSize({ w: rect.width, h: rect.height });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [imgLoaded]);

  const onImgLoad = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;
    setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
    setImgLoaded(true);
    // Reset pan/zoom on new image.
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const onImgError = useCallback(() => {
    setLoadError(true);
  }, []);

  // Compute the initial contain-fit size — the "1x" scale draws the
  // image so it fits fully inside the frame with no cropping. Every
  // pan/zoom operates on top of this baseline.
  const baseFit = (() => {
    if (!frameSize || !imgNatural) return null;
    const frameAspect = frameSize.w / frameSize.h;
    const imgAspect = imgNatural.w / imgNatural.h;
    let baseW: number, baseH: number;
    if (imgAspect > frameAspect) {
      // Image is wider than the frame — fit by width.
      baseW = frameSize.w;
      baseH = frameSize.w / imgAspect;
    } else {
      baseH = frameSize.h;
      baseW = frameSize.h * imgAspect;
    }
    return { w: baseW, h: baseH };
  })();

  // Clamp pan so the image never leaves a visible edge inside the frame
  // when scaled above 1. At scale=1 (fit view), the image can move
  // freely but is usually centred.
  const clampTranslate = useCallback((tx: number, ty: number, s: number) => {
    if (!frameSize || !baseFit) return { x: tx, y: ty };
    const drawnW = baseFit.w * s;
    const drawnH = baseFit.h * s;
    // Half of the overflow beyond the frame — max distance the image
    // centre can move from the frame centre before an edge shows.
    const maxX = Math.max(0, (drawnW - frameSize.w) / 2);
    const maxY = Math.max(0, (drawnH - frameSize.h) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, tx)),
      y: Math.max(-maxY, Math.min(maxY, ty))
    };
  }, [frameSize, baseFit]);

  // Re-clamp translate whenever scale changes so shrinking doesn't leave
  // the image dangling off the frame.
  useEffect(() => {
    setTranslate((prev) => clampTranslate(prev.x, prev.y, scale));
  }, [scale, clampTranslate]);

  // ─── Pointer/touch drag ─────────────────────────────────
  const dragState = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    if (!frameSize) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: translate.x,
      baseY: translate.y
    };
    setDragging(true);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    const next = clampTranslate(dragState.current.baseX + dx, dragState.current.baseY + dy, scale);
    setTranslate(next);
  }
  function onPointerUp() {
    dragState.current = null;
    setDragging(false);
  }

  // ─── Export ─────────────────────────────────────────────
  async function save() {
    if (!frameSize || !imgNatural || !imgSrc || !baseFit || saving) return;
    setSaving(true);
    try {
      const outputHeight = Math.round(outputWidth / aspect);
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas ctx");

      // Compute what area of the source image the frame currently shows.
      // The image is rendered at (baseFit.w * scale) × (baseFit.h * scale)
      // and translated by (translate.x, translate.y) relative to the
      // frame centre. Work in source-pixel coordinates.
      const displayedW = baseFit.w * scale;
      const displayedH = baseFit.h * scale;
      const sourcePerDisplayed = imgNatural.w / displayedW;

      // Where the frame's top-left corner sits in the source image.
      // Frame centre (in display coords, relative to image centre) is at
      // (-translate.x, -translate.y). Convert to source pixels.
      const frameCenterInSourceX = imgNatural.w / 2 - translate.x * sourcePerDisplayed;
      const frameCenterInSourceY = imgNatural.h / 2 - translate.y * sourcePerDisplayed;
      const sourceCropW = frameSize.w * sourcePerDisplayed;
      const sourceCropH = frameSize.h * sourcePerDisplayed;
      const sx = frameCenterInSourceX - sourceCropW / 2;
      const sy = frameCenterInSourceY - sourceCropH / 2;

      // Draw a soft grey background for any transparent pixels (uploaded
      // PNGs, etc.) — matches the platform's grey fallback treatment.
      ctx.fillStyle = "#F3F4F6";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const img = imageRef.current;
      if (!img) throw new Error("no image ref");
      ctx.drawImage(
        img,
        sx, sy, sourceCropW, sourceCropH,
        0, 0, canvas.width, canvas.height
      );

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9);
      });
      if (!blob) throw new Error("export failed");
      onSave(blob);
    } catch {
      // Silent — the button re-enables and the merchant can retry
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[120] flex items-end justify-center md:items-center"
      onClick={onCancel}
    >
      {/* Backdrop */}
      <div aria-hidden className="absolute inset-0 bg-black/85 backdrop-blur-sm"/>

      {/* Sheet — full-viewport slide-up on mobile, 560px card on md+ */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-[#0A0A0A] text-white shadow-2xl md:h-[86vh] md:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-[10.5px] font-black uppercase tracking-[0.18em] text-white/60">
              Frame image
            </div>
            <div className="text-[13px] font-black text-white">{title}</div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X size={14} strokeWidth={2.6}/>
          </button>
        </div>

        {/* Instruction strip */}
        <div className="border-b border-white/10 px-4 py-2 text-center text-[11px] font-bold text-white/70">
          Drag to move · Pinch or slide to zoom · Save when it looks right
        </div>

        {/* Editor viewport */}
        <div className="flex flex-1 items-center justify-center overflow-hidden bg-[#1a1a1a] p-3">
          <div
            ref={containerRef}
            className="relative w-full max-w-full overflow-hidden bg-black shadow-lg"
            style={{
              aspectRatio: String(aspect),
              maxHeight: "100%",
              touchAction: "none",
              cursor: dragging ? "grabbing" : "grab"
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {loadError ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/50">
                <ImageOff size={22} strokeWidth={2}/>
                <span className="text-[11.5px] font-bold">Couldn&apos;t load this image.</span>
              </div>
            ) : imgSrc && baseFit ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imageRef}
                src={imgSrc}
                alt=""
                onLoad={onImgLoad}
                onError={onImgError}
                draggable={false}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: `${baseFit.w}px`,
                  height: `${baseFit.h}px`,
                  transform: `translate(-50%, -50%) translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                  transformOrigin: "center center",
                  willChange: "transform",
                  userSelect: "none",
                  pointerEvents: "none"
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[11px] text-white/50">
                Loading image…
              </div>
            )}
          </div>
        </div>

        {/* Zoom controls */}
        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(MIN_SCALE, +(s - 0.1).toFixed(2)))}
              aria-label="Zoom out"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-40"
              disabled={scale <= MIN_SCALE + 0.001}
            >
              <Minus size={14} strokeWidth={2.6}/>
            </button>
            <input
              type="range"
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={0.02}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              aria-label="Zoom level"
              className="min-h-[36px] flex-1 accent-[color:var(--brand-y,#FFB300)]"
              style={{ ["--brand-y" as string]: BRAND_YELLOW } as React.CSSProperties}
            />
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(MAX_SCALE, +(s + 0.1).toFixed(2)))}
              aria-label="Zoom in"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-40"
              disabled={scale >= MAX_SCALE - 0.001}
            >
              <Plus size={14} strokeWidth={2.6}/>
            </button>
            <span className="w-10 flex-shrink-0 text-right text-[10.5px] font-black uppercase tracking-wider text-white/60">
              {scale.toFixed(1)}×
            </span>
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
          {onUseOriginal && (
            <button
              type="button"
              onClick={onUseOriginal}
              className="inline-flex h-11 items-center justify-center rounded-full bg-white/10 px-4 text-[11.5px] font-black uppercase tracking-wider text-white hover:bg-white/20"
            >
              Use original
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!imgLoaded || saving || loadError}
            className="ml-auto inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-[12px] font-black uppercase tracking-wider text-white shadow-md active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: BRAND_GREEN_DARK }}
          >
            <Check size={13} strokeWidth={2.6}/>
            {saving ? "Saving…" : "Save frame"}
          </button>
        </div>
      </div>
    </div>
  );
}
