// statistics.band_1 — 4-cell trust metrics band.
//
// The numbers-talk-louder-than-words section. Merchant fills in years
// in business, jobs completed, star rating, coverage — whatever proves
// scale. Best just above testimonials or the CTA. Dark surface by
// default makes the numbers pop, but every colour is token-bound so
// Colour tool can flip it to light in one click.

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Slot = 1 | 2 | 3 | 4;

type Config = {
  eyebrow: string;
  heading: string;
  s1Value: string; s1Label: string;
  s2Value: string; s2Label: string;
  s3Value: string; s3Label: string;
  s4Value: string; s4Label: string;
  darkSurface: boolean;
};

function StatisticsBand({
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

  const darkMode = config.darkSurface;
  const bg = darkMode ? "#0A0A0A" : surface;
  const fg = darkMode ? "#FFFFFF" : text;
  const subFg = darkMode ? "rgba(255,255,255,0.60)" : muted;

  type Stat = { i: Slot; value: string; label: string };
  const slots: Stat[] = [
    { i: 1, value: config.s1Value, label: config.s1Label },
    { i: 2, value: config.s2Value, label: config.s2Label },
    { i: 3, value: config.s3Value, label: config.s3Label },
    { i: 4, value: config.s4Value, label: config.s4Label }
  ];
  const stats = slots.filter((s) => s.value);

  return (
    <section
      className="w-full"
      style={{ background: bg, color: fg }}
      {...sectionRootAttrs(instanceId, "statistics.band_1", "Statistics")}
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        {(config.eyebrow || config.heading) && (
          <div className="text-center">
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
          </div>
        )}

        <ul
          className={`grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8 ${
            config.eyebrow || config.heading ? "mt-10" : ""
          }`}
        >
          {stats.map((s) => (
            <li key={s.i} className="text-center">
              <p
                className="text-4xl leading-none sm:text-5xl"
                style={{
                  fontFamily: headingFont,
                  fontWeight: headingWeight ?? 900,
                  color: accent
                }}
                {...treeAttrs(instanceId, `s${s.i}Value`, `Stat ${s.i} value`, "text")}
              >
                {s.value}
              </p>
              <p
                className="mt-2 text-[12px] font-bold uppercase tracking-widest"
                style={{
                  color: subFg,
                  fontFamily: bodyFont,
                  fontWeight: bodyWeight ?? 600
                }}
                {...treeAttrs(instanceId, `s${s.i}Label`, `Stat ${s.i} label`, "text")}
              >
                {s.label}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const statFields = (i: Slot, value: string, label: string) => [
  { key: `s${i}Value`, label: `Stat ${i} value`, type: { kind: "text" as const, maxLength: 20 }, default: value, priority: "text" as const, aiPromptable: true, description: 'The big number — e.g. "28", "12,000+", "4.9★"', group: `Stat ${i}` },
  { key: `s${i}Label`, label: `Stat ${i} label`, type: { kind: "text" as const, maxLength: 60 }, default: label, priority: "text" as const, aiPromptable: true, description: "Short label under the number", group: `Stat ${i}` }
];

const registration: SectionRegistration<Config> = {
  id: "statistics.band_1",
  name: "Statistics band",
  version: "1.0.0",
  library: "statistics",
  description:
    "Four big numbers with short labels — years in business, jobs completed, star rating, areas covered. Dark surface by default; toggle for a light band that matches the surrounding sections.",
  editableFields: [
    { key: "eyebrow", role: "eyebrow",label: "Small kicker (optional)", type: { kind: "text", maxLength: 40 }, default: "By the numbers", priority: "text", group: "Header" },
    { key: "heading", role: "headline",label: "Main headline (optional)", type: { kind: "text", maxLength: 120 }, default: "", priority: "text", aiPromptable: true, description: "Leave blank for a pure numbers band.", group: "Header" },
    ...statFields(1, "28", "Years in business"),
    ...statFields(2, "12,000+", "Jobs completed"),
    ...statFields(3, "4.9★", "Average rating"),
    ...statFields(4, "48", "Postcodes covered"),
    { key: "darkSurface", label: "Dark surface", type: { kind: "boolean" }, default: true, group: "Style" }
  ],
  animations: ["none", "count-up"],
  aiPrompts: {
    explain: "Explain why a numbers band works as a trust anchor. Reference the specific stats.",
    improve: "Improve without layout change. Values under 6 characters, labels under 4 words, no marketing fluff. Return only patched config.",
    rewrite: "Rewrite labels in a {tone} voice. Values stay factual.",
    suggestAlternative: "Suggest an alternative statistics layout from library='statistics'. One-sentence rationale.",
    score: "Score across 6 dimensions. JSON only."
  },
  thumbnail: "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/statistics-band-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 0 },
    accessibility: { contrastMin: 4.5 },
    sales: { socialProofRecommended: true },
    seo: { headingLevel: 2 },
    mobile: { minTapTargetPx: 44 },
    brandConsistency: { boundTokens: ["color.accent", "color.surface", "color.text"] }
  },
  telemetryTags: ["statistics", "trust_band", "four_stats", "big_numbers", "dark_surface"],
  bestForVerticals: ["plumbing", "electrical", "hvac", "landscaping", "roofing", "joinery", "plant_hire", "tool_hire", "building_merchant", "kitchen_install", "bathroom_install"],
  defaultConfig: () => ({
    eyebrow: "By the numbers",
    heading: "",
    s1Value: "28", s1Label: "Years in business",
    s2Value: "12,000+", s2Label: "Jobs completed",
    s3Value: "4.9★", s3Label: "Average rating",
    s4Value: "48", s4Label: "Postcodes covered",
    darkSurface: true
  }),
  renderer: StatisticsBand
};

sectionRegistry.register(registration);
