// trust_bar.icon_row_1 — Phase 2 retrofit on shadcn foundation.
//
// Thin trust bar between hero and services. Icon + short label per item,
// horizontal-scroll on mobile if items overflow, centered grid on
// tablet+. Uses Lucide icon set + Framer Motion Reveal for staggered
// entrance. Typography from the platform scale.

"use client";

import {
  ShieldCheck,
  BadgeCheck,
  Star,
  MapPin,
  Award,
  Wrench,
  Zap,
  Clock,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";
import { mandatorySchemesForTrade } from "@/lib/knowledge";

type Config = {
  eyebrow: string;
  item1Icon: string;
  item1Label: string;
  item2Icon: string;
  item2Label: string;
  item3Icon: string;
  item3Label: string;
  item4Icon: string;
  item4Label: string;
  /** When true, pulls trust items from the Knowledge Graph — the
   *  package's compliance elements filtered by credentialScheme
   *  (Gas Safe / NICEIC / TrustMark / etc.). */
  useKnowledgeGraph: boolean;
  surface: "light" | "dark" | "tinted";
};

/** Credential scheme slug → display label (short, uppercase-friendly). */
const SCHEME_LABEL: Record<string, string> = {
  "gas-safe": "Gas Safe",
  niceic: "NICEIC",
  napit: "NAPIT",
  trustmark: "TrustMark",
  fmb: "FMB",
  mcs: "MCS",
  hetas: "HETAS",
  fensa: "FENSA",
  chas: "CHAS",
  ipaf: "IPAF",
  pasma: "PASMA",
  "waste-carrier": "Waste Carrier",
  "companies-house": "Companies House",
  cscs: "CSCS",
  smas: "SMAS",
  constructionline: "Constructionline",
  safecontractor: "SafeContractor"
};

/** Which Lucide icon key to pair with each scheme. */
const SCHEME_ICON: Record<string, string> = {
  "gas-safe": "shield",
  niceic: "badge",
  napit: "badge",
  trustmark: "shield",
  fmb: "award",
  mcs: "bolt",
  hetas: "shield",
  fensa: "shield",
  chas: "badge",
  ipaf: "wrench",
  pasma: "wrench",
  "waste-carrier": "clock",
  "companies-house": "badge",
  cscs: "users",
  smas: "shield",
  constructionline: "badge",
  safecontractor: "shield"
};

const ICONS: Record<string, LucideIcon> = {
  shield: ShieldCheck,
  badge: BadgeCheck,
  star: Star,
  pin: MapPin,
  award: Award,
  wrench: Wrench,
  bolt: Zap,
  clock: Clock,
  users: Users
};

const ICON_KEYS = Object.keys(ICONS);

function IconRowSection({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const surface = config.surface ?? "tinted";
  const isDark = surface === "dark";
  const isTinted = surface === "tinted";

  const eyebrow =
    typeof config.eyebrow === "string" ? config.eyebrow : "";
  const useKnowledgeGraph = config.useKnowledgeGraph === true;

  // Resolution order:
  //   1. merchant-authored slots (item1..item4Label)
  //   2. Knowledge Graph → mandatorySchemesForTrade(primaryTrade)
  //   3. nothing → don't render
  let items: Array<{ icon: string; label: string }> = [];

  if (!useKnowledgeGraph) {
    items = [
      { icon: config.item1Icon, label: config.item1Label },
      { icon: config.item2Icon, label: config.item2Label },
      { icon: config.item3Icon, label: config.item3Label },
      { icon: config.item4Icon, label: config.item4Label }
    ]
      .map((i) => ({
        icon: typeof i.icon === "string" ? i.icon : "shield",
        label: typeof i.label === "string" ? i.label : ""
      }))
      .filter((i) => i.label.length > 0);
  }

  if (items.length === 0 && data.primaryTrade) {
    const schemes = mandatorySchemesForTrade(data.primaryTrade);
    if (schemes.length > 0) {
      items = schemes.slice(0, 4).map((s) => ({
        icon: SCHEME_ICON[s.scheme] ?? "shield",
        label: SCHEME_LABEL[s.scheme] ?? s.label
      }));
    }
  }

  if (items.length === 0) return null;

  return (
    <section
      className={cn(
        "relative w-full overflow-x-clip border-y border-border",
        isDark && "bg-foreground text-background",
        !isDark && !isTinted && "bg-background text-foreground",
        isTinted && "text-foreground"
      )}
      style={
        isTinted ? { background: `${accent}08` } : undefined
      }
      {...sectionRootAttrs(
        instanceId,
        "trust_bar.icon_row_1",
        "Trust bar · icon row"
      )}
    >
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {eyebrow && (
          <Reveal>
            <p
              className="mb-3 text-center text-eyebrow font-extrabold uppercase text-muted-foreground"
              {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
            >
              {eyebrow}
            </p>
          </Reveal>
        )}
        <Reveal delay={0.05}>
          {/* Horizontal-scroll on mobile if 4 items don't fit without
              cramping; centered grid from tablet+. */}
          <ul
            className="-mx-4 flex justify-start gap-3 overflow-x-auto px-4 sm:mx-0 sm:justify-center sm:gap-6 sm:px-0"
            style={{ scrollbarWidth: "none" }}
          >
            {items.map((item, i) => {
              const Icon = ICONS[item.icon] ?? ShieldCheck;
              return (
                <li
                  key={i}
                  className="flex shrink-0 flex-col items-center gap-1.5 sm:flex-1 sm:gap-2"
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full border sm:h-11 sm:w-11"
                    style={{
                      borderColor: `${accent}55`,
                      background: `${accent}12`
                    }}
                  >
                    <Icon
                      size={18}
                      strokeWidth={2.25}
                      style={{ color: accent }}
                      aria-hidden="true"
                    />
                  </div>
                  <span
                    className="w-[72px] text-center text-caption font-extrabold uppercase leading-tight text-foreground sm:w-auto sm:max-w-[110px]"
                    {...treeAttrs(
                      instanceId,
                      `item${i + 1}Label`,
                      `Item ${i + 1} label`,
                      "text"
                    )}
                  >
                    {item.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "trust_bar.icon_row_1",
  name: "Trust bar · icon row",
  version: "2.0.0",
  library: "trust_bar",
  description:
    "Thin trust bar with 3-4 credential icons + short labels. Sits between the hero and services. Icons from the platform Lucide set; Framer Motion Reveal entrance; theme-aware surface (light / tinted / dark).",
  editableFields: [
    { key: "eyebrow", label: "Small eyebrow (optional)", type: { kind: "text", maxLength: 40 }, default: "", priority: "text", role: "eyebrow", description: "Optional label above the icon row.", group: "Copy" },
    { key: "useKnowledgeGraph", label: "Pull credentials from Knowledge Graph", type: { kind: "boolean" }, default: false, description: "When ON, ignores the 4 items below and shows the mandatory credential schemes for this trade (Gas Safe / NICEIC / TrustMark / etc.).", group: "Data source" },
    { key: "item1Icon", label: "Item 1 icon", type: { kind: "select", options: ICON_KEYS.map((v) => ({ value: v, label: v })) }, default: "shield", group: "Item 1" },
    { key: "item1Label", label: "Item 1 label", type: { kind: "text", maxLength: 30 }, default: "Gas Safe Registered", priority: "text", group: "Item 1" },
    { key: "item2Icon", label: "Item 2 icon", type: { kind: "select", options: ICON_KEYS.map((v) => ({ value: v, label: v })) }, default: "badge", group: "Item 2" },
    { key: "item2Label", label: "Item 2 label", type: { kind: "text", maxLength: 30 }, default: "NICEIC Approved", priority: "text", group: "Item 2" },
    { key: "item3Icon", label: "Item 3 icon", type: { kind: "select", options: ICON_KEYS.map((v) => ({ value: v, label: v })) }, default: "star", group: "Item 3" },
    { key: "item3Label", label: "Item 3 label", type: { kind: "text", maxLength: 30 }, default: "5.0 · 1000+ Reviews", priority: "text", group: "Item 3" },
    { key: "item4Icon", label: "Item 4 icon", type: { kind: "select", options: ICON_KEYS.map((v) => ({ value: v, label: v })) }, default: "pin", group: "Item 4" },
    { key: "item4Label", label: "Item 4 label", type: { kind: "text", maxLength: 30 }, default: "Local Experts", priority: "text", group: "Item 4" },
    {
      key: "surface",
      role: "surface_mode",
      label: "Surface",
      type: { kind: "select", options: [{ value: "light", label: "Light" }, { value: "tinted", label: "Tinted" }, { value: "dark", label: "Dark" }] },
      default: "tinted",
      group: "Layout"
    }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "A thin trust bar with icon + label items. Explain why this pattern builds credibility in 3 bullets.",
    improve: "Improve labels to be shorter and higher-impact. Return only patched fields.",
    rewrite: "Rewrite the 4 labels in a {tone} voice.",
    suggestAlternative: "Suggest one alternative section for below the hero when trust markers aren't the main story.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: {
    loading: { imageWeightBudgetKb: 0 },
    accessibility: { contrastMin: 4.5 },
    sales: { primaryActionRequired: false, socialProofRecommended: true },
    seo: { headingLevel: 3 },
    mobile: { minTapTargetPx: 44 },
    brandConsistency: { boundTokens: ["color.accent"] }
  },
  telemetryTags: ["trust_bar", "icons", "compact", "shadcn", "framer_motion"],
  bestForVerticals: ["electrician", "plumber", "gas-engineer", "hvac-contractor", "roofer", "landscaper", "extension-builder"],

  // ─── Slice D extended manifest ──────────────────────────────────
  category: "trust",
  supportedThemes: ["all"],
  supportedIndustries: ["all"],
  responsiveBehaviour: {
    mobile: "carousel",
    tablet: "grid_4",
    desktop: "grid_4"
  },
  imagePlaceholders: [],
  lucideIconsUsed: ["ShieldCheck", "BadgeCheck", "Star", "MapPin", "Award", "Wrench", "Zap", "Clock", "Users"],
  ctaArea: {
    hasPrimary: false,
    hasSecondary: false
  },
  accessibilityNotes: [
    "Icons are aria-hidden — the visible label is the accessible name",
    "Horizontal-scroll on mobile uses no scrollbar — visual affordance only, keyboard users tab through labels",
    "Uppercase label styling is purely visual — semantic case preserved for screen readers"
  ],

  defaultConfig: () => ({
    eyebrow: "",
    useKnowledgeGraph: true,
    // Fallback content — used only when Knowledge Graph pull is off AND
    // the merchant hasn't authored their own credentials.
    item1Icon: "shield",
    item1Label: "",
    item2Icon: "badge",
    item2Label: "",
    item3Icon: "star",
    item3Label: "",
    item4Icon: "pin",
    item4Label: "",
    surface: "tinted"
  }),
  renderer: IconRowSection
};

sectionRegistry.register(registration);
