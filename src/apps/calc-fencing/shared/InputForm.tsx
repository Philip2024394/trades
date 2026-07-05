// InputForm — per-scenario fields for the fencing calc.

"use client";

import type { ChangeEvent } from "react";
import { RadioGroup, TextInput, Toggle } from "@/platform/ui";
import type { FencingInputs, FencingScenario } from "../logic";

export type InputFormDensity = "comfy" | "compact";

export type InputFormProps = {
  scenario: FencingScenario;
  inputs: FencingInputs;
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

function PanelWidthPicker({
  value,
  onChange
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <RadioGroup
      id="panel_width_m"
      name="panel_width_m"
      label="Panel width"
      variant="cards"
      value={String(value)}
      onChange={(v) => onChange(parseFloat(v))}
      options={[
        {
          value: "1.83",
          label: "1.83 m (6 ft)",
          description: "UK standard closeboard / featheredge panel"
        },
        {
          value: "1.5",
          label: "1.5 m",
          description: "Continental / metric fence panel"
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
    case "straight": {
      const i = inputs as Extract<FencingInputs, { scenario: "straight" }>;
      return (
        <div className={stackCls}>
          <DimensionField
            id="run_length_m"
            label="Run length"
            value={num(i.run_length_m, 12)}
            onChange={(v) => onFieldChange("run_length_m", v)}
          />
          <PanelWidthPicker
            value={i.panel_width_m}
            onChange={(v) => onFieldChange("panel_width_m", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            100 × 100 mm posts at panel centres, 600 mm buried in
            concrete. One postcrete bag per post. Set the string line
            straight before digging any hole.
          </div>
          <Toggle
            id="include_gravel_boards"
            label="Include gravel boards"
            description="Concrete or timber base — stops panel rot on wet ground"
            checked={i.include_gravel_boards}
            onChange={(v) => onFieldChange("include_gravel_boards", v)}
          />
        </div>
      );
    }
    case "l_corner": {
      const i = inputs as Extract<FencingInputs, { scenario: "l_corner" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="run_a_length_m"
              label="Run A"
              value={num(i.run_a_length_m, 8)}
              onChange={(v) => onFieldChange("run_a_length_m", v)}
            />
            <DimensionField
              id="run_b_length_m"
              label="Run B"
              value={num(i.run_b_length_m, 6)}
              onChange={(v) => onFieldChange("run_b_length_m", v)}
            />
          </div>
          <PanelWidthPicker
            value={i.panel_width_m}
            onChange={(v) => onFieldChange("panel_width_m", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            L-corner adds one extra corner post — extra strength at the
            angle. Use a longer post (2.7 m) at the corner if the fence
            is above 1.8 m for wind loading.
          </div>
          <Toggle
            id="include_gravel_boards"
            label="Include gravel boards"
            checked={i.include_gravel_boards}
            onChange={(v) => onFieldChange("include_gravel_boards", v)}
          />
        </div>
      );
    }
    case "gated": {
      const i = inputs as Extract<FencingInputs, { scenario: "gated" }>;
      return (
        <div className={stackCls}>
          <DimensionField
            id="run_length_m"
            label="Total run length"
            value={num(i.run_length_m, 15)}
            onChange={(v) => onFieldChange("run_length_m", v)}
          />
          <div className={dim2Col}>
            <DimensionField
              id="gate_width_m"
              label="Gate width"
              value={num(i.gate_width_m, 0.9)}
              onChange={(v) => onFieldChange("gate_width_m", v)}
            />
            <RadioGroup
              id="gate_count"
              name="gate_count"
              label="Number of gates"
              variant="cards"
              value={String(i.gate_count)}
              onChange={(v) =>
                onFieldChange("gate_count", parseInt(v) as 1 | 2)
              }
              options={[
                { value: "1", label: "1 gate" },
                { value: "2", label: "2 gates" }
              ]}
            />
          </div>
          <PanelWidthPicker
            value={i.panel_width_m}
            onChange={(v) => onFieldChange("panel_width_m", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Each gate needs 2 strong gate posts (100×100 mm minimum,
            2.4 m). Heavy-duty hinges + drop bolt included. Standard
            garden gate 0.9 m, double 1.8 m. Add 30 mm clearance
            allowance either side of the frame.
          </div>
          <Toggle
            id="include_gravel_boards"
            label="Include gravel boards"
            checked={i.include_gravel_boards}
            onChange={(v) => onFieldChange("include_gravel_boards", v)}
          />
        </div>
      );
    }
  }
}
