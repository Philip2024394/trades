// features.icon_grid_1 — 4-cell grid of icon-labelled feature bullets.
//
// A trade-vertical "why us" band. Merchants use it to communicate their
// four biggest differentiators — insurance, callout speed, guarantee,
// hours. Fixed 4 slots (a repeating collection would be more powerful
// but adds a UI dimension that lands with Module 15 constraints).

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Config = {
  eyebrow: string;
  heading: string;
  feature1Icon: string;
  feature1Label: string;
  feature1Body: string;
  feature2Icon: string;
  feature2Label: string;
  feature2Body: string;
  feature3Icon: string;
  feature3Label: string;
  feature3Body: string;
  feature4Icon: string;
  feature4Label: string;
  feature4Body: string;
};

function FeatureIconGrid({
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

  type Feat = { i: 1 | 2 | 3 | 4; icon: string; label: string; body: string };
  const featureSlots: Feat[] = [
    { i: 1, icon: config.feature1Icon, label: config.feature1Label, body: config.feature1Body },
    { i: 2, icon: config.feature2Icon, label: config.feature2Label, body: config.feature2Body },
    { i: 3, icon: config.feature3Icon, label: config.feature3Label, body: config.feature3Body },
    { i: 4, icon: config.feature4Icon, label: config.feature4Label, body: config.feature4Body }
  ];
  const features = featureSlots.filter((f) => f.label);

  return (
    <section
      className="w-full"
      style={{ background: surface, color: text }}
      {...sectionRootAttrs(instanceId, "features.icon_grid_1", "Feature grid")}
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
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
            className="mt-2 max-w-3xl text-3xl leading-tight sm:text-4xl"
            style={{ fontFamily: headingFont, fontWeight: headingWeight ?? 800 }}
            {...treeAttrs(instanceId, "heading", "Main headline", "text")}
          >
            {config.heading}
          </h2>
        )}

        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <li
              key={f.i}
              className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
            >
              <span
                aria-hidden="true"
                className="grid h-10 w-10 place-items-center rounded-full text-[18px] font-extrabold"
                style={{ background: accent, color: "#0A0A0A" }}
                {...treeAttrs(instanceId, `feature${f.i}Icon`, `Feature ${f.i} icon`, "text")}
              >
                {f.icon}
              </span>
              <p
                className="text-[15px]"
                style={{ fontFamily: headingFont, fontWeight: headingWeight ?? 800, color: text }}
                {...treeAttrs(instanceId, `feature${f.i}Label`, `Feature ${f.i} label`, "text")}
              >
                {f.label}
              </p>
              {f.body && (
                <p
                  className="text-[12px] leading-relaxed"
                  style={{
                    color: muted,
                    fontFamily: bodyFont,
                    fontWeight: bodyWeight ?? 500
                  }}
                  {...treeAttrs(instanceId, `feature${f.i}Body`, `Feature ${f.i} body`, "text")}
                >
                  {f.body}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const featureFields = (i: 1 | 2 | 3 | 4) => [
  { key: `feature${i}Icon`, label: `Feature ${i} icon`, type: { kind: "text" as const, maxLength: 4 }, default: ["✓", "⚡", "🛡", "⏱"][i - 1] ?? "✓", priority: "text" as const, description: "One glyph — an emoji or short symbol.", group: `Feature ${i}` },
  { key: `feature${i}Label`, label: `Feature ${i} label`, type: { kind: "text" as const, maxLength: 40 }, default: ["Fully insured", "Same-day callout", "2-year guarantee", "24/7 line"][i - 1] ?? "", priority: "text" as const, aiPromptable: true, group: `Feature ${i}` },
  { key: `feature${i}Body`, label: `Feature ${i} body`, type: { kind: "text" as const, maxLength: 140, multiline: true }, default: [
    "£5M public liability. Every job covered end-to-end.",
    "Emergency response within 4 hours across our region.",
    "Workmanship guaranteed for two years, no fine print.",
    "Message us any time. Someone always replies."
  ][i - 1] ?? "", priority: "text" as const, aiPromptable: true, group: `Feature ${i}` }
];

const registration: SectionRegistration<Config> = {
  id: "features.icon_grid_1",
  name: "Feature icon grid",
  version: "1.0.0",
  library: "features",
  description:
    "Four-cell grid of icon-badged feature bullets — insurance, response time, guarantee, hours. Rings the merchant's trust bell.",
  editableFields: [
    { key: "eyebrow", role: "eyebrow",label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Why hire us", priority: "text", group: "Copy" },
    { key: "heading", role: "headline",label: "Main headline", type: { kind: "text", maxLength: 120 }, default: "Four things every job gets.", priority: "text", aiPromptable: true, group: "Copy" },
    ...featureFields(1),
    ...featureFields(2),
    ...featureFields(3),
    ...featureFields(4)
  ],
  animations: ["none", "fade", "stagger"],
  aiPrompts: {
    explain: "Explain why an icon-grid features band works for trades. 3 bullets. Reference specific labels.",
    improve: "Improve without layout change. Labels under 4 words. Bodies under 15 words. Verbs first. Return only patched config.",
    rewrite: "Rewrite all 4 features in a {tone} voice.",
    suggestAlternative: "Suggest an alternative features layout from library='features'. One-sentence rationale.",
    score: "Score across the 6 dimensions. JSON only."
  },
  thumbnail: "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/features-icon-grid-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 0 },
    accessibility: { contrastMin: 4.5 },
    sales: { socialProofRecommended: true },
    seo: { headingLevel: 2 },
    mobile: { minTapTargetPx: 44 },
    brandConsistency: { boundTokens: ["color.accent", "color.surface", "color.text"] }
  },
  telemetryTags: ["features", "icon_grid", "four_column", "typography_first"],
  bestForVerticals: ["plumbing", "electrical", "hvac", "landscaping", "roofing", "joinery", "plant_hire", "kitchen_install", "bathroom_install"],
  defaultConfig: () => ({
    eyebrow: "Why hire us",
    heading: "Four things every job gets.",
    feature1Icon: "✓", feature1Label: "Fully insured", feature1Body: "£5M public liability. Every job covered end-to-end.",
    feature2Icon: "⚡", feature2Label: "Same-day callout", feature2Body: "Emergency response within 4 hours across our region.",
    feature3Icon: "🛡", feature3Label: "2-year guarantee", feature3Body: "Workmanship guaranteed for two years, no fine print.",
    feature4Icon: "⏱", feature4Label: "24/7 line", feature4Body: "Message us any time. Someone always replies."
  }),
  renderer: FeatureIconGrid
};

sectionRegistry.register(registration);
