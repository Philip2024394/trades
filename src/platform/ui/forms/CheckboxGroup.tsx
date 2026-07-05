// CheckboxGroup — styled checkboxes. Single-checkbox use also
// exported for consent / terms fields.

import { Check } from "lucide-react";
import type { ComponentType } from "react";
import { FieldGroup } from "./FieldGroup";

export type CheckboxOption = {
  value: string;
  label: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
};

export type CheckboxGroupProps = {
  id: string;
  name: string;
  label?: string;
  labelBadge?: string;
  hint?: string;
  error?: string;
  values?: readonly string[];
  onChange?: (values: string[]) => void;
  options: readonly CheckboxOption[];
  variant?: "list" | "cards";
};

export function CheckboxGroup({
  id,
  name,
  label,
  labelBadge,
  hint,
  error,
  values = [],
  onChange,
  options,
  variant = "list"
}: CheckboxGroupProps) {
  const toggle = (v: string) => {
    if (!onChange) return;
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  };
  return (
    <FieldGroup
      id={id}
      label={label}
      labelBadge={labelBadge}
      hint={hint}
      error={error}
    >
      <div
        role="group"
        className={variant === "cards" ? "flex flex-col gap-2" : "flex flex-col gap-1"}
      >
        {options.map((opt) => {
          const selected = values.includes(opt.value);
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
                  type="checkbox"
                  name={name}
                  value={opt.value}
                  checked={selected}
                  onChange={() => toggle(opt.value)}
                  className="peer sr-only"
                />
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
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
                type="checkbox"
                name={name}
                value={opt.value}
                checked={selected}
                onChange={() => toggle(opt.value)}
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

/** Single checkbox — usually for consent / terms fields. */
export type CheckboxProps = {
  id: string;
  name?: string;
  label: string;
  hint?: string;
  error?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  required?: boolean;
};

export function Checkbox({
  id,
  name,
  label,
  hint,
  error,
  checked,
  onChange,
  required
}: CheckboxProps) {
  const hasError = Boolean(error);
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-1 py-1"
      >
        <input
          id={id}
          type="checkbox"
          name={name}
          checked={checked}
          onChange={(e) => onChange?.(e.currentTarget.checked)}
          required={required}
          aria-invalid={hasError || undefined}
          className="mt-1 h-4 w-4 accent-neutral-900"
        />
        <span className="text-[13px] leading-relaxed text-neutral-800">
          {label}
        </span>
      </label>
      {(hint || error) ? (
        <div
          className={`ml-7 text-[12px] ${
            hasError ? "text-red-600" : "text-neutral-500"
          }`}
        >
          {error ?? hint}
        </div>
      ) : null}
    </div>
  );
}
