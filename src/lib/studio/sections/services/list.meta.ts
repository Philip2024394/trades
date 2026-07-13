// Metadata sidecar for services.list_1.
//
// Task #41 fix: the sibling `list.tsx` is a "use client" module because
// the renderer uses React client features. Next.js does NOT run the
// module-level `sectionRegistry.register()` side effect on the server
// when a "use client" module is imported from an RSC / API route — so
// the server-side catalog was missing this section, and the AI router
// couldn't propose it.
//
// This file is NOT "use client", so its top-level register() call runs
// on BOTH the server (populating the API-route registry) AND the client
// (populating the editor registry). The renderer is imported from the
// sibling .tsx: on the server it becomes a client-component reference
// (never called), on the client it's the real component.

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { SectionRegistration } from "@/lib/studio/sectionTypes";
import { ServicesList } from "./list";

// Kept as a literal here (not imported from list.tsx) because that
// file is "use client" — non-component named exports become opaque
// proxies when read from the server bundle. Component references
// (like ServicesList) are the only cross-boundary import that works.
const ICON_KEYS = [
  "wrench", "zap", "flame", "droplet", "search", "hammer",
  "cable", "plug", "home", "shield", "clipboard", "sparkles",
  "paintbrush", "ruler", "tree", "truck"
];

type Config = {
  eyebrow: string;
  heading: string;
  s1Icon: string; s1Name: string; s1Body: string; s1Price: string; s1Href: string;
  s2Icon: string; s2Name: string; s2Body: string; s2Price: string; s2Href: string;
  s3Icon: string; s3Name: string; s3Body: string; s3Price: string; s3Href: string;
  s4Icon: string; s4Name: string; s4Body: string; s4Price: string; s4Href: string;
  s5Icon: string; s5Name: string; s5Body: string; s5Price: string; s5Href: string;
  useKnowledgeGraph: boolean;
  surface: "light" | "dark";
  items?: Array<{ icon?: string; title?: string; body?: string; price?: string; href?: string }>;
};

const iconOpts = () => ICON_KEYS.map((v) => ({ value: v, label: v }));

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
