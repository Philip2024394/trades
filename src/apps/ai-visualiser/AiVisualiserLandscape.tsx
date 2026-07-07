// AiVisualiserLandscape — wide tile for the gold-path high-conversion
// slot. Same content as the square, laid out horizontally so the CTA
// sits alongside a bigger hero image.

"use client";

import { Sparkles, Camera, Wand2, ArrowRight } from "lucide-react";
import { Overline, SurfaceCard } from "@/platform/ui";
import type { AiVisualiserTilePropsBase } from "./types";

export type AiVisualiserLandscapeProps = AiVisualiserTilePropsBase;

export function AiVisualiserLandscape({
  scope,
  headlineNoun,
  previewImageUrl,
  onLaunch,
  href,
  preview = false,
  className = ""
}: AiVisualiserLandscapeProps) {
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
      className={`relative grid w-full grid-cols-1 overflow-hidden md:grid-cols-2 ${className}`.trim()}
    >
      <div className="relative min-h-[220px] md:min-h-[300px]">
        {previewImageUrl ? (
          <img
            src={previewImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent md:bg-gradient-to-r md:from-transparent md:via-black/10 md:to-black/40" />
      </div>

      <div className="flex flex-col justify-center gap-4 p-5 md:p-6">
        <Overline icon={Sparkles} tone="amber">
          AI Visualiser
        </Overline>
        <h3 className="text-2xl font-semibold leading-tight text-neutral-900 md:text-3xl">
          See your {noun} before you spend money.
        </h3>
        <p className="text-[15px] leading-relaxed text-neutral-700">
          Snap a photo of your space, pick a style from our catalogue, and
          watch it come to life. Every design is quoted by us — no third
          party, no obligation.
        </p>
        <ul className="grid grid-cols-1 gap-2 text-[13px] text-neutral-700 sm:grid-cols-3">
          <li className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-amber-500" aria-hidden />
            Snap your space
          </li>
          <li className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-amber-500" aria-hidden />
            Choose the look
          </li>
          <li className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" aria-hidden />
            See it — free
          </li>
        </ul>

        <InteractiveEl
          {...(interactiveProps as Record<string, unknown>)}
          className="mt-1 inline-flex min-h-[48px] items-center justify-center gap-2 self-start rounded-lg bg-neutral-900 px-5 text-[14px] font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
          disabled={preview || undefined}
          aria-label={`Try the AI Visualiser — see your ${noun}`}
        >
          Try it — free
          <ArrowRight className="h-4 w-4" aria-hidden />
        </InteractiveEl>
      </div>
    </SurfaceCard>
  );
}
