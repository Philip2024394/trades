// Timeline — vertical journey pattern with numbered nodes.
//
// Similar to ProcessBand but rendered as a numbered list with more
// content per step. Used for booking journeys, order pipelines,
// setup checklists, project milestones.

import { Check } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

export type TimelineStep = {
  key: string;
  title: string;
  description?: string;
  status?: "done" | "current" | "upcoming";
  timestamp?: string;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
};

export type TimelineProps = {
  steps: readonly TimelineStep[];
  /** Show step numbers vs status icons. Number is the default. */
  numbered?: boolean;
};

const NODE_STATUS_CLASS = {
  done: "bg-emerald-500 text-white",
  current: "bg-neutral-900 text-white ring-4 ring-neutral-900/10",
  upcoming: "bg-neutral-200 text-neutral-500"
} as const;

const CONNECTOR_STATUS_CLASS = {
  done: "bg-emerald-500",
  current: "bg-neutral-200",
  upcoming: "bg-neutral-200"
} as const;

export function Timeline({ steps, numbered = true }: TimelineProps) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => {
        const status = step.status ?? "upcoming";
        const isLast = i === steps.length - 1;
        const StepIcon = step.icon;
        return (
          <li key={step.key} className="relative flex gap-4">
            <div className="relative flex flex-col items-center">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${NODE_STATUS_CLASS[status]}`}
              >
                {status === "done" ? (
                  <Check className="h-4 w-4" />
                ) : StepIcon && !numbered ? (
                  <StepIcon className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </span>
              {!isLast ? (
                <span
                  className={`mt-1 w-0.5 flex-1 ${CONNECTOR_STATUS_CLASS[status]}`}
                />
              ) : null}
            </div>
            <div className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-6"}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div
                  className={`text-[14px] font-semibold ${
                    status === "upcoming" ? "text-neutral-500" : "text-neutral-900"
                  }`}
                >
                  {step.title}
                </div>
                {step.timestamp ? (
                  <div className="text-[11px] text-neutral-500">
                    {step.timestamp}
                  </div>
                ) : null}
              </div>
              {step.description ? (
                <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-600">
                  {step.description}
                </p>
              ) : null}
              {step.action ? <div className="mt-2">{step.action}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
