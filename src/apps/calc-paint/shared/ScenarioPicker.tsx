// ScenarioPicker — the 9-scenario chooser.
//
// Three rendering modes:
//   grid — 3×3 tile grid (landscape hero picker)
//   scroll — horizontal chip strip (square + portrait compact)
//   select — native <select> (very-narrow contexts)

"use client";

import {
  DoorOpen,
  Fence,
  Home,
  Landmark,
  Layers,
  Paintbrush,
  RectangleVertical,
  Ruler,
  Square
} from "lucide-react";
import type { ComponentType } from "react";
import { Select } from "@/platform/ui";
import type { PaintScenario } from "../logic";

const ICON_MAP: Record<PaintScenario, ComponentType<{ className?: string }>> = {
  quick_estimate: Paintbrush,
  full_room: Home,
  single_wall: Square,
  external_masonry: Landmark,
  doors_only: DoorOpen,
  windows_only: RectangleVertical,
  timber_fence: Fence,
  metal_railing: Layers,
  skirting_trim: Ruler
};

export type ScenarioPickerMode = "grid" | "scroll" | "select";

export type ScenarioPickerProps = {
  scenario: PaintScenario;
  labels: Record<PaintScenario, string>;
  onChange: (s: PaintScenario) => void;
  mode: ScenarioPickerMode;
};

const ORDER: readonly PaintScenario[] = [
  "quick_estimate",
  "full_room",
  "single_wall",
  "external_masonry",
  "doors_only",
  "windows_only",
  "timber_fence",
  "metal_railing",
  "skirting_trim"
];

export function ScenarioPicker({
  scenario,
  labels,
  onChange,
  mode
}: ScenarioPickerProps) {
  if (mode === "select") {
    return (
      <Select
        id="paint-scenario"
        value={scenario}
        onChange={(e) => onChange(e.currentTarget.value as PaintScenario)}
        options={ORDER.map((s) => ({ value: s, label: labels[s] }))}
      />
    );
  }
  if (mode === "grid") {
    return (
      <ul className="grid grid-cols-3 gap-2">
        {ORDER.map((s) => {
          const Icon = ICON_MAP[s];
          const active = s === scenario;
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => onChange(s)}
                className={`flex min-h-[64px] w-full flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center transition ${
                  active
                    ? "border-amber-400 bg-amber-50 text-neutral-900"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-amber-700" : "text-neutral-500"}`} />
                <span className="text-[11px] font-medium leading-tight">
                  {labels[s]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }
  // scroll mode
  return (
    <div
      className="-mx-1 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-1 pb-1"
      style={{ scrollbarWidth: "none" }}
    >
      {ORDER.map((s) => {
        const Icon = ICON_MAP[s];
        const active = s === scenario;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`inline-flex min-h-[36px] shrink-0 snap-start items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition ${
              active
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {labels[s]}
          </button>
        );
      })}
    </div>
  );
}
