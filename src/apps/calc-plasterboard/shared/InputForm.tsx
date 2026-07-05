// InputForm — per-scenario plasterboard fields.

"use client";

import type { ChangeEvent } from "react";
import { RadioGroup, TextInput, Toggle } from "@/platform/ui";
import type { PlasterboardInputs, PlasterboardScenario } from "../logic";

export type InputFormDensity = "comfy" | "compact";

export type InputFormProps = {
  scenario: PlasterboardScenario;
  inputs: PlasterboardInputs;
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

function BoardSizeField({
  value,
  onChange
}: {
  value: "1200x2400" | "1200x1800";
  onChange: (v: "1200x2400" | "1200x1800") => void;
}) {
  return (
    <RadioGroup
      id="board_size"
      name="board_size"
      label="Board size"
      variant="cards"
      value={value}
      onChange={(v) => onChange(v as "1200x2400" | "1200x1800")}
      options={[
        {
          value: "1200x2400",
          label: "1200 × 2400 mm",
          description: "Standard UK sheet · 2.88 m²"
        },
        {
          value: "1200x1800",
          label: "1200 × 1800 mm",
          description: "Handleable single-person size · 2.16 m²"
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
    case "walls": {
      const i = inputs as Extract<PlasterboardInputs, { scenario: "walls" }>;
      return (
        <div className={stackCls}>
          <AreaField
            id="wall_area_m2"
            label="Wall surface area"
            value={num(i.wall_area_m2, 20)}
            onChange={(v) => onFieldChange("wall_area_m2", v)}
          />
          <BoardSizeField
            value={i.board_size}
            onChange={(v) => onFieldChange("board_size", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Board direction: staggered joints add strength. 1200 mm side
            usually runs horizontal on stud walls (36 mm centres) — check
            stud spacing on-site before ordering.
          </div>
          <Toggle
            id="waste_10pct"
            label="Add 10% wastage"
            description="Standard trade over-order — covers cuts + damage"
            checked={i.waste_10pct}
            onChange={(v) => onFieldChange("waste_10pct", v)}
          />
        </div>
      );
    }
    case "ceilings": {
      const i = inputs as Extract<PlasterboardInputs, { scenario: "ceilings" }>;
      return (
        <div className={stackCls}>
          <AreaField
            id="ceiling_area_m2"
            label="Ceiling surface area"
            value={num(i.ceiling_area_m2, 15)}
            onChange={(v) => onFieldChange("ceiling_area_m2", v)}
          />
          <BoardSizeField
            value={i.board_size}
            onChange={(v) => onFieldChange("board_size", v)}
          />
          <Toggle
            id="moisture_resistant"
            label="Moisture-resistant board (MR / green board)"
            description="Required for bathrooms + kitchens · adds ~30% to cost"
            checked={i.moisture_resistant}
            onChange={(v) => onFieldChange("moisture_resistant", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Ceilings need a second pair of hands or a plasterboard lift.
            Use 12.5 mm standard for domestic ceilings, 15 mm for
            fire-rated / commercial.
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
    case "whole_room": {
      const i = inputs as Extract<PlasterboardInputs, { scenario: "whole_room" }>;
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
          <BoardSizeField
            value={i.board_size}
            onChange={(v) => onFieldChange("board_size", v)}
          />
          <Toggle
            id="include_ceiling"
            label="Board the ceiling too"
            description="Adds L × W to the total board area"
            checked={i.include_ceiling}
            onChange={(v) => onFieldChange("include_ceiling", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            The whole-room calc measures the FULL perimeter × height
            without subtracting doors/windows. Deduct roughly 1.6 m²
            per door and 1.5 m² per window if you're pricing tight.
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
