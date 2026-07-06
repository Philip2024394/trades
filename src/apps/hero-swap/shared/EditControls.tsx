// EditControls — clamped sliders for the merchant's per-image edits.
// All values are pre-clamped to safe ranges — the merchant literally
// cannot push them further. Suggestion engine handles cases where
// even clamped values reach thresholds (like max vignette).

"use client";

import type { HeroEdits } from "@/lib/hero-swap/types";

export type EditControlsProps = {
  edits: HeroEdits;
  onChange: <K extends keyof HeroEdits>(field: K, value: HeroEdits[K]) => void;
};

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "%",
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label className="text-[11px] font-medium text-neutral-700">
          {label}
        </label>
        <span className="text-[11px] tabular-nums text-neutral-600">
          {value > 0 ? "+" : ""}
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.currentTarget.value))}
        className="w-full accent-neutral-900"
      />
    </div>
  );
}

export function EditControls({ edits, onChange }: EditControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        Fine tune
      </div>
      <Slider
        label="Brightness"
        value={edits.brightness}
        min={-20}
        max={20}
        onChange={(v) => onChange("brightness", v)}
      />
      <Slider
        label="Warmth"
        value={edits.warmth}
        min={-30}
        max={30}
        onChange={(v) => onChange("warmth", v)}
      />
      <Slider
        label="Vignette"
        value={edits.vignette}
        min={0}
        max={40}
        onChange={(v) => onChange("vignette", v)}
      />
      <div className="rounded-md bg-neutral-50 px-2 py-1.5 text-[10px] text-neutral-600">
        All edits stay within safe ranges — your hero can never look broken.
      </div>
    </div>
  );
}
