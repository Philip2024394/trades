// InputForm — per-scenario fields for the decking calc.

"use client";

import type { ChangeEvent } from "react";
import { RadioGroup, TextInput, Toggle } from "@/platform/ui";
import type { DeckingInputs, DeckingScenario } from "../logic";

export type InputFormDensity = "comfy" | "compact";

export type InputFormProps = {
  scenario: DeckingScenario;
  inputs: DeckingInputs;
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

function BoardWidthPicker({
  value,
  onChange
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <RadioGroup
      id="board_width_mm"
      name="board_width_mm"
      label="Board width"
      variant="cards"
      value={String(value)}
      onChange={(v) => onChange(parseInt(v))}
      options={[
        {
          value: "120",
          label: "120 mm",
          description: "Narrower · reduces cupping / warping on wide decks"
        },
        {
          value: "144",
          label: "144 mm",
          description: "UK standard softwood / composite width"
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
      const i = inputs as Extract<DeckingInputs, { scenario: "simple" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Deck length"
              value={num(i.length_m, 4)}
              onChange={(v) => onFieldChange("length_m", v)}
            />
            <DimensionField
              id="width_m"
              label="Deck width"
              value={num(i.width_m, 3)}
              onChange={(v) => onFieldChange("width_m", v)}
            />
          </div>
          <BoardWidthPicker
            value={i.board_width_mm}
            onChange={(v) => onFieldChange("board_width_mm", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            5 mm expansion gap baked in. Joists @ 400 mm centres. Boards
            laid perpendicular to the length. 3.6 m board length is UK
            standard trade cut.
          </div>
          <Toggle
            id="waste_10pct"
            label="Add 10% wastage"
            description="Trade over-order for cuts + trim"
            checked={i.waste_10pct}
            onChange={(v) => onFieldChange("waste_10pct", v)}
          />
        </div>
      );
    }
    case "l_shape": {
      const i = inputs as Extract<DeckingInputs, { scenario: "l_shape" }>;
      return (
        <div className={stackCls}>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Section A (main deck)
            </div>
            <div className={dim2Col}>
              <DimensionField
                id="a_length_m"
                label="Length"
                value={num(i.a_length_m, 4)}
                onChange={(v) => onFieldChange("a_length_m", v)}
              />
              <DimensionField
                id="a_width_m"
                label="Width"
                value={num(i.a_width_m, 3)}
                onChange={(v) => onFieldChange("a_width_m", v)}
              />
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Section B (return)
            </div>
            <div className={dim2Col}>
              <DimensionField
                id="b_length_m"
                label="Length"
                value={num(i.b_length_m, 2)}
                onChange={(v) => onFieldChange("b_length_m", v)}
              />
              <DimensionField
                id="b_width_m"
                label="Width"
                value={num(i.b_width_m, 1.5)}
                onChange={(v) => onFieldChange("b_width_m", v)}
              />
            </div>
          </div>
          <BoardWidthPicker
            value={i.board_width_mm}
            onChange={(v) => onFieldChange("board_width_mm", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            L-shape adds a mitre join or picture-frame edge — factor 2–3
            extra boards for the corner cut and pattern loss.
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
    case "multi_level": {
      const i = inputs as Extract<DeckingInputs, { scenario: "multi_level" }>;
      return (
        <div className={stackCls}>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Upper deck
            </div>
            <div className={dim2Col}>
              <DimensionField
                id="upper_length_m"
                label="Length"
                value={num(i.upper_length_m, 3)}
                onChange={(v) => onFieldChange("upper_length_m", v)}
              />
              <DimensionField
                id="upper_width_m"
                label="Width"
                value={num(i.upper_width_m, 3)}
                onChange={(v) => onFieldChange("upper_width_m", v)}
              />
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Lower deck
            </div>
            <div className={dim2Col}>
              <DimensionField
                id="lower_length_m"
                label="Length"
                value={num(i.lower_length_m, 4)}
                onChange={(v) => onFieldChange("lower_length_m", v)}
              />
              <DimensionField
                id="lower_width_m"
                label="Width"
                value={num(i.lower_width_m, 3)}
                onChange={(v) => onFieldChange("lower_width_m", v)}
              />
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Steps
            </div>
            <div className={dim2Col}>
              <TextInput
                id="step_count"
                type="number"
                label="Number of steps"
                value={String(num(i.step_count, 3))}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  onFieldChange(
                    "step_count",
                    Math.max(1, parseInt(e.currentTarget.value) || 1)
                  )
                }
                min={1}
                step={1}
              />
              <DimensionField
                id="step_width_m"
                label="Step width"
                value={num(i.step_width_m, 1.2)}
                onChange={(v) => onFieldChange("step_width_m", v)}
              />
            </div>
          </div>
          <BoardWidthPicker
            value={i.board_width_mm}
            onChange={(v) => onFieldChange("board_width_mm", v)}
          />
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            Steps use 280 mm tread depth (Part K minimum). Bullnose /
            riser boards add 2 extra boards per step to the count.
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
