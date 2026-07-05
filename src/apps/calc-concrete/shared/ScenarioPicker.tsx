// ScenarioPicker — 5-scenario chooser.

"use client";

import { Car, Fence, Home, Route, Square } from "lucide-react";
import type { ComponentType } from "react";
import { Select } from "@/platform/ui";
import type { ConcreteScenario } from "../logic";

const ICON_MAP: Record<
  ConcreteScenario,
  ComponentType<{ className?: string }>
> = {
  patio_slab: Square,
  path: Route,
  fence_post_bases: Fence,
  shed_base: Home,
  driveway: Car
};

const ORDER: readonly ConcreteScenario[] = [
  "patio_slab",
  "path",
  "fence_post_bases",
  "shed_base",
  "driveway"
];

export type ScenarioPickerMode = "grid" | "scroll" | "select";
export type ScenarioPickerProps = {
  scenario: ConcreteScenario;
  labels: Record<ConcreteScenario, string>;
  onChange: (s: ConcreteScenario) => void;
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
        id="concrete-scenario"
        value={scenario}
        onChange={(e) => onChange(e.currentTarget.value as ConcreteScenario)}
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
