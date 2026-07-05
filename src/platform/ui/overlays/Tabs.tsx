// Tabs — segmented control / pill tab bar.
//
// Two variants:
//   underline — desktop-style with underline indicator
//   pills — mobile-friendly rounded pills (segmented control)

"use client";

import type { ComponentType, ReactNode } from "react";

export type Tab = {
  key: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  count?: number | string;
};

export type TabsProps = {
  tabs: readonly Tab[];
  value: string;
  onChange: (key: string) => void;
  variant?: "underline" | "pills";
  /** Full-width tabs — each takes equal share. */
  block?: boolean;
  children?: ReactNode;
};

export function Tabs({
  tabs,
  value,
  onChange,
  variant = "underline",
  block,
  children
}: TabsProps) {
  if (variant === "pills") {
    return (
      <div>
        <div
          role="tablist"
          className={`inline-flex rounded-full bg-neutral-100 p-1 ${block ? "w-full" : ""}`}
        >
          {tabs.map((tab) => {
            const active = value === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChange(tab.key)}
                className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition ${
                  block ? "flex-1" : ""
                } ${
                  active
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                {tab.label}
                {tab.count !== undefined ? (
                  <span
                    className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      active
                        ? "bg-neutral-100 text-neutral-700"
                        : "bg-neutral-200 text-neutral-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    );
  }

  // underline variant
  return (
    <div>
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto border-b border-neutral-200"
        style={{ scrollbarWidth: "none" }}
      >
        {tabs.map((tab) => {
          const active = value === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.key)}
              className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 border-b-2 px-3 text-[13px] font-medium transition ${
                active
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              {tab.label}
              {tab.count !== undefined ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    active
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {tab.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
