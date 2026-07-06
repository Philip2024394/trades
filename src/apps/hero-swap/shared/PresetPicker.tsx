// PresetPicker — Full bleed / Framed / Card preset selector. Each
// preset shows a tiny wireframe preview so the merchant can see the
// difference visually.

"use client";

import { HERO_PRESET_ORDER, HERO_PRESETS } from "@/lib/hero-swap/presets";
import type { HeroPreset } from "@/lib/hero-swap/types";

export type PresetPickerProps = {
  current: HeroPreset;
  onChange: (next: HeroPreset) => void;
  suggested?: HeroPreset;
};

function PresetWireframe({ preset }: { preset: HeroPreset }) {
  const spec = HERO_PRESETS[preset];
  if (preset === "full_bleed") {
    return (
      <div className="relative h-12 w-full overflow-hidden rounded-md bg-gradient-to-br from-neutral-400 to-neutral-600">
        <div className="absolute inset-x-1 bottom-1 text-[8px] text-white">
          Text here
        </div>
      </div>
    );
  }
  if (preset === "framed") {
    return (
      <div className="p-1">
        <div className="relative h-10 w-full overflow-hidden rounded-md bg-gradient-to-br from-neutral-400 to-neutral-600">
          <div className="absolute inset-x-1 bottom-1 text-[8px] text-white">
            Text here
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-1 p-1">
      <div className="h-10 w-1/2 rounded-md bg-gradient-to-br from-neutral-400 to-neutral-600" />
      <div className="flex h-10 w-1/2 flex-col justify-center gap-1 rounded-md bg-neutral-900 p-1">
        <div className="h-1 w-3/4 rounded bg-white/70" />
        <div className="h-1 w-1/2 rounded bg-white/50" />
      </div>
    </div>
  );
}

export function PresetPicker({
  current,
  onChange,
  suggested
}: PresetPickerProps) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        Layout
      </div>
      <div className="grid grid-cols-3 gap-2">
        {HERO_PRESET_ORDER.map((p) => {
          const spec = HERO_PRESETS[p];
          const isCurrent = p === current;
          const isSuggested = p === suggested && !isCurrent;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`relative rounded-xl border-2 bg-white p-1.5 text-left transition ${
                isCurrent
                  ? "border-amber-400"
                  : isSuggested
                    ? "border-blue-400 bg-blue-50"
                    : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <PresetWireframe preset={p} />
              <div className="mt-2 px-1">
                <div className="text-[11px] font-semibold text-neutral-900">
                  {spec.label}
                </div>
                <div className="mt-0.5 text-[10px] leading-tight text-neutral-500">
                  {spec.description}
                </div>
              </div>
              {isSuggested ? (
                <div className="absolute right-1 top-1 rounded-full bg-blue-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                  Suggested
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
