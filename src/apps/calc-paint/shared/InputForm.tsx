// InputForm — renders the field set for the active scenario.
//
// Density modes:
//   comfy — 2-column dimensions grid, room for helper text (landscape)
//   compact — single column, smaller labels (square + portrait)

"use client";

import type { ChangeEvent } from "react";
import { RadioGroup, Select, TextInput, Toggle } from "@/platform/ui";
import type { PaintInputs, PaintScenario } from "../logic";

export type InputFormDensity = "comfy" | "compact";

export type InputFormProps = {
  scenario: PaintScenario;
  inputs: PaintInputs;
  onFieldChange: (field: string, value: unknown) => void;
  density?: InputFormDensity;
};

// ─── Reusable field building blocks ───────────────────────────
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}

function DimensionField({
  id,
  label,
  value,
  onChange,
  min = 0.1,
  step = 0.1
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
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
      min={min}
      step={step}
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

function CoatsField({
  value,
  onChange
}: {
  value: 1 | 2;
  onChange: (v: 1 | 2) => void;
}) {
  return (
    <RadioGroup
      id="coats"
      name="coats"
      label="Coats"
      value={String(value)}
      onChange={(v) => onChange(v === "1" ? 1 : 2)}
      options={[
        { value: "1", label: "1 coat" },
        { value: "2", label: "2 coats (recommended)" }
      ]}
    />
  );
}

// ─── Main form ────────────────────────────────────────────────
export function InputForm({
  scenario,
  inputs,
  onFieldChange,
  density = "comfy"
}: InputFormProps) {
  const dim2Col = density === "comfy" ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-2";
  const stackCls = density === "comfy" ? "flex flex-col gap-3" : "flex flex-col gap-2";

  switch (scenario) {
    case "quick_estimate": {
      const i = inputs as Extract<PaintInputs, { scenario: "quick_estimate" }>;
      return (
        <div className={stackCls}>
          <RadioGroup
            id="room_type"
            name="room_type"
            label="Room size"
            value={i.room_type}
            onChange={(v) => onFieldChange("room_type", v)}
            variant="cards"
            options={[
              {
                value: "small",
                label: "Small",
                description: "Bathroom / box room · ~28 m² walls"
              },
              {
                value: "medium",
                label: "Medium",
                description: "Bedroom / dining · ~42 m² walls"
              },
              {
                value: "large",
                label: "Large",
                description: "Lounge / open-plan · ~56 m² walls"
              }
            ]}
          />
          <CoatsField
            value={i.coats}
            onChange={(v) => onFieldChange("coats", v)}
          />
        </div>
      );
    }
    case "full_room": {
      const i = inputs as Extract<PaintInputs, { scenario: "full_room" }>;
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
            <DimensionField
              id="height_m"
              label="Height"
              value={num(i.height_m, 2.4)}
              onChange={(v) => onFieldChange("height_m", v)}
            />
          </div>
          <div className={dim2Col}>
            <CountField
              id="doors"
              label="Doors"
              value={i.doors}
              onChange={(v) => onFieldChange("doors", v)}
            />
            <CountField
              id="windows"
              label="Windows"
              value={i.windows}
              onChange={(v) => onFieldChange("windows", v)}
            />
          </div>
          <Select
            id="surface"
            label="Surface"
            value={i.surface}
            onChange={(e) => onFieldChange("surface", e.currentTarget.value)}
            options={[
              { value: "smooth", label: "Smooth (12 m²/L)" },
              { value: "textured", label: "Textured (10 m²/L)" },
              { value: "fresh_plaster", label: "Fresh plaster — needs mist coat" }
            ]}
          />
          <CoatsField
            value={i.coats}
            onChange={(v) => onFieldChange("coats", v)}
          />
          <Toggle
            id="include_ceiling"
            label="Include ceiling"
            description="Adds 11 m²/L emulsion for the ceiling area"
            checked={i.include_ceiling}
            onChange={(v) => onFieldChange("include_ceiling", v)}
          />
          <Toggle
            id="paint_dw"
            label="Paint doors + windows in gloss/satinwood"
            description="Adds trim paint on top of wall emulsion"
            checked={i.paint_doors_and_windows}
            onChange={(v) => onFieldChange("paint_doors_and_windows", v)}
          />
          <Toggle
            id="waste_10pct"
            label="Add 10% wastage"
            description="Standard trade wastage buffer"
            checked={i.waste_10pct}
            onChange={(v) => onFieldChange("waste_10pct", v)}
          />
        </div>
      );
    }
    case "single_wall": {
      const i = inputs as Extract<PaintInputs, { scenario: "single_wall" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Wall length"
              value={num(i.length_m, 4)}
              onChange={(v) => onFieldChange("length_m", v)}
            />
            <DimensionField
              id="height_m"
              label="Wall height"
              value={num(i.height_m, 2.4)}
              onChange={(v) => onFieldChange("height_m", v)}
            />
          </div>
          <Select
            id="surface"
            label="Surface"
            value={i.surface}
            onChange={(e) => onFieldChange("surface", e.currentTarget.value)}
            options={[
              { value: "smooth", label: "Smooth" },
              { value: "textured", label: "Textured" },
              { value: "fresh_plaster", label: "Fresh plaster" }
            ]}
          />
          <CoatsField
            value={i.coats}
            onChange={(v) => onFieldChange("coats", v)}
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
    case "external_masonry": {
      const i = inputs as Extract<PaintInputs, { scenario: "external_masonry" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Wall length"
              value={num(i.length_m, 8)}
              onChange={(v) => onFieldChange("length_m", v)}
            />
            <DimensionField
              id="height_m"
              label="Wall height"
              value={num(i.height_m, 2.5)}
              onChange={(v) => onFieldChange("height_m", v)}
            />
          </div>
          <Select
            id="surface"
            label="Surface"
            value={i.surface}
            onChange={(e) => onFieldChange("surface", e.currentTarget.value)}
            options={[
              { value: "smooth", label: "Smooth render (6 m²/L)" },
              { value: "textured", label: "Textured / pebbledash (5 m²/L)" }
            ]}
          />
          <CoatsField
            value={i.coats}
            onChange={(v) => onFieldChange("coats", v)}
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
    case "doors_only": {
      const i = inputs as Extract<PaintInputs, { scenario: "doors_only" }>;
      return (
        <div className={stackCls}>
          <CountField
            id="count"
            label="Number of doors"
            value={i.count}
            onChange={(v) => onFieldChange("count", v)}
          />
          <Select
            id="door_size"
            label="Door size"
            value={i.door_size}
            onChange={(e) => onFieldChange("door_size", e.currentTarget.value)}
            options={[
              { value: "standard", label: "Standard (762 × 1981 mm)" },
              { value: "tall", label: "Tall (838 × 2135 mm)" }
            ]}
          />
          <RadioGroup
            id="sides"
            name="sides"
            label="Sides"
            value={i.sides}
            onChange={(v) => onFieldChange("sides", v)}
            options={[
              { value: "one", label: "One side" },
              { value: "both", label: "Both sides" }
            ]}
          />
          <Toggle
            id="include_frame"
            label="Include frame + architrave"
            checked={i.include_frame}
            onChange={(v) => onFieldChange("include_frame", v)}
          />
          <CoatsField
            value={i.coats}
            onChange={(v) => onFieldChange("coats", v)}
          />
        </div>
      );
    }
    case "windows_only": {
      const i = inputs as Extract<PaintInputs, { scenario: "windows_only" }>;
      return (
        <div className={stackCls}>
          <CountField
            id="count"
            label="Number of windows"
            value={i.count}
            onChange={(v) => onFieldChange("count", v)}
          />
          <Select
            id="window_size"
            label="Window size"
            value={i.window_size}
            onChange={(e) => onFieldChange("window_size", e.currentTarget.value)}
            options={[
              { value: "small", label: "Small (0.6 × 0.9 m)" },
              { value: "standard", label: "Standard (1.2 × 1.2 m)" },
              { value: "large", label: "Large (1.8 × 1.5 m)" }
            ]}
          />
          <RadioGroup
            id="sides"
            name="sides"
            label="Sides"
            value={i.sides}
            onChange={(v) => onFieldChange("sides", v)}
            options={[
              { value: "one", label: "Interior only" },
              { value: "both", label: "Both sides" }
            ]}
          />
          <CoatsField
            value={i.coats}
            onChange={(v) => onFieldChange("coats", v)}
          />
        </div>
      );
    }
    case "timber_fence": {
      const i = inputs as Extract<PaintInputs, { scenario: "timber_fence" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Fence length"
              value={num(i.length_m, 10)}
              onChange={(v) => onFieldChange("length_m", v)}
            />
            <DimensionField
              id="height_m"
              label="Fence height"
              value={num(i.height_m, 1.8)}
              onChange={(v) => onFieldChange("height_m", v)}
            />
          </div>
          <RadioGroup
            id="sides"
            name="sides"
            label="Sides"
            value={i.sides}
            onChange={(v) => onFieldChange("sides", v)}
            options={[
              { value: "one", label: "One side only" },
              { value: "both", label: "Both sides (adds 100%)" }
            ]}
          />
          <CoatsField
            value={i.coats}
            onChange={(v) => onFieldChange("coats", v)}
          />
        </div>
      );
    }
    case "metal_railing": {
      const i = inputs as Extract<PaintInputs, { scenario: "metal_railing" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Railing length"
              value={num(i.length_m, 5)}
              onChange={(v) => onFieldChange("length_m", v)}
            />
            <DimensionField
              id="height_m"
              label="Railing height"
              value={num(i.height_m, 1.1)}
              onChange={(v) => onFieldChange("height_m", v)}
            />
          </div>
          <RadioGroup
            id="profile"
            name="profile"
            label="Profile"
            value={i.profile}
            onChange={(v) => onFieldChange("profile", v)}
            variant="cards"
            options={[
              {
                value: "plain",
                label: "Plain",
                description: "Straight bars · 8 m²/L"
              },
              {
                value: "decorative",
                label: "Decorative",
                description: "Detailed profile · 5 m²/L"
              }
            ]}
          />
          <CoatsField
            value={i.coats}
            onChange={(v) => onFieldChange("coats", v)}
          />
        </div>
      );
    }
    case "skirting_trim": {
      const i = inputs as Extract<PaintInputs, { scenario: "skirting_trim" }>;
      return (
        <div className={stackCls}>
          <DimensionField
            id="linear_m"
            label="Linear metres of skirting"
            value={num(i.linear_m, 14)}
            onChange={(v) => onFieldChange("linear_m", v)}
          />
          <CoatsField
            value={i.coats}
            onChange={(v) => onFieldChange("coats", v)}
          />
        </div>
      );
    }
  }
}
