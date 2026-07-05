// Blockquote — customer quotes, testimonials, editorial pulls.
//
// Two variants:
//   default — subtle, for inline testimonials
//   spotlight — hero-scale, for featured quotes

import { Quote } from "lucide-react";
import { CARD_RADIUS } from "../tokens";

export type BlockquoteVariant = "default" | "spotlight";

export type BlockquoteProps = {
  quote: string;
  attribution?: string;
  role?: string;
  variant?: BlockquoteVariant;
};

export function Blockquote({
  quote,
  attribution,
  role,
  variant = "default"
}: BlockquoteProps) {
  if (variant === "spotlight") {
    return (
      <figure
        className={`${CARD_RADIUS} bg-neutral-900 p-6 text-white md:p-8`}
      >
        <Quote className="h-6 w-6 text-amber-400" />
        <blockquote className="mt-3 text-[17px] font-medium leading-relaxed md:text-[20px]">
          &ldquo;{quote}&rdquo;
        </blockquote>
        {(attribution || role) ? (
          <figcaption className="mt-4 text-[13px] text-neutral-300">
            {attribution ? (
              <span className="font-semibold text-white">{attribution}</span>
            ) : null}
            {role ? <span className="ml-1">· {role}</span> : null}
          </figcaption>
        ) : null}
      </figure>
    );
  }
  return (
    <figure className={`${CARD_RADIUS} bg-amber-50 p-3 md:p-4`}>
      <blockquote className="text-[13px] italic leading-relaxed text-neutral-800">
        &ldquo;{quote}&rdquo;
      </blockquote>
      {(attribution || role) ? (
        <figcaption className="mt-1 text-[11px] text-neutral-600">
          — {attribution}
          {role ? ` · ${role}` : ""}
        </figcaption>
      ) : null}
    </figure>
  );
}
