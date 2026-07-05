// SuccessCard — reusable success confirmation card.
//
// Reference: launch-ui post-submit state. Emerald ring + tick +
// title + body + optional next-action button. No confetti — trades
// want confidence, not fireworks.

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { SurfaceCard } from "../primitives/SurfaceCard";

export type SuccessCardProps = {
  title: string;
  body?: string;
  /** Optional action rendered under the body. Pass a Button. */
  action?: ReactNode;
  /** Optional supporting node (secondary info card, next-steps list). */
  extra?: ReactNode;
  /** Change the accent to blue for informational success. */
  tone?: "success" | "info";
};

export function SuccessCard({
  title,
  body,
  action,
  extra,
  tone = "success"
}: SuccessCardProps) {
  const bg = tone === "success" ? "bg-emerald-100" : "bg-blue-100";
  const fg = tone === "success" ? "text-emerald-600" : "text-blue-600";
  return (
    <SurfaceCard variant="primary" padding="lg" className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full ring-4 ring-white">
        <div className={`flex h-full w-full items-center justify-center rounded-full ${bg}`}>
          <Check className={`h-7 w-7 ${fg}`} strokeWidth={2.5} />
        </div>
      </div>
      <h3 className="mt-3 text-[16px] font-semibold text-neutral-900">
        {title}
      </h3>
      {body ? (
        <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-neutral-600">
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      {extra ? <div className="mt-4">{extra}</div> : null}
    </SurfaceCard>
  );
}
