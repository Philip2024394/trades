// faq.accordion_1 — expandable Q&A list.
//
// Uses native <details>/<summary> elements — expand/collapse works
// without JavaScript, respects reduced-motion, and screen readers get
// disclosure semantics for free. Six fixed Q&A slots (merchants can
// leave later ones blank and only the filled ones render).

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Slot = 1 | 2 | 3 | 4 | 5 | 6;

type Config = {
  eyebrow: string;
  heading: string;
  q1: string; a1: string;
  q2: string; a2: string;
  q3: string; a3: string;
  q4: string; a4: string;
  q5: string; a5: string;
  q6: string; a6: string;
};

function FaqAccordion({
  instanceId,
  config,
  tokens
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string | undefined) ?? "#FFB300";
  const surface = (tokens["color.surface"] as string | undefined) ?? "#FFFFFF";
  const text = (tokens["color.text"] as string | undefined) ?? "#0A0A0A";
  const muted = (tokens["color.muted"] as string | undefined) ?? "#737373";
  const headingFont = tokens["font.heading"] as string | undefined;
  const bodyFont = tokens["font.body"] as string | undefined;
  const headingWeight = tokens["font.heading.weight"] as number | undefined;
  const bodyWeight = tokens["font.body.weight"] as number | undefined;

  type Row = { i: Slot; q: string; a: string };
  const rows: Row[] = [
    { i: 1, q: config.q1, a: config.a1 },
    { i: 2, q: config.q2, a: config.a2 },
    { i: 3, q: config.q3, a: config.a3 },
    { i: 4, q: config.q4, a: config.a4 },
    { i: 5, q: config.q5, a: config.a5 },
    { i: 6, q: config.q6, a: config.a6 }
  ];
  const items = rows.filter((r) => r.q);

  return (
    <section
      className="w-full"
      style={{ background: surface, color: text }}
      {...sectionRootAttrs(instanceId, "faq.accordion_1", "FAQ")}
    >
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        {config.eyebrow && (
          <p
            className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: accent }}
            {...treeAttrs(instanceId, "eyebrow", "Small kicker", "text")}
          >
            {config.eyebrow}
          </p>
        )}
        {config.heading && (
          <h2
            className="mt-2 text-3xl leading-tight sm:text-4xl"
            style={{ fontFamily: headingFont, fontWeight: headingWeight ?? 800 }}
            {...treeAttrs(instanceId, "heading", "Main headline", "text")}
          >
            {config.heading}
          </h2>
        )}

        <ul className="mt-8 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {items.map((row) => (
            <li key={row.i}>
              <details className="group">
                <summary
                  className="flex cursor-pointer items-center justify-between gap-4 p-4 transition hover:bg-neutral-50 sm:p-5"
                  style={{ listStyle: "none" }}
                >
                  <span
                    className="flex-1 text-[15px]"
                    style={{
                      color: text,
                      fontFamily: headingFont,
                      fontWeight: headingWeight ?? 800
                    }}
                    {...treeAttrs(instanceId, `q${row.i}`, `Question ${row.i}`, "text")}
                  >
                    {row.q}
                  </span>
                  <span
                    aria-hidden="true"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[15px] font-extrabold transition group-open:rotate-45"
                    style={{ background: accent, color: "#0A0A0A" }}
                  >
                    +
                  </span>
                </summary>
                {row.a && (
                  <p
                    className="px-4 pb-5 text-[13px] leading-relaxed sm:px-5"
                    style={{
                      color: muted,
                      fontFamily: bodyFont,
                      fontWeight: bodyWeight ?? 500
                    }}
                    {...treeAttrs(instanceId, `a${row.i}`, `Answer ${row.i}`, "text")}
                  >
                    {row.a}
                  </p>
                )}
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const qaFields = (i: Slot, q: string, a: string) => [
  { key: `q${i}`, label: `Question ${i}`, type: { kind: "text" as const, maxLength: 160 }, default: q, priority: "text" as const, aiPromptable: true, group: `Q&A ${i}` },
  { key: `a${i}`, label: `Answer ${i}`, type: { kind: "text" as const, maxLength: 400, multiline: true }, default: a, priority: "text" as const, aiPromptable: true, group: `Q&A ${i}` }
];

const registration: SectionRegistration<Config> = {
  id: "faq.accordion_1",
  name: "FAQ accordion",
  version: "1.0.0",
  library: "faq",
  description:
    "Expandable Q&A list — 6 fixed rows, native <details> so no JavaScript loads. Merchants who leave later rows blank get only the populated ones. Best just above a CTA or footer to catch last-minute hesitations.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Frequently asked", priority: "text", group: "Header" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 120 }, default: "The stuff we get asked most.", priority: "text", aiPromptable: true, group: "Header" },
    ...qaFields(1, "Are you insured?", "£5M public liability + £10M employer's liability. Certificates on request before any work starts."),
    ...qaFields(2, "How quickly can you come out?", "Same day for emergencies across our catchment. 3-5 working days for planned work — sooner if we've been in touch."),
    ...qaFields(3, "Do you charge a callout fee?", "No. Free quote, free callout. You only pay if we do the work and you're happy with it."),
    ...qaFields(4, "What areas do you cover?", "Anywhere within 25 miles of the postcode on our contact page. Further afield by arrangement — ask us."),
    ...qaFields(5, "Do you guarantee your work?", "Two years on workmanship, plus the manufacturer's warranty on any parts. We'll come back if anything's not right."),
    ...qaFields(6, "Can I pay by card / bank transfer?", "Card, bank transfer, or cash. VAT-registered — invoices provided. Trade accounts on request.")
  ],
  animations: ["none"],
  aiPrompts: {
    explain:
      "Explain why an FAQ section works near the bottom of a trade landing page. Reference specific Q&As.",
    improve:
      "Improve without layout change. Questions phrased as the customer would ask. Answers under 40 words each. Return only patched config.",
    rewrite:
      "Rewrite questions and answers in a {tone} voice. Answers stay factual.",
    suggestAlternative:
      "Suggest an alternative layout from library='faq'. One-sentence rationale.",
    score: "Score across 6 dimensions. JSON only."
  },
  thumbnail:
    "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/faq-accordion-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 0 },
    accessibility: { contrastMin: 4.5 },
    sales: { primaryActionRequired: false },
    seo: { headingLevel: 2, structuredData: "FAQPage" },
    mobile: { minTapTargetPx: 44 },
    brandConsistency: { boundTokens: ["color.accent", "color.surface", "color.text"] }
  },
  telemetryTags: [
    "faq",
    "accordion",
    "six_qa",
    "native_details",
    "no_js"
  ],
  bestForVerticals: [
    "plumbing",
    "electrical",
    "hvac",
    "landscaping",
    "roofing",
    "joinery",
    "plant_hire",
    "kitchen_install",
    "bathroom_install",
    "locksmith"
  ],
  defaultConfig: () => ({
    eyebrow: "Frequently asked",
    heading: "The stuff we get asked most.",
    q1: "Are you insured?",
    a1: "£5M public liability + £10M employer's liability. Certificates on request before any work starts.",
    q2: "How quickly can you come out?",
    a2: "Same day for emergencies across our catchment. 3-5 working days for planned work — sooner if we've been in touch.",
    q3: "Do you charge a callout fee?",
    a3: "No. Free quote, free callout. You only pay if we do the work and you're happy with it.",
    q4: "What areas do you cover?",
    a4: "Anywhere within 25 miles of the postcode on our contact page. Further afield by arrangement — ask us.",
    q5: "Do you guarantee your work?",
    a5: "Two years on workmanship, plus the manufacturer's warranty on any parts. We'll come back if anything's not right.",
    q6: "Can I pay by card / bank transfer?",
    a6: "Card, bank transfer, or cash. VAT-registered — invoices provided. Trade accounts on request."
  }),
  renderer: FaqAccordion
};

sectionRegistry.register(registration);
