// FormSection — visually groups fields with a heading + optional
// description. Use one per logical step / topic in a long form.

import type { ReactNode } from "react";

export type FormSectionProps = {
  title?: string;
  description?: string;
  /** Numeric step indicator — appears in a chip beside the title. */
  step?: number;
  children: ReactNode;
  className?: string;
};

export function FormSection({
  title,
  description,
  step,
  children,
  className = ""
}: FormSectionProps) {
  return (
    <fieldset className={`flex flex-col gap-3 ${className}`.trim()}>
      {(title || description || step !== undefined) ? (
        <legend className="mb-1 flex items-center gap-2">
          {step !== undefined ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-[12px] font-semibold text-white">
              {step}
            </span>
          ) : null}
          {title ? (
            <span className="text-[15px] font-semibold text-neutral-900">
              {title}
            </span>
          ) : null}
        </legend>
      ) : null}
      {description ? (
        <p className="text-[13px] text-neutral-600 -mt-1">{description}</p>
      ) : null}
      <div className="flex flex-col gap-3">{children}</div>
    </fieldset>
  );
}
