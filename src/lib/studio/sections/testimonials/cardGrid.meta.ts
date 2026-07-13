// Metadata sidecar for testimonials.card_grid_1. Server-safe registration so the AI routes can see this section (task #41 fix).

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { SectionRegistration } from "@/lib/studio/sectionTypes";
import { TestimonialsCardGrid } from "./cardGrid";

type Config = {
  eyebrow: string;
  heading: string;
  quote1: string; author1: string; business1: string;
  quote2: string; author2: string; business2: string;
  quote3: string; author3: string; business3: string;
  showAggregate: boolean;
  aggregateText: string;
  /** When true, seeds template quotes from the KG's customerTypes for
   *  this trade. Attribution is intentionally generic ("Recent customer")
   *  because the merchant is expected to replace with real reviews. */
  useKnowledgeGraph: boolean;
  surface: "light" | "dark";
};

const registration: SectionRegistration<Config> = {
  id: "testimonials.card_grid_1",
  name: "Testimonials · card grid",
  version: "2.0.0",
  library: "testimonials",
  description:
    "Three-card social-proof grid on shadcn Card + Framer Motion. Aggregate rating strip. Lucide star + quote icons. Mobile: card-stacked; Desktop: 3-col grid. Optional KG binding seeds template quotes from customerTypes for the trade.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "What customers say", priority: "text", role: "eyebrow", group: "Copy" },
    { key: "heading", label: "Heading", type: { kind: "text", maxLength: 80 }, default: "Recent reviews", priority: "text", role: "headline", aiPromptable: true, group: "Copy" },
    { key: "showAggregate", label: "Show aggregate rating", type: { kind: "boolean" }, default: true, group: "Copy" },
    { key: "aggregateText", label: "Aggregate rating text", type: { kind: "text", maxLength: 80 }, default: "4.9 average · 380 verified reviews", priority: "text", role: "trust_line", aiPromptable: true, group: "Copy" },
    { key: "useKnowledgeGraph", label: "Seed template quotes from Knowledge Graph", type: { kind: "boolean" }, default: false, description: "When ON, ignores the 3 quotes below and seeds template quotes for this trade's customer segments (homeowner / letting agent / etc.). Replace with real reviews after launch.", group: "Data source" },
    { key: "quote1", label: "Quote 1", type: { kind: "text", maxLength: 240, multiline: true }, default: "", priority: "text", role: "quote", aiPromptable: true, group: "Card 1" },
    { key: "author1", label: "Author 1", type: { kind: "text", maxLength: 40 }, default: "", priority: "text", role: "quote_author", group: "Card 1" },
    { key: "business1", label: "Business / role 1", type: { kind: "text", maxLength: 60 }, default: "", priority: "text", group: "Card 1" },
    { key: "quote2", label: "Quote 2", type: { kind: "text", maxLength: 240, multiline: true }, default: "", priority: "text", role: "quote", aiPromptable: true, group: "Card 2" },
    { key: "author2", label: "Author 2", type: { kind: "text", maxLength: 40 }, default: "", priority: "text", role: "quote_author", group: "Card 2" },
    { key: "business2", label: "Business / role 2", type: { kind: "text", maxLength: 60 }, default: "", priority: "text", group: "Card 2" },
    { key: "quote3", label: "Quote 3", type: { kind: "text", maxLength: 240, multiline: true }, default: "", priority: "text", role: "quote", aiPromptable: true, group: "Card 3" },
    { key: "author3", label: "Author 3", type: { kind: "text", maxLength: 40 }, default: "", priority: "text", role: "quote_author", group: "Card 3" },
    { key: "business3", label: "Business / role 3", type: { kind: "text", maxLength: 60 }, default: "", priority: "text", group: "Card 3" },
    { key: "surface", role: "surface_mode", label: "Surface", type: { kind: "select", options: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }] }, default: "light", group: "Layout" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "A three-card testimonials section. Explain when it beats a review carousel.",
    improve: "Tighten quotes. Return patched fields only.",
    rewrite: "Rewrite quotes in a {tone} voice, preserving structure + author names.",
    suggestAlternative: "Suggest an alternative when the merchant has 20+ reviews.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: { loading: { imageWeightBudgetKb: 0 }, accessibility: { contrastMin: 4.5 }, sales: { socialProofRecommended: true }, seo: { headingLevel: 2 }, mobile: { minTapTargetPx: 44 }, brandConsistency: { boundTokens: ["color.accent"] } },
  telemetryTags: ["testimonials", "reviews", "cards", "shadcn", "framer_motion"],
  bestForVerticals: ["electrician", "plumber", "gas-engineer", "hvac-contractor", "roofer", "landscaper", "extension-builder"],

  // ─── Slice D extended manifest ──────────────────────────────────
  category: "testimonials",
  supportedThemes: ["all"],
  supportedIndustries: ["all"],
  responsiveBehaviour: {
    mobile: "stack",
    tablet: "grid_2",
    desktop: "grid_3"
  },
  imagePlaceholders: [],
  lucideIconsUsed: ["Star", "Quote"],
  ctaArea: {
    hasPrimary: false,
    hasSecondary: false
  },
  accessibilityNotes: [
    "Star icons are aria-hidden — the aggregate rating text carries the score",
    "Card semantics are <ul>/<li> — screen readers announce card count",
    "Quote text uses proper curly quotes; author + role read after the quote for context"
  ],

  defaultConfig: () => ({
    eyebrow: "What customers say",
    heading: "Recent reviews",
    showAggregate: true,
    aggregateText: "4.9 average · 380 verified reviews",
    useKnowledgeGraph: true,
    // Fallback slots — used only when KG pull is off AND merchant
    // hasn't authored their own.
    quote1: "", author1: "", business1: "",
    quote2: "", author2: "", business2: "",
    quote3: "", author3: "", business3: "",
    surface: "light"
  }),
  renderer: TestimonialsCardGrid
};

sectionRegistry.register(registration);
