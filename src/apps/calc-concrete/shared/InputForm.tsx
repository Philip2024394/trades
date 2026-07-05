// InputForm — per-scenario concrete fields.
//
// Depth presets (mm) built in for common slab thicknesses.
// Mix ratio presets: 1:2:4 general / 1:1.5:3 structural / 1:3:6 mass.

"use client";

import type { ChangeEvent } from "react";
import { RadioGroup, Select, TextInput, Toggle } from "@/platform/ui";
import type { ConcreteInputs, ConcreteScenario } from "../logic";

export type InputFormDensity = "comfy" | "compact";

export type InputFormProps = {
  scenario: ConcreteScenario;
  inputs: ConcreteInputs;
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
      onChange={(e) => onChange(parseInt(e.currentTarget.value, 10) || 0)}
      min={1}
      step={1}
    />
  );
}

function MillimetreField({
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
      onChange={(e) => onChange(parseInt(e.currentTarget.value, 10) || 0)}
      min={10}
      step={5}
      suffix={<span className="text-[11px] font-medium text-neutral-500">mm</span>}
    />
  );
}

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
      label="Slab depth"
      value={String(value)}
      onChange={(e) => onChange(parseInt(e.currentTarget.value, 10) || 100)}
      options={presets.map((p) => ({
        value: String(p.value),
        label: p.label
      }))}
    />
  );
}

function MixField({
  value,
  onChange
}: {
  value: "general" | "structural" | "mass";
  onChange: (v: "general" | "structural" | "mass") => void;
}) {
  return (
    <RadioGroup
      id="mix"
      name="mix"
      label="Concrete mix"
      variant="cards"
      value={value}
      onChange={(v) => onChange(v as "general" | "structural" | "mass")}
      options={[
        {
          value: "general",
          label: "General (1:2:4)",
          description: "Patios · paths · shed bases · low-load work"
        },
        {
          value: "structural",
          label: "Structural (1:1.5:3)",
          description: "Driveways · footings · anywhere vehicles/heavy load"
        },
        {
          value: "mass",
          label: "Mass fill (1:3:6)",
          description: "Non-structural bulk fill · foundations infill"
        }
      ]}
    />
  );
}

const SLAB_DEPTH_PRESETS = [
  { value: 75, label: "75 mm (paths + light-duty)" },
  { value: 100, label: "100 mm (patios + shed bases)" },
  { value: 150, label: "150 mm (driveways + garage)" },
  { value: 200, label: "200 mm (heavy vehicle / commercial)" }
];

export function InputForm({
  scenario,
  inputs,
  onFieldChange,
  density = "comfy"
}: InputFormProps) {
  const dim2Col = density === "comfy" ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-2";
  const stackCls = density === "comfy" ? "flex flex-col gap-3" : "flex flex-col gap-2";

  switch (scenario) {
    case "patio_slab":
    case "path":
    case "shed_base":
    case "driveway": {
      const i = inputs as Extract<
        ConcreteInputs,
        {
          scenario:
            | "patio_slab"
            | "path"
            | "shed_base"
            | "driveway";
        }
      >;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Length"
              value={num(i.length_m, 4)}
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
            presets={SLAB_DEPTH_PRESETS}
          />
          <MixField
            value={i.mix}
            onChange={(v) => onFieldChange("mix", v)}
          />
          <Toggle
            id="waste_10pct"
            label="Add 10% wastage"
            description="Standard trade over-order for spillage + finishing"
            checked={i.waste_10pct}
            onChange={(v) => onFieldChange("waste_10pct", v)}
          />
        </div>
      );
    }
    case "fence_post_bases": {
      const i = inputs as Extract<
        ConcreteInputs,
        { scenario: "fence_post_bases" }
      >;
      return (
        <div className={stackCls}>
          <CountField
            id="count"
            label="Number of fence posts"
            value={i.count}
            onChange={(v) => onFieldChange("count", v)}
          />
          <div className={dim2Col}>
            <MillimetreField
              id="hole_diameter_mm"
              label="Hole diameter"
              value={i.hole_diameter_mm}
              onChange={(v) => onFieldChange("hole_diameter_mm", v)}
            />
            <MillimetreField
              id="hole_depth_mm"
              label="Hole depth"
              value={i.hole_depth_mm}
              onChange={(v) => onFieldChange("hole_depth_mm", v)}
            />
          </div>
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Postcrete (fast-set) is usually the right product for fence posts —
            no need to mix cement + sand + ballast on-site. The shopping list
            below will suggest it.
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
  }
}
