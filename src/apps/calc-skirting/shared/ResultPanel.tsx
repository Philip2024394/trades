// ResultPanel — trim carpenter result renderer.

"use client";

import { AlertTriangle } from "lucide-react";
import { SurfaceCard } from "@/platform/ui";
import type { CalculatorOutput, CalculatorOutputLine } from "../logic";

export type ResultPanelDensity = "full" | "condensed";
export type ResultPanelProps = {
  result: CalculatorOutput;
  density?: ResultPanelDensity;
};

function LineRow({ line }: { line: CalculatorOutputLine }) {
  const tone = line.tone ?? "muted";
  const labelCls =
    tone === "primary"
      ? "text-[13px] font-semibold text-neutral-900"
      : "text-[12px] text-neutral-700";
  const valueCls =
    tone === "primary"
      ? "text-[14px] font-bold text-neutral-900"
      : "text-[12px] font-medium text-neutral-800";
  return (
    <div className="flex items-start justify-between gap-2 py-1.5">
      <div className="min-w-0 flex-1">
        <div className={labelCls}>{line.label}</div>
        {line.detail ? (
          <div className="text-[11px] text-neutral-500">{line.detail}</div>
        ) : null}
      </div>
      <div className={`shrink-0 text-right ${valueCls}`}>{line.value}</div>
    </div>
  );
}

export function ResultPanel({ result }: ResultPanelProps) {
  const primary = result.lines.find((l) => l.tone === "primary");
  const others = result.lines.filter((l) => l !== primary);
  const total = result.materials_total_pence;

  return (
    <SurfaceCard variant="secondary" padding="md">
      {primary ? (
        <div className="mb-2 flex items-baseline justify-between rounded-lg bg-amber-50 px-3 py-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">
              Total quote
            </div>
            {primary.detail ? (
              <div className="text-[10px] text-amber-800">
                {primary.detail}
              </div>
            ) : null}
          </div>
          <span className="text-[18px] font-bold text-neutral-900 tabular-nums">
            £{(total / 100).toFixed(0)}
          </span>
        </div>
      ) : (
        <div className="rounded-lg bg-neutral-100 px-3 py-2 text-[11px] text-neutral-600">
          Enter quantities above — quote appears here.
        </div>
      )}
      {others.length > 0 ? (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {others.map((line, i) => (
            <li key={i}>
              <LineRow line={line} />
            </li>
          ))}
        </ul>
      ) : null}
      {result.warnings?.length ? (
        <div className="mt-2 flex flex-col gap-1">
          {result.warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-900"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {w}
            </div>
          ))}
        </div>
      ) : null}
    </SurfaceCard>
  );
}
