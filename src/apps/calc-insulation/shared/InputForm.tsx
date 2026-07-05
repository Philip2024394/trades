// InputForm — per-scenario fields for the insulation calc.

"use client";

import type { ChangeEvent } from "react";
import { RadioGroup, TextInput, Toggle } from "@/platform/ui";
import type { InsulationInputs, InsulationScenario } from "../logic";

export type InputFormDensity = "comfy" | "compact";

export type InputFormProps = {
  scenario: InsulationScenario;
  inputs: InsulationInputs;
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

function MmField({
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
        onChange(parseInt(e.currentTarget.value) || 0)
      }
      min={25}
      step={25}
      suffix={<span className="text-[11px] font-medium text-neutral-500">mm</span>}
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
    case "loft": {
      const i = inputs as Extract<InsulationInputs, { scenario: "loft" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="loft_length_m"
              label="Loft length"
              value={num(i.loft_length_m, 8)}
              onChange={(v) => onFieldChange("loft_length_m", v)}
            />
            <DimensionField
              id="loft_width_m"
              label="Loft width"
              value={num(i.loft_width_m, 5)}
              onChange={(v) => onFieldChange("loft_width_m", v)}
            />
          </div>
          <RadioGroup
            id="cross_lay"
            name="cross_lay"
            label="Layering strategy"
            variant="cards"
            value={i.cross_lay ? "yes" : "no"}
            onChange={(v) => onFieldChange("cross_lay", v === "yes")}
            options={[
              {
                value: "yes",
                label: "Cross-lay (Part L compliant)",
                description:
                  "1st layer between joists · 2nd at 90° across = U ≤ 0.16"
              },
              {
                value: "no",
                label: "Single layer",
                description: "Between joists only — hits ~0.20 U-value"
              }
            ]}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Part L 2025 loft target: U ≤ 0.15 (new build) / 0.16
            (refurb). 270 mm mineral wool cross-laid is the UK standard.
            Keep 25 mm gap at eaves for ventilation.
          </div>
          <Toggle
            id="waste_5pct"
            label="Add 5% wastage"
            description="Trade over-order for cuts + damage"
            checked={i.waste_5pct}
            onChange={(v) => onFieldChange("waste_5pct", v)}
          />
        </div>
      );
    }
    case "wall_cavity": {
      const i = inputs as Extract<InsulationInputs, { scenario: "wall_cavity" }>;
      return (
        <div className={stackCls}>
          <AreaField
            id="wall_area_m2"
            label="Wall area"
            value={num(i.wall_area_m2, 40)}
            onChange={(v) => onFieldChange("wall_area_m2", v)}
          />
          <MmField
            id="cavity_mm"
            label="Cavity width"
            value={num(i.cavity_mm, 100)}
            onChange={(v) => onFieldChange("cavity_mm", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Standard UK cavities: 50–150 mm. Full-fill PIR gets you to
            ~U 0.28. Borescope the cavity before filling to check for
            rubble bridges or damaged wall ties.
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
    case "solid_floor": {
      const i = inputs as Extract<InsulationInputs, { scenario: "solid_floor" }>;
      return (
        <div className={stackCls}>
          <AreaField
            id="floor_area_m2"
            label="Floor area"
            value={num(i.floor_area_m2, 25)}
            onChange={(v) => onFieldChange("floor_area_m2", v)}
          />
          <MmField
            id="depth_mm"
            label="PIR depth"
            value={num(i.depth_mm, 100)}
            onChange={(v) => onFieldChange("depth_mm", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Part L 2025 floor target: U ≤ 0.13. 150 mm PIR under a 65 mm
            screed is the UK domestic norm. Always specify DPM under
            insulation to prevent rising damp.
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
    case "pitched_roof": {
      const i = inputs as Extract<InsulationInputs, { scenario: "pitched_roof" }>;
      return (
        <div className={stackCls}>
          <AreaField
            id="roof_area_m2"
            label="Roof area (on slope)"
            value={num(i.roof_area_m2, 30)}
            onChange={(v) => onFieldChange("roof_area_m2", v)}
          />
          <MmField
            id="rafter_centres_mm"
            label="Rafter centres"
            value={num(i.rafter_centres_mm, 600)}
            onChange={(v) => onFieldChange("rafter_centres_mm", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Part L 2025 pitched roof target: U ≤ 0.15. Warm-roof
            installs combine between-rafter PIR with a continuous
            under-rafter board to eliminate cold bridges. Fit breather
            membrane above rafters.
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
