// BeadingRatesForm — 4 beading types with £/m OR "Free (included)".
//
// This is the "My rates" section. Plasterer sets their prices once
// and the engine applies them to every window / door / corner
// automatically based on measured perimeters.

"use client";

import { CornerDownRight, DoorOpen, Frame, Square } from "lucide-react";
import type { ChangeEvent, ComponentType } from "react";
import { TextInput, Toggle } from "@/platform/ui";
import type { BeadingRates } from "../logic";

type BeadKey = keyof BeadingRates;

const BEAD_META: Record<
  BeadKey,
  { label: string; hint: string; Icon: ComponentType<{ className?: string }> }
> = {
  window: {
    label: "Window bead",
    hint: "Auto: top + left + right of every window",
    Icon: Square
  },
  door: {
    label: "Door bead",
    hint: "Auto: top + left + right of every door type",
    Icon: DoorOpen
  },
  external_corner: {
    label: "External corner bead",
    hint: "Auto: elevation height × quoin corners",
    Icon: Frame
  },
  internal_edge: {
    label: "Internal edge bead",
    hint: "Auto: room height × internal-corner count",
    Icon: CornerDownRight
  }
};

const ORDER: BeadKey[] = [
  "window",
  "door",
  "external_corner",
  "internal_edge"
];

export type BeadingRatesFormProps = {
  rates: BeadingRates;
  onPatch: (
    key: BeadKey,
    patch: Partial<BeadingRates[BeadKey]>
  ) => void;
};

export function BeadingRatesForm({ rates, onPatch }: BeadingRatesFormProps) {
  return (
    <ul className="flex flex-col gap-1.5">
      {ORDER.map((k) => {
        const { label, hint, Icon } = BEAD_META[k];
        const r = rates[k];
        return (
          <li
            key={k}
            className="rounded-lg border border-neutral-200 bg-white p-2.5"
          >
            <div className="mb-1.5 flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-neutral-500" />
              <div>
                <div className="text-[12px] font-semibold text-neutral-900">
                  {label}
                </div>
                <div className="text-[10px] leading-tight text-neutral-500">
                  {hint}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <TextInput
                id={`bead-${k}`}
                label="Price per meter"
                type="number"
                value={String((r.price_per_m_pence / 100).toFixed(2))}
                onChange={(ev: ChangeEvent<HTMLInputElement>) => {
                  const pence = Math.round(
                    (parseFloat(ev.currentTarget.value) || 0) * 100
                  );
                  onPatch(k, { price_per_m_pence: pence });
                }}
                disabled={r.free}
                min={0}
                step={0.1}
                prefix={
                  <span className="text-[11px] font-medium text-neutral-500">
                    £
                  </span>
                }
                suffix={
                  <span className="text-[10px] font-medium text-neutral-500">
                    / m
                  </span>
                }
              />
              <div className="pb-0.5">
                <Toggle
                  id={`bead-free-${k}`}
                  label="Free"
                  checked={r.free}
                  onChange={(v) => onPatch(k, { free: v })}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
