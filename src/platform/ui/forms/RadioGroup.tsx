// RadioGroup — styled radio buttons.
//
// Two shapes:
//   list — vertical radio list (default)
//   cards — larger card-style option tiles with optional description
//
// Card variant is one of the highest-conversion form patterns for
// mobile — big tap targets, no cognitive overhead.

import { Check } from "lucide-react";
import type { ComponentType } from "react";
import { FieldGroup } from "./FieldGroup";

export type RadioOption = {
  value: string;
  label: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
};

export type RadioGroupProps = {
  id: string;
  name: string;
  label?: string;
  labelBadge?: string;
  hint?: string;
  error?: string;
  value?: string;
  onChange?: (value: string) => void;
  options: readonly RadioOption[];
  variant?: "list" | "cards";
};

export function RadioGroup({
  id,
  name,
  label,
  labelBadge,
  hint,
  error,
  value,
  onChange,
  options,
  variant = "list"
}: RadioGroupProps) {
  return (
    <FieldGroup
      id={id}
      label={label}
      labelBadge={labelBadge}
      hint={hint}
      error={error}
    >
      <div
        role="radiogroup"
        className={variant === "cards" ? "flex flex-col gap-2" : "flex flex-col gap-1"}
      >
        {options.map((opt) => {
          const selected = value === opt.value;
          const Icon = opt.icon;
          if (variant === "cards") {
            return (
              <label
                key={opt.value}
                className={`relative flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                  selected
                    ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900"
                    : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                <input
                  type="radio"
                  name={name}
                  value={opt.value}
                  checked={selected}
                  onChange={() => onChange?.(opt.value)}
                  className="peer sr-only"
                />
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected
                      ? "border-neutral-900 bg-neutral-900"
                      : "border-neutral-300 bg-white"
                  }`}
                  aria-hidden="true"
                >
                  {selected ? (
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  ) : null}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-[14px] font-medium text-neutral-900">
                    {Icon ? <Icon className="h-4 w-4 text-neutral-500" /> : null}
                    {opt.label}
                  </div>
                  {opt.description ? (
                    <div className="mt-0.5 text-[12px] text-neutral-600">
                      {opt.description}
                    </div>
                  ) : null}
                </div>
              </label>
            );
          }
          return (
            <label
              key={opt.value}
              className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 py-1 hover:bg-neutral-50"
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={selected}
                onChange={() => onChange?.(opt.value)}
                className="h-4 w-4 accent-neutral-900"
              />
              <span className="text-[14px] text-neutral-900">{opt.label}</span>
            </label>
          );
        })}
      </div>
    </FieldGroup>
  );
}
