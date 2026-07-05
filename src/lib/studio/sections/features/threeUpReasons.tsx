// features.three_up_reasons_1 — Phase 2 retrofit on shadcn foundation.
//
// Three-up "Why choose us" grid. Icon (Lucide) + title + short body per
// item. Mobile: card-stacked. Desktop: 3-col grid. Framer Motion Reveal
// choreography with staggered entrance per card. Typography from the
// platform scale.

"use client";

import {
  ShieldCheck,
  BadgeCheck,
  Clock,
  Zap,
  Award,
  Wrench,
  ThumbsUp,
  Heart,
  Users,
  Sparkles
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";
import { packageForTrade } from "@/lib/knowledge";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  item1Icon: string;
  item1Title: string;
  item1Body: string;
  item2Icon: string;
  item2Title: string;
  item2Body: string;
  item3Icon: string;
  item3Title: string;
  item3Body: string;
  /** When true, pulls the 3 items from the Knowledge Graph
   *  packageForTrade(primaryTrade).industryIntelligence. */
  useKnowledgeGraph: boolean;
  surface: "light" | "dark";
};

/** Turn a Knowledge Graph industryIntelligence bullet ("Prep time is
 *  30–50% of paint time and the biggest under-quoted item") into a
 *  {title, body} pair. First 4-6 words become the title, remainder
 *  becomes the body — good enough as a first-pass template. */
function bulletToTitleBody(bullet: string): { title: string; body: string } {
  if (!bullet) return { title: "", body: "" };
  const trimmed = bullet.trim();
  // Prefer splitting on a dash / em-dash / colon
  for (const sep of [" — ", " – ", " - ", ": "]) {
    if (trimmed.includes(sep)) {
      const [t, ...rest] = trimmed.split(sep);
      return { title: t.trim(), body: rest.join(sep).trim() };
    }
  }
  // Fallback: first ~6 words = title
  const words = trimmed.split(/\s+/);
  if (words.length <= 6) return { title: trimmed, body: "" };
  return {
    title: words.slice(0, 6).join(" "),
    body: words.slice(6).join(" ")
  };
}

const ICONS: Record<string, LucideIcon> = {
  shield: ShieldCheck,
  badge: BadgeCheck,
  clock: Clock,
  bolt: Zap,
  award: Award,
  wrench: Wrench,
  thumb: ThumbsUp,
  heart: Heart,
  users: Users,
  sparkle: Sparkles
};

const ICON_KEYS = Object.keys(ICONS);

function ThreeUpReasonsSection({
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
    (typeof config.heading === "string" && config.heading) || "Why choose us";
  const subheading =
    typeof config.subheading === "string" ? config.subheading : "";
  const useKnowledgeGraph = config.useKnowledgeGraph === true;

  // ─── Resolve items ───
  //   1. explicit config items
  //   2. Knowledge Graph industryIntelligence bullets → title/body
  let items = !useKnowledgeGraph
    ? [
        { icon: config.item1Icon, title: config.item1Title, body: config.item1Body },
        { icon: config.item2Icon, title: config.item2Title, body: config.item2Body },
        { icon: config.item3Icon, title: config.item3Title, body: config.item3Body }
      ]
    : [];

  items = items
    .map((i) => ({
      icon: typeof i.icon === "string" ? i.icon : "shield",
      title: typeof i.title === "string" ? i.title : "",
      body: typeof i.body === "string" ? i.body : ""
    }))
    .filter((i) => i.title.length > 0);

  // Fallback: Knowledge Graph industryIntelligence
  if (items.length === 0 && data.primaryTrade) {
    const pkg = packageForTrade(data.primaryTrade);
    if (pkg && Array.isArray(pkg.industryIntelligence)) {
      const iconRotation = ["shield", "clock", "award"];
      items = pkg.industryIntelligence
        .slice(0, 3)
        .map((bullet, idx) => {
          const parts = bulletToTitleBody(bullet);
          return {
            icon: iconRotation[idx] ?? "shield",
            title: parts.title,
            body: parts.body
          };
        })
        .filter((i) => i.title.length > 0);
    }
  }

  if (items.length === 0) return null;

  return (
    <section
      className={cn(
        "relative w-full overflow-x-clip",
        isDark ? "bg-foreground text-background" : "bg-background text-foreground"
      )}
      {...sectionRootAttrs(
        instanceId,
        "features.three_up_reasons_1",
        "Three-up reasons"
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
                {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
              >
                {eyebrow}
              </p>
            </Reveal>
          )}
          <Reveal delay={0.05}>
            <h2
              className="mt-3 text-display-sm font-extrabold sm:text-display-md lg:text-display-lg"
              {...treeAttrs(instanceId, "heading", "Heading", "text")}
            >
              {heading}
            </h2>
          </Reveal>
          {subheading && (
            <Reveal delay={0.1}>
              <p
                className="mx-auto mt-4 max-w-2xl text-body-md text-muted-foreground sm:text-body-lg"
                {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
              >
                {subheading}
              </p>
            </Reveal>
          )}
        </div>

        {/* Items — vertical stack mobile, 3-col grid lg+ */}
        <ul className="mt-10 grid gap-3 sm:mt-14 sm:gap-4 lg:grid-cols-3 lg:gap-5">
          {items.map((item, i) => {
            const Icon = ICONS[item.icon] ?? ShieldCheck;
            return (
              <li key={i}>
                <Reveal delay={0.15 + i * 0.08}>
                  <Card className="h-full border-border/60 shadow-sm transition-shadow hover:shadow-md">
                    <CardContent className="p-5 sm:p-6">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-xl sm:h-14 sm:w-14"
                        style={{
                          background: `${accent}14`,
                          color: accent
                        }}
                      >
                        <Icon size={22} strokeWidth={2.25} aria-hidden="true" />
                      </div>
                      <h3
                        className="mt-4 text-heading-md font-extrabold sm:text-heading-lg"
                        {...treeAttrs(
                          instanceId,
                          `item${i + 1}Title`,
                          `Item ${i + 1} title`,
                          "text"
                        )}
                      >
                        {item.title}
                      </h3>
                      {item.body && (
                        <p
                          className="mt-2 text-body-sm text-muted-foreground sm:text-body-md"
                          {...treeAttrs(
                            instanceId,
                            `item${i + 1}Body`,
                            `Item ${i + 1} body`,
                            "text"
                          )}
                        >
                          {item.body}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "features.three_up_reasons_1",
  name: "Three-up reasons (Why choose us)",
  version: "2.0.0",
  library: "features",
  description:
    "Three-item value-prop grid on shadcn Card + Framer Motion. Circular Lucide icon + title + short body per item. Mobile: card-stacked; Desktop: 3-col grid. Ideal for 'Why choose us' below the trust bar.",
  editableFields: [
    { key: "eyebrow", label: "Eyebrow (optional)", type: { kind: "text", maxLength: 40 }, default: "Why hire us", priority: "text", role: "eyebrow", group: "Copy" },
    { key: "heading", label: "Heading", type: { kind: "text", maxLength: 60 }, default: "How we work", priority: "text", role: "headline", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Subheading (optional)", type: { kind: "text", maxLength: 200, multiline: true }, default: "", priority: "text", role: "subhead", aiPromptable: true, group: "Copy" },
    { key: "useKnowledgeGraph", label: "Pull reasons from Knowledge Graph", type: { kind: "boolean" }, default: false, description: "When ON, ignores the 3 items below and pulls the top 3 trade-specific reasons from the platform Knowledge Graph.", group: "Data source" },
    { key: "item1Icon", label: "Item 1 icon", type: { kind: "select", options: ICON_KEYS.map((v) => ({ value: v, label: v })) }, default: "shield", group: "Item 1" },
    { key: "item1Title", label: "Item 1 title", type: { kind: "text", maxLength: 40 }, default: "Fully Certified", priority: "text", group: "Item 1" },
    { key: "item1Body", label: "Item 1 body", type: { kind: "text", maxLength: 140, multiline: true }, default: "Gas Safe & NICEIC approved. Every job to standard.", priority: "text", aiPromptable: true, group: "Item 1" },
    { key: "item2Icon", label: "Item 2 icon", type: { kind: "select", options: ICON_KEYS.map((v) => ({ value: v, label: v })) }, default: "clock", group: "Item 2" },
    { key: "item2Title", label: "Item 2 title", type: { kind: "text", maxLength: 40 }, default: "Reliable & On Time", priority: "text", group: "Item 2" },
    { key: "item2Body", label: "Item 2 body", type: { kind: "text", maxLength: 140, multiline: true }, default: "We respect your time — arrive when we say we will.", priority: "text", aiPromptable: true, group: "Item 2" },
    { key: "item3Icon", label: "Item 3 icon", type: { kind: "select", options: ICON_KEYS.map((v) => ({ value: v, label: v })) }, default: "award", group: "Item 3" },
    { key: "item3Title", label: "Item 3 title", type: { kind: "text", maxLength: 40 }, default: "Experienced Experts", priority: "text", group: "Item 3" },
    { key: "item3Body", label: "Item 3 body", type: { kind: "text", maxLength: 140, multiline: true }, default: "Years of hands-on experience. Nothing we haven't seen.", priority: "text", aiPromptable: true, group: "Item 3" },
    { key: "surface", role: "surface_mode", label: "Surface", type: { kind: "select", options: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }] }, default: "light", group: "Layout" }
  ],
  animations: ["none", "fade-in", "slide-up"],
  aiPrompts: {
    explain: "A three-up 'Why choose us' section. Explain when it converts + when it doesn't.",
    improve: "Tighten titles + bodies. Return patched fields only.",
    rewrite: "Rewrite each reason in a {tone} voice, preserving structure.",
    suggestAlternative: "Suggest an alternative when the merchant has 5+ reasons.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: { loading: { imageWeightBudgetKb: 0 }, accessibility: { contrastMin: 4.5 }, sales: { socialProofRecommended: true }, seo: { headingLevel: 2 }, mobile: { minTapTargetPx: 44 }, brandConsistency: { boundTokens: ["color.accent"] } },
  telemetryTags: ["features", "three_up", "reasons", "why_choose_us", "shadcn", "framer_motion"],
  bestForVerticals: ["electrician", "plumber", "gas-engineer", "hvac-contractor", "roofer", "landscaper", "extension-builder"],
  defaultConfig: () => ({
    eyebrow: "Why hire us",
    heading: "How we work",
    subheading: "",
    useKnowledgeGraph: true,
    // Fallback content — used only when Knowledge Graph pull is off AND
    // the merchant hasn't authored their own.
    item1Icon: "shield",
    item1Title: "",
    item1Body: "",
    item2Icon: "clock",
    item2Title: "",
    item2Body: "",
    item3Icon: "award",
    item3Title: "",
    item3Body: "",
    surface: "light"
  }),
  renderer: ThreeUpReasonsSection
};

sectionRegistry.register(registration);
