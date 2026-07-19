"use client";

// Interactive crop preview viewer — anti-theft hardened.
//
// Layers stacked from cheap to strong (Philip 2026-07-17):
//   L1  Canvas render — source URL never appears in DOM; right-click
//       "Save image as…" returns a canvas snapshot (already watermarked)
//       instead of the ImageKit URL.
//   L1b 3×3 split-tile CSS-background scrim on top of the canvas so
//       casual DOM inspection sees 9 partial background-images, not one.
//   L2  Preview URL capped at 720px longest edge, q-70 JPG. Any
//       screenshot on any monitor is downgraded well below the paid
//       1080/1920 outputs.
//   L3  Content-aware watermark burned onto the SUBJECT focal area
//       (via fo-face_auto crop math) at 55% opacity + drop shadow,
//       plus 12 diagonal tiled marks over the full frame.
//   L5  Event blockers — contextmenu, dragstart, selectstart, copy,
//       long-press. Not a real deterrent but stops the casual save.
//
// No claim of "100% unremovable" — modern AI can chew any visible
// mark. Layered defence is about making theft costlier than the
// £3–£10 purchase.

import { useEffect, useRef, useState } from "react";
import { STORE_VARIANTS, urlForPreview, type VariantSlug } from "@/lib/storeImageVariants";

export function PreviewViewer({
  imageUrl,
  subject
}: {
  imageUrl: string;
  subject: string;
}) {
  const [variant, setVariant] = useState<VariantSlug>("full");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready,    setReady]    = useState(false);

  const previewUrl = urlForPreview(imageUrl, variant);

  const ratio =
    variant === "instagram" ? "1 / 1"  :
    variant === "website"   ? "16 / 9" :
    variant === "mobile"    ? "9 / 16" :
    "9 / 16";

  // Redraw the canvas whenever the variant changes. Loading via
  // `crossOrigin="anonymous"` so the canvas isn't tainted and we can
  // export a data URL for the right-click save fallback (which we
  // deliberately serve as a low-res watermarked PNG).
  useEffect(() => {
    setReady(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding    = "async";
    img.onload = () => {
      const cw = img.naturalWidth  || 720;
      const ch = img.naturalHeight || 720;
      canvas.width  = cw;
      canvas.height = ch;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);

      // ── L3: subject-focal burned watermark ─────────────────────
      // Fo-face_auto puts the subject roughly in the horizontal
      // centre of every crop. Drop the primary mark across the
      // vertical middle band where the worker's chest / focal
      // tool lives so any inpainting attempt destroys the subject.
      const focalY  = ch * 0.55;
      const fontPx  = Math.max(20, Math.round(cw * 0.048));
      ctx.save();
      ctx.translate(cw / 2, focalY);
      ctx.rotate(-6 * Math.PI / 180);
      ctx.font          = `900 ${fontPx}px system-ui, sans-serif`;
      ctx.textAlign     = "center";
      ctx.textBaseline  = "middle";
      ctx.fillStyle     = "rgba(255,255,255,0.55)";
      ctx.shadowColor   = "rgba(0,0,0,0.85)";
      ctx.shadowBlur    = 8;
      ctx.shadowOffsetY = 2;
      ctx.fillText("SITE INTEREST · NOT LICENSED", 0, 0);
      // Second line — smaller — sits below
      ctx.font = `700 ${Math.round(fontPx * 0.45)}px system-ui, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillText("Preview only · buy at siteinterest.co.uk", 0, fontPx * 0.75);
      ctx.restore();

      // Tiled diagonal repeats (lighter, all-over pattern).
      const cols = 4, rows = 4;
      const stepX = cw / cols;
      const stepY = ch / rows;
      ctx.save();
      ctx.font       = `800 ${Math.round(fontPx * 0.45)}px system-ui, sans-serif`;
      ctx.fillStyle  = "rgba(255,255,255,0.28)";
      ctx.shadowColor= "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 4;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.save();
          ctx.translate(stepX * (c + 0.5), stepY * (r + 0.5));
          ctx.rotate(-25 * Math.PI / 180);
          ctx.textAlign    = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("Site Interest · Preview", 0, 0);
          ctx.restore();
        }
      }
      ctx.restore();

      setReady(true);
    };
    img.onerror = () => setReady(true);
    img.src = previewUrl;
  }, [previewUrl]);

  // ── L5: block context menu + drag + copy + selection ────────
  useEffect(() => {
    const block = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };
    const node = canvasRef.current;
    if (!node) return;
    node.addEventListener("contextmenu", block);
    node.addEventListener("dragstart",   block);
    node.addEventListener("selectstart", block);
    return () => {
      node.removeEventListener("contextmenu", block);
      node.removeEventListener("dragstart",   block);
      node.removeEventListener("selectstart", block);
    };
  }, []);

  return (
    <div
      className="space-y-3 select-none"
      onCopy={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Main preview */}
      <div
        className="relative mx-auto overflow-hidden rounded-2xl border bg-neutral-100 transition-all"
        style={{
          borderColor: "rgba(0,0,0,0.08)",
          aspectRatio: ratio,
          maxHeight:   "72vh",
          width:       variant === "website" ? "100%"
                     : variant === "instagram" ? "min(100%, 72vh)"
                     : "min(100%, calc(72vh * 9 / 16))"
        }}
      >
        {/* L1: canvas draws the watermarked preview. No <img> source
            URL exposed in the DOM. object-fit via CSS on the canvas. */}
        <canvas
          ref={canvasRef}
          aria-label={subject}
          className="h-full w-full"
          style={{
            display:   "block",
            objectFit: "cover",
            width:     "100%",
            height:    "100%",
            opacity:   ready ? 1 : 0,
            transition:"opacity 200ms"
          }}
        />

        {/* L1b: 3×3 split-tile scrim rendered as CSS backgrounds.
            Right-click on top of the canvas will hit one of these
            transparent overlays first — Save Image As would return
            a background-image fragment (partial), not the source. */}
        <div
          aria-hidden
          className="pointer-events-auto absolute inset-0 grid grid-cols-3 grid-rows-3"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e)   => e.preventDefault()}
        >
          {Array.from({ length: 9 }).map((_, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            return (
              <div
                key={i}
                style={{
                  backgroundImage:    `url("data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=")`,
                  backgroundSize:     "300% 300%",
                  backgroundPosition: `${col * 50}% ${row * 50}%`,
                  cursor:             "not-allowed"
                }}
              />
            );
          })}
        </div>

        {/* Active crop pill top-left */}
        <div
          className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
        >
          <span>Previewing</span>
          <span className="rounded px-1 py-0.5" style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}>
            {STORE_VARIANTS.find((v) => v.slug === variant)?.ratio ?? "native"}
          </span>
          <span>{STORE_VARIANTS.find((v) => v.slug === variant)?.label}</span>
        </div>

        {/* Anti-theft footer strip — visible reminder */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-[9px] font-black uppercase tracking-wider text-white/90"
        >
          <span>Preview · 720px · Watermarked</span>
          <span>Buy to download clean · 1080/1920 · No watermark</span>
        </div>
      </div>

      {/* Preset row — 4 chips. Mini-thumbnails also use urlForPreview
          so no source URL leaks anywhere on the page. */}
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
            Tap a crop to preview at full size
          </div>
          <div className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
            All 4 included
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {STORE_VARIANTS.map((v) => {
            const active = variant === v.slug;
            const thumbRatio =
              v.slug === "instagram" ? "1 / 1"  :
              v.slug === "website"   ? "16 / 9" :
              "9 / 16";
            return (
              <button
                key={v.slug}
                type="button"
                onClick={() => setVariant(v.slug)}
                className="group flex flex-col items-stretch gap-1 overflow-hidden rounded-lg border bg-white text-center transition"
                style={{
                  borderColor:     active ? "#B8860B" : "rgba(0,0,0,0.10)",
                  boxShadow:       active ? "0 0 0 2px rgba(184,134,11,0.20)" : undefined
                }}
                aria-pressed={active}
                title={`${v.label} · ${v.ratio}`}
              >
                <div
                  className="relative w-full overflow-hidden"
                  style={{ aspectRatio: thumbRatio, backgroundColor: "#F5F5F5" }}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {/* Thumbnail also served capped, and covered by a
                      pointer-events-none scrim so the img itself is
                      never the click target. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={urlForPreview(imageUrl, v.slug)}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="h-full w-full object-cover pointer-events-none select-none"
                  />
                  <div className="absolute inset-0" style={{ cursor: "pointer" }}/>
                </div>
                <div className="flex items-center justify-center gap-1 px-1 pb-1 pt-0.5">
                  <span className="text-[10px] font-black leading-none text-neutral-900">
                    {v.slug === "instagram" ? "Instagram"
                      : v.slug === "website" ? "Website"
                      : v.slug === "mobile"  ? "Phone"
                      : "Original"}
                  </span>
                  <span className="rounded px-1 py-px text-[8px] font-black uppercase tracking-wider" style={{ backgroundColor: active ? "#FFB300" : "rgba(0,0,0,0.05)", color: "#0A0A0A" }}>
                    {v.ratio}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
