// RatesForm — carpenter's rate card.
//
// Each service has a £ input + a "hide from customer view" checkbox.
// Setting the rate to £0 achieves the same thing.

"use client";

import { EyeOff } from "lucide-react";
import type { ChangeEvent } from "react";
import { TextInput, Toggle } from "@/platform/ui";
import {
  TRIM_SERVICE_LABEL,
  TRIM_SERVICE_ORDER,
  TRIM_SERVICE_UNIT_LABEL
} from "../logic";
import type { TrimRates, TrimService } from "../logic";

export type RatesFormProps = {
  rates: TrimRates;
  onRateChange: (service: TrimService, pence: number) => void;
};

export function RatesForm({ rates, onRateChange }: RatesFormProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg bg-neutral-50 px-3 py-2 text-[11px] text-neutral-700">
        Set your price for each service. Any service left at{" "}
        <span className="font-semibold">£0</span> is hidden from the customer
        quote view — only priced services appear.
      </div>
      {TRIM_SERVICE_ORDER.map((service) => {
        const rate = rates[service];
        const hidden = rate === 0;
        return (
          <div
            key={service}
            className={`rounded-lg border p-2.5 transition ${
              hidden
                ? "border-neutral-200 bg-neutral-50 opacity-70"
                : "border-neutral-200 bg-white"
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div>
                <div className="text-[12px] font-semibold text-neutral-900">
                  {TRIM_SERVICE_LABEL[service]}
                </div>
                <div className="text-[10px] text-neutral-500">
                  Charged {TRIM_SERVICE_UNIT_LABEL[service]}
                </div>
              </div>
              {hidden ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-700">
                  <EyeOff className="h-3 w-3" /> Hidden
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <TextInput
                id={`rate-${service}`}
                type="number"
                label="Price"
                value={String((rate / 100).toFixed(2))}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const pence = Math.round(
                    (parseFloat(e.currentTarget.value) || 0) * 100
                  );
                  onRateChange(service, pence);
                }}
                min={0}
                step={0.5}
                prefix={
                  <span className="text-[11px] font-medium text-neutral-500">
                    £
                  </span>
                }
                suffix={
                  <span className="text-[10px] font-medium text-neutral-500">
                    {TRIM_SERVICE_UNIT_LABEL[service]}
                  </span>
                }
              />
              <div className="pb-0.5">
                <Toggle
                  id={`hide-${service}`}
                  label="Hide"
                  checked={hidden}
                  onChange={(v) => onRateChange(service, v ? 0 : rate || 100)}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
