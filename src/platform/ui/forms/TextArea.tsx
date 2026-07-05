// TextArea — multi-line text input with character counter.

import type { TextareaHTMLAttributes } from "react";
import {
  FIELD_BASE_CLASS,
  FIELD_BORDER_CLASS,
  FIELD_BORDER_ERROR_CLASS,
  FieldGroup
} from "./FieldGroup";

export type TextAreaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id"
> & {
  id: string;
  label?: string;
  labelBadge?: string;
  hint?: string;
  error?: string;
};

export function TextArea({
  id,
  label,
  labelBadge,
  hint,
  error,
  className,
  rows = 4,
  ...textareaProps
}: TextAreaProps) {
  const hasError = Boolean(error);
  const borderCls = hasError ? FIELD_BORDER_ERROR_CLASS : FIELD_BORDER_CLASS;
  const characterCount =
    typeof textareaProps.value === "string" && textareaProps.maxLength
      ? `${(textareaProps.value as string).length} / ${textareaProps.maxLength}`
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
      <textarea
        id={id}
        rows={rows}
        className={`${FIELD_BASE_CLASS} ${borderCls} px-3.5 py-2.5 leading-relaxed ${className ?? ""}`.trim()}
        aria-invalid={hasError || undefined}
        {...textareaProps}
      />
    </FieldGroup>
  );
}
