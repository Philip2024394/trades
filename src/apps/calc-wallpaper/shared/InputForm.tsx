// InputForm — per-scenario fields for the wallpaper calc.

"use client";

import type { ChangeEvent } from "react";
import { RadioGroup, TextInput } from "@/platform/ui";
import type { WallpaperInputs, WallpaperScenario } from "../logic";

export type InputFormDensity = "comfy" | "compact";

export type InputFormProps = {
  scenario: WallpaperScenario;
  inputs: WallpaperInputs;
  onFieldChange: (field: string, value: unknown) => void;
  density?: InputFormDensity;
};

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}

function DimensionField({
  id,
  label,
  value,
  onChange
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <TextInput
      id={id}
      type="number"
      label={label}
      value={String(value)}
      onChange={(e: ChangeEvent<HTMLInputElement>) =>
        onChange(parseFloat(e.currentTarget.value) || 0)
      }
      min={0.1}
      step={0.1}
      suffix={<span className="text-[11px] font-medium text-neutral-500">m</span>}
    />
  );
}

function CountField({
  id,
  label,
  value,
  onChange
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <TextInput
      id={id}
      type="number"
      label={label}
      value={String(value)}
      onChange={(e: ChangeEvent<HTMLInputElement>) =>
        onChange(Math.max(0, parseInt(e.currentTarget.value) || 0))
      }
      min={0}
      step={1}
    />
  );
}

function PatternPicker({
  value,
  onChange
}: {
  value: "plain_or_small" | "large_repeat";
  onChange: (v: "plain_or_small" | "large_repeat") => void;
}) {
  return (
    <RadioGroup
      id="pattern"
      name="pattern"
      label="Pattern type"
      variant="cards"
      value={value}
      onChange={(v) => onChange(v as "plain_or_small" | "large_repeat")}
      options={[
        {
          value: "plain_or_small",
          label: "Plain / small pattern",
          description: "≤ 8 cm repeat · 4.5 m² usable per roll"
        },
        {
          value: "large_repeat",
          label: "Large-repeat pattern",
          description: "> 8 cm repeat · 3.5 m² usable · match waste"
        }
      ]}
    />
  );
}

export function InputForm({
  scenario,
  inputs,
  onFieldChange,
  density = "comfy"
}: InputFormProps) {
  const dim2Col =
    density === "comfy" ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-2";
  const stackCls =
    density === "comfy" ? "flex flex-col gap-3" : "flex flex-col gap-2";

  switch (scenario) {
    case "feature_wall": {
      const i = inputs as Extract<WallpaperInputs, { scenario: "feature_wall" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="wall_length_m"
              label="Wall length"
              value={num(i.wall_length_m, 4)}
              onChange={(v) => onFieldChange("wall_length_m", v)}
            />
            <DimensionField
              id="wall_height_m"
              label="Wall height"
              value={num(i.wall_height_m, 2.4)}
              onChange={(v) => onFieldChange("wall_height_m", v)}
            />
          </div>
          <PatternPicker
            value={i.pattern}
            onChange={(v) => onFieldChange("pattern", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Standard UK roll: 10.05 × 0.52 m = 5.2 m² raw. Plain roll
            hangs ~4.5 m² usable, large-repeat ~3.5 m² after pattern
            match. Always order 1 extra roll from the same batch.
          </div>
        </div>
      );
    }
    case "whole_room": {
      const i = inputs as Extract<WallpaperInputs, { scenario: "whole_room" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Room length"
              value={num(i.length_m, 4)}
              onChange={(v) => onFieldChange("length_m", v)}
            />
            <DimensionField
              id="width_m"
              label="Room width"
              value={num(i.width_m, 3)}
              onChange={(v) => onFieldChange("width_m", v)}
            />
            <DimensionField
              id="height_m"
              label="Room height"
              value={num(i.height_m, 2.4)}
              onChange={(v) => onFieldChange("height_m", v)}
            />
          </div>
          <div className={dim2Col}>
            <CountField
              id="doors"
              label="Doors"
              value={num(i.doors, 1)}
              onChange={(v) => onFieldChange("doors", v)}
            />
            <CountField
              id="windows"
              label="Windows"
              value={num(i.windows, 1)}
              onChange={(v) => onFieldChange("windows", v)}
            />
          </div>
          <PatternPicker
            value={i.pattern}
            onChange={(v) => onFieldChange("pattern", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Deducts 1.7 m² per door and 1.4 m² per window. Radiators
            not deducted — cost of matching pattern behind them isn't
            worth the m² saving. Always order 1 extra roll (same batch).
          </div>
        </div>
      );
    }
    case "stairwell": {
      const i = inputs as Extract<WallpaperInputs, { scenario: "stairwell" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="tallest_wall_height_m"
              label="Tallest wall height"
              value={num(i.tallest_wall_height_m, 5)}
              onChange={(v) => onFieldChange("tallest_wall_height_m", v)}
            />
            <DimensionField
              id="stair_run_m"
              label="Stair run (horizontal)"
              value={num(i.stair_run_m, 4)}
              onChange={(v) => onFieldChange("stair_run_m", v)}
            />
          </div>
          <PatternPicker
            value={i.pattern}
            onChange={(v) => onFieldChange("pattern", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Stairwell walls are trapezoidal — this estimator averages
            the tallest height with the lower first-floor edge (~1 m).
            Get a decorator to verify with a laser level for tricky
            galleried voids.
          </div>
        </div>
      );
    }
  }
}
