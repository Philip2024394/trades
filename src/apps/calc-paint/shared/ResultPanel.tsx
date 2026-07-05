// ResultPanel — renders the CalculatorOutput.
//
// Two density modes:
//   full — every line + labour + total (landscape / portrait)
//   condensed — headline only + expandable details (square)

"use client";

import { AlertTriangle, ChevronDown, ChevronUp, Info } from "lucide-react";
import { useState } from "react";
import { SurfaceCard } from "@/platform/ui";
import type { CalculatorOutput, CalculatorOutputLine } from "../logic";

export type ResultPanelDensity = "full" | "condensed";

export type ResultPanelProps = {
  result: CalculatorOutput;
  density?: ResultPanelDensity;
};

function pence(p: number): string {
  const gbp = p / 100;
  return gbp >= 100
    ? `£${gbp.toFixed(0)}`
    : gbp === 0
    ? "—"
    : `£${gbp.toFixed(2)}`;
}

function LineRow({ line }: { line: CalculatorOutputLine }) {
  const tone = line.tone ?? "muted";
  const baseCls = "flex items-start justify-between gap-2 py-1.5";
  const labelCls =
    tone === "primary"
      ? "text-[13px] font-semibold text-neutral-900"
      : tone === "warning"
      ? "text-[12px] text-amber-800"
      : "text-[12px] text-neutral-700";
  const valueCls =
    tone === "primary"
      ? "text-[14px] font-bold text-neutral-900"
      : "text-[12px] font-medium text-neutral-800";
  return (
    <div className={baseCls}>
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

export function ResultPanel({ result, density = "full" }: ResultPanelProps) {
  const [showAll, setShowAll] = useState(density === "full");
  const primaryLine = result.lines.find((l) => l.tone === "primary");
  const otherLines = result.lines.filter((l) => l !== primaryLine);

  const isCondensed = density === "condensed" && !showAll;

  return (
    <SurfaceCard variant="secondary" padding="md">
      {/* Headline result */}
      {primaryLine ? (
        <div className="flex items-baseline justify-between border-b border-neutral-200 pb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            You need
          </span>
          <div className="text-right">
            <div className="text-[18px] font-bold text-neutral-900">
              {primaryLine.value}
            </div>
            {primaryLine.detail ? (
              <div className="text-[11px] text-neutral-500">
                {primaryLine.detail}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Materials sub-total */}
      {result.materials_total_pence > 0 ? (
        <div className="flex items-baseline justify-between pt-2 pb-1">
          <span className="text-[12px] text-neutral-700">Materials</span>
          <span className="text-[14px] font-semibold text-neutral-900 tabular-nums">
            {pence(result.materials_total_pence)}
          </span>
        </div>
      ) : null}

      {/* Optional labour line */}
      {result.labour ? (
        <div className="flex items-baseline justify-between border-t border-neutral-200 pt-2">
          <div>
            <div className="text-[12px] font-medium text-neutral-700">
              {result.labour.trade_label} labour
            </div>
            <div className="text-[11px] text-neutral-500">
              {result.labour.quantity.toFixed(1)} {result.labour.rate_unit}
              {result.labour.quantity === 1 ? "" : "s"} · {pence(result.labour.rate_pence)} /{" "}
              {result.labour.rate_unit}
            </div>
          </div>
          <span className="text-[14px] font-semibold text-neutral-900 tabular-nums">
            {pence(result.labour.total_pence)}
          </span>
        </div>
      ) : null}

      {/* Total */}
      {result.materials_total_pence > 0 || result.labour ? (
        <div className="mt-2 flex items-baseline justify-between rounded-lg bg-amber-50 px-3 py-2">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-amber-900">
            Estimated total
          </span>
          <span className="text-[16px] font-bold text-neutral-900 tabular-nums">
            {pence(
              result.materials_total_pence + (result.labour?.total_pence ?? 0)
            )}
          </span>
        </div>
      ) : null}

      {/* Line-item breakdown (collapsible in condensed mode) */}
      {otherLines.length && !isCondensed ? (
        <ul className="mt-2 flex flex-col divide-y divide-neutral-100">
          {otherLines.map((line, i) => (
            <li key={i}>
              <LineRow line={line} />
            </li>
          ))}
        </ul>
      ) : null}

      {/* Show-more toggle (condensed mode) */}
      {density === "condensed" && otherLines.length ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-neutral-700 hover:text-neutral-900"
        >
          {showAll ? (
            <>
              <ChevronUp className="h-3 w-3" /> Hide breakdown
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> See full breakdown
            </>
          )}
        </button>
      ) : null}

      {/* Warnings */}
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
