// ScenarioPicker — 5-scenario chooser with grid / scroll / select modes.

"use client";

import {
  Home,
  Layers,
  MoveDown,
  Route,
  Square as SquareIcon
} from "lucide-react";
import type { ComponentType } from "react";
import { Select } from "@/platform/ui";
import type { FlooringScenario } from "../logic";

const ICON_MAP: Record<
  FlooringScenario,
  ComponentType<{ className?: string }>
> = {
  rectangular: SquareIcon,
  l_shape: Home,
  stairs: MoveDown,
  hallway: Route,
  multi_room: Layers
};

const ORDER: readonly FlooringScenario[] = [
  "rectangular",
  "l_shape",
  "stairs",
  "hallway",
  "multi_room"
];

export type ScenarioPickerMode = "grid" | "scroll" | "select";

export type ScenarioPickerProps = {
  scenario: FlooringScenario;
  labels: Record<FlooringScenario, string>;
  onChange: (s: FlooringScenario) => void;
  mode: ScenarioPickerMode;
};

export function ScenarioPicker({
  scenario,
  labels,
  onChange,
  mode
}: ScenarioPickerProps) {
  if (mode === "select") {
    return (
      <Select
        id="flooring-scenario"
        value={scenario}
        onChange={(e) => onChange(e.currentTarget.value as FlooringScenario)}
        options={ORDER.map((s) => ({ value: s, label: labels[s] }))}
      />
    );
  }
  if (mode === "grid") {
    return (
      <ul className="grid grid-cols-5 gap-2">
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
                <Icon
                  className={`h-4 w-4 ${
                    active ? "text-amber-700" : "text-neutral-500"
                  }`}
                />
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
  // scroll
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
