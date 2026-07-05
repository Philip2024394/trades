// ScenarioPicker — 4-scenario chooser.

"use client";

import { Home, Layers, MoveDown, Ruler } from "lucide-react";
import type { ComponentType } from "react";
import { Select } from "@/platform/ui";
import type { InsulationScenario } from "../logic";

const ICON_MAP: Record<
  InsulationScenario,
  ComponentType<{ className?: string }>
> = {
  loft: Layers,
  wall_cavity: Ruler,
  solid_floor: MoveDown,
  pitched_roof: Home
};

const ORDER: readonly InsulationScenario[] = [
  "loft",
  "wall_cavity",
  "solid_floor",
  "pitched_roof"
];

export type ScenarioPickerMode = "grid" | "scroll" | "select";
export type ScenarioPickerProps = {
  scenario: InsulationScenario;
  labels: Record<InsulationScenario, string>;
  onChange: (s: InsulationScenario) => void;
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
        id="insulation-scenario"
        value={scenario}
        onChange={(e) =>
          onChange(e.currentTarget.value as InsulationScenario)
        }
        options={ORDER.map((s) => ({ value: s, label: labels[s] }))}
      />
    );
  }
  if (mode === "grid") {
    return (
      <ul className="grid grid-cols-4 gap-2">
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
