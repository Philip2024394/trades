// RoomEditor — edits a single internal room.
//
// Substrate: solid block/brick or timber studwork (per storey — UK
// standard is solid downstairs, studwork upstairs).
// Finish: skim only / bonding + skim / slab + skim. NO T&J.
// Features: arches × count (each is a fixed feature price).
// Insulation: only shown when substrate = timber studwork.

"use client";

import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import type { ChangeEvent } from "react";
import {
  Button,
  RadioGroup,
  Select,
  TextInput,
  Toggle
} from "@/platform/ui";
import {
  FEATURE_LABEL,
  INSULATION_LABEL,
  INTERNAL_FINISH_LABEL,
  roomCeilingArea,
  roomWallArea
} from "../logic";
import type {
  FeatureType,
  InsulationType,
  InternalFinish,
  Opening,
  OpeningType,
  Room,
  SubstrateType
} from "../logic";
import { OpeningsEditor } from "./OpeningsEditor";

const SUBSTRATE_OPTIONS: {
  value: SubstrateType;
  label: string;
  description: string;
}[] = [
  {
    value: "solid",
    label: "Solid block / brick",
    description: "Direct plaster — bonding + skim, or skim on smooth walls"
  },
  {
    value: "timber_studwork",
    label: "Timber studwork",
    description: "Requires slabbing before finish · upstairs standard"
  }
];

const FINISH_ORDER: InternalFinish[] = [
  "skim_only",
  "bonding_skim",
  "slab_skim"
];

const FEATURE_ORDER: FeatureType[] = [
  "arched_ceiling",
  "arched_wall_edge",
  "arched_doorway",
  "curved_return"
];

const INSULATION_ORDER: InsulationType[] = [
  "mineral_wool",
  "pir_board",
  "sheep_wool"
];

export type RoomEditorProps = {
  room: Room;
  onPatch: (patch: Partial<Room>) => void;
  onAddOpening: (type: OpeningType) => void;
  onPatchOpening: (openingId: string, patch: Partial<Opening>) => void;
  onRemoveOpening: (openingId: string) => void;
  density?: "comfy" | "compact";
};

export function RoomEditor({
  room: r,
  onPatch,
  onAddOpening,
  onPatchOpening,
  onRemoveOpening,
  density = "comfy"
}: RoomEditorProps) {
  const walls = roomWallArea(r);
  const ceiling = roomCeilingArea(r);
  const stackCls =
    density === "comfy" ? "flex flex-col gap-3" : "flex flex-col gap-2";
  const dimGridCls =
    density === "comfy" ? "grid grid-cols-3 gap-2" : "grid grid-cols-3 gap-1.5";

  return (
    <div className={stackCls}>
      <TextInput
        id={`r-name-${r.id}`}
        label="Room name"
        value={r.name}
        onChange={(ev: ChangeEvent<HTMLInputElement>) =>
          onPatch({ name: ev.currentTarget.value })
        }
      />

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Dimensions
        </div>
        <div className={dimGridCls}>
          <TextInput
            id={`r-l-${r.id}`}
            label="Length"
            type="number"
            value={String(r.length_m)}
            onChange={(ev: ChangeEvent<HTMLInputElement>) =>
              onPatch({ length_m: parseFloat(ev.currentTarget.value) || 0 })
            }
            min={0.5}
            step={0.1}
            suffix={
              <span className="text-[10px] font-medium text-neutral-500">m</span>
            }
          />
          <TextInput
            id={`r-w-${r.id}`}
            label="Width"
            type="number"
            value={String(r.width_m)}
            onChange={(ev: ChangeEvent<HTMLInputElement>) =>
              onPatch({ width_m: parseFloat(ev.currentTarget.value) || 0 })
            }
            min={0.5}
            step={0.1}
            suffix={
              <span className="text-[10px] font-medium text-neutral-500">m</span>
            }
          />
          <TextInput
            id={`r-h-${r.id}`}
            label="Height"
            type="number"
            value={String(r.height_m)}
            onChange={(ev: ChangeEvent<HTMLInputElement>) =>
              onPatch({ height_m: parseFloat(ev.currentTarget.value) || 0 })
            }
            min={0.5}
            step={0.1}
            suffix={
              <span className="text-[10px] font-medium text-neutral-500">m</span>
            }
          />
        </div>
      </div>

      <div className="rounded-lg bg-neutral-50 px-3 py-2 text-[11px] text-neutral-700">
        Walls net:{" "}
        <span className="font-semibold text-neutral-900">
          {walls.toFixed(1)} m²
        </span>
        {r.include_ceiling ? (
          <>
            {" · "}Ceiling:{" "}
            <span className="font-semibold text-neutral-900">
              {ceiling.toFixed(1)} m²
            </span>
          </>
        ) : null}
      </div>

      <RadioGroup
        id={`r-sub-${r.id}`}
        name={`sub-${r.id}`}
        label="Substrate"
        variant="cards"
        value={r.substrate}
        onChange={(v) => onPatch({ substrate: v as SubstrateType })}
        options={SUBSTRATE_OPTIONS}
      />

      <Select
        id={`r-fin-${r.id}`}
        label="Finish"
        value={r.finish}
        onChange={(ev: ChangeEvent<HTMLSelectElement>) =>
          onPatch({ finish: ev.currentTarget.value as InternalFinish })
        }
        options={FINISH_ORDER.map((f) => ({
          value: f,
          label: INTERNAL_FINISH_LABEL[f]
        }))}
      />
      {r.substrate === "solid" && r.finish === "slab_skim" ? (
        <div className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          Slabbing over solid walls is uncommon — usually bonding + skim
          direct.
        </div>
      ) : null}

      <Toggle
        id={`r-inc-c-${r.id}`}
        label="Skim the ceiling too"
        description="Adds L × W to the total area"
        checked={r.include_ceiling}
        onChange={(v) => onPatch({ include_ceiling: v })}
      />

      <OpeningsEditor
        openings={r.openings}
        onAdd={onAddOpening}
        onPatch={onPatchOpening}
        onRemove={onRemoveOpening}
      />

      <TextInput
        id={`r-ic-${r.id}`}
        label="Internal edge corners (count)"
        type="number"
        value={String(r.internal_corners)}
        onChange={(ev: ChangeEvent<HTMLInputElement>) =>
          onPatch({
            internal_corners: Math.max(
              0,
              parseInt(ev.currentTarget.value) || 0
            )
          })
        }
        min={0}
        step={1}
        hint="Standard rectangular room = 4 vertical internal corners"
      />

      {/* Features */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Features ({r.features.length})
          </div>
          <Button
            intent="ghost"
            size="sm"
            icon={Plus}
            type="button"
            onClick={() =>
              onPatch({
                features: [
                  ...r.features,
                  { type: "arched_wall_edge", count: 1 }
                ]
              })
            }
          >
            Add feature
          </Button>
        </div>
        {r.features.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-600">
            Add an arch or curved return if this room has any.
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {r.features.map((f, idx) => (
              <li
                key={idx}
                className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.6fr)_auto] gap-1.5 rounded-lg border border-neutral-200 bg-white p-2"
              >
                <Select
                  id={`f-t-${r.id}-${idx}`}
                  value={f.type}
                  onChange={(ev: ChangeEvent<HTMLSelectElement>) => {
                    const next = [...r.features];
                    next[idx] = {
                      ...f,
                      type: ev.currentTarget.value as FeatureType
                    };
                    onPatch({ features: next });
                  }}
                  options={FEATURE_ORDER.map((t) => ({
                    value: t,
                    label: FEATURE_LABEL[t]
                  }))}
                />
                <TextInput
                  id={`f-c-${r.id}-${idx}`}
                  type="number"
                  value={String(f.count)}
                  onChange={(ev: ChangeEvent<HTMLInputElement>) => {
                    const next = [...r.features];
                    next[idx] = {
                      ...f,
                      count: Math.max(1, parseInt(ev.currentTarget.value) || 1)
                    };
                    onPatch({ features: next });
                  }}
                  min={1}
                  step={1}
                  suffix={
                    <span className="text-[10px] font-medium text-neutral-500">
                      ×
                    </span>
                  }
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = [...r.features];
                    next.splice(idx, 1);
                    onPatch({ features: next });
                  }}
                  aria-label="Remove feature"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Insulation — only for timber studwork */}
      {r.substrate === "timber_studwork" ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-2.5">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Insulation
          </div>
          <Toggle
            id={`r-ins-toggle-${r.id}`}
            label="Timber studding needs insulation"
            description="Adds a separate line for mineral wool / PIR / sheep wool"
            checked={r.insulation !== null}
            onChange={(v) =>
              onPatch({
                insulation: v
                  ? { type: "mineral_wool", thickness_mm: 100 }
                  : null
              })
            }
          />
          {r.insulation ? (
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <Select
                id={`r-ins-type-${r.id}`}
                label="Type"
                value={r.insulation.type}
                onChange={(ev: ChangeEvent<HTMLSelectElement>) =>
                  onPatch({
                    insulation: r.insulation
                      ? {
                          ...r.insulation,
                          type: ev.currentTarget.value as InsulationType
                        }
                      : null
                  })
                }
                options={INSULATION_ORDER.map((t) => ({
                  value: t,
                  label: INSULATION_LABEL[t]
                }))}
              />
              <TextInput
                id={`r-ins-thk-${r.id}`}
                label="Thickness"
                type="number"
                value={String(r.insulation.thickness_mm)}
                onChange={(ev: ChangeEvent<HTMLInputElement>) =>
                  onPatch({
                    insulation: r.insulation
                      ? {
                          ...r.insulation,
                          thickness_mm:
                            parseInt(ev.currentTarget.value) || 100
                        }
                      : null
                  })
                }
                min={25}
                step={25}
                suffix={
                  <span className="text-[10px] font-medium text-neutral-500">
                    mm
                  </span>
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <Toggle
        id={`r-high-${r.id}`}
        label="High ceiling / hallway / above 3 m"
        description="Applies your global height uplift %"
        checked={r.high_ceiling}
        onChange={(v) => onPatch({ high_ceiling: v })}
      />

      <Toggle
        id={`r-inc-${r.id}`}
        label="Include this room in quote"
        checked={r.include}
        onChange={(v) => onPatch({ include: v })}
      />
    </div>
  );
}
