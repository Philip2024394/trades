// AiVisualiserPortrait — 3:4 tile for sidebar / product-page slots.

"use client";

import { Sparkles, Camera, Wand2 } from "lucide-react";
import { Overline, SurfaceCard } from "@/platform/ui";
import type { AiVisualiserTilePropsBase } from "./types";

export type AiVisualiserPortraitProps = AiVisualiserTilePropsBase;

export function AiVisualiserPortrait({
  scope,
  headlineNoun,
  previewImageUrl,
  onLaunch,
  href,
  preview = false,
  className = ""
}: AiVisualiserPortraitProps) {
  if (scope.length === 0 && !preview) return null;

  const noun =
    headlineNoun ??
    scope[0]?.display_name.toLowerCase() ??
    "renovation";

  const InteractiveEl: "a" | "button" = href ? "a" : "button";
  const interactiveProps = href
    ? { href }
    : { onClick: preview ? undefined : onLaunch, type: "button" as const };

  return (
    <SurfaceCard
      variant="primary"
      padding="none"
      interactive={!preview}
      className={`relative flex aspect-[3/4] w-full flex-col overflow-hidden ${className}`.trim()}
    >
      <div className="relative h-1/2 w-full">
        {previewImageUrl ? (
          <img
            src={previewImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <Overline icon={Sparkles} tone="amber">
            AI Visualiser
          </Overline>
          <h3 className="mt-2 text-lg font-semibold leading-tight text-neutral-900">
            See your {noun} before you spend money.
          </h3>
          <ul className="mt-3 space-y-1.5 text-[13px] text-neutral-700">
            <li className="flex items-center gap-2">
              <Camera className="h-3.5 w-3.5 text-amber-500" aria-hidden />
              Snap your space
            </li>
            <li className="flex items-center gap-2">
              <Wand2 className="h-3.5 w-3.5 text-amber-500" aria-hidden />
              Pick the look
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" aria-hidden />
              See it — free
            </li>
          </ul>
        </div>

        <InteractiveEl
          {...(interactiveProps as Record<string, unknown>)}
          className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-lg bg-neutral-900 px-4 text-[13px] font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
          disabled={preview || undefined}
          aria-label={`Try the AI Visualiser — see your ${noun}`}
        >
          Try it — free
        </InteractiveEl>
      </div>
    </SurfaceCard>
  );
}
