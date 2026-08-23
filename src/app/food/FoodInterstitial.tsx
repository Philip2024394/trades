"use client";

// FoodInterstitial · sponsor + category tiles interleaved into the masonry.
// Mirrors /nex-app/centre interstitial pattern.

import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import type { FoodCategory } from "@/lib/nexapp/foodListings";

export type FoodInterstitialTile =
  | {
      kind: "sponsor";
      id: string;
      eyebrow: string;
      headline: string;
      sub: string;
      cta: string;
      href: string;
      accent: "orange" | "neutral";
    }
  | {
      kind: "category";
      id: string;
      emoji: string;
      label: string;
      labelId: string;
      slug: FoodCategory;
    };

export function FoodInterstitial({
  tile,
  onCategorySelect,
}: {
  tile: FoodInterstitialTile;
  onCategorySelect: (slug: FoodCategory) => void;
}) {
  if (tile.kind === "category") {
    return (
      <button
        type="button"
        onClick={() => onCategorySelect(tile.slug)}
        className="group mb-3 flex w-full break-inside-avoid items-center justify-between gap-2 rounded-2xl border border-black/5 bg-white px-3 py-2.5 text-left shadow-sm hover:bg-black/[0.02]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-base leading-none" aria-hidden>
            {tile.emoji}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-semibold text-black">
              {tile.label}
            </span>
            <span className="block text-[10px] text-black/50">{tile.labelId}</span>
          </span>
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-black/30" />
      </button>
    );
  }

  // Sponsor tile
  const orange = tile.accent === "orange";
  return (
    <Link
      href={tile.href}
      className={`relative mb-3 block break-inside-avoid overflow-hidden rounded-2xl border p-3 shadow-sm transition-shadow hover:shadow-md ${
        orange
          ? "border-orange-200 bg-gradient-to-br from-orange-50 to-white"
          : "border-black/5 bg-white"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-white ${
          orange ? "bg-gradient-to-r from-orange-500 to-orange-600" : "bg-black"
        }`}>
          <Sparkles className="h-3 w-3" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <div className={`text-[9px] font-black uppercase tracking-[0.22em] ${
            orange ? "text-orange-600" : "text-black/50"
          }`}>
            {tile.eyebrow}
          </div>
          <p className="mt-0.5 text-[11.5px] font-semibold leading-[1.35] text-black">
            {tile.headline}
          </p>
          <p className="mt-1 text-[10.5px] leading-[1.4] text-black/60">{tile.sub}</p>
          <span className={`mt-2 inline-flex items-center gap-1 text-[10px] font-semibold ${
            orange ? "text-orange-600" : "text-black/70"
          }`}>
            {tile.cta}
            <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}
