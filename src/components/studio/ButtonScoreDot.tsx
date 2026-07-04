"use client";

// Button conversion score dot — inline in edit mode.
//
// Renders a small tier chip (green / amber / red) next to a button
// with the headline score. Hover reveals the six-axis breakdown and a
// "Fix top issue" button that patches the config via the editor bus.

import { useState } from "react";
import type { ButtonScoreResult } from "@/platform/buttons/score/conversionScore";

const GREEN = "#10B981";
const AMBER = "#F59E0B";
const RED = "#DC2626";

export function ButtonScoreDot({
  result,
  onFixTopIssue
}: {
  result: ButtonScoreResult;
  onFixTopIssue?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const colour =
    result.tier === "green" ? GREEN : result.tier === "amber" ? AMBER : RED;

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`Button score ${result.headline} of 100`}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-extrabold uppercase tracking-widest text-white transition"
        style={{ background: colour }}
      >
        <span
          className="inline-block h-2 w-2 rounded-full bg-white/80"
          aria-hidden="true"
        />
        <span>{result.headline}</span>
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute right-0 top-full z-10 mt-1 w-72 rounded-xl border border-neutral-200 bg-white p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              Button score
            </p>
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
              style={{ background: colour }}
            >
              {result.headline}
            </span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {result.axes.map((a) => (
              <li key={a.axis} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background: a.passed
                      ? GREEN
                      : a.score >= 50
                        ? AMBER
                        : RED
                  }}
                />
                <span className="w-20 shrink-0 text-[10px] font-extrabold uppercase tracking-widest text-neutral-600">
                  {AXIS_LABEL[a.axis]}
                </span>
                <span className="min-w-[24px] text-[11px] font-bold text-neutral-900">
                  {a.score}
                </span>
                <span className="line-clamp-1 flex-1 text-[10px] text-neutral-500">
                  {a.reason}
                </span>
              </li>
            ))}
          </ul>
          {result.worst && result.worst.fix && (
            <div className="mt-3 border-t border-neutral-100 pt-3">
              <p className="text-[10px] font-bold text-neutral-500">
                Top issue —{" "}
                <span className="uppercase tracking-widest">
                  {AXIS_LABEL[result.worst.axis]}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-neutral-700">
                {result.worst.fix}
              </p>
              {onFixTopIssue && (
                <button
                  type="button"
                  onClick={onFixTopIssue}
                  className="mt-2 inline-flex h-8 items-center rounded-lg px-3 text-[10px] font-extrabold uppercase tracking-widest text-neutral-900"
                  style={{ background: "#FFB300" }}
                >
                  Fix top issue →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const AXIS_LABEL: Record<string, string> = {
  contrast: "Contrast",
  visibility: "Visibility",
  copy: "Copy",
  a11y: "A11y",
  mobile: "Mobile",
  performance: "Perf"
};
