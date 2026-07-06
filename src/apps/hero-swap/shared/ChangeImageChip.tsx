// ChangeImageChip — floating chip that lives on top of a hero slot.
// Shows a swap count so the merchant sees at a glance how many
// alternatives are available. Hidden entirely if count is 0 or 1
// (no false promise of "swap" when there's nothing to swap TO).

"use client";

import { RefreshCw } from "lucide-react";

export type ChangeImageChipProps = {
  matchedCount: number;
  onClick: () => void;
};

export function ChangeImageChip({
  matchedCount,
  onClick
}: ChangeImageChipProps) {
  if (matchedCount <= 1) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-4 right-4 z-30 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur transition hover:bg-black/85"
    >
      <RefreshCw className="h-3.5 w-3.5" />
      Change image
      <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px] font-semibold">
        {matchedCount}
      </span>
    </button>
  );
}
