// BeforeAfterViewer — main viewer + thumbnail rail. Takes an array of
// pairs (up to 4). First pair is the active viewer; the rest render
// as small thumbnails below with orientation badges. Tap a thumbnail
// to promote it to the viewer.

"use client";

import { LayoutTemplate, MoveHorizontal, MoveVertical } from "lucide-react";
import { useState } from "react";
import { useEditModeOptional } from "@/apps/live-edit/EditModeContext";
import type { BeforeAfterPair } from "@/lib/before-after/types";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

function withMerchant(url: string, merchantId: string | null | undefined): string {
  if (!merchantId) return url;
  if (!url.startsWith("/api/image/serve/")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}m=${encodeURIComponent(merchantId)}`;
}

export type BeforeAfterViewerProps = {
  pairs: BeforeAfterPair[];
  heading?: string;
  subhead?: string;
  className?: string;
};

export function BeforeAfterViewer({
  pairs,
  heading,
  subhead,
  className = ""
}: BeforeAfterViewerProps) {
  const [activeId, setActiveId] = useState<string>(pairs[0]?.id ?? "");
  const editCtx = useEditModeOptional();

  if (pairs.length === 0) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 text-center text-neutral-500">
        <div>
          <LayoutTemplate className="mx-auto mb-2 h-6 w-6" />
          <div className="text-[13px] font-semibold">No before/after pairs yet</div>
          <div className="mt-1 text-[11px]">
            In edit mode, tap this section to add your first pair.
          </div>
        </div>
      </div>
    );
  }

  const active = pairs.find((p) => p.id === activeId) ?? pairs[0];

  return (
    <div className={className}>
      {heading ? (
        <div className="mb-4 text-center">
          <h2 className="text-[22px] font-bold text-neutral-900 md:text-[28px]">
            {heading}
          </h2>
          {subhead ? (
            <p className="mx-auto mt-1 max-w-2xl text-[13px] text-neutral-600 md:text-[14px]">
              {subhead}
            </p>
          ) : null}
        </div>
      ) : null}

      <BeforeAfterSlider pair={active} />

      {pairs.length > 1 ? (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
          {pairs.map((p) => {
            const isActive = p.id === active.id;
            const OrientationIcon =
              p.orientation === "vertical" ? MoveVertical : MoveHorizontal;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveId(p.id)}
                className={`group relative shrink-0 overflow-hidden rounded-xl border-2 bg-white text-left transition ${
                  isActive
                    ? "border-amber-400 shadow-sm"
                    : "border-neutral-200 hover:border-neutral-300"
                }`}
                style={{ width: 160 }}
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden">
                  <img
                    src={withMerchant(p.before_url, editCtx?.merchantId)}
                    alt={p.caption ?? "Before/After thumbnail"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white">
                    <OrientationIcon className="h-3 w-3" />
                  </div>
                </div>
                {p.caption ? (
                  <div className="p-1.5 text-[10px] font-medium leading-tight text-neutral-800 line-clamp-2">
                    {p.caption}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
