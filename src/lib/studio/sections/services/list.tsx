// services.list_1 — Phase 4 rebuild.
//
// Now Knowledge-Graph-aware AND Lucide-icon-only. Never renders emoji.
//
// Resolution order for the services list:
//   1. config.items[]              — explicit blueprint seed
//   2. legacy s1..s5 config slots  — older blueprint seeds
//   3. Knowledge Graph package     — trade-appropriate defaults pulled
//                                    from packageForTrade(data.primaryTrade)
//
// Every service row renders a Lucide icon determined by a small
// slug→icon map. No colour hard-coding — icons inherit theme through
// Tailwind classes and CSS-var-backed brand tokens.
//
// ═══════ Lucide Icons ═══════
//   Primary Icon:      Wrench
//   Secondary Icons:   Zap, Flame, Droplet, Search, Hammer, Cable,
//                      Plug, Home, Shield, ClipboardCheck
//   Button Icons:      ArrowRight (row hover)
//   Navigation Icons:  ArrowRight (row link)
//   Status Icons:      (none)
//   Action Icons:      ArrowRight
// ═══════════════════════════

"use client";

import Link from "next/link";
import {
  ArrowRight,
  Wrench,
  Zap,
  Flame,
  Droplet,
  Search,
  Hammer,
  Cable,
  Plug,
  Home,
  Shield,
  ClipboardCheck,
  Sparkles,
  Paintbrush,
  Ruler,
  TreePine,
  Truck
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";
import { packageForTrade } from "@/lib/knowledge";

type ItemShape = {
  icon?: string;
  title?: string;
  body?: string;
  price?: string;
  href?: string;
};

type Config = {
  eyebrow: string;
  heading: string;
  s1Icon: string; s1Name: string; s1Body: string; s1Price: string; s1Href: string;
  s2Icon: string; s2Name: string; s2Body: string; s2Price: string; s2Href: string;
  s3Icon: string; s3Name: string; s3Body: string; s3Price: string; s3Href: string;
  s4Icon: string; s4Name: string; s4Body: string; s4Price: string; s4Href: string;
  s5Icon: string; s5Name: string; s5Body: string; s5Price: string; s5Href: string;
  items?: ItemShape[];
  /** When true, blueprint content is IGNORED and services come from the
   *  Knowledge Graph for data.primaryTrade. */
  useKnowledgeGraph: boolean;
  surface: "light" | "dark";
};

// Lucide icon map — string keys used in configs + auto-derived from
// service slugs. NEVER emoji.
const ICON_MAP: Record<string, LucideIcon> = {
  wrench: Wrench,
  zap: Zap,
  flame: Flame,
  droplet: Droplet,
  search: Search,
  hammer: Hammer,
  cable: Cable,
  plug: Plug,
  home: Home,
  shield: Shield,
  clipboard: ClipboardCheck,
  sparkles: Sparkles,
  paintbrush: Paintbrush,
  ruler: Ruler,
  tree: TreePine,
  truck: Truck
};

// Service-slug → Lucide icon inference. Used when pulling from the
// Knowledge Graph so each service auto-gets a sensible icon.
function inferIcon(serviceSlug: string): string {
  const s = serviceSlug.toLowerCase();
  if (s.includes("electric") || s.includes("consumer-unit") || s.includes("rewire") || s.includes("eicr") || s.includes("solar") || s.includes("ev-")) return "zap";
  if (s.includes("cable") || s.includes("data") || s.includes("network")) return "cable";
  if (s.includes("socket") || s.includes("outlet")) return "plug";
  if (s.includes("boiler") || s.includes("gas") || s.includes("cp12") || s.includes("heating") || s.includes("flue")) return "flame";
  if (s.includes("plumb") || s.includes("leak") || s.includes("tap") || s.includes("radiator") || s.includes("shower") || s.includes("water")) return "droplet";
  if (s.includes("survey") || s.includes("inspection") || s.includes("report") || s.includes("detection")) return "search";
  if (s.includes("build") || s.includes("extension") || s.includes("carpentry") || s.includes("joinery") || s.includes("kitchen") || s.includes("bathroom")) return "hammer";
  if (s.includes("paint") || s.includes("decor") || s.includes("wallpaper")) return "paintbrush";
  if (s.includes("garden") || s.includes("landscap") || s.includes("turf") || s.includes("planting")) return "tree";
  if (s.includes("hire") || s.includes("delivery") || s.includes("supply") || s.includes("van")) return "truck";
  if (s.includes("clean") || s.includes("polish") || s.includes("respray")) return "sparkles";
  if (s.includes("guarantee") || s.includes("insured") || s.includes("cert")) return "shield";
  if (s.includes("emergency") || s.includes("callout") || s.includes("24") || s.includes("service")) return "clipboard";
  return "wrench";
}

function ServicesList({
  instanceId,
  config,
  tokens,
  data,
  mode
}: SectionRendererProps<Config>) {
  const isDark = config.surface === "dark";
  const isEditing = mode === "edit";

  const eyebrow = typeof config.eyebrow === "string" ? config.eyebrow : "";
  const heading = typeof config.heading === "string" ? config.heading : "";
  const useKnowledgeGraph = config.useKnowledgeGraph === true;

  let services: Array<{
    icon: string;
    name: string;
    body: string;
    price: string;
    href: string;
  }> = [];

  // Priority 1: explicit items[] shape
  if (!useKnowledgeGraph && Array.isArray(config.items) && config.items.length > 0) {
    services = config.items
      .map((it) => ({
        icon: typeof it.icon === "string" ? it.icon : "",
        name: typeof it.title === "string" ? it.title : "",
        body: typeof it.body === "string" ? it.body : "",
        price: typeof it.price === "string" ? it.price : "",
        href: typeof it.href === "string" ? it.href : "#"
      }))
      .filter((s) => s.name.length > 0);
  }

  // Priority 2: legacy s1..s5 slots (only when config was seeded)
  if (services.length === 0 && !useKnowledgeGraph) {
    const legacy = [
      { icon: config.s1Icon, name: config.s1Name, body: config.s1Body, price: config.s1Price, href: config.s1Href },
      { icon: config.s2Icon, name: config.s2Name, body: config.s2Body, price: config.s2Price, href: config.s2Href },
      { icon: config.s3Icon, name: config.s3Name, body: config.s3Body, price: config.s3Price, href: config.s3Href },
      { icon: config.s4Icon, name: config.s4Name, body: config.s4Body, price: config.s4Price, href: config.s4Href },
      { icon: config.s5Icon, name: config.s5Name, body: config.s5Body, price: config.s5Price, href: config.s5Href }
    ]
      .map((s) => ({
        icon: typeof s.icon === "string" ? s.icon : "",
        name: typeof s.name === "string" ? s.name : "",
        body: typeof s.body === "string" ? s.body : "",
        price: typeof s.price === "string" ? s.price : "",
        href: typeof s.href === "string" ? s.href : "#"
      }))
      .filter((s) => s.name.length > 0);
    if (legacy.length > 0 && typeof config.s1Name === "string" && config.s1Name.length > 0) {
      services = legacy;
    }
  }

  // Priority 3: Knowledge Graph — data.primaryTrade → packageForTrade
  if (services.length === 0 && data.primaryTrade) {
    const pkg = packageForTrade(data.primaryTrade);
    if (pkg) {
      services = pkg.services.slice(0, 6).map((svc) => ({
        icon: inferIcon(svc.slug),
        name: svc.name,
        body: svc.description,
        price:
          svc.pricingModel === "fixed-price"
            ? "Fixed price"
            : svc.pricingModel === "day-rate"
              ? "Day rate"
              : "Quote required",
        href: `/services/${svc.slug}`
      }));
    }
  }

  if (services.length === 0) return null;

  return (
    <section
      className={cn(
        "relative w-full overflow-x-clip",
        isDark ? "bg-foreground text-background" : "bg-background text-foreground"
      )}
      {...sectionRootAttrs(instanceId, "services.list_1", "Services menu")}
    >
      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
        <div className="text-center sm:text-left">
          {eyebrow && (
            <Reveal>
              <p
                className="text-eyebrow font-extrabold uppercase text-brand-accent"
                {...treeAttrs(instanceId, "eyebrow", "Small kicker", "text")}
              >
                {eyebrow}
              </p>
            </Reveal>
          )}
          {heading && (
            <Reveal delay={0.05}>
              <h2
                className="mt-3 font-heading text-display-sm font-extrabold sm:text-display-md lg:text-display-lg"
                {...treeAttrs(instanceId, "heading", "Main headline", "text")}
              >
                {heading}
              </h2>
            </Reveal>
          )}
        </div>

        <Reveal delay={0.1}>
          <Card className="mt-8 divide-y divide-border overflow-hidden">
            {services.map((s, i) => {
              const Icon =
                ICON_MAP[s.icon] ?? ICON_MAP[inferIcon(s.name)] ?? Wrench;
              return (
                <Link
                  key={i}
                  href={s.href || "#"}
                  tabIndex={isEditing ? -1 : undefined}
                  className="group flex items-center gap-4 p-4 transition-colors hover:bg-muted/40 sm:p-5"
                >
                  <span
                    aria-hidden="true"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-accent/15 text-brand-accent sm:h-12 sm:w-12"
                    {...treeAttrs(instanceId, `s${i + 1}Icon`, `Service ${i + 1} icon`, "text")}
                  >
                    <Icon size={20} strokeWidth={2.25} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-body-md font-extrabold text-foreground sm:text-heading-sm"
                      {...treeAttrs(instanceId, `s${i + 1}Name`, `Service ${i + 1} name`, "text")}
                    >
                      {s.name}
                    </p>
                    {s.body && (
                      <p
                        className="mt-0.5 text-body-sm text-muted-foreground"
                        {...treeAttrs(instanceId, `s${i + 1}Body`, `Service ${i + 1} description`, "text")}
                      >
                        {s.body}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                    {s.price && (
                      <p
                        className="text-body-sm font-extrabold text-foreground"
                        {...treeAttrs(instanceId, `s${i + 1}Price`, `Service ${i + 1} price`, "text")}
                      >
                        {s.price}
                      </p>
                    )}
                    <span className="inline-flex items-center gap-1 text-caption font-extrabold uppercase text-muted-foreground transition group-hover:text-foreground">
                      More
                      <ArrowRight
                        size={12}
                        strokeWidth={2.5}
                        className="transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </Link>
              );
            })}
          </Card>
        </Reveal>
      </div>
    </section>
  );
}

const iconOpts = () => Object.keys(ICON_MAP).map((v) => ({ value: v, label: v }));

const registration: SectionRegistration<Config> = {
  id: "services.list_1",
  name: "Services menu",
  version: "3.0.0",
  library: "services",
  description:
    "Vertical services menu on shadcn Card + Framer Motion. Lucide-only icons (never emoji). Resolves content: items[] → legacy s1..s5 → Knowledge Graph packageForTrade(primaryTrade). Set useKnowledgeGraph: true to force graph resolution.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Services", priority: "text", role: "eyebrow", group: "Copy" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 80 }, default: "What we do", priority: "text", role: "headline", aiPromptable: true, group: "Copy" },
    { key: "useKnowledgeGraph", label: "Pull from Knowledge Graph", type: { kind: "boolean" }, default: false, description: "When ON, ignores s1..s5 below and pulls trade-specific services from the platform Knowledge Graph.", group: "Data source" },
    { key: "s1Icon", label: "Service 1 icon", type: { kind: "select", options: iconOpts() }, default: "wrench", group: "Service 1" },
    { key: "s1Name", label: "Service 1 name", type: { kind: "text", maxLength: 40 }, default: "", priority: "text", group: "Service 1" },
    { key: "s1Body", label: "Service 1 body", type: { kind: "text", maxLength: 140 }, default: "", priority: "text", aiPromptable: true, group: "Service 1" },
    { key: "s1Price", label: "Service 1 price", type: { kind: "text", maxLength: 20 }, default: "", priority: "text", group: "Service 1" },
    { key: "s1Href", label: "Service 1 link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "", group: "Service 1" },
    { key: "s2Icon", label: "Service 2 icon", type: { kind: "select", options: iconOpts() }, default: "zap", group: "Service 2" },
    { key: "s2Name", label: "Service 2 name", type: { kind: "text", maxLength: 40 }, default: "", priority: "text", group: "Service 2" },
    { key: "s2Body", label: "Service 2 body", type: { kind: "text", maxLength: 140 }, default: "", priority: "text", aiPromptable: true, group: "Service 2" },
    { key: "s2Price", label: "Service 2 price", type: { kind: "text", maxLength: 20 }, default: "", priority: "text", group: "Service 2" },
    { key: "s2Href", label: "Service 2 link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "", group: "Service 2" },
    { key: "s3Icon", label: "Service 3 icon", type: { kind: "select", options: iconOpts() }, default: "flame", group: "Service 3" },
    { key: "s3Name", label: "Service 3 name", type: { kind: "text", maxLength: 40 }, default: "", priority: "text", group: "Service 3" },
    { key: "s3Body", label: "Service 3 body", type: { kind: "text", maxLength: 140 }, default: "", priority: "text", aiPromptable: true, group: "Service 3" },
    { key: "s3Price", label: "Service 3 price", type: { kind: "text", maxLength: 20 }, default: "", priority: "text", group: "Service 3" },
    { key: "s3Href", label: "Service 3 link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "", group: "Service 3" },
    { key: "s4Icon", label: "Service 4 icon", type: { kind: "select", options: iconOpts() }, default: "droplet", group: "Service 4" },
    { key: "s4Name", label: "Service 4 name", type: { kind: "text", maxLength: 40 }, default: "", priority: "text", group: "Service 4" },
    { key: "s4Body", label: "Service 4 body", type: { kind: "text", maxLength: 140 }, default: "", priority: "text", aiPromptable: true, group: "Service 4" },
    { key: "s4Price", label: "Service 4 price", type: { kind: "text", maxLength: 20 }, default: "", priority: "text", group: "Service 4" },
    { key: "s4Href", label: "Service 4 link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "", group: "Service 4" },
    { key: "s5Icon", label: "Service 5 icon", type: { kind: "select", options: iconOpts() }, default: "search", group: "Service 5" },
    { key: "s5Name", label: "Service 5 name", type: { kind: "text", maxLength: 40 }, default: "", priority: "text", group: "Service 5" },
    { key: "s5Body", label: "Service 5 body", type: { kind: "text", maxLength: 140 }, default: "", priority: "text", aiPromptable: true, group: "Service 5" },
    { key: "s5Price", label: "Service 5 price", type: { kind: "text", maxLength: 20 }, default: "", priority: "text", group: "Service 5" },
    { key: "s5Href", label: "Service 5 link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "", group: "Service 5" },
    { key: "surface", role: "surface_mode", label: "Surface", type: { kind: "select", options: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }] }, default: "light", group: "Layout" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "A services menu section. Explain when trade-graph auto-population beats manual seeding.",
    improve: "Tighten titles + bodies to trade-plain language.",
    rewrite: "Rewrite service names + descriptions in a {tone} voice.",
    suggestAlternative: "Suggest an alternative when services are photo-heavy.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: {
    loading: { imageWeightBudgetKb: 0 },
    accessibility: { contrastMin: 4.5 },
    sales: { primaryActionRequired: false },
    seo: { headingLevel: 2 },
    mobile: { minTapTargetPx: 48 },
    brandConsistency: { boundTokens: ["color.accent"] }
  },
  telemetryTags: ["services", "list", "menu", "shadcn", "framer_motion", "knowledge_graph", "lucide"],
  bestForVerticals: ["electrician", "plumber", "gas-engineer", "hvac-contractor", "handyman", "chimney-sweep", "locksmith", "landscaper", "painter"],

  // ─── Slice D extended manifest ──────────────────────────────────
  category: "services",
  supportedThemes: ["all"],
  supportedIndustries: ["all"],
  responsiveBehaviour: {
    mobile: "stack",
    tablet: "stack",
    desktop: "stack"
  },
  imagePlaceholders: [],
  lucideIconsUsed: [
    "ArrowRight",
    "Wrench",
    "Zap",
    "Flame",
    "Droplet",
    "Search",
    "Hammer",
    "Cable",
    "Plug",
    "Home",
    "Shield",
    "ClipboardCheck",
    "Sparkles",
    "Paintbrush",
    "Ruler",
    "TreePine",
    "Truck"
  ],
  ctaArea: {
    hasPrimary: false,
    hasSecondary: false
  },
  accessibilityNotes: [
    "Each service row is a full-size Link — screen readers announce title + description + price",
    "48px+ minimum row height for touch",
    "Icons decorative (aria-hidden); text carries the meaning",
    "Arrow icon has hover/focus translation for sighted users"
  ],

  defaultConfig: () => ({
    eyebrow: "Services",
    heading: "What we do",
    useKnowledgeGraph: true,
    s1Icon: "wrench", s1Name: "", s1Body: "", s1Price: "", s1Href: "",
    s2Icon: "zap", s2Name: "", s2Body: "", s2Price: "", s2Href: "",
    s3Icon: "flame", s3Name: "", s3Body: "", s3Price: "", s3Href: "",
    s4Icon: "droplet", s4Name: "", s4Body: "", s4Price: "", s4Href: "",
    s5Icon: "search", s5Name: "", s5Body: "", s5Price: "", s5Href: "",
    surface: "light"
  }),
  renderer: ServicesList
};

sectionRegistry.register(registration);
