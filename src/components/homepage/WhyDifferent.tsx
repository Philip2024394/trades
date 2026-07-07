// Section 3 — Why We're Different.
//
// The positioning cornerstone. Three columns: Directory / Lead Website /
// Construction Notebook. Notebook column is visually dominant, elevated,
// with the accent yellow. This is the section that most explicitly kills
// the "just another directory" mental model.

import { X, Check } from "lucide-react";
import type { ComparisonColumn } from "./types";

export function WhyDifferent({
  overline,
  headline,
  subheadline,
  columns
}: {
  overline: string;
  headline: string;
  subheadline: string;
  columns: ComparisonColumn[];
}) {
  return (
    <section className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
        <header className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-[13px] font-semibold uppercase tracking-wider text-neutral-700">
            {overline}
          </div>
          <h2 className="mt-6 text-[36px] font-bold leading-[1.1] tracking-tight text-neutral-900 md:text-[52px]">
            {headline}
          </h2>
          <p className="mt-4 text-[17px] leading-[1.55] text-neutral-600 md:text-[18px]">
            {subheadline}
          </p>
        </header>

        <div className="mt-14 grid gap-5 md:grid-cols-3 md:items-stretch">
          {columns.map((col) => (
            <ComparisonCard key={col.kind} col={col} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ComparisonCard({ col }: { col: ComparisonColumn }) {
  const isNotebook = col.kind === "notebook";
  return (
    <div
      className={
        isNotebook
          ? "relative rounded-3xl border-2 border-amber-400 bg-white p-8 shadow-[0_20px_60px_rgba(255,179,0,0.20)] md:-translate-y-3"
          : "rounded-3xl border border-neutral-200 bg-neutral-50 p-8"
      }
    >
      {isNotebook ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-3 py-1 text-[13px] font-bold text-neutral-900">
          The Construction Notebook
        </div>
      ) : null}

      <div
        className={`text-[13px] font-semibold uppercase tracking-wider ${
          isNotebook ? "text-amber-700" : "text-neutral-500"
        }`}
      >
        {isNotebook ? "Different category" : col.kind === "directory" ? "Yesterday" : "Yesterday"}
      </div>
      <h3
        className={`mt-2 text-[22px] font-bold leading-tight ${
          isNotebook ? "text-neutral-900" : "text-neutral-700"
        }`}
      >
        {col.label}
      </h3>

      <ul className="mt-6 space-y-3">
        {col.points.map((p) => (
          <li key={p} className="flex items-start gap-2.5">
            <span
              className={
                isNotebook
                  ? "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400"
                  : "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-200"
              }
              aria-hidden
            >
              {isNotebook ? (
                <Check className="h-3 w-3 text-neutral-900" strokeWidth={3} />
              ) : (
                <X className="h-3 w-3 text-neutral-500" strokeWidth={3} />
              )}
            </span>
            <span
              className={`text-[15px] leading-snug ${
                isNotebook ? "font-medium text-neutral-900" : "text-neutral-600"
              }`}
            >
              {p}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
