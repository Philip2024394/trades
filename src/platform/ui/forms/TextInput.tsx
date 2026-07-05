// TextInput — single-line text input with label + hint + error +
// optional prefix/suffix + optional inline icon.
//
// Handles email, tel, url, number, password, search variants via
// `type` prop. Uses semantic HTML — no fancy JS.

import type { ComponentType, InputHTMLAttributes, ReactNode } from "react";
import {
  FIELD_BASE_CLASS,
  FIELD_BORDER_CLASS,
  FIELD_BORDER_ERROR_CLASS,
  FIELD_PAD_CLASS,
  FieldGroup
} from "./FieldGroup";

export type TextInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "prefix" | "id"
> & {
  id: string;
  label?: string;
  labelBadge?: string;
  hint?: string;
  error?: string;
  /** Left-side content — icon component or short text like £ / kg. */
  prefix?: ComponentType<{ className?: string }> | ReactNode;
  /** Right-side content. */
  suffix?: ComponentType<{ className?: string }> | ReactNode;
};

function renderAdornment(
  value: ComponentType<{ className?: string }> | ReactNode | undefined
): ReactNode {
  if (!value) return null;
  if (typeof value === "function") {
    const Icon = value as ComponentType<{ className?: string }>;
    return <Icon className="h-4 w-4 text-neutral-500" />;
  }
  return value;
}

export function TextInput({
  id,
  label,
  labelBadge,
  hint,
  error,
  prefix,
  suffix,
  className,
  type = "text",
  ...inputProps
}: TextInputProps) {
  const hasError = Boolean(error);
  const borderCls = hasError ? FIELD_BORDER_ERROR_CLASS : FIELD_BORDER_CLASS;
  const wrapCls = `flex items-center gap-2 rounded-xl border bg-white transition focus-within:ring-2 focus-within:ring-neutral-900 ${
    hasError ? "border-red-400 focus-within:ring-red-500" : "border-neutral-300 focus-within:border-neutral-900"
  }`;

  const characterCount =
    typeof inputProps.value === "string" && inputProps.maxLength
      ? `${(inputProps.value as string).length} / ${inputProps.maxLength}`
      : undefined;

  return (
    <FieldGroup
      id={id}
      label={label}
      labelBadge={labelBadge}
      hint={hint}
      error={error}
      labelTrailing={characterCount}
    >
      {(prefix || suffix) ? (
        <div className={`${wrapCls} ${FIELD_PAD_CLASS}`}>
          {prefix ? (
            <span className="shrink-0">{renderAdornment(prefix)}</span>
          ) : null}
          <input
            id={id}
            type={type}
            className={`flex-1 bg-transparent text-[14px] text-neutral-900 outline-none placeholder:text-neutral-400 ${
              className ?? ""
            }`.trim()}
            aria-invalid={hasError || undefined}
            {...inputProps}
          />
          {suffix ? (
            <span className="shrink-0">{renderAdornment(suffix)}</span>
          ) : null}
        </div>
      ) : (
        <input
          id={id}
          type={type}
          className={`${FIELD_BASE_CLASS} ${borderCls} ${FIELD_PAD_CLASS} ${className ?? ""}`.trim()}
          aria-invalid={hasError || undefined}
          {...inputProps}
        />
      )}
    </FieldGroup>
  );
}
