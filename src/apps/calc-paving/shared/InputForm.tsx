// InputForm — per-scenario fields for the paving calc.

"use client";

import type { ChangeEvent } from "react";
import { RadioGroup, TextInput, Toggle } from "@/platform/ui";
import type { PavingInputs, PavingScenario } from "../logic";

export type InputFormDensity = "comfy" | "compact";

export type InputFormProps = {
  scenario: PavingScenario;
  inputs: PavingInputs;
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
      min={0.5}
      step={0.1}
      suffix={<span className="text-[11px] font-medium text-neutral-500">m</span>}
    />
  );
}

function SlabSizePicker({
  wValue,
  hValue,
  onChange,
  scenario
}: {
  wValue: number;
  hValue: number;
  onChange: (w: number, h: number) => void;
  scenario: PavingScenario;
}) {
  // Different scenario = different sensible slab sizes
  const options =
    scenario === "driveway"
      ? [
          {
            value: "200x100",
            label: "200 × 100 mm block",
            description: "Standard UK block-paver"
          },
          {
            value: "210x140",
            label: "210 × 140 mm block",
            description: "Larger driveway block"
          }
        ]
      : scenario === "garden_path"
        ? [
            {
              value: "450x450",
              label: "450 × 450 mm",
              description: "Traditional path flag"
            },
            {
              value: "600x300",
              label: "600 × 300 mm plank",
              description: "Contemporary linear look"
            }
          ]
        : [
            {
              value: "600x600",
              label: "600 × 600 mm",
              description: "Standard UK patio slab"
            },
            {
              value: "600x300",
              label: "600 × 300 mm",
              description: "Linear plank patio"
            },
            {
              value: "900x600",
              label: "900 × 600 mm",
              description: "Large-format porcelain"
            }
          ];

  const currentValue = `${wValue}x${hValue}`;
  return (
    <RadioGroup
      id="slab_size"
      name="slab_size"
      label="Slab size"
      variant="cards"
      value={currentValue}
      onChange={(v) => {
        const [w, h] = v.split("x").map((n) => parseInt(n));
        onChange(w, h);
      }}
      options={options}
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

  const onSlabSizeChange = (w: number, h: number) => {
    onFieldChange("slab_w_mm", w);
    onFieldChange("slab_h_mm", h);
  };

  switch (scenario) {
    case "patio": {
      const i = inputs as Extract<PavingInputs, { scenario: "patio" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Length"
              value={num(i.length_m, 5)}
              onChange={(v) => onFieldChange("length_m", v)}
            />
            <DimensionField
              id="width_m"
              label="Width"
              value={num(i.width_m, 3)}
              onChange={(v) => onFieldChange("width_m", v)}
            />
          </div>
          <SlabSizePicker
            wValue={i.slab_w_mm}
            hValue={i.slab_h_mm}
            onChange={onSlabSizeChange}
            scenario="patio"
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Sub-base: MOT Type 1 @ 100 mm compacted. Sand bed 50 mm.
            Fall away from house at 1:80 for drainage. Jointing
            compound at 25 kg per 10 m² of finished area.
          </div>
          <Toggle
            id="waste_10pct"
            label="Add 10% wastage"
            description="Standard trade over-order for cuts + damage"
            checked={i.waste_10pct}
            onChange={(v) => onFieldChange("waste_10pct", v)}
          />
        </div>
      );
    }
    case "driveway": {
      const i = inputs as Extract<PavingInputs, { scenario: "driveway" }>;
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
          <SlabSizePicker
            wValue={i.slab_w_mm}
            hValue={i.slab_h_mm}
            onChange={onSlabSizeChange}
            scenario="driveway"
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Sub-base: MOT Type 1 @ 150 mm compacted (vehicle loading).
            Weed membrane over sub-base. Post-2008 planning: driveways
            over 5 m² need permeable paving OR SuDS drainage.
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
    case "garden_path": {
      const i = inputs as Extract<PavingInputs, { scenario: "garden_path" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Path length"
              value={num(i.length_m, 8)}
              onChange={(v) => onFieldChange("length_m", v)}
            />
            <DimensionField
              id="width_m"
              label="Path width"
              value={num(i.width_m, 0.9)}
              onChange={(v) => onFieldChange("width_m", v)}
            />
          </div>
          <SlabSizePicker
            wValue={i.slab_w_mm}
            hValue={i.slab_h_mm}
            onChange={onSlabSizeChange}
            scenario="garden_path"
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Sub-base 75 mm — paths don't need vehicle loading. Add lawn
            edging strip to hold shape. Curved path bumps waste to 20%
            for cutting to the curve.
          </div>
          <Toggle
            id="curves"
            label="Curved path"
            description="Adds ~20% waste for shape-cutting slabs"
            checked={i.curves}
            onChange={(v) => onFieldChange("curves", v)}
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
