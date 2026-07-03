// testimonials.card_grid_1 — three-card social-proof grid.
//
// Fixed 3 slots (like features/icon_grid). Real repeating-collection UI
// arrives in Module 15. For M10 shell the 3 slots cover the common
// "one review per customer type" pattern.

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Config = {
  eyebrow: string;
  heading: string;
  quote1: string;
  author1: string;
  business1: string;
  quote2: string;
  author2: string;
  business2: string;
  quote3: string;
  author3: string;
  business3: string;
  showAggregate: boolean;
  aggregateText: string;
};

function TestimonialsCardGrid({
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

  type Card = { i: 1 | 2 | 3; quote: string; author: string; business: string };
  const cardSlots: Card[] = [
    { i: 1, quote: config.quote1, author: config.author1, business: config.business1 },
    { i: 2, quote: config.quote2, author: config.author2, business: config.business2 },
    { i: 3, quote: config.quote3, author: config.author3, business: config.business3 }
  ];
  const cards = cardSlots.filter((c) => c.quote);

  return (
    <section
      className="w-full"
      style={{ background: surface, color: text }}
      {...sectionRootAttrs(instanceId, "testimonials.card_grid_1", "Testimonials")}
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {config.eyebrow && (
              <p
                className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
                style={{ color: accent }}
                {...treeAttrs(instanceId, "eyebrow", "Small kicker", "text")}
              >
                {config.eyebrow}
              </p>
            )}
            <h2
              className="mt-2 max-w-3xl text-3xl leading-tight sm:text-4xl"
              style={{ fontFamily: headingFont, fontWeight: headingWeight ?? 800 }}
              {...treeAttrs(instanceId, "heading", "Main headline", "text")}
            >
              {config.heading}
            </h2>
          </div>
          {config.showAggregate && config.aggregateText && (
            <p
              className="text-[13px] font-bold"
              style={{ color: muted }}
              {...treeAttrs(instanceId, "aggregateText", "Aggregate line", "text")}
            >
              <span style={{ color: accent }}>★★★★★</span> {config.aggregateText}
            </p>
          )}
        </div>

        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <li key={c.i} className="flex h-full flex-col gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
              <span aria-hidden="true" style={{ color: accent }} className="text-[15px]">
                ★★★★★
              </span>
              <p
                className="text-[14px] leading-relaxed"
                style={{ color: text, fontFamily: bodyFont, fontWeight: bodyWeight ?? 500 }}
                {...treeAttrs(instanceId, `quote${c.i}`, `Quote ${c.i}`, "text")}
              >
                &ldquo;{c.quote}&rdquo;
              </p>
              <div className="mt-auto">
                <p
                  className="text-[13px] font-extrabold"
                  style={{ color: text }}
                  {...treeAttrs(instanceId, `author${c.i}`, `Author ${c.i}`, "text")}
                >
                  {c.author}
                </p>
                <p
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: muted }}
                  {...treeAttrs(instanceId, `business${c.i}`, `Business ${c.i}`, "text")}
                >
                  {c.business}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const slotFields = (i: 1 | 2 | 3) => [
  { key: `quote${i}`, label: `Quote ${i}`, type: { kind: "text" as const, maxLength: 280, multiline: true }, default: [
    "Turned up on time, cleaned up after themselves, and the job's held perfectly through a bad winter.",
    "Fair price, no surprises, and they came back to check the work a fortnight later. Rare these days.",
    "Second time we've used them for the extension. Wouldn't call anyone else."
  ][i - 1] ?? "", priority: "text" as const, aiPromptable: true, group: `Testimonial ${i}` },
  { key: `author${i}`, label: `Author ${i}`, type: { kind: "text" as const, maxLength: 60 }, default: ["Sarah W.", "Mark T.", "Priya D."][i - 1] ?? "", priority: "text" as const, group: `Testimonial ${i}` },
  { key: `business${i}`, label: `Business ${i}`, type: { kind: "text" as const, maxLength: 60 }, default: ["Homeowner · Leeds", "Site manager · Manchester", "Homeowner · Bristol"][i - 1] ?? "", priority: "text" as const, group: `Testimonial ${i}` }
];

const registration: SectionRegistration<Config> = {
  id: "testimonials.card_grid_1",
  name: "Testimonial cards",
  version: "1.0.0",
  library: "testimonials",
  description:
    "Three review cards side-by-side. Star rating, quote, name, role. Stacks on mobile. Add an aggregate line (\"4.9 · 380 reviews\") in the top-right for extra credibility.",
  editableFields: [
    { key: "eyebrow", role: "eyebrow",label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "What customers say", priority: "text", group: "Copy" },
    { key: "heading", role: "headline",label: "Main headline", type: { kind: "text", maxLength: 120 }, default: "Not us — them.", priority: "text", aiPromptable: true, group: "Copy" },
    ...slotFields(1),
    ...slotFields(2),
    ...slotFields(3),
    { key: "showAggregate", label: "Show aggregate rating", type: { kind: "boolean" }, default: true, group: "Aggregate" },
    { key: "aggregateText", label: "Aggregate text", type: { kind: "text", maxLength: 60 }, default: "4.9 average · 380 verified reviews", priority: "text", aiPromptable: true, group: "Aggregate" }
  ],
  animations: ["none", "fade", "stagger"],
  aiPrompts: {
    explain: "Explain why 3-card testimonials work for trades. Reference specific quotes.",
    improve: "Improve without layout change. Quotes under 25 words. Attributions specific. Return only patched config.",
    rewrite: "Rewrite quotes in a {tone} voice while keeping them plausible.",
    suggestAlternative: "Suggest an alternative testimonials layout from library='testimonials'. One-sentence rationale.",
    score: "Score across 6 dimensions. JSON only."
  },
  thumbnail: "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/testimonials-card-grid-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 0 },
    accessibility: { contrastMin: 4.5 },
    sales: { socialProofRecommended: true },
    seo: { headingLevel: 2, structuredData: "Review" },
    mobile: { noHorizontalScroll: true },
    brandConsistency: { boundTokens: ["color.accent", "color.surface", "color.text"] }
  },
  telemetryTags: ["testimonials", "three_card", "social_proof", "star_rating"],
  bestForVerticals: ["plumbing", "electrical", "landscaping", "roofing", "joinery", "kitchen_install", "bathroom_install", "plant_hire", "tiling"],
  defaultConfig: () => ({
    eyebrow: "What customers say",
    heading: "Not us — them.",
    quote1: "Turned up on time, cleaned up after themselves, and the job's held perfectly through a bad winter.",
    author1: "Sarah W.", business1: "Homeowner · Leeds",
    quote2: "Fair price, no surprises, and they came back to check the work a fortnight later. Rare these days.",
    author2: "Mark T.", business2: "Site manager · Manchester",
    quote3: "Second time we've used them for the extension. Wouldn't call anyone else.",
    author3: "Priya D.", business3: "Homeowner · Bristol",
    showAggregate: true,
    aggregateText: "4.9 average · 380 verified reviews"
  }),
  renderer: TestimonialsCardGrid
};

sectionRegistry.register(registration);
