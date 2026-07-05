// faq.accordion_1 — Phase 2 rebuild on shadcn Accordion (Radix).
//
// Uses the platform shadcn Accordion primitive under the hood — proper
// keyboard nav, aria-expanded, focus management via Radix. Framer
// Motion Reveal for entrance. 6 Q&A slots; blueprints can also seed
// a `preseed` array which is merged in.

"use client";

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
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

function FaqAccordion({
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

const registration: SectionRegistration<Config> = {
  id: "faq.accordion_1",
  name: "FAQ Accordion",
  version: "2.0.0",
  library: "faq",
  description:
    "Expandable Q&A on shadcn Accordion (Radix). Proper keyboard nav + aria-expanded semantics. 6 Q&A slots; blueprints can also seed a preseed array. Framer Motion entrance choreography.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Frequently asked", priority: "text", role: "eyebrow", group: "Copy" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 80 }, default: "Common questions", priority: "text", role: "headline", aiPromptable: true, group: "Copy" },
    { key: "useKnowledgeGraph", label: "Pull FAQs from Knowledge Graph", type: { kind: "boolean" }, default: false, description: "When ON, ignores the Q1..Q6 below and pulls trade-specific FAQs from the platform Knowledge Graph.", group: "Data source" },
    { key: "q1", label: "Question 1", type: { kind: "text", maxLength: 120 }, default: "Are you insured?", priority: "text", role: "question", aiPromptable: true, group: "Q1" },
    { key: "a1", label: "Answer 1", type: { kind: "text", maxLength: 400, multiline: true }, default: "Yes — £5M public liability. Certificate on request.", priority: "text", role: "answer", aiPromptable: true, group: "Q1" },
    { key: "q2", label: "Question 2", type: { kind: "text", maxLength: 120 }, default: "How quickly can you come out?", priority: "text", role: "question", aiPromptable: true, group: "Q2" },
    { key: "a2", label: "Answer 2", type: { kind: "text", maxLength: 400, multiline: true }, default: "Same-day for emergencies. Standard bookings within 3 working days.", priority: "text", role: "answer", aiPromptable: true, group: "Q2" },
    { key: "q3", label: "Question 3", type: { kind: "text", maxLength: 120 }, default: "Do you charge a callout fee?", priority: "text", role: "question", aiPromptable: true, group: "Q3" },
    { key: "a3", label: "Answer 3", type: { kind: "text", maxLength: 400, multiline: true }, default: "No callout fee within our coverage area. Diagnostic quoted before any work starts.", priority: "text", role: "answer", aiPromptable: true, group: "Q3" },
    { key: "q4", label: "Question 4", type: { kind: "text", maxLength: 120 }, default: "What areas do you cover?", priority: "text", role: "question", aiPromptable: true, group: "Q4" },
    { key: "a4", label: "Answer 4", type: { kind: "text", maxLength: 400, multiline: true }, default: "Full coverage across our 25-mile radius. Outside the area on a case-by-case basis.", priority: "text", role: "answer", aiPromptable: true, group: "Q4" },
    { key: "q5", label: "Question 5", type: { kind: "text", maxLength: 120 }, default: "Do you guarantee your work?", priority: "text", role: "question", aiPromptable: true, group: "Q5" },
    { key: "a5", label: "Answer 5", type: { kind: "text", maxLength: 400, multiline: true }, default: "2-year workmanship guarantee. Manufacturer warranty on parts.", priority: "text", role: "answer", aiPromptable: true, group: "Q5" },
    { key: "q6", label: "Question 6", type: { kind: "text", maxLength: 120 }, default: "Can I pay by card / bank transfer?", priority: "text", role: "question", aiPromptable: true, group: "Q6" },
    { key: "a6", label: "Answer 6", type: { kind: "text", maxLength: 400, multiline: true }, default: "Card, bank transfer, WhatsApp Pay. No cheques.", priority: "text", role: "answer", aiPromptable: true, group: "Q6" },
    { key: "surface", role: "surface_mode", label: "Surface", type: { kind: "select", options: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }] }, default: "light", group: "Layout" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "An FAQ accordion. Explain when it works vs a dedicated FAQ page.",
    improve: "Tighten questions + answers. Return patched fields only.",
    rewrite: "Rewrite Q + A in a {tone} voice, preserving structure.",
    suggestAlternative: "Suggest an alternative when there are 15+ FAQs.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: {
    loading: { imageWeightBudgetKb: 0 },
    accessibility: { contrastMin: 4.5 },
    sales: { socialProofRecommended: false },
    seo: { headingLevel: 2 },
    mobile: { minTapTargetPx: 48 },
    brandConsistency: { boundTokens: ["color.accent"] }
  },
  telemetryTags: ["faq", "accordion", "questions", "shadcn", "radix", "framer_motion"],
  bestForVerticals: ["electrician", "plumber", "gas-engineer", "hvac-contractor", "handyman", "landscaper", "extension-builder"],

  // ─── Slice D extended manifest ──────────────────────────────────
  category: "faq",
  supportedThemes: ["all"],
  supportedIndustries: ["all"],
  responsiveBehaviour: {
    mobile: "collapse",
    tablet: "collapse",
    desktop: "collapse"
  },
  imagePlaceholders: [],
  lucideIconsUsed: ["ChevronDown"],
  ctaArea: {
    hasPrimary: false,
    hasSecondary: false
  },
  accessibilityNotes: [
    "Radix Accordion primitive handles aria-expanded / aria-controls automatically",
    "Keyboard navigation: Tab focus, Enter/Space expand, Arrow keys between triggers",
    "ChevronDown icon flips via [data-state=open] — respects reduced-motion",
    "H2 heading is the section landmark; questions are H3-level triggers"
  ],

  defaultConfig: () => ({
    eyebrow: "Frequently asked",
    heading: "Common questions",
    useKnowledgeGraph: true,
    // Legacy defaults kept as fallback if primaryTrade is unset AND no
    // preseed AND merchant hasn't authored their own.
    q1: "", a1: "",
    q2: "", a2: "",
    q3: "", a3: "",
    q4: "", a4: "",
    q5: "", a5: "",
    q6: "", a6: "",
    surface: "light"
  }),
  renderer: FaqAccordion
};

sectionRegistry.register(registration);
