// StickySubmit — sticky action row that pins the primary CTA to the
// bottom of the container (or viewport) on long forms.
//
// Usage: place at the end of the form. Handles safe-area spacing +
// mobile-friendly full-width buttons.

import type { ReactNode } from "react";

export type StickySubmitProps = {
  /** Primary submit button — usually renders the Button primitive. */
  primary: ReactNode;
  /** Optional secondary action (Back / Save draft). */
  secondary?: ReactNode;
  /** Optional helper text above the buttons — "By submitting you
   *  agree to our terms" etc. */
  helper?: ReactNode;
  /** Pin to viewport vs container. Defaults to container-sticky. */
  scope?: "container" | "viewport";
};

export function StickySubmit({
  primary,
  secondary,
  helper,
  scope = "container"
}: StickySubmitProps) {
  const scopeCls =
    scope === "viewport"
      ? "fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur"
      : "sticky bottom-0 z-10 -mx-4 mt-2 border-t border-neutral-200 bg-white/95 px-4 pb-3 pt-3 backdrop-blur";
  return (
    <div className={scopeCls}>
      {helper ? (
        <p className="mb-2 text-center text-[11px] text-neutral-500">
          {helper}
        </p>
      ) : null}
      <div className="flex items-stretch gap-2">
        {secondary ? <div className="flex-1">{secondary}</div> : null}
        <div className={secondary ? "flex-[1.6]" : "flex-1"}>{primary}</div>
      </div>
    </div>
  );
}
