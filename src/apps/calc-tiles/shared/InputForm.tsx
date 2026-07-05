// InputForm — per-scenario tile fields.
//
// Uses common tile-size presets (150×150 · 200×200 · 300×300 ·
// 300×600 · 600×600 · custom) so tradies don't type mm every time.

"use client";

import type { ChangeEvent } from "react";
import { RadioGroup, Select, TextInput, Toggle } from "@/platform/ui";
import type { TilesInputs, TilesScenario } from "../logic";

export type InputFormDensity = "comfy" | "compact";

export type InputFormProps = {
  scenario: TilesScenario;
  inputs: TilesInputs;
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

const TILE_SIZE_PRESETS = [
  { key: "150x150", label: "150 × 150 mm (mosaic)", w: 150, h: 150 },
  { key: "200x200", label: "200 × 200 mm (metro)", w: 200, h: 200 },
  { key: "300x300", label: "300 × 300 mm", w: 300, h: 300 },
  { key: "300x600", label: "300 × 600 mm", w: 300, h: 600 },
  { key: "600x300", label: "600 × 300 mm (subway large)", w: 600, h: 300 },
  { key: "600x600", label: "600 × 600 mm (patio standard)", w: 600, h: 600 },
  { key: "custom", label: "Custom size", w: 0, h: 0 }
];

function TileSizeField({
  tile_w_mm,
  tile_h_mm,
  onChange,
  density
}: {
  tile_w_mm: number;
  tile_h_mm: number;
  onChange: (w: number, h: number) => void;
  density: InputFormDensity;
}) {
  const activePreset =
    TILE_SIZE_PRESETS.find(
      (p) => p.w === tile_w_mm && p.h === tile_h_mm && p.key !== "custom"
    )?.key ?? "custom";
  const isCustom = activePreset === "custom";
  const grid2 = density === "comfy" ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-2";
  return (
    <div className="flex flex-col gap-2">
      <Select
        id="tile_size"
        label="Tile size"
        value={activePreset}
        onChange={(e) => {
          const preset = TILE_SIZE_PRESETS.find(
            (p) => p.key === e.currentTarget.value
          );
          if (!preset) return;
          if (preset.key === "custom") {
            // keep current values on custom-mode switch
            onChange(tile_w_mm || 300, tile_h_mm || 300);
          } else {
            onChange(preset.w, preset.h);
          }
        }}
        options={TILE_SIZE_PRESETS.map((p) => ({
          value: p.key,
          label: p.label
        }))}
      />
      {isCustom ? (
        <div className={grid2}>
          <TextInput
            id="tile_w_mm"
            type="number"
            label="Tile width"
            value={String(tile_w_mm)}
            onChange={(e) =>
              onChange(parseInt(e.currentTarget.value, 10) || 0, tile_h_mm)
            }
            min={10}
            step={1}
            suffix={<span className="text-[11px] font-medium text-neutral-500">mm</span>}
          />
          <TextInput
            id="tile_h_mm"
            type="number"
            label="Tile height"
            value={String(tile_h_mm)}
            onChange={(e) =>
              onChange(tile_w_mm, parseInt(e.currentTarget.value, 10) || 0)
            }
            min={10}
            step={1}
            suffix={<span className="text-[11px] font-medium text-neutral-500">mm</span>}
          />
        </div>
      ) : null}
    </div>
  );
}

function JointField({
  value,
  onChange
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Select
      id="joint_mm"
      label="Grout joint width"
      value={String(value)}
      onChange={(e) => onChange(parseInt(e.currentTarget.value, 10) || 3)}
      options={[
        { value: "2", label: "2 mm (rectified)" },
        { value: "3", label: "3 mm (standard)" },
        { value: "5", label: "5 mm (rustic / outdoor)" },
        { value: "8", label: "8 mm (natural stone)" }
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
    case "bathroom_floor": {
      const i = inputs as Extract<TilesInputs, { scenario: "bathroom_floor" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Length"
              value={num(i.length_m, 2.5)}
              onChange={(v) => onFieldChange("length_m", v)}
            />
            <DimensionField
              id="width_m"
              label="Width"
              value={num(i.width_m, 2)}
              onChange={(v) => onFieldChange("width_m", v)}
            />
          </div>
          <TileSizeField
            tile_w_mm={i.tile_w_mm}
            tile_h_mm={i.tile_h_mm}
            onChange={(w, h) => {
              onFieldChange("tile_w_mm", w);
              onFieldChange("tile_h_mm", h);
            }}
            density={density}
          />
          <JointField
            value={i.joint_mm}
            onChange={(v) => onFieldChange("joint_mm", v)}
          />
        </div>
      );
    }
    case "shower_walls": {
      const i = inputs as Extract<TilesInputs, { scenario: "shower_walls" }>;
      return (
        <div className={stackCls}>
          <DimensionField
            id="height_m"
            label="Wall height"
            value={num(i.height_m, 2.2)}
            onChange={(v) => onFieldChange("height_m", v)}
          />
          <div className={dim2Col}>
            <DimensionField
              id="wall_a_m"
              label="Wall A width"
              value={num(i.wall_a_m, 0.9)}
              onChange={(v) => onFieldChange("wall_a_m", v)}
            />
            <DimensionField
              id="wall_b_m"
              label="Wall B width"
              value={num(i.wall_b_m, 0.9)}
              onChange={(v) => onFieldChange("wall_b_m", v)}
            />
          </div>
          <TileSizeField
            tile_w_mm={i.tile_w_mm}
            tile_h_mm={i.tile_h_mm}
            onChange={(w, h) => {
              onFieldChange("tile_w_mm", w);
              onFieldChange("tile_h_mm", h);
            }}
            density={density}
          />
          <JointField
            value={i.joint_mm}
            onChange={(v) => onFieldChange("joint_mm", v)}
          />
          <Toggle
            id="diagonal"
            label="Diagonal lay (45°)"
            description="Adds 5% extra wastage for corner cuts"
            checked={i.diagonal}
            onChange={(v) => onFieldChange("diagonal", v)}
          />
        </div>
      );
    }
    case "splashback": {
      const i = inputs as Extract<TilesInputs, { scenario: "splashback" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Splashback length"
              value={num(i.length_m, 3)}
              onChange={(v) => onFieldChange("length_m", v)}
            />
            <DimensionField
              id="height_m"
              label="Splashback height"
              value={num(i.height_m, 0.6)}
              onChange={(v) => onFieldChange("height_m", v)}
            />
          </div>
          <TileSizeField
            tile_w_mm={i.tile_w_mm}
            tile_h_mm={i.tile_h_mm}
            onChange={(w, h) => {
              onFieldChange("tile_w_mm", w);
              onFieldChange("tile_h_mm", h);
            }}
            density={density}
          />
          <JointField
            value={i.joint_mm}
            onChange={(v) => onFieldChange("joint_mm", v)}
          />
        </div>
      );
    }
    case "whole_bathroom": {
      const i = inputs as Extract<TilesInputs, { scenario: "whole_bathroom" }>;
      return (
        <div className={stackCls}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Floor
          </div>
          <div className={dim2Col}>
            <DimensionField
              id="floor_length_m"
              label="Floor length"
              value={num(i.floor_length_m, 2.5)}
              onChange={(v) => onFieldChange("floor_length_m", v)}
            />
            <DimensionField
              id="floor_width_m"
              label="Floor width"
              value={num(i.floor_width_m, 2)}
              onChange={(v) => onFieldChange("floor_width_m", v)}
            />
          </div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Walls
          </div>
          <DimensionField
            id="wall_height_m"
            label="Wall height (tiled height)"
            value={num(i.wall_height_m, 2.2)}
            onChange={(v) => onFieldChange("wall_height_m", v)}
          />
          <Toggle
            id="bath_surround"
            label="Tile bath surround"
            description="Adds ~4 m² of bath-side tiling"
            checked={i.bath_surround}
            onChange={(v) => onFieldChange("bath_surround", v)}
          />
          <TileSizeField
            tile_w_mm={i.tile_w_mm}
            tile_h_mm={i.tile_h_mm}
            onChange={(w, h) => {
              onFieldChange("tile_w_mm", w);
              onFieldChange("tile_h_mm", h);
            }}
            density={density}
          />
          <JointField
            value={i.joint_mm}
            onChange={(v) => onFieldChange("joint_mm", v)}
          />
        </div>
      );
    }
    case "outdoor_patio": {
      const i = inputs as Extract<TilesInputs, { scenario: "outdoor_patio" }>;
      return (
        <div className={stackCls}>
          <div className={dim2Col}>
            <DimensionField
              id="length_m"
              label="Patio length"
              value={num(i.length_m, 5)}
              onChange={(v) => onFieldChange("length_m", v)}
            />
            <DimensionField
              id="width_m"
              label="Patio width"
              value={num(i.width_m, 4)}
              onChange={(v) => onFieldChange("width_m", v)}
            />
          </div>
          <TileSizeField
            tile_w_mm={i.tile_w_mm}
            tile_h_mm={i.tile_h_mm}
            onChange={(w, h) => {
              onFieldChange("tile_w_mm", w);
              onFieldChange("tile_h_mm", h);
            }}
            density={density}
          />
          <RadioGroup
            id="joint_mm_group"
            name="joint_mm_group"
            label="Grout joint width"
            variant="cards"
            value={String(i.joint_mm)}
            onChange={(v) => onFieldChange("joint_mm", parseInt(v, 10))}
            options={[
              {
                value: "5",
                label: "5 mm",
                description: "Standard outdoor porcelain"
              },
              {
                value: "8",
                label: "8 mm",
                description: "Wider gap · natural stone"
              }
            ]}
          />
          <Toggle
            id="diagonal"
            label="Diagonal lay (45°)"
            description="Adds 5% extra wastage for edge cuts"
            checked={i.diagonal}
            onChange={(v) => onFieldChange("diagonal", v)}
          />
        </div>
      );
    }
  }
}
