// Reusable "add to favourites" heart button.
// Drop on any surface — product cards, merchant hero, trade profile,
// job postings. Uses localStorage-backed `toggleFavourite`.

"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import {
  isFavourite,
  toggleFavourite,
  type FavouriteKind
} from "../data/favourites";

type Props = {
  kind: FavouriteKind;
  targetSlug: string;
  /** Compact = icon-only pill; full = pill with "Save" label */
  variant?: "icon" | "labelled" | "hero-overlay";
  ariaLabel?: string;
};

export function FavouriteButton({
  kind,
  targetSlug,
  variant = "icon",
  ariaLabel
}: Props) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isFavourite(kind, targetSlug));
  }, [kind, targetSlug]);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = toggleFavourite(kind, targetSlug);
    setSaved(next);
  }

  if (variant === "hero-overlay") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={ariaLabel ?? (saved ? "Remove from favourites" : "Save to favourites")}
        className="flex h-10 w-10 items-center justify-center rounded-full shadow-md backdrop-blur"
        style={{
          backgroundColor: saved ? "rgba(220,38,38,0.95)" : "rgba(255,255,255,0.90)",
          color: saved ? "#FFFFFF" : "#0A0A0A"
        }}
      >
        <Heart size={16} strokeWidth={2.2} fill={saved ? "#FFFFFF" : "none"}/>
      </button>
    );
  }

  if (variant === "labelled") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-[11px] font-black uppercase tracking-wider transition"
        style={{
          borderColor: saved ? "#DC2626" : "rgba(139,69,19,0.15)",
          backgroundColor: saved ? "#FEE2E2" : "#FFFFFF",
          color: saved ? "#B91C1C" : "#0A0A0A"
        }}
      >
        <Heart size={12} strokeWidth={2.2} fill={saved ? "#DC2626" : "none"}/>
        {saved ? "Saved" : "Save"}
      </button>
    );
  }

  // Default: compact icon button
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={ariaLabel ?? (saved ? "Remove from favourites" : "Save to favourites")}
      className="flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-sm transition"
      style={{
        borderColor: saved ? "#DC2626" : "rgba(139,69,19,0.15)",
        color: saved ? "#DC2626" : "#525252"
      }}
    >
      <Heart size={14} strokeWidth={2.2} fill={saved ? "#DC2626" : "none"}/>
    </button>
  );
}
