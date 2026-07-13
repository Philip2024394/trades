// Customer-signed reviews on a trade's public profile.
// Every review carries the job title + value + location for context —
// the customer sees exactly what kind of job the trade did before.

import { Star, PoundSterling, MapPin, Info } from "lucide-react";
import type { TradeTestimonial } from "../data/tradeProfiles";

type Props = {
  testimonials: TradeTestimonial[];
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function TradeTestimonialsSection({ testimonials }: Props) {
  if (testimonials.length === 0) return null;

  const total = testimonials.reduce((sum, r) => sum + r.starRating, 0);
  const avg = total / testimonials.length;
  const dist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of testimonials) {
    dist[Math.round(r.starRating) as 1 | 2 | 3 | 4 | 5] += 1;
  }

  return (
    <section
      className="rounded-2xl border bg-white p-5 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
        Customer-signed reviews
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-3">
        <div className="text-[26px] font-black text-neutral-900">{avg.toFixed(1)}</div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              size={14}
              className="text-amber-500"
              fill={n <= Math.round(avg) ? "currentColor" : "transparent"}
            />
          ))}
        </div>
        <div className="text-[11.5px] text-neutral-500">
          {testimonials.length} review{testimonials.length === 1 ? "" : "s"} — each verified by the customer's own Trade Center account
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {testimonials.map((r) => (
          <li
            key={r.id}
            className="rounded-xl border p-4"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-[12.5px] font-black text-neutral-900">
                {r.customerName}
              </div>
              <div className="text-[10.5px] text-neutral-500">
                {formatDate(r.createdAtIso)}
              </div>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-600">
              <span className="inline-flex items-center gap-1">
                <MapPin size={10}/> {r.location}
              </span>
              <span>· {r.jobTitle}</span>
              {r.jobValueGbp && (
                <span className="inline-flex items-center gap-1 font-bold text-neutral-800">
                  · <PoundSterling size={10}/> {r.jobValueGbp.toLocaleString()}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={11}
                  className="text-amber-500"
                  fill={n <= r.starRating ? "currentColor" : "transparent"}
                />
              ))}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-neutral-700">
              {r.body}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-start gap-2 rounded-md bg-neutral-50 p-3">
        <Info size={13} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
        <p className="text-[10.5px] leading-snug text-neutral-500">
          Every review is signed by the customer's own Trade Center account after a completed
          job. Trade Center does not moderate, filter, or reorder — you see them as posted.
        </p>
      </div>
    </section>
  );
}
