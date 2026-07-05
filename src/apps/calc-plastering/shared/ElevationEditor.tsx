// ElevationEditor — edits a single external elevation.
//
// Composes WallShapePicker (illustrated) + rect dimensions + gable
// triangle (only when rect_gable) + openings list + quoin corners
// + high-ceiling toggle + finish selector.

"use client";

import { AlertTriangle } from "lucide-react";
import type { ChangeEvent } from "react";
import { RadioGroup, Select, TextInput, Toggle } from "@/platform/ui";
import {
  elevationGrossArea,
  elevationNetArea,
  EXTERNAL_FINISH_LABEL
} from "../logic";
import type { Elevation, ExternalFinish, Opening, OpeningType } from "../logic";
import { OpeningsEditor } from "./OpeningsEditor";
import { WallShapePicker } from "./WallShapePicker";

const FINISH_ORDER: ExternalFinish[] = [
  "sc_smooth",
  "sc_sponge",
  "nap_dash",
  "pebble_dash",
  "stone_dash",
  "roughcast",
  "monocouche",
  "silicone",
  "acrylic",
  "lime"
];

const QUOIN_OPTIONS = [
  { value: "0", label: "No quoin work" },
  { value: "1", label: "1 corner has quoins" },
  { value: "2", label: "Both corners have quoins" }
];

export type ElevationEditorProps = {
  elevation: Elevation;
  onPatch: (patch: Partial<Elevation>) => void;
  onAddOpening: (type: OpeningType) => void;
  onPatchOpening: (openingId: string, patch: Partial<Opening>) => void;
  onRemoveOpening: (openingId: string) => void;
  density?: "comfy" | "compact";
};

export function ElevationEditor({
  elevation: e,
  onPatch,
  onAddOpening,
  onPatchOpening,
  onRemoveOpening,
  density = "comfy"
}: ElevationEditorProps) {
  const gross = elevationGrossArea(e);
  const net = elevationNetArea(e);
  const dimGridCls =
    density === "comfy" ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 gap-1.5";
  const stackCls =
    density === "comfy" ? "flex flex-col gap-3" : "flex flex-col gap-2";

  // Detect a degenerate gable triangle (impossible with the given 3 sides)
  const gableInvalid =
    e.wall_shape === "rect_gable" &&
    (e.gable_base_m + e.gable_left_slope_m <= e.gable_right_slope_m ||
      e.gable_base_m + e.gable_right_slope_m <= e.gable_left_slope_m ||
      e.gable_left_slope_m + e.gable_right_slope_m <= e.gable_base_m);

  return (
    <div className={stackCls}>
      <div className="flex items-center justify-between">
        <TextInput
          id={`el-name-${e.id}`}
          label="Elevation name"
          value={e.name}
          onChange={(ev: ChangeEvent<HTMLInputElement>) =>
            onPatch({ name: ev.currentTarget.value })
          }
        />
      </div>

      <WallShapePicker
        value={e.wall_shape}
        onChange={(v) => onPatch({ wall_shape: v })}
      />

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Rectangle
        </div>
        <div className={dimGridCls}>
          <TextInput
            id={`el-rw-${e.id}`}
            label="Width"
            type="number"
            value={String(e.rect_width_m)}
            onChange={(ev: ChangeEvent<HTMLInputElement>) =>
              onPatch({ rect_width_m: parseFloat(ev.currentTarget.value) || 0 })
            }
            min={0.5}
            step={0.1}
            suffix={
              <span className="text-[11px] font-medium text-neutral-500">m</span>
            }
          />
          <TextInput
            id={`el-rh-${e.id}`}
            label="Height (eaves)"
            type="number"
            value={String(e.rect_height_m)}
            onChange={(ev: ChangeEvent<HTMLInputElement>) =>
              onPatch({ rect_height_m: parseFloat(ev.currentTarget.value) || 0 })
            }
            min={0.5}
            step={0.1}
            suffix={
              <span className="text-[11px] font-medium text-neutral-500">m</span>
            }
          />
        </div>
      </div>

      {e.wall_shape === "rect_gable" ? (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Gable triangle — 3 sides
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <TextInput
              id={`el-gb-${e.id}`}
              label="Base"
              type="number"
              value={String(e.gable_base_m)}
              onChange={(ev: ChangeEvent<HTMLInputElement>) =>
                onPatch({ gable_base_m: parseFloat(ev.currentTarget.value) || 0 })
              }
              min={0.5}
              step={0.1}
              suffix={
                <span className="text-[10px] font-medium text-neutral-500">
                  m
                </span>
              }
            />
            <TextInput
              id={`el-gl-${e.id}`}
              label="Left slope"
              type="number"
              value={String(e.gable_left_slope_m)}
              onChange={(ev: ChangeEvent<HTMLInputElement>) =>
                onPatch({
                  gable_left_slope_m: parseFloat(ev.currentTarget.value) || 0
                })
              }
              min={0.5}
              step={0.1}
              suffix={
                <span className="text-[10px] font-medium text-neutral-500">
                  m
                </span>
              }
            />
            <TextInput
              id={`el-gr-${e.id}`}
              label="Right slope"
              type="number"
              value={String(e.gable_right_slope_m)}
              onChange={(ev: ChangeEvent<HTMLInputElement>) =>
                onPatch({
                  gable_right_slope_m: parseFloat(ev.currentTarget.value) || 0
                })
              }
              min={0.5}
              step={0.1}
              suffix={
                <span className="text-[10px] font-medium text-neutral-500">
                  m
                </span>
              }
            />
          </div>
          {gableInvalid ? (
            <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-[11px] text-red-800">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              Impossible triangle — any two sides must add to more than the
              third. Re-measure.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg bg-neutral-50 px-3 py-2 text-[11px] text-neutral-700">
        Gross area:{" "}
        <span className="font-semibold text-neutral-900">
          {gross.toFixed(1)} m²
        </span>
        {e.openings.length > 0 ? (
          <>
            {" · "}Net after openings:{" "}
            <span className="font-semibold text-neutral-900">
              {net.toFixed(1)} m²
            </span>
          </>
        ) : null}
      </div>

      <OpeningsEditor
        openings={e.openings}
        onAdd={onAddOpening}
        onPatch={onPatchOpening}
        onRemove={onRemoveOpening}
      />

      <RadioGroup
        id={`el-quoin-${e.id}`}
        name={`quoin-${e.id}`}
        label="Quoin / corner work"
        variant="cards"
        value={String(e.quoin_corners)}
        onChange={(v) =>
          onPatch({ quoin_corners: parseInt(v) as 0 | 1 | 2 })
        }
        options={QUOIN_OPTIONS}
      />

      <Select
        id={`el-finish-${e.id}`}
        label="External finish"
        value={e.finish}
        onChange={(ev: ChangeEvent<HTMLSelectElement>) =>
          onPatch({ finish: ev.currentTarget.value as ExternalFinish })
        }
        options={FINISH_ORDER.map((f) => ({
          value: f,
          label: EXTERNAL_FINISH_LABEL[f]
        }))}
      />

      <Toggle
        id={`el-high-${e.id}`}
        label="High elevation / above 3 m"
        description="Applies your global height uplift %"
        checked={e.high_ceiling}
        onChange={(v) => onPatch({ high_ceiling: v })}
      />

      <Toggle
        id={`el-inc-${e.id}`}
        label="Include this elevation in quote"
        description="Toggle off for elevations already rendered / not in scope"
        checked={e.include}
        onChange={(v) => onPatch({ include: v })}
      />
    </div>
  );
}
