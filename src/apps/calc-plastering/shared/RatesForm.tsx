// RatesForm — "My rates" section for the plasterer.
//
// Contains: external finish £/m² · internal finish £/m² · height
// uplift % · feature flat rates · insulation £/m² · beading (via
// BeadingRatesForm).

"use client";

import type { ChangeEvent } from "react";
import { TextInput } from "@/platform/ui";
import {
  EXTERNAL_FINISH_LABEL,
  FEATURE_LABEL,
  INSULATION_LABEL,
  INTERNAL_FINISH_LABEL
} from "../logic";
import type {
  ExternalFinish,
  FeatureType,
  InsulationType,
  InternalFinish,
  MyRates
} from "../logic";
import { BeadingRatesForm } from "./BeadingRatesForm";

const EXTERNAL_ORDER: ExternalFinish[] = [
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

const INTERNAL_ORDER: InternalFinish[] = [
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

function RateRow({
  id,
  label,
  pence,
  unit,
  onChange
}: {
  id: string;
  label: string;
  pence: number;
  unit: string;
  onChange: (pence: number) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)] items-center gap-2">
      <label
        htmlFor={id}
        className="text-[12px] font-medium text-neutral-800"
      >
        {label}
      </label>
      <TextInput
        id={id}
        type="number"
        value={String((pence / 100).toFixed(2))}
        onChange={(ev: ChangeEvent<HTMLInputElement>) =>
          onChange(Math.round((parseFloat(ev.currentTarget.value) || 0) * 100))
        }
        min={0}
        step={0.5}
        prefix={
          <span className="text-[11px] font-medium text-neutral-500">£</span>
        }
        suffix={
          <span className="text-[10px] font-medium text-neutral-500">
            / {unit}
          </span>
        }
      />
    </div>
  );
}

export type RatesFormProps = {
  rates: MyRates;
  onPatchRates: (patch: Partial<MyRates>) => void;
  onPatchBeading: (
    key: keyof MyRates["beading"],
    patch: Partial<MyRates["beading"][keyof MyRates["beading"]]>
  ) => void;
};

export function RatesForm({
  rates,
  onPatchRates,
  onPatchBeading
}: RatesFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <section>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          External finishes (£/m²)
        </div>
        <div className="flex flex-col gap-1.5">
          {EXTERNAL_ORDER.map((f) => (
            <RateRow
              key={f}
              id={`rate-ext-${f}`}
              label={EXTERNAL_FINISH_LABEL[f]}
              pence={rates.external[f]}
              unit="m²"
              onChange={(p) =>
                onPatchRates({
                  external: { ...rates.external, [f]: p }
                })
              }
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Internal finishes (£/m²)
        </div>
        <div className="flex flex-col gap-1.5">
          {INTERNAL_ORDER.map((f) => (
            <RateRow
              key={f}
              id={`rate-int-${f}`}
              label={INTERNAL_FINISH_LABEL[f]}
              pence={rates.internal[f]}
              unit="m²"
              onChange={(p) =>
                onPatchRates({
                  internal: { ...rates.internal, [f]: p }
                })
              }
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Height uplift
        </div>
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)] items-center gap-2">
          <label
            htmlFor="rate-uplift"
            className="text-[12px] font-medium text-neutral-800"
          >
            Above 3 m elevations / high ceilings
          </label>
          <TextInput
            id="rate-uplift"
            type="number"
            value={String(rates.height_uplift_pct)}
            onChange={(ev: ChangeEvent<HTMLInputElement>) =>
              onPatchRates({
                height_uplift_pct: parseFloat(ev.currentTarget.value) || 0
              })
            }
            min={0}
            step={1}
            suffix={
              <span className="text-[10px] font-medium text-neutral-500">%</span>
            }
          />
        </div>
      </section>

      <section>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Feature line items (£ each)
        </div>
        <div className="flex flex-col gap-1.5">
          {FEATURE_ORDER.map((f) => (
            <RateRow
              key={f}
              id={`rate-feat-${f}`}
              label={FEATURE_LABEL[f]}
              pence={rates.features[f]}
              unit="each"
              onChange={(p) =>
                onPatchRates({
                  features: { ...rates.features, [f]: p }
                })
              }
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Insulation (£/m²)
        </div>
        <div className="flex flex-col gap-1.5">
          {INSULATION_ORDER.map((t) => (
            <RateRow
              key={t}
              id={`rate-ins-${t}`}
              label={INSULATION_LABEL[t]}
              pence={rates.insulation[t]}
              unit="m²"
              onChange={(p) =>
                onPatchRates({
                  insulation: { ...rates.insulation, [t]: p }
                })
              }
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Beading (£/m or free)
        </div>
        <BeadingRatesForm
          rates={rates.beading}
          onPatch={onPatchBeading}
        />
      </section>
    </div>
  );
}
