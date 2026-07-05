// MetricCard — KPI widget for dashboards + coach summaries.
//
// Compact on mobile (icon + value + label), expanded on desktop
// (adds trend delta + description).

import { TrendingDown, TrendingUp } from "lucide-react";
import type { ComponentType } from "react";
import { CARD_RADIUS } from "../tokens";

export type MetricCardProps = {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  unit?: string;
  delta?: { direction: "up" | "down"; magnitude: string };
  description?: string;
  variant?: "default" | "highlight";
};

export function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  delta,
  description,
  variant = "default"
}: MetricCardProps) {
  const isHighlight = variant === "highlight";
  return (
    <div
      className={`flex flex-col gap-1 ${CARD_RADIUS} border p-3 md:p-4 ${
        isHighlight
          ? "border-amber-300 bg-amber-50"
          : "border-neutral-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        {Icon ? (
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-md ${
              isHighlight ? "bg-amber-400 text-neutral-900" : "bg-neutral-900 text-white"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
        ) : null}
        {delta ? (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              delta.direction === "up"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-red-100 text-red-700"
            }`}
          >
            {delta.direction === "up" ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {delta.magnitude}
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-[22px] font-bold text-neutral-900 md:text-[26px]">
          {value}
        </span>
        {unit ? (
          <span className="text-[13px] text-neutral-600">{unit}</span>
        ) : null}
      </div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500 md:text-[12px]">
        {label}
      </div>
      {description ? (
        <p className="mt-1 hidden text-[12px] text-neutral-600 md:block">
          {description}
        </p>
      ) : null}
    </div>
  );
}
