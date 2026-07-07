// AiVisualiserSquare — 1:1 tile for the merchant storefront.
//
// This is the "small square section on each app front page" — an
// opt-in conversion widget that opens the AI Visualiser flow. Copy is
// driven by the merchant's catalogue scope so a kitchen merchant sees
// "See your kitchen…", a driveway merchant sees "See your driveway…"
// with zero configuration.

"use client";

import { Sparkles, Camera, Wand2 } from "lucide-react";
import { Overline, SurfaceCard } from "@/platform/ui";
import type { AiVisualiserTilePropsBase } from "./types";

export type AiVisualiserSquareProps = AiVisualiserTilePropsBase;

export function AiVisualiserSquare({
  scope,
  headlineNoun,
  previewImageUrl,
  onLaunch,
  href,
  preview = false,
  className = ""
}: AiVisualiserSquareProps) {
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
      className={`relative flex aspect-square w-full flex-col overflow-hidden ${className}`.trim()}
    >
      {previewImageUrl ? (
        <div className="absolute inset-0 -z-10">
          <img
            src={previewImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        </div>
      ) : (
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900" />
      )}

      <div className="flex h-full flex-col justify-between p-4 text-white">
        <div>
          <Overline icon={Sparkles} tone="amber">
            AI Visualiser
          </Overline>
          <h3 className="mt-2 text-lg font-semibold leading-tight md:text-xl">
            See your {noun} before you spend money.
          </h3>
          <p className="mt-2 text-[13px] leading-snug text-white/85">
            Upload a photo. Pick a style. Get a life-like render — plus a
            quote from us, no obligation.
          </p>
        </div>

        <div className="mt-3 space-y-2">
          <ul className="space-y-1.5 text-[13px] text-white/90">
            <li className="flex items-center gap-2">
              <Camera className="h-3.5 w-3.5 text-amber-300" aria-hidden />
              Snap your space
            </li>
            <li className="flex items-center gap-2">
              <Wand2 className="h-3.5 w-3.5 text-amber-300" aria-hidden />
              Choose from our catalogue
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden />
              See it — free
            </li>
          </ul>

          <InteractiveEl
            {...(interactiveProps as Record<string, unknown>)}
            className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-lg bg-amber-400 px-4 text-[13px] font-semibold text-neutral-900 transition hover:bg-amber-300 disabled:opacity-60"
            disabled={preview || undefined}
            aria-label={`Try the AI Visualiser — see your ${noun}`}
          >
            Try it — free
          </InteractiveEl>
        </div>
      </div>
    </SurfaceCard>
  );
}
