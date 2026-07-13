"use client";

// CanteenEditorialQuote — magazine-style pull quote strip.
//
// Renders a customer review as an oversized serif quote, asymmetric on
// desktop, centred on mobile. Breaks the "stack of cards" rhythm and
// gives the canteen page one editorial moment that says "this trade has
// earned this praise" without needing a five-star widget.
//
// Data source: top review from the canteen host. Falls back to a
// tastefully-worded demo quote when no reviews are on file (so demo
// canteens still render the section without a hole).

import { Quote } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK } from "@/lib/brand/tokens";

export type EditorialQuote = {
  body: string;
  authorName: string;
  authorCity: string | null;
  /** Optional star count (1-5). Rendered as small yellow stars above
   *  the byline for extra trust. */
  stars: number | null;
};

export function CanteenEditorialQuote({ quote }: { quote: EditorialQuote }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-10 md:px-6 md:pt-16">
      {/* Asymmetric layout: on md+ the quote sits in a narrower column
          justified to the left, giving the right side empty air that
          reads as intentional whitespace — that whitespace IS the
          editorial signal. Mobile centres it. */}
      <div className="md:grid md:grid-cols-12">
        <div className="md:col-span-8 md:col-start-2">
          <div className="flex items-start gap-3 md:gap-5">
            {/* Oversized quote mark — anchors the block */}
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full shadow-md md:h-14 md:w-14"
              style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
              aria-hidden
            >
              <Quote size={20} strokeWidth={2.4}/>
            </div>
            <div className="min-w-0 flex-1">
              {/* THE QUOTE — poster-scale serif, italic. This is the
                  page's "hero moment" for social proof. */}
              <blockquote
                className="text-[22px] font-black italic leading-[1.15] text-neutral-900 sm:text-[28px] md:text-[36px] lg:text-[42px]"
                style={{ fontFamily: 'Georgia, "Playfair Display", "Times New Roman", serif' }}
              >
                <span
                  aria-hidden
                  className="mr-1 font-black italic"
                  style={{ color: BRAND_YELLOW }}
                >
                  &ldquo;
                </span>
                {quote.body}
                <span
                  aria-hidden
                  className="ml-1 font-black italic"
                  style={{ color: BRAND_YELLOW }}
                >
                  &rdquo;
                </span>
              </blockquote>

              {/* Byline strip — small, uppercase, tracked wide */}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-600 md:mt-6 md:text-[11px]">
                {quote.stars !== null && (
                  <span className="inline-flex items-center gap-0.5" aria-label={`${quote.stars} out of 5 stars`}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        aria-hidden
                        className="inline-block"
                        style={{
                          color: (quote.stars ?? 0) >= i ? "#F59E0B" : "rgba(0,0,0,0.15)",
                          fontSize: "14px",
                          lineHeight: 1
                        }}
                      >
                        ★
                      </span>
                    ))}
                  </span>
                )}
                <span className="text-neutral-500">·</span>
                <span className="text-neutral-800">{quote.authorName}</span>
                {quote.authorCity && (
                  <>
                    <span className="text-neutral-400">·</span>
                    <span className="text-neutral-500">{quote.authorCity}</span>
                  </>
                )}
              </div>

              {/* Hairline separator — anchors the block to the page
                  without needing a bordered card. */}
              <div
                className="mt-6 h-px w-16 md:mt-8 md:w-24"
                style={{ backgroundColor: BRAND_BLACK, opacity: 0.9 }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
