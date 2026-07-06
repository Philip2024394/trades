// CropPreview — 3-aspect crop preview shown after the merchant uploads
// an image. Each preview is a viewport at the target aspect ratio
// with the image rendered via CSS object-position so the merchant can
// drag inside a viewport to reposition the focal point per aspect.
//
// This is what makes uploads actually work on mobile: instead of
// letting the browser awkwardly crop the image, the merchant tells us
// where the important part is per aspect.

"use client";

import { useEffect, useRef, useState } from "react";
import type { AspectRatio, CropFocalPoint } from "@/lib/hero-swap/imageCrop";
import { validateHeroSize } from "@/lib/hero-swap/imageCrop";

export type CropPreviewProps = {
  sourceDataUrl: string;
  focals: Record<AspectRatio, CropFocalPoint>;
  onFocalChange: (aspect: AspectRatio, focal: CropFocalPoint) => void;
};

const ASPECTS: { id: AspectRatio; label: string; className: string }[] = [
  { id: "16:9", label: "Desktop hero", className: "aspect-[16/9]" },
  { id: "1:1", label: "Grid tile", className: "aspect-square" },
  { id: "3:4", label: "Mobile hero", className: "aspect-[3/4]" }
];

function Viewport({
  aspect,
  label,
  aspectClassName,
  sourceDataUrl,
  focal,
  onFocalChange
}: {
  aspect: AspectRatio;
  label: string;
  aspectClassName: string;
  sourceDataUrl: string;
  focal: CropFocalPoint;
  onFocalChange: (focal: CropFocalPoint) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleMove = (clientX: number, clientY: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    onFocalChange({ x, y });
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label} · {aspect}
      </div>
      <div
        ref={ref}
        className={`relative w-full cursor-move overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100 ${aspectClassName}`}
        onMouseDown={(e) => {
          setDragging(true);
          handleMove(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) handleMove(t.clientX, t.clientY);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) handleMove(t.clientX, t.clientY);
        }}
      >
        <img
          src={sourceDataUrl}
          alt={`${aspect} preview`}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: `${focal.x}% ${focal.y}%` }}
          draggable={false}
        />
        {/* Focal point crosshair */}
        <div
          className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
          style={{ left: `${focal.x}%`, top: `${focal.y}%`, backgroundColor: "rgba(255,255,255,0.4)" }}
          aria-hidden
        />
      </div>
    </div>
  );
}

export function CropPreview({
  sourceDataUrl,
  focals,
  onFocalChange
}: CropPreviewProps) {
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setWarning(validateHeroSize(img.naturalWidth, img.naturalHeight));
    };
    img.src = sourceDataUrl;
  }, [sourceDataUrl]);

  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        Where's the important part?
      </div>
      <div className="mb-2 text-[11px] text-neutral-600">
        Drag inside each preview to move the focal point. Your image will
        crop to the right shape on every device.
      </div>
      <div className="grid grid-cols-3 gap-2">
        {ASPECTS.map((a) => (
          <Viewport
            key={a.id}
            aspect={a.id}
            label={a.label}
            aspectClassName={a.className}
            sourceDataUrl={sourceDataUrl}
            focal={focals[a.id]}
            onFocalChange={(next) => onFocalChange(a.id, next)}
          />
        ))}
      </div>
      {warning ? (
        <div className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[10px] text-amber-900">
          {warning}
        </div>
      ) : null}
    </div>
  );
}
