// Affiliate dashboard — shared "what this page is for" explainer panel.
//
// Renders a yellow-rim card with a one-sentence headline, a short
// plain-English explanation, and a numbered 4-step "how to use" list.
// Placed directly below the page <h1> on every affiliate dashboard page.
// Brand yellow is hard-coded to #FFB300 so it matches the spec even if
// brand-accent ever shifts.
import type { ReactNode } from "react";

type Props = {
  title: string;
  description: ReactNode;
  steps: ReactNode[];
};

export function PageExplainer({ title, description, steps }: Props) {
  return (
    <section
      className="rounded-xl border-l-4 bg-[#FFB300]/10 p-4 sm:p-5"
      style={{ borderLeftColor: "#FFB300" }}
      aria-label={`How to use: ${title}`}
    >
      <p
        className="text-[14px] font-extrabold leading-snug sm:text-[15px]"
        style={{ color: "#FFB300" }}
      >
        {title}
      </p>
      <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-brand-text">
        {description}
      </p>
      <div className="mt-3">
        <p className="text-[13px] font-bold text-brand-text">
          How to use this in 4 steps
        </p>
        <ol className="mt-1 space-y-1 text-[13px] leading-relaxed text-brand-text">
          {steps.map((step, idx) => (
            <li key={idx} className="flex gap-2">
              <span
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-black"
                style={{ backgroundColor: "#FFB300" }}
                aria-hidden="true"
              >
                {idx + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
