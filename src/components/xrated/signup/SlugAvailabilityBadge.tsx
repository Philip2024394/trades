"use client";

// Slug availability badge — the visible micro-feedback that flips
// green/red/spinner as the user types their preferred vanity URL.
// Drops into any form that binds to a "slug" text input via the
// useSlugAvailability hook.
//
// Copy is intentionally trades-native — no "the slug you entered is
// unavailable" jargon; just "Taken. Try another." at trade-native
// reading level.

import { useSlugAvailability, SLUG_REJECTION_MESSAGE } from "./useSlugAvailability";
import { CircleCheck, CircleX, Loader2 } from "lucide-react";
import { BRAND_GREEN_DARK } from "@/lib/brand/tokens";

export function SlugAvailabilityBadge({ slug }: { slug: string }) {
  const state = useSlugAvailability(slug);

  if (state.status === "idle") return null;

  if (state.status === "checking") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500">
        <Loader2 size={11} strokeWidth={2.5} className="animate-spin"/>
        Checking
      </span>
    );
  }

  if (state.status === "available") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider"
        style={{ color: BRAND_GREEN_DARK }}
      >
        <CircleCheck size={11} strokeWidth={2.5}/>
        Yours
      </span>
    );
  }

  return (
    <span className="inline-flex items-start gap-1 text-[11px] font-black leading-tight text-red-600">
      <CircleX size={11} strokeWidth={2.5} className="mt-0.5 flex-shrink-0"/>
      <span className="normal-case tracking-normal font-bold">
        {SLUG_REJECTION_MESSAGE[state.reason]}
      </span>
    </span>
  );
}
