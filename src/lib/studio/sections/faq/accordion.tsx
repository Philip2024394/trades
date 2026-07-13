// faq.accordion_1 — Phase 2 rebuild on shadcn Accordion (Radix).
//
// Uses the platform shadcn Accordion primitive under the hood — proper
// keyboard nav, aria-expanded, focus management via Radix. Framer
// Motion Reveal for entrance. 6 Q&A slots; blueprints can also seed
// a `preseed` array which is merged in.

"use client";

import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRendererProps
} from "@/lib/studio/sectionTypes";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from "@/components/ui/accordion";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";
import { packageForTrade } from "@/lib/knowledge";

type PreseedItem = { q?: string; a?: string };

type Config = {
  eyebrow: string;
  heading: string;
  q1: string; a1: string;
  q2: string; a2: string;
  q3: string; a3: string;
  q4: string; a4: string;
  q5: string; a5: string;
  q6: string; a6: string;
  preseed?: PreseedItem[];
  /** When true, pulls Q&A from the Knowledge Graph
   *  packageForTrade(primaryTrade).commonFaqs. Merchant overrides
   *  later via the section editor. */
  useKnowledgeGraph: boolean;
  surface: "light" | "dark";
};

export function FaqAccordion({
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
  const useKnowledgeGraph = config.useKnowledgeGraph === true;

  // Resolution order:
  //   1. preseed[]              — explicit blueprint seed
  //   2. q1..q6 slots           — legacy config
  //   3. Knowledge Graph        — packageForTrade(primaryTrade).commonFaqs
  let items: Array<{ q: string; a: string }> = [];

  if (!useKnowledgeGraph && Array.isArray(config.preseed) && config.preseed.length > 0) {
    items = config.preseed
      .map((r) => ({
        q: typeof r.q === "string" ? r.q : "",
        a: typeof r.a === "string" ? r.a : ""
      }))
      .filter((r) => r.q.length > 0);
  }

  if (items.length === 0 && !useKnowledgeGraph) {
    const legacy = [
      { q: config.q1, a: config.a1 },
      { q: config.q2, a: config.a2 },
      { q: config.q3, a: config.a3 },
      { q: config.q4, a: config.a4 },
      { q: config.q5, a: config.a5 },
      { q: config.q6, a: config.a6 }
    ]
      .map((r) => ({
        q: typeof r.q === "string" ? r.q : "",
        a: typeof r.a === "string" ? r.a : ""
      }))
      .filter((r) => r.q.length > 0);
    if (legacy.length > 0 && typeof config.q1 === "string" && config.q1.length > 0) {
      items = legacy;
    }
  }

  if (items.length === 0 && data.primaryTrade) {
    const pkg = packageForTrade(data.primaryTrade);
    if (pkg) {
      items = pkg.commonFaqs.slice(0, 6).map((f) => ({
        q: f.question,
        a: f.answer
      }));
    }
  }

  if (items.length === 0) return null;

  return (
    <section
      className={cn(
        "relative w-full overflow-x-clip",
        isDark ? "bg-foreground text-background" : "bg-background text-foreground"
      )}
      {...sectionRootAttrs(instanceId, "faq.accordion_1", "FAQ")}
    >
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
        {/* Header */}
        <div className="text-center sm:text-left">
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
                {...treeAttrs(instanceId, "heading", "Main headline", "text")}
              >
                {heading}
              </h2>
            </Reveal>
          )}
        </div>

        {/* Accordion — shadcn Radix under the hood */}
        <Reveal delay={0.12}>
          <Accordion
            type="single"
            collapsible
            className="mt-8 sm:mt-10"
          >
            {items.map((row, i) => (
              <AccordionItem key={i} value={`item-${i + 1}`}>
                <AccordionTrigger
                  {...treeAttrs(instanceId, `q${i + 1}`, `Question ${i + 1}`, "text")}
                >
                  {row.q}
                </AccordionTrigger>
                <AccordionContent
                  {...treeAttrs(instanceId, `a${i + 1}`, `Answer ${i + 1}`, "text")}
                >
                  {row.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

