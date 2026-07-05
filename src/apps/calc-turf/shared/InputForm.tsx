// InputForm — per-scenario fields for the turf calc.

"use client";

import type { ChangeEvent } from "react";
import { RadioGroup, TextInput, Toggle } from "@/platform/ui";
import type { TurfInputs, TurfScenario } from "../logic";

export type InputFormDensity = "comfy" | "compact";

export type InputFormProps = {
  scenario: TurfScenario;
  inputs: TurfInputs;
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

function TopsoilDepthPicker({
  value,
  onChange
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <RadioGroup
      id="topsoil_depth_mm"
      name="topsoil_depth_mm"
      label="Topsoil depth"
      variant="cards"
      value={String(value)}
      onChange={(v) => onChange(parseInt(v))}
      options={[
        {
          value: "50",
          label: "50 mm",
          description: "New-lawn standard · sound sub-base"
        },
        {
          value: "100",
          label: "100 mm",
          description: "Poor / stony ground · new-build gardens"
        },
        {
          value: "150",
          label: "150 mm",
          description: "Very poor sub-soil · levelling required"
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
    case "simple": {
      const i = inputs as Extract<TurfInputs, { scenario: "simple" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="lawn_length_m"
              label="Lawn length"
              value={num(i.lawn_length_m, 5)}
              onChange={(v) => onFieldChange("lawn_length_m", v)}
            />
            <DimensionField
              id="lawn_width_m"
              label="Lawn width"
              value={num(i.lawn_width_m, 4)}
              onChange={(v) => onFieldChange("lawn_width_m", v)}
            />
          </div>
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Simple lay — assumes existing prepared soil. Standard UK
            roll: 1 m × 410 mm = 0.41 m². Lay within 24 h of delivery,
            water daily for 2 weeks. No walking on for 3 weeks.
          </div>
          <Toggle
            id="waste_5pct"
            label="Add 5% wastage"
            description="Trade over-order for shape cuts + damaged rolls"
            checked={i.waste_5pct}
            onChange={(v) => onFieldChange("waste_5pct", v)}
          />
        </div>
      );
    }
    case "full_prep": {
      const i = inputs as Extract<TurfInputs, { scenario: "full_prep" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="lawn_length_m"
              label="Lawn length"
              value={num(i.lawn_length_m, 5)}
              onChange={(v) => onFieldChange("lawn_length_m", v)}
            />
            <DimensionField
              id="lawn_width_m"
              label="Lawn width"
              value={num(i.lawn_width_m, 4)}
              onChange={(v) => onFieldChange("lawn_width_m", v)}
            />
          </div>
          <TopsoilDepthPicker
            value={i.topsoil_depth_mm}
            onChange={(v) => onFieldChange("topsoil_depth_mm", v)}
          />
          <Toggle
            id="include_levelling_sand"
            label="Include levelling sand"
            description="2 kg/m² sharp sand brushed into seams after laying"
            checked={i.include_levelling_sand}
            onChange={(v) => onFieldChange("include_levelling_sand", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Full prep: rotovate to 100 mm depth, remove stones,
            level, spread topsoil, firm with roller / tread, rake to
            smooth, then lay turf within 24 h. Topsoil is 1.4 t/m³.
          </div>
          <Toggle
            id="waste_5pct"
            label="Add 5% wastage"
            checked={i.waste_5pct}
            onChange={(v) => onFieldChange("waste_5pct", v)}
          />
        </div>
      );
    }
  }
}
