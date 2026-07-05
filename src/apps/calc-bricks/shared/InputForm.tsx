// InputForm — per-scenario brick/block fields.

"use client";

import type { ChangeEvent } from "react";
import { RadioGroup, TextInput, Toggle } from "@/platform/ui";
import type { BricksInputs, BricksScenario } from "../logic";

export type InputFormDensity = "comfy" | "compact";

export type InputFormProps = {
  scenario: BricksScenario;
  inputs: BricksInputs;
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
      min={0}
      step={1}
    />
  );
}

function UnitField({
  value,
  onChange
}: {
  value: "brick" | "block" | "aircrete";
  onChange: (v: "brick" | "block" | "aircrete") => void;
}) {
  return (
    <RadioGroup
      id="unit"
      name="unit"
      label="Unit type"
      variant="cards"
      value={value}
      onChange={(v) => onChange(v as "brick" | "block" | "aircrete")}
      options={[
        {
          value: "brick",
          label: "Bricks",
          description: "Standard UK 215 × 102.5 × 65 mm · 60 / m² face"
        },
        {
          value: "block",
          label: "Concrete blocks",
          description: "Standard UK 440 × 100 × 215 mm · 10 / m² face"
        },
        {
          value: "aircrete",
          label: "Aircrete blocks",
          description: "Lightweight thermal blocks · 10 / m² face"
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
  const dim2Col = density === "comfy" ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-2";
  const stackCls = density === "comfy" ? "flex flex-col gap-3" : "flex flex-col gap-2";

  switch (scenario) {
    case "garden_wall": {
      const i = inputs as Extract<BricksInputs, { scenario: "garden_wall" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Wall length"
              value={num(i.length_m, 6)}
              onChange={(v) => onFieldChange("length_m", v)}
            />
            <DimensionField
              id="height_m"
              label="Wall height"
              value={num(i.height_m, 1.2)}
              onChange={(v) => onFieldChange("height_m", v)}
            />
          </div>
          <UnitField
            value={i.unit}
            onChange={(v) => onFieldChange("unit", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Single-skin garden walls are typically 1-1.5 m tall. Anything
            above 1.5 m usually needs a double skin + piers for stability.
          </div>
          <Toggle
            id="waste_10pct"
            label="Add 10% wastage"
            description="Standard trade over-order — covers breakages + cuts"
            checked={i.waste_10pct}
            onChange={(v) => onFieldChange("waste_10pct", v)}
          />
        </div>
      );
    }
    case "cavity_wall": {
      const i = inputs as Extract<BricksInputs, { scenario: "cavity_wall" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Wall length"
              value={num(i.length_m, 5)}
              onChange={(v) => onFieldChange("length_m", v)}
            />
            <DimensionField
              id="height_m"
              label="Wall height"
              value={num(i.height_m, 2.4)}
              onChange={(v) => onFieldChange("height_m", v)}
            />
          </div>
          <UnitField
            value={i.unit}
            onChange={(v) => onFieldChange("unit", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Cavity walls = 2 skins (facing brick outside, block/aircrete
            inside typically). Wall ties every 900 mm horizontally and
            450 mm vertically — surfaced in the shopping list.
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
    case "boundary_wall": {
      const i = inputs as Extract<BricksInputs, { scenario: "boundary_wall" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Wall length"
              value={num(i.length_m, 10)}
              onChange={(v) => onFieldChange("length_m", v)}
            />
            <DimensionField
              id="height_m"
              label="Wall height"
              value={num(i.height_m, 1.8)}
              onChange={(v) => onFieldChange("height_m", v)}
            />
          </div>
          <RadioGroup
            id="skins"
            name="skins"
            label="Skins"
            variant="cards"
            value={String(i.skins)}
            onChange={(v) =>
              onFieldChange("skins", parseInt(v, 10) as 1 | 2)
            }
            options={[
              {
                value: "1",
                label: "Single skin",
                description: "Lightweight boundary — ≤ 1.5 m tall"
              },
              {
                value: "2",
                label: "Double skin",
                description: "Higher walls + retaining · > 1.5 m tall"
              }
            ]}
          />
          <CountField
            id="piers_count"
            label="Number of piers (support columns)"
            value={i.piers_count}
            onChange={(v) => onFieldChange("piers_count", v)}
          />
          <UnitField
            value={i.unit}
            onChange={(v) => onFieldChange("unit", v)}
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
