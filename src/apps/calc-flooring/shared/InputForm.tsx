// InputForm — per-scenario field rendering.
//
// Includes multi-room zone add/remove UI (unique to flooring calc
// vs. the paint calc).

"use client";

import { Plus, X } from "lucide-react";
import type { ChangeEvent } from "react";
import { Button, RadioGroup, Select, TextInput, Toggle } from "@/platform/ui";
import type { FlooringInputs, FlooringScenario } from "../logic";

export type InputFormDensity = "comfy" | "compact";

export type InputFormProps = {
  scenario: FlooringScenario;
  inputs: FlooringInputs;
  onFieldChange: (field: string, value: unknown) => void;
  onAddZone: () => void;
  onRemoveZone: (index: number) => void;
  onUpdateZone: (
    index: number,
    field: "name" | "length_m" | "width_m",
    value: string | number
  ) => void;
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
      min={1}
      step={1}
    />
  );
}

function LayoutField({
  value,
  onChange
}: {
  value: "straight" | "diagonal" | "herringbone";
  onChange: (v: "straight" | "diagonal" | "herringbone") => void;
}) {
  return (
    <RadioGroup
      id="layout"
      name="layout"
      label="Lay pattern"
      value={value}
      variant="cards"
      onChange={(v) => onChange(v as "straight" | "diagonal" | "herringbone")}
      options={[
        {
          value: "straight",
          label: "Straight",
          description: "+10% wastage — standard lay along wall"
        },
        {
          value: "diagonal",
          label: "Diagonal",
          description: "+15% wastage — 45° to the wall"
        },
        {
          value: "herringbone",
          label: "Herringbone",
          description: "+20% wastage — parquet pattern"
        }
      ]}
    />
  );
}

export function InputForm({
  scenario,
  inputs,
  onFieldChange,
  onAddZone,
  onRemoveZone,
  onUpdateZone,
  density = "comfy"
}: InputFormProps) {
  const dim2Col = density === "comfy" ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-2";
  const stackCls = density === "comfy" ? "flex flex-col gap-3" : "flex flex-col gap-2";

  switch (scenario) {
    case "rectangular": {
      const i = inputs as Extract<FlooringInputs, { scenario: "rectangular" }>;
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
          </div>
          <LayoutField
            value={i.layout}
            onChange={(v) => onFieldChange("layout", v)}
          />
        </div>
      );
    }
    case "l_shape": {
      const i = inputs as Extract<FlooringInputs, { scenario: "l_shape" }>;
      return (
        <div className={stackCls}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Section A (main area)
          </div>
          <div className={dim2Col}>
            <DimensionField
              id="a_length_m"
              label="Length"
              value={num(i.part_a_length_m, 4)}
              onChange={(v) => onFieldChange("part_a_length_m", v)}
            />
            <DimensionField
              id="a_width_m"
              label="Width"
              value={num(i.part_a_width_m, 3)}
              onChange={(v) => onFieldChange("part_a_width_m", v)}
            />
          </div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Section B (alcove / extension)
          </div>
          <div className={dim2Col}>
            <DimensionField
              id="b_length_m"
              label="Length"
              value={num(i.part_b_length_m, 2)}
              onChange={(v) => onFieldChange("part_b_length_m", v)}
            />
            <DimensionField
              id="b_width_m"
              label="Width"
              value={num(i.part_b_width_m, 1.5)}
              onChange={(v) => onFieldChange("part_b_width_m", v)}
            />
          </div>
        </div>
      );
    }
    case "stairs": {
      const i = inputs as Extract<FlooringInputs, { scenario: "stairs" }>;
      return (
        <div className={stackCls}>
          <CountField
            id="treads"
            label="Number of treads (steps)"
            value={i.treads}
            onChange={(v) => onFieldChange("treads", v)}
          />
          <div className={dim2Col}>
            <DimensionField
              id="tread_depth_m"
              label="Tread depth"
              value={num(i.tread_depth_m, 0.28)}
              onChange={(v) => onFieldChange("tread_depth_m", v)}
            />
            <DimensionField
              id="stair_width_m"
              label="Stair width"
              value={num(i.stair_width_m, 0.9)}
              onChange={(v) => onFieldChange("stair_width_m", v)}
            />
          </div>
          <Toggle
            id="include_risers"
            label="Cover risers (vertical face)"
            description="Adds ~18cm strip per riser to the total"
            checked={i.include_risers}
            onChange={(v) => onFieldChange("include_risers", v)}
          />
        </div>
      );
    }
    case "hallway": {
      const i = inputs as Extract<FlooringInputs, { scenario: "hallway" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Hallway length"
              value={num(i.length_m, 5)}
              onChange={(v) => onFieldChange("length_m", v)}
            />
            <DimensionField
              id="width_m"
              label="Hallway width"
              value={num(i.width_m, 1.2)}
              onChange={(v) => onFieldChange("width_m", v)}
            />
          </div>
        </div>
      );
    }
    case "multi_room": {
      const i = inputs as Extract<FlooringInputs, { scenario: "multi_room" }>;
      return (
        <div className={stackCls}>
          <LayoutField
            value={i.layout}
            onChange={(v) => onFieldChange("layout", v)}
          />
          <ul className="flex flex-col gap-2">
            {i.zones.map((zone, idx) => (
              <li
                key={idx}
                className="rounded-lg border border-neutral-200 bg-neutral-50 p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <TextInput
                    id={`zone-${idx}-name`}
                    value={zone.name}
                    onChange={(e) =>
                      onUpdateZone(idx, "name", e.currentTarget.value)
                    }
                    className="text-[13px]"
                    placeholder="Zone name"
                  />
                  {i.zones.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => onRemoveZone(idx)}
                      aria-label="Remove zone"
                      className="ml-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <div className={dim2Col}>
                  <DimensionField
                    id={`zone-${idx}-length`}
                    label="Length"
                    value={num(zone.length_m, 3)}
                    onChange={(v) => onUpdateZone(idx, "length_m", v)}
                  />
                  <DimensionField
                    id={`zone-${idx}-width`}
                    label="Width"
                    value={num(zone.width_m, 3)}
                    onChange={(v) => onUpdateZone(idx, "width_m", v)}
                  />
                </div>
              </li>
            ))}
          </ul>
          <Button intent="secondary" size="sm" icon={Plus} onClick={onAddZone}>
            Add another zone
          </Button>
        </div>
      );
    }
  }
}
