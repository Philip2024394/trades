// SuggestionChip — the "guided guardrails" advisor. When the platform
// evaluates the current hero slot and finds a better layout for the
// merchant's chosen image + edits, this chip appears with a one-line
// reason + a one-tap Apply button.
//
// Merchant is never blocked. They can always dismiss.

"use client";

import { Lightbulb, X } from "lucide-react";
import { HERO_PRESETS } from "@/lib/hero-swap/presets";
import type { HeroSuggestion } from "@/lib/hero-swap/types";

export type SuggestionChipProps = {
  suggestion: HeroSuggestion;
  onApply: () => void;
  onDismiss: () => void;
};

export function SuggestionChip({
  suggestion,
  onApply,
  onDismiss
}: SuggestionChipProps) {
  const suggestedLabel = suggestion.suggest_preset
    ? HERO_PRESETS[suggestion.suggest_preset].label
    : "";

  return (
    <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
      <Lightbulb className="h-4 w-4 shrink-0 text-blue-600" />
      <div className="min-w-0 flex-1 text-[11px] leading-snug text-blue-900">
        {suggestion.reason}
        {suggestedLabel ? (
          <span className="font-semibold"> Try {suggestedLabel}.</span>
        ) : null}
      </div>
      {suggestion.suggest_preset ? (
        <button
          type="button"
          onClick={onApply}
          className="shrink-0 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-blue-700"
        >
          Try it
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss suggestion"
        className="shrink-0 rounded-md p-1 text-blue-600 transition hover:bg-blue-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
