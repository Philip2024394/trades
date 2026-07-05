// features.icon_grid_1 — Phase 3 rebuild on shadcn foundation.
//
// 4-cell "why us" grid. Trade differentiator band. Insurance, callout
// speed, guarantee, hours — the four things a homeowner ranks. Supports
// TWO shapes: fixed feature1..4 slots OR items[] array.

"use client";

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

type ItemShape = {
  icon?: string;
  title?: string;
  label?: string;
  body?: string;
};

type Config = {
  eyebrow: string;
  heading: string;
  feature1Icon: string; feature1Label: string; feature1Body: string;
  feature2Icon: string; feature2Label: string; feature2Body: string;
  feature3Icon: string; feature3Label: string; feature3Body: string;
  feature4Icon: string; feature4Label: string; feature4Body: string;
  items?: ItemShape[];
  surface: "light" | "dark";
};

function FeatureIconGrid({
  instanceId,
  config,
  tokens
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const isDark = config.surface === "dark";

  // Defensive fallbacks.
  const eyebrow = typeof config.eyebrow === "string" ? config.eyebrow : "";
  const heading = typeof config.heading === "string" ? config.heading : "";

  // Prefer items[] when present, else use feature1..4 slots.
  let features: Array<{ i: number; icon: string; label: string; body: string }> = [];
  if (Array.isArray(config.items) && config.items.length > 0) {
    features = config.items
      .map((it, idx) => ({
        i: idx + 1,
        icon: typeof it.icon === "string" ? it.icon : "✓",
        label: (typeof it.title === "string" && it.title) || (typeof it.label === "string" ? it.label : ""),
        body: typeof it.body === "string" ? it.body : ""
      }))
      .filter((f) => f.label.length > 0);
  } else {
    features = [
      { i: 1, icon: config.feature1Icon, label: config.feature1Label, body: config.feature1Body },
      { i: 2, icon: config.feature2Icon, label: config.feature2Label, body: config.feature2Body },
      { i: 3, icon: config.feature3Icon, label: config.feature3Label, body: config.feature3Body },
      { i: 4, icon: config.feature4Icon, label: config.feature4Label, body: config.feature4Body }
    ]
      .map((f) => ({
        i: f.i,
        icon: typeof f.icon === "string" ? f.icon : "",
        label: typeof f.label === "string" ? f.label : "",
        body: typeof f.body === "string" ? f.body : ""
      }))
      .filter((f) => f.label.length > 0);
  }

  if (features.length === 0) return null;

  return (
    <section
      className={cn(
        "relative w-full overflow-x-clip",
        isDark ? "bg-foreground text-background" : "bg-background text-foreground"
      )}
      {...sectionRootAttrs(instanceId, "features.icon_grid_1", "Feature icon grid")}
    >
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
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
        </div>

        <ul className="mt-10 grid gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-5">
          {features.map((f, i) => (
            <li key={f.i}>
              <Reveal delay={0.15 + i * 0.06}>
                <Card className="h-full border-border/60 shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="p-5 sm:p-6">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-heading-md"
                      style={{
                        background: `${accent}14`,
                        color: accent
                      }}
                    >
                      {f.icon || "✓"}
                    </div>
                    <p
                      className="mt-3 text-heading-sm font-extrabold sm:text-heading-md"
                      {...treeAttrs(instanceId, `feature${f.i}Label`, `Feature ${f.i} label`, "text")}
                    >
                      {f.label}
                    </p>
                    {f.body && (
                      <p
                        className="mt-1.5 text-body-sm text-muted-foreground"
                        {...treeAttrs(instanceId, `feature${f.i}Body`, `Feature ${f.i} body`, "text")}
                      >
                        {f.body}
                      </p>
                    )}
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

const registration: SectionRegistration<Config> = {
  id: "features.icon_grid_1",
  name: "Feature icon grid",
  version: "3.0.0",
  library: "features",
  description:
    "4-cell 'why us' grid on shadcn Card + Framer Motion. Supports both fixed feature1..4 slots AND clean items[] array. Mobile: stacked; Tablet: 2-col; Desktop: 4-col.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Why us", priority: "text", role: "eyebrow", group: "Copy" },
    { key: "heading", label: "Heading", type: { kind: "text", maxLength: 60 }, default: "How we work", priority: "text", role: "headline", aiPromptable: true, group: "Copy" },
    { key: "feature1Icon", label: "Feature 1 icon", type: { kind: "text", maxLength: 4 }, default: "✓", group: "Feature 1" },
    { key: "feature1Label", label: "Feature 1 label", type: { kind: "text", maxLength: 40 }, default: "Fully insured", priority: "text", group: "Feature 1" },
    { key: "feature1Body", label: "Feature 1 body", type: { kind: "text", maxLength: 140 }, default: "£5M public liability. Every job covered end-to-end.", priority: "text", aiPromptable: true, group: "Feature 1" },
    { key: "feature2Icon", label: "Feature 2 icon", type: { kind: "text", maxLength: 4 }, default: "⚡", group: "Feature 2" },
    { key: "feature2Label", label: "Feature 2 label", type: { kind: "text", maxLength: 40 }, default: "Same-day callout", priority: "text", group: "Feature 2" },
    { key: "feature2Body", label: "Feature 2 body", type: { kind: "text", maxLength: 140 }, default: "Emergency response within 4 hours across our region.", priority: "text", aiPromptable: true, group: "Feature 2" },
    { key: "feature3Icon", label: "Feature 3 icon", type: { kind: "text", maxLength: 4 }, default: "🛡", group: "Feature 3" },
    { key: "feature3Label", label: "Feature 3 label", type: { kind: "text", maxLength: 40 }, default: "2-year guarantee", priority: "text", group: "Feature 3" },
    { key: "feature3Body", label: "Feature 3 body", type: { kind: "text", maxLength: 140 }, default: "Workmanship guaranteed for two years, no fine print.", priority: "text", aiPromptable: true, group: "Feature 3" },
    { key: "feature4Icon", label: "Feature 4 icon", type: { kind: "text", maxLength: 4 }, default: "⏱", group: "Feature 4" },
    { key: "feature4Label", label: "Feature 4 label", type: { kind: "text", maxLength: 40 }, default: "24/7 line", priority: "text", group: "Feature 4" },
    { key: "feature4Body", label: "Feature 4 body", type: { kind: "text", maxLength: 140 }, default: "Message us any time. Someone always replies.", priority: "text", aiPromptable: true, group: "Feature 4" },
    { key: "surface", role: "surface_mode", label: "Surface", type: { kind: "select", options: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }] }, default: "light", group: "Layout" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "A 4-cell feature grid. Explain when it beats a 3-up reasons pattern.",
    improve: "Tighten labels + bodies. Return patched fields only.",
    rewrite: "Rewrite each feature in a {tone} voice.",
    suggestAlternative: "Suggest an alternative when there are 6+ features to show.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: { loading: { imageWeightBudgetKb: 0 }, accessibility: { contrastMin: 4.5 }, sales: { socialProofRecommended: true }, seo: { headingLevel: 2 }, mobile: { minTapTargetPx: 44 }, brandConsistency: { boundTokens: ["color.accent"] } },
  telemetryTags: ["features", "icon_grid", "shadcn", "framer_motion"],
  bestForVerticals: ["electrician", "plumber", "gas-engineer", "hvac-contractor", "roofer", "landscaper", "extension-builder"],
  defaultConfig: () => ({
    eyebrow: "Why us",
    heading: "How we work",
    feature1Icon: "✓", feature1Label: "Fully insured", feature1Body: "£5M public liability. Every job covered end-to-end.",
    feature2Icon: "⚡", feature2Label: "Same-day callout", feature2Body: "Emergency response within 4 hours across our region.",
    feature3Icon: "🛡", feature3Label: "2-year guarantee", feature3Body: "Workmanship guaranteed for two years, no fine print.",
    feature4Icon: "⏱", feature4Label: "24/7 line", feature4Body: "Message us any time. Someone always replies.",
    surface: "light"
  }),
  renderer: FeatureIconGrid
};

sectionRegistry.register(registration);
