// FieldGroup — the foundational wrapper every form field lives inside.
//
// Provides: label + optional badge + hint + error message + children
// slot. Handles the label→input association via htmlFor.
//
// Composition rule: TextInput / TextArea / Select / RadioGroup /
// CheckboxGroup all internally use FieldGroup so consumers get a
// consistent field shape without composing it manually.

import type { ReactNode } from "react";

export type FieldGroupProps = {
  id: string;
  label?: string;
  /** Small tag next to the label — "Optional", "Required", etc. */
  labelBadge?: string;
  /** Helper text shown BELOW the input. */
  hint?: string;
  /** Error message — swaps hint styling to red. */
  error?: string;
  /** Right-side element on the label row — usually a character
   *  counter or "hide" link for password fields. */
  labelTrailing?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function FieldGroup({
  id,
  label,
  labelBadge,
  hint,
  error,
  labelTrailing,
  children,
  className = ""
}: FieldGroupProps) {
  const hasError = Boolean(error);
  return (
    <div className={`flex flex-col gap-1.5 ${className}`.trim()}>
      {label ? (
        <div className="flex items-baseline justify-between gap-2">
          <label
            htmlFor={id}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-800"
          >
            {label}
            {labelBadge ? (
              <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
                {labelBadge}
              </span>
            ) : null}
          </label>
          {labelTrailing ? (
            <span className="text-[11px] text-neutral-500">
              {labelTrailing}
            </span>
          ) : null}
        </div>
      ) : null}
      {children}
      {(hint || error) ? (
        <div
          className={`text-[12px] ${
            hasError ? "text-red-600" : "text-neutral-500"
          }`}
        >
          {error ?? hint}
        </div>
      ) : null}
    </div>
  );
}

/** Shared class strings so every input variant renders consistently. */
export const FIELD_BASE_CLASS =
  "w-full rounded-xl border bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500 transition";

export const FIELD_BORDER_CLASS = "border-neutral-300 focus:border-neutral-900";
export const FIELD_BORDER_ERROR_CLASS =
  "border-red-400 focus:border-red-600 focus:ring-red-500";

/** WCAG-compliant tap-target padding. */
export const FIELD_PAD_CLASS = "min-h-[44px] px-3.5 py-2.5 md:min-h-[48px]";
