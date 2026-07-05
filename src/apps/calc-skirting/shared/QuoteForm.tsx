// QuoteForm — customer-facing quantity picker.
//
// Only shows services the carpenter has priced (rate > 0). Each visible
// service has a quantity input in its natural unit (metres or count).

"use client";

import { Wallet } from "lucide-react";
import { EmptyState } from "@/platform/ui";
import type { ChangeEvent } from "react";
import { TextInput } from "@/platform/ui";
import {
  TRIM_SERVICE_IS_INTEGER,
  TRIM_SERVICE_LABEL,
  TRIM_SERVICE_QTY_NOUN,
  TRIM_SERVICE_UNIT_LABEL
} from "../logic";
import type { TrimQuantities, TrimRates, TrimService } from "../logic";

export type QuoteFormProps = {
  enabledServices: TrimService[];
  rates: TrimRates;
  quantities: TrimQuantities;
  onQuantityChange: (service: TrimService, qty: number) => void;
};

export function QuoteForm({
  enabledServices,
  rates,
  quantities,
  onQuantityChange
}: QuoteFormProps) {
  if (enabledServices.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="No services priced yet"
        description="Switch to My rates and set a price for any service you offer. Priced services will appear here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg bg-neutral-50 px-3 py-2 text-[11px] text-neutral-700">
        Enter how much of each service you need. Prices shown are the
        carpenter's finished-service price.
      </div>
      {enabledServices.map((service) => {
        const rate = rates[service];
        const qty = quantities[service];
        const isInt = TRIM_SERVICE_IS_INTEGER[service];
        const pence = Math.round(qty * rate);
        return (
          <div
            key={service}
            className="rounded-lg border border-neutral-200 bg-white p-2.5"
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-neutral-900">
                  {TRIM_SERVICE_LABEL[service]}
                </div>
                <div className="text-[10px] text-neutral-500">
                  £{(rate / 100).toFixed(2)} {TRIM_SERVICE_UNIT_LABEL[service]}
                </div>
              </div>
              {qty > 0 ? (
                <div className="text-right">
                  <div className="text-[13px] font-bold text-neutral-900 tabular-nums">
                    £{(pence / 100).toFixed(0)}
                  </div>
                </div>
              ) : null}
            </div>
            <TextInput
              id={`qty-${service}`}
              type="number"
              label={`How many ${TRIM_SERVICE_QTY_NOUN[service]}?`}
              value={String(qty)}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const raw = parseFloat(e.currentTarget.value) || 0;
                const clean = isInt ? Math.round(raw) : raw;
                onQuantityChange(service, clean);
              }}
              min={0}
              step={isInt ? 1 : 0.5}
              suffix={
                <span className="text-[10px] font-medium text-neutral-500">
                  {isInt ? "×" : "m"}
                </span>
              }
            />
          </div>
        );
      })}
    </div>
  );
}
