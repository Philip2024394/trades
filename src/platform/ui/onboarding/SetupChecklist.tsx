// SetupChecklist — merchant onboarding widget.
//
// Reference: arhamkhnz/next-shadcn-admin-dashboard — onboarding
// widget. Rewritten with our SurfaceCard + tokens.
//
// Structure: SVG progress ring next to title + numbered rows below
// with checkbox state. Optional CTA per item (e.g. "Upload" opens
// the project wizard).

"use client";

import { ArrowRight, Check } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { SurfaceCard } from "../primitives/SurfaceCard";

export type SetupChecklistItem = {
  key: string;
  title: string;
  description?: string;
  done: boolean;
  icon?: ComponentType<{ className?: string }>;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
};

export type SetupChecklistProps = {
  title?: string;
  subtitle?: string;
  items: readonly SetupChecklistItem[];
  /** Additional content below the item list — e.g. "Reset progress". */
  footer?: ReactNode;
};

export function SetupChecklist({
  title = "Publish your website",
  subtitle,
  items,
  footer
}: SetupChecklistProps) {
  const doneCount = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  return (
    <SurfaceCard padding="lg">
      <div className="flex items-start gap-4">
        <ProgressRing pct={pct} />
        <div className="flex-1">
          <h3 className="text-[15px] font-semibold text-neutral-900 md:text-[17px]">
            {title}
          </h3>
          <p className="mt-0.5 text-[13px] text-neutral-600">
            {subtitle ?? `${doneCount} of ${items.length} steps complete`}
          </p>
        </div>
      </div>
      <ol className="mt-4 flex flex-col gap-1">
        {items.map((item, i) => {
          const Icon = item.icon;
          const rowCls = `flex items-start gap-3 rounded-lg px-2 py-2 ${
            item.done ? "" : "hover:bg-neutral-50"
          }`;
          return (
            <li key={item.key} className={rowCls}>
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  item.done
                    ? "bg-emerald-500 text-white"
                    : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {item.done ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : (
                  i + 1
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className={`flex items-center gap-1.5 text-[13px] font-medium ${
                    item.done ? "text-neutral-500 line-through" : "text-neutral-900"
                  }`}
                >
                  {Icon ? (
                    <Icon className="h-3.5 w-3.5 text-neutral-500" />
                  ) : null}
                  {item.title}
                </div>
                {item.description ? (
                  <div className="mt-0.5 text-[12px] text-neutral-600">
                    {item.description}
                  </div>
                ) : null}
              </div>
              {item.action && !item.done ? (
                item.action.href ? (
                  <a
                    href={item.action.href}
                    className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-neutral-900 hover:underline"
                  >
                    {item.action.label}
                    <ArrowRight className="h-3 w-3" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={item.action.onClick}
                    className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-neutral-900 hover:underline"
                  >
                    {item.action.label}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )
              ) : null}
            </li>
          );
        })}
      </ol>
      {footer ? (
        <div className="mt-3 border-t border-neutral-100 pt-3 text-[12px] text-neutral-500">
          {footer}
        </div>
      ) : null}
    </SurfaceCard>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const size = 56;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        className="fill-none stroke-neutral-200"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="fill-none stroke-amber-400 transition-[stroke-dashoffset] duration-[320ms] ease-out"
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dy=".35em"
        className="fill-neutral-900 text-[13px] font-bold"
      >
        {pct}%
      </text>
    </svg>
  );
}
