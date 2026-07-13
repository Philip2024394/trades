// testimonials.card_grid_1 — Phase 2 rebuild on shadcn foundation.
//
// Three-card social-proof grid on shadcn Card + Framer Motion Reveal.
// Aggregate rating strip at the top (star row + rating + count).
// Mobile: horizontal-scroll carousel of cards. Desktop: 3-col grid.
// Star icons from Lucide.
//
// Slice C: optional Knowledge Graph binding — when useKnowledgeGraph
// is on, seeds 3 template quotes from packageForTrade().customerTypes.
// Attribution is intentionally generic ("Recent customer") because the
// merchant is expected to replace these with real reviews.

"use client";

import { Star, Quote } from "lucide-react";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type { SectionRendererProps } from "@/lib/studio/sectionTypes";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";
import { packageForTrade } from "@/lib/knowledge";
import type { PackageCustomerType } from "@/lib/knowledge";

type Config = {
  eyebrow: string;
  heading: string;
  quote1: string; author1: string; business1: string;
  quote2: string; author2: string; business2: string;
  quote3: string; author3: string; business3: string;
  showAggregate: boolean;
  aggregateText: string;
  /** When true, seeds template quotes from the KG's customerTypes for
   *  this trade. Attribution is intentionally generic ("Recent customer")
   *  because the merchant is expected to replace with real reviews. */
  useKnowledgeGraph: boolean;
  surface: "light" | "dark";
};

/** Turn a customerType's description into a template quote in the
 *  customer's voice. Descriptions are third-person about what a
 *  customer *values* — we convert to first-person. */
function quoteFromCustomerType(c: PackageCustomerType): string {
  const desc = (c.description ?? "").trim();
  if (!desc) {
    return "Reliable trade — did what they said they'd do, when they said they'd do it.";
  }
  const valuesMatch = desc.match(/(?:^|\.\s*)(Values|Wants|Needs)\s+([^.]+)\.?/i);
  if (valuesMatch) {
    const rest = (valuesMatch[2] ?? "").trim();
    return `I wanted ${rest}. That's exactly what we got — no drama, no messing about.`;
  }
  return `${desc} That's what we got — plain speaking, work done properly.`;
}

export function TestimonialsCardGrid({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const isDark = config.surface === "dark";

  // Defensive fallbacks.
  const eyebrow =
    typeof config.eyebrow === "string" ? config.eyebrow : "";
  const heading =
    typeof config.heading === "string" ? config.heading : "";
  const showAggregate = config.showAggregate !== false;
  const aggregateText =
    typeof config.aggregateText === "string" ? config.aggregateText : "";
  const useKnowledgeGraph = config.useKnowledgeGraph === true;

  // Resolution order:
  //   1. merchant-authored quotes (quote1..3)
  //   2. Knowledge Graph → 3 template quotes derived from customerTypes
  let cards: Array<{ i: number; quote: string; author: string; business: string }> = [];

  if (!useKnowledgeGraph) {
    cards = [
      { quote: config.quote1, author: config.author1, business: config.business1 },
      { quote: config.quote2, author: config.author2, business: config.business2 },
      { quote: config.quote3, author: config.author3, business: config.business3 }
    ]
      .map((c, i) => ({
        i: i + 1,
        quote: typeof c.quote === "string" ? c.quote : "",
        author: typeof c.author === "string" ? c.author : "",
        business: typeof c.business === "string" ? c.business : ""
      }))
      .filter((c) => c.quote.length > 0);
  }

  if (cards.length === 0 && data.primaryTrade) {
    const pkg = packageForTrade(data.primaryTrade);
    if (pkg && Array.isArray(pkg.customerTypes) && pkg.customerTypes.length > 0) {
      cards = pkg.customerTypes.slice(0, 3).map((c, idx) => ({
        i: idx + 1,
        quote: quoteFromCustomerType(c),
        author: "Recent customer",
        business: c.name
      }));
    }
  }

  if (cards.length === 0) return null;

  return (
    <section
      className={cn(
        "relative w-full overflow-x-clip",
        isDark ? "bg-foreground text-background" : "bg-background text-foreground"
      )}
      {...sectionRootAttrs(
        instanceId,
        "testimonials.card_grid_1",
        "Testimonials · card grid"
      )}
    >
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
        {/* Header */}
        <div className="text-center">
          {eyebrow && (
            <Reveal>
              <p
                className="text-eyebrow font-extrabold uppercase"
                style={{ color: accent }}
                {...treeAttrs(instanceId, "eyebrow", "Small kicker", "text")}
              >
                {eyebrow}
              </p>
            </Reveal>
          )}
          {heading && (
            <Reveal delay={0.05}>
              <h2
                className="mt-3 text-display-sm font-extrabold sm:text-display-md lg:text-display-lg"
                {...treeAttrs(instanceId, "heading", "Heading", "text")}
              >
                {heading}
              </h2>
            </Reveal>
          )}
          {showAggregate && aggregateText && (
            <Reveal delay={0.1}>
              <div className="mt-4 inline-flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star
                      key={i}
                      size={16}
                      strokeWidth={0}
                      fill={accent}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <span
                  className="text-body-sm font-bold text-muted-foreground sm:text-body-md"
                  {...treeAttrs(
                    instanceId,
                    "aggregateText",
                    "Aggregate rating",
                    "text"
                  )}
                >
                  {aggregateText}
                </span>
              </div>
            </Reveal>
          )}
        </div>

        {/* Cards — horizontal-scroll on mobile, 3-col grid on desktop */}
        <ul className="mt-10 grid grid-cols-1 gap-3 sm:mt-14 sm:gap-4 lg:grid-cols-3 lg:gap-5">
          {cards.map((c, i) => (
            <li key={c.i}>
              <Reveal delay={0.15 + i * 0.08}>
                <Card className="h-full border-border/60 shadow-sm">
                  <CardContent className="flex h-full flex-col p-5 sm:p-6">
                    <Quote
                      size={20}
                      strokeWidth={2}
                      className="opacity-40"
                      style={{ color: accent }}
                      aria-hidden="true"
                    />
                    <div className="mt-3 flex items-center gap-0.5">
                      {[0, 1, 2, 3, 4].map((s) => (
                        <Star
                          key={s}
                          size={14}
                          strokeWidth={0}
                          fill={accent}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                    <p
                      className="mt-3 flex-1 text-body-md leading-relaxed"
                      {...treeAttrs(
                        instanceId,
                        `quote${c.i}`,
                        `Quote ${c.i}`,
                        "text"
                      )}
                    >
                      &ldquo;{c.quote}&rdquo;
                    </p>
                    <div className="mt-4 border-t border-border pt-3">
                      <p
                        className="text-body-sm font-extrabold text-foreground"
                        {...treeAttrs(
                          instanceId,
                          `author${c.i}`,
                          `Author ${c.i}`,
                          "text"
                        )}
                      >
                        {c.author}
                      </p>
                      {c.business && (
                        <p
                          className="mt-0.5 text-caption font-bold uppercase text-muted-foreground"
                          {...treeAttrs(
                            instanceId,
                            `business${c.i}`,
                            `Business ${c.i}`,
                            "text"
                          )}
                        >
                          {c.business}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

