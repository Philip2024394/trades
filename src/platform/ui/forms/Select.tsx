// Select — native <select> with consistent styling + chevron.
//
// Native is best on mobile: OS picker is faster than any custom
// dropdown. Kit uses native + styled shell.

import { ChevronDown } from "lucide-react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import {
  FIELD_BASE_CLASS,
  FIELD_BORDER_CLASS,
  FIELD_BORDER_ERROR_CLASS,
  FIELD_PAD_CLASS,
  FieldGroup
} from "./FieldGroup";

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "id"
> & {
  id: string;
  label?: string;
  labelBadge?: string;
  hint?: string;
  error?: string;
  /** Placeholder pseudo-option shown when value is empty. */
  placeholder?: string;
  options: readonly SelectOption[];
  /** For fully custom option rendering (e.g. optgroup). */
  children?: ReactNode;
};

export function Select({
  id,
  label,
  labelBadge,
  hint,
  error,
  placeholder,
  options,
  children,
  className,
  ...selectProps
}: SelectProps) {
  const hasError = Boolean(error);
  const borderCls = hasError ? FIELD_BORDER_ERROR_CLASS : FIELD_BORDER_CLASS;
  return (
    <FieldGroup
      id={id}
      label={label}
      labelBadge={labelBadge}
      hint={hint}
      error={error}
    >
      <div className="relative">
        <select
          id={id}
          className={`${FIELD_BASE_CLASS} ${borderCls} ${FIELD_PAD_CLASS} appearance-none pr-9 ${className ?? ""}`.trim()}
          aria-invalid={hasError || undefined}
          {...selectProps}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {children ??
            options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
      </div>
    </FieldGroup>
  );
}
