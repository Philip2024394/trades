// InputForm — per-scenario mortar fields.
//
// Wall area is the single dimension (users already know it from
// calc-bricks output — or measure directly). Mix ratio card picker
// with UK trade explanations.

"use client";

import type { ChangeEvent } from "react";
import { RadioGroup, Select, TextInput, Toggle } from "@/platform/ui";
import type { MortarInputs, MortarScenario } from "../logic";

export type InputFormDensity = "comfy" | "compact";

export type InputFormProps = {
  scenario: MortarScenario;
  inputs: MortarInputs;
  onFieldChange: (field: string, value: unknown) => void;
  density?: InputFormDensity;
};

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}

function WallAreaField({
  value,
  onChange
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <TextInput
      id="wall_area_m2"
      type="number"
      label="Wall surface area"
      value={String(value)}
      onChange={(e: ChangeEvent<HTMLInputElement>) =>
        onChange(parseFloat(e.currentTarget.value) || 0)
      }
      min={0.5}
      step={0.5}
      hint="If you've used the Bricks calc, copy the wall area from there."
      suffix={<span className="text-[11px] font-medium text-neutral-500">m²</span>}
    />
  );
}

function MixField({
  value,
  onChange
}: {
  value: "general_1_4" | "lime_1_1_6" | "structural_1_3";
  onChange: (v: "general_1_4" | "lime_1_1_6" | "structural_1_3") => void;
}) {
  return (
    <RadioGroup
      id="mix"
      name="mix"
      label="Mortar mix"
      variant="cards"
      value={value}
      onChange={(v) =>
        onChange(v as "general_1_4" | "lime_1_1_6" | "structural_1_3")
      }
      options={[
        {
          value: "general_1_4",
          label: "General (1:4)",
          description: "Cement : sand · general purpose brick/block work"
        },
        {
          value: "lime_1_1_6",
          label: "Lime mix (1:1:6, M4)",
          description:
            "Cement : lime : sand · soft mortar for repointing + heritage"
        },
        {
          value: "structural_1_3",
          label: "Structural (1:3)",
          description: "Cement : sand · engineering brick + retaining walls"
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
  const stackCls = density === "comfy" ? "flex flex-col gap-3" : "flex flex-col gap-2";

  switch (scenario) {
    case "brickwork": {
      const i = inputs as Extract<MortarInputs, { scenario: "brickwork" }>;
      return (
        <div className={stackCls}>
          <WallAreaField
            value={num(i.wall_area_m2, 10)}
            onChange={(v) => onFieldChange("wall_area_m2", v)}
          />
          <MixField
            value={i.mix}
            onChange={(v) => onFieldChange("mix", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Brickwork uses ~22 L mortar per m² face (2.2 L per m² per
            10 mm joint × 10 mm). Pre-mix bags are quickest for small
            jobs; DIY mix is cheaper on 20 m²+.
          </div>
          <Toggle
            id="waste_10pct"
            label="Add 10% wastage"
            description="Standard trade over-order"
            checked={i.waste_10pct}
            onChange={(v) => onFieldChange("waste_10pct", v)}
          />
        </div>
      );
    }
    case "blockwork": {
      const i = inputs as Extract<MortarInputs, { scenario: "blockwork" }>;
      return (
        <div className={stackCls}>
          <WallAreaField
            value={num(i.wall_area_m2, 15)}
            onChange={(v) => onFieldChange("wall_area_m2", v)}
          />
          <MixField
            value={i.mix}
            onChange={(v) => onFieldChange("mix", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Blockwork uses ~12 L mortar per m² face — fewer joints per
            m² than brickwork so less mortar needed.
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
    case "repointing": {
      const i = inputs as Extract<MortarInputs, { scenario: "repointing" }>;
      return (
        <div className={stackCls}>
          <WallAreaField
            value={num(i.wall_area_m2, 8)}
            onChange={(v) => onFieldChange("wall_area_m2", v)}
          />
          <Select
            id="joint_thickness_mm"
            label="Existing joint thickness"
            value={String(i.joint_thickness_mm)}
            onChange={(e) =>
              onFieldChange(
                "joint_thickness_mm",
                parseInt(e.currentTarget.value, 10) || 10
              )
            }
            options={[
              { value: "8", label: "8 mm (Victorian / older)" },
              { value: "10", label: "10 mm (standard modern)" },
              { value: "12", label: "12 mm (natural stone)" }
            ]}
          />
          <MixField
            value={i.mix}
            onChange={(v) => onFieldChange("mix", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Heritage / soft brick? Use the lime mix (1:1:6). Modern
            hard brick is fine with 1:4. Never repoint with a stronger
            mortar than the original — it damages the brick face.
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
