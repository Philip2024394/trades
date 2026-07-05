// InputForm — per-scenario fields for the render calc.

"use client";

import type { ChangeEvent } from "react";
import { RadioGroup, TextInput, Toggle } from "@/platform/ui";
import type { RenderInputs, RenderScenario } from "../logic";

export type InputFormDensity = "comfy" | "compact";

export type InputFormProps = {
  scenario: RenderScenario;
  inputs: RenderInputs;
  onFieldChange: (field: string, value: unknown) => void;
  density?: InputFormDensity;
};

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}

function AreaField({
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
      step={0.5}
      suffix={<span className="text-[11px] font-medium text-neutral-500">m²</span>}
    />
  );
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

function SystemPicker({
  value,
  onChange
}: {
  value: "sand_cement" | "k_rend_silicone";
  onChange: (v: "sand_cement" | "k_rend_silicone") => void;
}) {
  return (
    <RadioGroup
      id="system"
      name="system"
      label="Render system"
      variant="cards"
      value={value}
      onChange={(v) => onChange(v as "sand_cement" | "k_rend_silicone")}
      options={[
        {
          value: "sand_cement",
          label: "Sand:cement (1:5)",
          description: "Traditional 3-coat scratch + top · 12 kg/m² at 16 mm"
        },
        {
          value: "k_rend_silicone",
          label: "K Rend / silicone thin-coat",
          description: "Coloured 2-coat system · 8 kg/m² · self-cleaning"
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
    case "external_wall": {
      const i = inputs as Extract<RenderInputs, { scenario: "external_wall" }>;
      return (
        <div className={stackCls}>
          <AreaField
            id="wall_area_m2"
            label="Wall area to render"
            value={num(i.wall_area_m2, 25)}
            onChange={(v) => onFieldChange("wall_area_m2", v)}
          />
          <SystemPicker
            value={i.system}
            onChange={(v) => onFieldChange("system", v)}
          />
          <Toggle
            id="include_mesh"
            label="Include reinforcement mesh"
            description="Fibreglass mesh embedded in base coat — reduces cracking, essential over movement joints"
            checked={i.include_mesh}
            onChange={(v) => onFieldChange("include_mesh", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Deduct doors + windows before entering wall area. Fresh
            brickwork needs to cure 6 weeks before rendering. Add
            corner mesh + bell beads at all external corners.
          </div>
          <Toggle
            id="waste_10pct"
            label="Add 10% wastage"
            description="Trade over-order — mixing loss + drop"
            checked={i.waste_10pct}
            onChange={(v) => onFieldChange("waste_10pct", v)}
          />
        </div>
      );
    }
    case "chimney_stack": {
      const i = inputs as Extract<RenderInputs, { scenario: "chimney_stack" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="stack_perimeter_m"
              label="Stack perimeter"
              value={num(i.stack_perimeter_m, 2.4)}
              onChange={(v) => onFieldChange("stack_perimeter_m", v)}
            />
            <DimensionField
              id="stack_height_m"
              label="Stack height"
              value={num(i.stack_height_m, 1.5)}
              onChange={(v) => onFieldChange("stack_height_m", v)}
            />
          </div>
          <SystemPicker
            value={i.system}
            onChange={(v) => onFieldChange("system", v)}
          />
          <Toggle
            id="include_mesh"
            label="Include reinforcement mesh"
            description="Highly exposed — mesh strongly recommended for chimneys"
            checked={i.include_mesh}
            onChange={(v) => onFieldChange("include_mesh", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Chimneys need scaffold access + lead code 4 flashing —
            quote those separately. Consider a chimney-cap band at
            top for weather protection.
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
