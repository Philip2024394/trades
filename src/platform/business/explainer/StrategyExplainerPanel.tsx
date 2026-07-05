// StrategyExplainerPanel — the merchant-facing "Why is my site built
// this way?" surface.
//
// Renders a StrategyExplanation as a collapsible list of decisions
// grouped by bucket. Zero external dependencies beyond lucide-react
// icons + Tailwind.

"use client";

import {
  BarChart3,
  Camera,
  ClipboardList,
  Info,
  LayoutGrid,
  Megaphone,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ResolvedStrategy } from "../resolver";
import { explainStrategy, groupDecisionsByBucket } from "./explain";
import type { ExplanationBucket } from "./types";

const BUCKET_ICON: Record<ExplanationBucket, typeof Info> = {
  Website: LayoutGrid,
  Booking: ClipboardList,
  Dashboard: BarChart3,
  SEO: Sparkles,
  Marketing: Megaphone,
  Trust: ShieldCheck,
  Content: Camera
};

export type StrategyExplainerPanelProps = {
  strategy: ResolvedStrategy;
  /** Optional title override. Defaults to "Why is my website built this way?". */
  title?: string;
};

export function StrategyExplainerPanel({
  strategy,
  title = "Why is my website built this way?"
}: StrategyExplainerPanelProps) {
  const explanation = useMemo(() => explainStrategy(strategy), [strategy]);
  const grouped = useMemo(() => groupDecisionsByBucket(explanation), [explanation]);
  const [openBucket, setOpenBucket] = useState<ExplanationBucket | null>(
    "Website"
  );

  const buckets = Object.keys(grouped) as ExplanationBucket[];

  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <header className="mb-4">
        <div className="flex items-center gap-2 text-[13px] text-neutral-500">
          <Info className="h-4 w-4" />
          Strategy transparency
        </div>
        <h2 className="mt-1 text-lg font-semibold text-neutral-900">{title}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">
          {explanation.summary}{" "}
          <span className="text-neutral-500">
            Based on the {explanation.provenance.playbooks.length} playbook
            {explanation.provenance.playbooks.length === 1 ? "" : "s"} in the{" "}
            <em>{explanation.provenance.recipe.name}</em> recipe.
          </span>
        </p>
      </header>

      <div className="mb-4 rounded-xl bg-neutral-50 p-3 text-[13px] text-neutral-700">
        <strong>Your inputs</strong>
        <ul className="mt-1 space-y-0.5 text-neutral-600">
          <li>· Trade: {explanation.context.tradeLabel}</li>
          <li>· Goal: {explanation.context.goalLabel}</li>
          {explanation.context.pushServices.length ? (
            <li>· Push services: {explanation.context.pushServices.join(", ")}</li>
          ) : null}
          <li>· Positioning: {explanation.context.positioning}</li>
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        {buckets.map((bucket) => {
          const Icon = BUCKET_ICON[bucket] ?? Info;
          const items = grouped[bucket] ?? [];
          const isOpen = openBucket === bucket;
          return (
            <div
              key={bucket}
              className="overflow-hidden rounded-xl border border-neutral-200"
            >
              <button
                type="button"
                onClick={() => setOpenBucket(isOpen ? null : bucket)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-[13px] hover:bg-neutral-50"
              >
                <span className="inline-flex items-center gap-2 font-semibold text-neutral-900">
                  <Icon className="h-4 w-4 text-neutral-500" />
                  {bucket}
                </span>
                <span className="text-[11px] text-neutral-500">
                  {items.length} decision{items.length === 1 ? "" : "s"}
                </span>
              </button>
              {isOpen ? (
                <ul className="border-t border-neutral-200 bg-neutral-50/60 px-4 py-3 text-[13px] text-neutral-700">
                  {items.map((line, i) => (
                    <li key={i} className="flex items-start gap-2 py-1.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                      <div>
                        <div>{capitaliseFirst(line.sentence)}</div>
                        {line.citedPlaybooks.length ? (
                          <div className="mt-0.5 text-[11px] text-neutral-500">
                            <MessageSquareQuote className="mr-1 inline h-3 w-3" />
                            From playbook{line.citedPlaybooks.length === 1 ? "" : "s"}:{" "}
                            {line.citedPlaybooks.join(", ")}
                            {typeof line.confidence === "number" ? (
                              <span> · {line.confidence}% confidence</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>

      <footer className="mt-4 text-[11px] text-neutral-500">
        Generated {new Date(explanation.generatedAt).toLocaleString()}. Not
        happy with a decision? Change your growth strategy — the site adapts
        automatically.
      </footer>
    </section>
  );
}

function capitaliseFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
