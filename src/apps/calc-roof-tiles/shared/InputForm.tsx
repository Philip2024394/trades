// InputForm — roof shape (gable/hip) + dimensions + material + pitch.
//
// The job scope is picked separately at the top; this form handles the
// underlying calc's inputs. Material picker adapts to the scope's
// allowed materials.

"use client";

import type { ChangeEvent } from "react";
import { RadioGroup, Select, TextInput, Toggle } from "@/platform/ui";
import {
  ROOF_MATERIAL_LABEL,
  ROOF_TILES_SCENARIO_LABEL,
  VALLEY_MATERIAL_LABEL
} from "../logic";
import type {
  RoofJobScope,
  RoofMaterial,
  RoofTilesInputs,
  RoofTilesScenario,
  ValleyMaterial
} from "../logic";

export type InputFormDensity = "comfy" | "compact";

export type InputFormProps = {
  roofShape: RoofTilesScenario;
  onRoofShapeChange: (s: RoofTilesScenario) => void;
  scope: RoofJobScope;
  allowedMaterials: RoofMaterial[];
  inputs: RoofTilesInputs;
  onFieldChange: (field: string, value: unknown) => void;
  valleyLengthM: number;
  onValleyLengthChange: (v: number) => void;
  valleyMaterial: ValleyMaterial;
  onValleyMaterialChange: (m: ValleyMaterial) => void;
  density?: InputFormDensity;
};

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}

const PITCH_OPTIONS: RoofTilesInputs["pitch_deg"][] = [
  15, 22.5, 30, 35, 40, 45
];

export function InputForm({
  roofShape,
  onRoofShapeChange,
  scope,
  allowedMaterials,
  inputs,
  onFieldChange,
  valleyLengthM,
  onValleyLengthChange,
  valleyMaterial,
  onValleyMaterialChange,
  density = "comfy"
}: InputFormProps) {
  const stackCls =
    density === "comfy" ? "flex flex-col gap-3" : "flex flex-col gap-2";
  const dim2Col =
    density === "comfy" ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-2";

  return (
    <div className={stackCls}>
      <RadioGroup
        id="roof_shape"
        name="roof_shape"
        label="Roof shape"
        variant="cards"
        value={roofShape}
        onChange={(v) => onRoofShapeChange(v as RoofTilesScenario)}
        options={[
          {
            value: "gable",
            label: ROOF_TILES_SCENARIO_LABEL.gable,
            description: "Two slopes, straight ends — most UK detached / semi"
          },
          {
            value: "hip",
            label: ROOF_TILES_SCENARIO_LABEL.hip,
            description: "All four sides slope — needs hip tiles + ~7% more tiles"
          }
        ]}
      />

      <div className={dim2Col}>
        <TextInput
          id="plan_area_m2"
          type="number"
          label="Plan area (footprint)"
          value={String(num(inputs.plan_area_m2, 50))}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onFieldChange(
              "plan_area_m2",
              parseFloat(e.currentTarget.value) || 0
            )
          }
          min={1}
          step={0.5}
          suffix={
            <span className="text-[11px] font-medium text-neutral-500">m²</span>
          }
        />
        <Select
          id="pitch_deg"
          label="Roof pitch"
          value={String(inputs.pitch_deg)}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            onFieldChange(
              "pitch_deg",
              parseFloat(e.currentTarget.value) as RoofTilesInputs["pitch_deg"]
            )
          }
          options={PITCH_OPTIONS.map((p) => ({
            value: String(p),
            label: `${p}°`
          }))}
        />
      </div>

      <div className={dim2Col}>
        <TextInput
          id="ridge_length_m"
          type="number"
          label="Ridge length"
          value={String(num(inputs.ridge_length_m, 8))}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onFieldChange(
              "ridge_length_m",
              parseFloat(e.currentTarget.value) || 0
            )
          }
          min={0}
          step={0.1}
          suffix={
            <span className="text-[11px] font-medium text-neutral-500">m</span>
          }
        />
        {roofShape === "hip" ? (
          <TextInput
            id="hip_length_m"
            type="number"
            label="Total hip length"
            value={String(
              num(
                (inputs as Extract<RoofTilesInputs, { scenario: "hip" }>)
                  .hip_length_m,
                5
              )
            )}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onFieldChange(
                "hip_length_m",
                parseFloat(e.currentTarget.value) || 0
              )
            }
            min={0}
            step={0.1}
            suffix={
              <span className="text-[11px] font-medium text-neutral-500">m</span>
            }
          />
        ) : null}
      </div>

      <Select
        id="tile_type"
        label={
          scope === "reslate_with_membrane"
            ? "Slate type"
            : scope === "retile_with_membrane"
              ? "Tile type"
              : "Material"
        }
        value={inputs.tile_type}
        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
          onFieldChange("tile_type", e.currentTarget.value as RoofMaterial)
        }
        options={allowedMaterials.map((m) => ({
          value: m,
          label: ROOF_MATERIAL_LABEL[m]
        }))}
      />

      <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
        {scope === "retile_with_membrane"
          ? "Retile scope: batten strips + soundness check assumed. New Type 5U membrane laid over battens with 150 mm overlaps at joints, 100 mm at ridge."
          : scope === "reslate_with_membrane"
            ? "Reslate scope: existing battens re-used if sound. Slate nails at 25 mm gauge on head, 50 mm on tail. New membrane under slates protects roof from wind-driven rain."
            : "Full strip: old tiles/slates off, sarking checked, 25×50 mm treated battens at gauge for tile type, breather membrane over rafters, new tile/slate laid. Add-in for felt disposal at skip cost."}
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Valley lining
        </div>
        <div className={dim2Col}>
          <TextInput
            id="valley_length_m"
            type="number"
            label="Valley length"
            value={String(valleyLengthM)}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onValleyLengthChange(parseFloat(e.currentTarget.value) || 0)
            }
            min={0}
            step={0.1}
            hint="0 if no valleys"
            suffix={
              <span className="text-[11px] font-medium text-neutral-500">m</span>
            }
          />
          <Select
            id="valley_material"
            label="Material"
            value={valleyMaterial}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              onValleyMaterialChange(e.currentTarget.value as ValleyMaterial)
            }
            disabled={valleyLengthM === 0}
            options={(
              ["lead_code_4", "copper", "grp_valley"] as ValleyMaterial[]
            ).map((m) => ({
              value: m,
              label: VALLEY_MATERIAL_LABEL[m]
            }))}
          />
        </div>
        {valleyLengthM > 0 ? (
          <div className="mt-1.5 rounded-md bg-neutral-50 px-2 py-1.5 text-[11px] text-neutral-700">
            Valley is the internal corner where two roof slopes meet.
            Lead code 4 is the UK standard; copper is a premium
            alternative (matches copper flashings). GRP is the budget
            plastic option for hidden valleys.
          </div>
        ) : null}
      </div>

      <Toggle
        id="waste_5pct"
        label="Add 5% wastage"
        description="Cuts + damaged tiles/slates — standard UK trade over-order"
        checked={inputs.waste_5pct}
        onChange={(v) => onFieldChange("waste_5pct", v)}
      />
    </div>
  );
}
