// Metadata sidecar for statistics.band_1. Server-safe registration so the AI routes can see this section (task #41 fix).

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { SectionRegistration } from "@/lib/studio/sectionTypes";
import { StatisticsBand } from "./band";

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
