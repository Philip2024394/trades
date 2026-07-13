// Metadata sidecar for faq.accordion_1. Server-safe registration so the AI routes can see this section (task #41 fix).

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { SectionRegistration } from "@/lib/studio/sectionTypes";
import { FaqAccordion } from "./accordion";

type PreseedItem = { q?: string; a?: string };

type Config = {
  eyebrow: string;
  heading: string;
  q1: string; a1: string;
  q2: string; a2: string;
  q3: string; a3: string;
  q4: string; a4: string;
  q5: string; a5: string;
  q6: string; a6: string;
  preseed?: PreseedItem[];
  /** When true, pulls Q&A from the Knowledge Graph
   *  packageForTrade(primaryTrade).commonFaqs. Merchant overrides
   *  later via the section editor. */
  useKnowledgeGraph: boolean;
  surface: "light" | "dark";
};

const registration: SectionRegistration<Config> = {
  id: "faq.accordion_1",
  name: "FAQ Accordion",
  version: "2.0.0",
  library: "faq",
  description:
    "Expandable Q&A on shadcn Accordion (Radix). Proper keyboard nav + aria-expanded semantics. 6 Q&A slots; blueprints can also seed a preseed array. Framer Motion entrance choreography.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Frequently asked", priority: "text", role: "eyebrow", group: "Copy" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 80 }, default: "Common questions", priority: "text", role: "headline", aiPromptable: true, group: "Copy" },
    { key: "useKnowledgeGraph", label: "Pull FAQs from Knowledge Graph", type: { kind: "boolean" }, default: false, description: "When ON, ignores the Q1..Q6 below and pulls trade-specific FAQs from the platform Knowledge Graph.", group: "Data source" },
    { key: "q1", label: "Question 1", type: { kind: "text", maxLength: 120 }, default: "Are you insured?", priority: "text", role: "question", aiPromptable: true, group: "Q1" },
    { key: "a1", label: "Answer 1", type: { kind: "text", maxLength: 400, multiline: true }, default: "Yes — £5M public liability. Certificate on request.", priority: "text", role: "answer", aiPromptable: true, group: "Q1" },
    { key: "q2", label: "Question 2", type: { kind: "text", maxLength: 120 }, default: "How quickly can you come out?", priority: "text", role: "question", aiPromptable: true, group: "Q2" },
    { key: "a2", label: "Answer 2", type: { kind: "text", maxLength: 400, multiline: true }, default: "Same-day for emergencies. Standard bookings within 3 working days.", priority: "text", role: "answer", aiPromptable: true, group: "Q2" },
    { key: "q3", label: "Question 3", type: { kind: "text", maxLength: 120 }, default: "Do you charge a callout fee?", priority: "text", role: "question", aiPromptable: true, group: "Q3" },
    { key: "a3", label: "Answer 3", type: { kind: "text", maxLength: 400, multiline: true }, default: "No callout fee within our coverage area. Diagnostic quoted before any work starts.", priority: "text", role: "answer", aiPromptable: true, group: "Q3" },
    { key: "q4", label: "Question 4", type: { kind: "text", maxLength: 120 }, default: "What areas do you cover?", priority: "text", role: "question", aiPromptable: true, group: "Q4" },
    { key: "a4", label: "Answer 4", type: { kind: "text", maxLength: 400, multiline: true }, default: "Full coverage across our 25-mile radius. Outside the area on a case-by-case basis.", priority: "text", role: "answer", aiPromptable: true, group: "Q4" },
    { key: "q5", label: "Question 5", type: { kind: "text", maxLength: 120 }, default: "Do you guarantee your work?", priority: "text", role: "question", aiPromptable: true, group: "Q5" },
    { key: "a5", label: "Answer 5", type: { kind: "text", maxLength: 400, multiline: true }, default: "2-year workmanship guarantee. Manufacturer warranty on parts.", priority: "text", role: "answer", aiPromptable: true, group: "Q5" },
    { key: "q6", label: "Question 6", type: { kind: "text", maxLength: 120 }, default: "Can I pay by card / bank transfer?", priority: "text", role: "question", aiPromptable: true, group: "Q6" },
    { key: "a6", label: "Answer 6", type: { kind: "text", maxLength: 400, multiline: true }, default: "Card, bank transfer, WhatsApp Pay. No cheques.", priority: "text", role: "answer", aiPromptable: true, group: "Q6" },
    { key: "surface", role: "surface_mode", label: "Surface", type: { kind: "select", options: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }] }, default: "light", group: "Layout" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "An FAQ accordion. Explain when it works vs a dedicated FAQ page.",
    improve: "Tighten questions + answers. Return patched fields only.",
    rewrite: "Rewrite Q + A in a {tone} voice, preserving structure.",
    suggestAlternative: "Suggest an alternative when there are 15+ FAQs.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: {
    loading: { imageWeightBudgetKb: 0 },
    accessibility: { contrastMin: 4.5 },
    sales: { socialProofRecommended: false },
    seo: { headingLevel: 2 },
    mobile: { minTapTargetPx: 48 },
    brandConsistency: { boundTokens: ["color.accent"] }
  },
  telemetryTags: ["faq", "accordion", "questions", "shadcn", "radix", "framer_motion"],
  bestForVerticals: ["electrician", "plumber", "gas-engineer", "hvac-contractor", "handyman", "landscaper", "extension-builder"],

  // ─── Slice D extended manifest ──────────────────────────────────
  category: "faq",
  supportedThemes: ["all"],
  supportedIndustries: ["all"],
  responsiveBehaviour: {
    mobile: "collapse",
    tablet: "collapse",
    desktop: "collapse"
  },
  imagePlaceholders: [],
  lucideIconsUsed: ["ChevronDown"],
  ctaArea: {
    hasPrimary: false,
    hasSecondary: false
  },
  accessibilityNotes: [
    "Radix Accordion primitive handles aria-expanded / aria-controls automatically",
    "Keyboard navigation: Tab focus, Enter/Space expand, Arrow keys between triggers",
    "ChevronDown icon flips via [data-state=open] — respects reduced-motion",
    "H2 heading is the section landmark; questions are H3-level triggers"
  ],

  defaultConfig: () => ({
    eyebrow: "Frequently asked",
    heading: "Common questions",
    useKnowledgeGraph: true,
    // Legacy defaults kept as fallback if primaryTrade is unset AND no
    // preseed AND merchant hasn't authored their own.
    q1: "", a1: "",
    q2: "", a2: "",
    q3: "", a3: "",
    q4: "", a4: "",
    q5: "", a5: "",
    q6: "", a6: "",
    surface: "light"
  }),
  renderer: FaqAccordion
};

sectionRegistry.register(registration);
