// InputForm — per-scenario gravel/aggregate fields.
//
// UK density lookup embedded in the stone-type picker so tradies know
// what they're pricing. Depth presets per-scenario.

"use client";

import type { ChangeEvent } from "react";
import { Select, TextInput, Toggle } from "@/platform/ui";
import type { GravelInputs, GravelScenario } from "../logic";

export type InputFormDensity = "comfy" | "compact";

export type InputFormProps = {
  scenario: GravelScenario;
  inputs: GravelInputs;
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

const STONE_TYPES = [
  { value: "gravel", label: "20 mm gravel · 1.6 t/m³" },
  { value: "pebbles", label: "Sea / Scottish pebbles · 1.8 t/m³" },
  { value: "cobbles", label: "Cobbles · 1.9 t/m³" },
  { value: "sharp_sand", label: "Sharp sand · 1.6 t/m³" },
  { value: "building_sand", label: "Building sand · 1.5 t/m³" },
  { value: "ballast", label: "Ballast (10 mm) · 1.7 t/m³" }
];

function StoneTypeField({
  value,
  onChange
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select
      id="stone_type"
      label="Stone / aggregate"
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      options={STONE_TYPES}
    />
  );
}

const DEPTH_PRESETS_DRIVEWAY = [
  { value: 40, label: "40 mm — top-up over existing" },
  { value: 50, label: "50 mm (standard driveway)" },
  { value: 75, label: "75 mm — heavy use" },
  { value: 100, label: "100 mm — deep coverage" }
];
const DEPTH_PRESETS_PATH = [
  { value: 25, label: "25 mm — light border finish" },
  { value: 40, label: "40 mm (garden path standard)" },
  { value: 50, label: "50 mm — deeper coverage" }
];
const DEPTH_PRESETS_BORDER = [
  { value: 20, label: "20 mm — thin decorative layer" },
  { value: 25, label: "25 mm (standard decorative depth)" },
  { value: 40, label: "40 mm — deeper cover" }
];
const DEPTH_PRESETS_GENERAL = [
  { value: 25, label: "25 mm" },
  { value: 40, label: "40 mm" },
  { value: 50, label: "50 mm" },
  { value: 75, label: "75 mm" },
  { value: 100, label: "100 mm" }
];

function DepthPresetField({
  value,
  onChange,
  presets
}: {
  value: number;
  onChange: (v: number) => void;
  presets: readonly { value: number; label: string }[];
}) {
  return (
    <Select
      id="depth_mm"
      label="Depth"
      value={String(value)}
      onChange={(e) => onChange(parseInt(e.currentTarget.value, 10) || 25)}
      options={presets.map((p) => ({
        value: String(p.value),
        label: p.label
      }))}
    />
  );
}

export function InputForm({
  scenario,
  inputs,
  onFieldChange,
  density = "comfy"
}: InputFormProps) {
  const dim2Col = density === "comfy" ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-2";
  const stackCls = density === "comfy" ? "flex flex-col gap-3" : "flex flex-col gap-2";

  switch (scenario) {
    case "driveway": {
      const i = inputs as Extract<GravelInputs, { scenario: "driveway" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Length"
              value={num(i.length_m, 8)}
              onChange={(v) => onFieldChange("length_m", v)}
            />
            <DimensionField
              id="width_m"
              label="Width"
              value={num(i.width_m, 3)}
              onChange={(v) => onFieldChange("width_m", v)}
            />
          </div>
          <DepthPresetField
            value={i.depth_mm}
            onChange={(v) => onFieldChange("depth_mm", v)}
            presets={DEPTH_PRESETS_DRIVEWAY}
          />
          <StoneTypeField
            value={i.stone_type}
            onChange={(v) => onFieldChange("stone_type", v)}
          />
          <Toggle
            id="waste_10pct"
            label="Add 10% wastage"
            description="Standard trade over-order for compaction + spillage"
            checked={i.waste_10pct}
            onChange={(v) => onFieldChange("waste_10pct", v)}
          />
        </div>
      );
    }
    case "garden_path": {
      const i = inputs as Extract<GravelInputs, { scenario: "garden_path" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Path length"
              value={num(i.length_m, 6)}
              onChange={(v) => onFieldChange("length_m", v)}
            />
            <DimensionField
              id="width_m"
              label="Path width"
              value={num(i.width_m, 1)}
              onChange={(v) => onFieldChange("width_m", v)}
            />
          </div>
          <DepthPresetField
            value={i.depth_mm}
            onChange={(v) => onFieldChange("depth_mm", v)}
            presets={DEPTH_PRESETS_PATH}
          />
          <StoneTypeField
            value={i.stone_type}
            onChange={(v) => onFieldChange("stone_type", v)}
          />
          <Toggle
            id="waste_10pct"
            label="Add 10% wastage"
            checked={i.waste_10pct}
            onChange={(v) => onFieldChange("waste_10pct", v)}
          />
        </div>
      );
    }
    case "decorative_border": {
      const i = inputs as Extract<
        GravelInputs,
        { scenario: "decorative_border" }
      >;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Border length"
              value={num(i.length_m, 10)}
              onChange={(v) => onFieldChange("length_m", v)}
            />
            <DimensionField
              id="width_m"
              label="Border width"
              value={num(i.width_m, 0.5)}
              onChange={(v) => onFieldChange("width_m", v)}
            />
          </div>
          <DepthPresetField
            value={i.depth_mm}
            onChange={(v) => onFieldChange("depth_mm", v)}
            presets={DEPTH_PRESETS_BORDER}
          />
          <StoneTypeField
            value={i.stone_type}
            onChange={(v) => onFieldChange("stone_type", v)}
          />
          <Toggle
            id="waste_10pct"
            label="Add 10% wastage"
            checked={i.waste_10pct}
            onChange={(v) => onFieldChange("waste_10pct", v)}
          />
        </div>
      );
    }
    case "french_drain": {
      const i = inputs as Extract<GravelInputs, { scenario: "french_drain" }>;
      return (
        <div className={stackCls}>
          <DimensionField
            id="length_m"
            label="Trench length"
            value={num(i.length_m, 8)}
            onChange={(v) => onFieldChange("length_m", v)}
          />
          <div className={dim2Col}>
            <DimensionField
              id="trench_width_m"
              label="Trench width"
              value={num(i.trench_width_m, 0.3)}
              onChange={(v) => onFieldChange("trench_width_m", v)}
            />
            <DimensionField
              id="trench_depth_m"
              label="Trench depth"
              value={num(i.trench_depth_m, 0.4)}
              onChange={(v) => onFieldChange("trench_depth_m", v)}
            />
          </div>
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            French drains use 20-40 mm clean stone (angular gravel) —
            not decorative rounded pebbles. Line the trench with
            weed-membrane before backfilling.
          </div>
          <Toggle
            id="waste_10pct"
            label="Add 10% wastage"
            checked={i.waste_10pct}
            onChange={(v) => onFieldChange("waste_10pct", v)}
          />
        </div>
      );
    }
    case "custom_l_shape": {
      const i = inputs as Extract<
        GravelInputs,
        { scenario: "custom_l_shape" }
      >;
      return (
        <div className={stackCls}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Section A (main area)
          </div>
          <div className={dim2Col}>
            <DimensionField
              id="a_length_m"
              label="Length"
              value={num(i.part_a_length_m, 4)}
              onChange={(v) => onFieldChange("part_a_length_m", v)}
            />
            <DimensionField
              id="a_width_m"
              label="Width"
              value={num(i.part_a_width_m, 3)}
              onChange={(v) => onFieldChange("part_a_width_m", v)}
            />
          </div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Section B (extension / alcove)
          </div>
          <div className={dim2Col}>
            <DimensionField
              id="b_length_m"
              label="Length"
              value={num(i.part_b_length_m, 2)}
              onChange={(v) => onFieldChange("part_b_length_m", v)}
            />
            <DimensionField
              id="b_width_m"
              label="Width"
              value={num(i.part_b_width_m, 1)}
              onChange={(v) => onFieldChange("part_b_width_m", v)}
            />
          </div>
          <DepthPresetField
            value={i.depth_mm}
            onChange={(v) => onFieldChange("depth_mm", v)}
            presets={DEPTH_PRESETS_GENERAL}
          />
          <StoneTypeField
            value={i.stone_type}
            onChange={(v) => onFieldChange("stone_type", v)}
          />
          <Toggle
            id="waste_10pct"
            label="Add 10% wastage"
            checked={i.waste_10pct}
            onChange={(v) => onFieldChange("waste_10pct", v)}
          />
        </div>
      );
    }
  }
}
