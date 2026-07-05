// TestimonialBand — quote showcase.
//
// Two shapes:
//   spotlight — one large hero quote (uses Blockquote spotlight variant)
//   grid — 3-up grid of shorter quotes (uses Blockquote default variant)

import { Star } from "lucide-react";
import { Blockquote } from "../content/Blockquote";
import { Overline } from "../content/Overline";

export type Testimonial = {
  quote: string;
  attribution: string;
  role?: string;
  /** 1-5 stars — shown as filled star row above the quote. */
  rating?: number;
};

export type TestimonialBandProps = {
  overline?: string;
  heading?: string;
  subheading?: string;
  testimonials: readonly Testimonial[];
  variant?: "spotlight" | "grid";
  surface?: "light" | "muted" | "dark";
};

export function TestimonialBand({
  overline,
  heading,
  subheading,
  testimonials,
  variant = "grid",
  surface = "muted"
}: TestimonialBandProps) {
  const bg =
    surface === "dark"
      ? "bg-neutral-900 text-white"
      : surface === "muted"
      ? "bg-neutral-50"
      : "bg-white";
  const headingColor =
    surface === "dark" ? "text-white" : "text-neutral-900";
  const subColor =
    surface === "dark" ? "text-neutral-300" : "text-neutral-700";
  return (
    <section className={`${bg} py-12 md:py-16`}>
      <div className="mx-auto max-w-6xl px-4">
        {(overline || heading) ? (
          <div className="mb-8 flex flex-col items-center gap-1.5 text-center">
            {overline ? (
              <Overline tone={surface === "dark" ? "amber" : "neutral"}>
                {overline}
              </Overline>
            ) : null}
            {heading ? (
              <h2 className={`text-xl font-bold md:text-2xl ${headingColor}`}>
                {heading}
              </h2>
            ) : null}
            {subheading ? (
              <p className={`max-w-2xl text-[14px] leading-relaxed md:text-[15px] ${subColor}`}>
                {subheading}
              </p>
            ) : null}
          </div>
        ) : null}
        {variant === "spotlight" && testimonials[0] ? (
          <div className="mx-auto max-w-3xl">
            {testimonials[0].rating ? (
              <StarRow rating={testimonials[0].rating} />
            ) : null}
            <Blockquote
              variant="spotlight"
              quote={testimonials[0].quote}
              attribution={testimonials[0].attribution}
              role={testimonials[0].role}
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t, i) => (
              <div key={i} className="flex flex-col gap-2">
                {t.rating ? <StarRow rating={t.rating} /> : null}
                <Blockquote
                  quote={t.quote}
                  attribution={t.attribution}
                  role={t.role}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StarRow({ rating }: { rating: number }) {
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div className="flex items-center gap-0.5" aria-label={`${clamped} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < clamped
              ? "fill-amber-400 text-amber-400"
              : "text-neutral-300"
          }`}
        />
      ))}
    </div>
  );
}
