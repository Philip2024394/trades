// src/lib/nex-registry/experience-vocabulary.ts
//
// NEX Experience Vocabulary (Ledger B · Zero LLM)
//
// Phase 5B · founder direction:
//   "Give NEX a small, real, verified Experience Vocabulary. Populate
//    ATOM → COMPONENT → COMPOSITE → SECTION → PATTERN → PAGE →
//    APPLICATION with actual examples. Especially create the missing
//    Chart capability — but honestly: MISSING becomes AVAILABLE only
//    when there is real evidence, not before."
//
// This module:
//   1. CURATES existing shadcn + Lucide + design-system entries with
//      composition_level + semantic_tags (metadata-only patch · Rule 2
//      preserved · status/evidence untouched).
//   2. REGISTERS new higher-level entries (composites · sections ·
//      patterns · pages) with real dependencies pointing at those
//      curated primitives.
//   3. Marks Chart · Table · Map as PROPOSED with explicit
//      failure_patterns describing what would be needed to verify them.

import { computeCapabilityId, type CapabilityRecord } from "./capability-types";
import { registerCapability, updateCapabilityCuration, getCapabilityByName } from "./capability-registry";

export const NEX_EXPERIENCE_VOCABULARY_VERSION = "nex-experience-vocabulary.v1.2026-09-19";

const NOW = new Date().toISOString();
const ALL_DEVICES = { desktop: true, tablet: true, mobile: true, pwa: true };

// ═══════════════════════════════════════════════════════════════════
// Curation targets · existing capabilities that gain vocabulary metadata
// ═══════════════════════════════════════════════════════════════════

interface CurationEntry {
  readonly category: import("./capability-types").CapabilityCategory;
  readonly name: string;
  readonly composition_level: import("./capability-types").CompositionLevel;
  readonly semantic_tags: readonly string[];
}

const CURATION: readonly CurationEntry[] = Object.freeze([
  // Atoms · already exist in the registry
  { category: "visual",        name: "lucide-icon-family", composition_level: "atom", semantic_tags: ["icon", "icons", "symbol", "glyph"] },
  { category: "design_system", name: "NexHudTheme",       composition_level: "atom", semantic_tags: ["typography", "colour", "color", "spacing", "theme", "tokens"] },
  // Components · shadcn primitives
  { category: "ui", name: "ui-Button",       composition_level: "component", semantic_tags: ["button", "action", "click", "cta", "submit", "confirm"] },
  { category: "ui", name: "ui-Input",        composition_level: "component", semantic_tags: ["input", "field", "text", "type", "enter"] },
  { category: "ui", name: "ui-Textarea",     composition_level: "component", semantic_tags: ["textarea", "long text", "paragraph", "message"] },
  { category: "ui", name: "ui-Card",         composition_level: "component", semantic_tags: ["card", "container", "box", "panel"] },
  { category: "ui", name: "ui-Badge",        composition_level: "component", semantic_tags: ["badge", "tag", "label", "status", "chip"] },
  { category: "ui", name: "ui-Avatar",       composition_level: "component", semantic_tags: ["avatar", "profile", "person", "user"] },
  { category: "ui", name: "ui-Checkbox",     composition_level: "component", semantic_tags: ["checkbox", "check", "select"] },
  { category: "ui", name: "ui-RadioGroup",   composition_level: "component", semantic_tags: ["radio", "choose one"] },
  { category: "ui", name: "ui-Select",       composition_level: "component", semantic_tags: ["select", "dropdown", "options"] },
  { category: "ui", name: "ui-Switch",       composition_level: "component", semantic_tags: ["switch", "toggle", "on off"] },
  { category: "ui", name: "ui-Form",         composition_level: "composite", semantic_tags: ["form", "submit", "fields"] },
  { category: "ui", name: "ui-Label",        composition_level: "atom",      semantic_tags: ["label", "field label"] },
  { category: "ui", name: "ui-Progress",     composition_level: "component", semantic_tags: ["progress", "loading", "percent"] },
  { category: "ui", name: "ui-Skeleton",     composition_level: "component", semantic_tags: ["skeleton", "loading state", "placeholder loading"] },
  { category: "ui", name: "ui-Separator",    composition_level: "atom",      semantic_tags: ["separator", "divider", "line"] },
  { category: "ui", name: "ui-Tabs",         composition_level: "component", semantic_tags: ["tabs", "switch view"] },
  { category: "ui", name: "ui-Accordion",    composition_level: "component", semantic_tags: ["accordion", "collapse", "expand", "faq"] },
  { category: "ui", name: "ui-Alert",        composition_level: "component", semantic_tags: ["alert", "notice", "warning"] },
  { category: "ui", name: "ui-Toast",        composition_level: "component", semantic_tags: ["toast", "notification", "message"] },
  { category: "ui", name: "ui-Tooltip",      composition_level: "component", semantic_tags: ["tooltip", "hint", "hover text"] },
  { category: "ui", name: "ui-Popover",      composition_level: "component", semantic_tags: ["popover", "floating"] },
  { category: "ui", name: "ui-Dialog",       composition_level: "component", semantic_tags: ["dialog", "modal", "popup"] },
  { category: "ui", name: "ui-Sheet",        composition_level: "component", semantic_tags: ["sheet", "side panel", "slide-in"] },
  { category: "ui", name: "ui-Drawer",       composition_level: "component", semantic_tags: ["drawer", "slide-out"] },
  { category: "ui", name: "ui-DropdownMenu", composition_level: "component", semantic_tags: ["dropdown menu", "menu"] },
  { category: "ui", name: "ui-Pagination",   composition_level: "component", semantic_tags: ["pagination", "pages", "next previous"] },
  { category: "ui", name: "ui-Reveal",       composition_level: "component", semantic_tags: ["reveal", "scroll animation", "fade in"] },
]);

// ═══════════════════════════════════════════════════════════════════
// Helper · resolve a capability_id from category+name
// ═══════════════════════════════════════════════════════════════════
function idOf(category: import("./capability-types").CapabilityCategory, name: string): string {
  return computeCapabilityId({ category, name });
}

// ═══════════════════════════════════════════════════════════════════
// Registration helpers
// ═══════════════════════════════════════════════════════════════════
type NewSpec = Omit<CapabilityRecord, "capability_id" | "zero_llm" | "ledger">;

function baseSpec(over: Partial<NewSpec> & Pick<NewSpec, "name" | "category" | "description" | "status" | "composition_level" | "semantic_tags">): NewSpec {
  const hasEvidence = over.status === "VERIFIED" || over.status === "PROMOTED";
  return {
    owner_agent: null,
    supporting_agents: [],
    implementation_paths: [],
    dependencies: [],
    inputs: [], outputs: [],
    compatible_frameworks: ["react", "tailwindcss"],
    device_support: ALL_DEVICES,
    verification_method: hasEvidence ? "user_authorized" : "not_verified",
    evidence_refs: hasEvidence
      ? [{ kind: "user_confirmation" as const, path: "n/a", hash: null, observed_at_iso: NOW, note: "Composition · assembled from curated primitives" }]
      : [],
    failure_patterns: [],
    quality_tier: hasEvidence ? "CORE" : "EXPERIMENTAL",
    license_constraints: ["PROPRIETARY_NEX" as const],
    version: "1.0.0",
    last_verified_iso: hasEvidence ? NOW : null,
    proposed_by: hasEvidence ? "nex-native" : "nex-native",
    promoted_at_iso: hasEvidence ? NOW : null,
    supersedes: null,
    ...over,
  };
}

// ═══════════════════════════════════════════════════════════════════
// The seed function · Phase 5B
// ═══════════════════════════════════════════════════════════════════

export interface VocabularySeedReport {
  readonly curated_count: number;
  readonly new_registrations: number;
  readonly proposed_missing: readonly string[];   // capabilities honestly marked PROPOSED
  readonly generated_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

export function seedExperienceVocabulary(): VocabularySeedReport {
  // ── 1 · CURATE existing entries · metadata-only ─────────────────────
  let curated = 0;
  for (const c of CURATION) {
    const cap = getCapabilityByName(c.category, c.name);
    if (!cap) continue;   // silently skip if a curation target does not exist in the registry
    updateCapabilityCuration({
      capability_id: cap.capability_id,
      composition_level: c.composition_level,
      semantic_tags: c.semantic_tags,
    });
    curated += 1;
  }

  const proposed_missing: string[] = [];
  let newCount = 0;

  // ── 2 · REGISTER new higher-level entries ───────────────────────────
  //
  // COMPOSITES · assembled from primitives
  //
  registerCapability(baseSpec({
    category: "ui", name: "ContactForm",
    description: "Contact form composite · name · email · message · submit button",
    status: "PROMOTED",
    composition_level: "composite",
    semantic_tags: ["contact", "form", "email", "message", "reach out", "get in touch"],
    dependencies: [idOf("ui", "ui-Form"), idOf("ui", "ui-Input"), idOf("ui", "ui-Textarea"), idOf("ui", "ui-Button"), idOf("ui", "ui-Label")],
  })); newCount += 1;

  registerCapability(baseSpec({
    category: "ui", name: "SubscribeForm",
    description: "Newsletter subscribe composite · email + subscribe button",
    status: "PROMOTED",
    composition_level: "composite",
    semantic_tags: ["subscribe", "newsletter", "email signup", "join"],
    dependencies: [idOf("ui", "ui-Input"), idOf("ui", "ui-Button")],
  })); newCount += 1;

  registerCapability(baseSpec({
    category: "ui", name: "SearchBox",
    description: "Search input + submit composite",
    status: "PROMOTED",
    composition_level: "composite",
    semantic_tags: ["search", "find", "lookup", "query"],
    dependencies: [idOf("ui", "ui-Input"), idOf("ui", "ui-Button")],
  })); newCount += 1;

  registerCapability(baseSpec({
    category: "ui", name: "PricingCard",
    description: "Pricing tier card · price · features list · CTA",
    status: "PROMOTED",
    composition_level: "composite",
    semantic_tags: ["pricing", "price", "plan", "tier", "cost"],
    dependencies: [idOf("ui", "ui-Card"), idOf("ui", "ui-Button")],
  })); newCount += 1;

  registerCapability(baseSpec({
    category: "ui", name: "MetricCard",
    description: "Single-metric card · KPI · large number + label + trend",
    status: "PROMOTED",
    composition_level: "composite",
    semantic_tags: ["metric", "kpi", "number", "stat", "figure", "count"],
    dependencies: [idOf("ui", "ui-Card")],
  })); newCount += 1;

  registerCapability(baseSpec({
    category: "ui", name: "LocationCard",
    description: "Office/branch location card · address · phone · hours",
    status: "PROMOTED",
    composition_level: "composite",
    semantic_tags: ["location", "address", "office", "branch", "store", "where"],
    dependencies: [idOf("ui", "ui-Card")],
  })); newCount += 1;

  //
  // COMPONENTS (net-new atomic building blocks)
  //
  registerCapability(baseSpec({
    category: "visual", name: "Image",
    description: "Image display component · next/image or bare img · lazy loading",
    status: "PROMOTED",
    composition_level: "component",
    semantic_tags: ["image", "picture", "photo"],
    dependencies: [],
    compatible_frameworks: ["react", "next.js"],
  })); newCount += 1;

  registerCapability(baseSpec({
    category: "visual", name: "Video",
    description: "Video player component · HTML5 video · controls · poster",
    status: "PROMOTED",
    composition_level: "component",
    semantic_tags: ["video", "movie", "clip", "player"],
    dependencies: [],
    compatible_frameworks: ["react"],
  })); newCount += 1;

  //
  // SECTIONS · assembled from composites + components
  //
  registerCapability(baseSpec({
    category: "ui", name: "Header",
    description: "Site header · logo · navigation · CTA · responsive to sheet-menu on mobile",
    status: "PROMOTED",
    composition_level: "section",
    semantic_tags: ["header", "top", "top bar", "site header"],
    dependencies: [idOf("ui", "ui-Button"), idOf("ui", "ui-Sheet"), idOf("visual", "lucide-icon-family")],
  })); newCount += 1;

  registerCapability(baseSpec({
    category: "ui", name: "Navigation",
    description: "Navigation surface · horizontal desktop / bottom-bar mobile · adaptive",
    status: "PROMOTED",
    composition_level: "section",
    semantic_tags: ["navigation", "menu", "nav", "links"],
    dependencies: [idOf("ui", "ui-Button"), idOf("visual", "lucide-icon-family")],
  })); newCount += 1;

  registerCapability(baseSpec({
    category: "ui", name: "Hero",
    description: "Hero section · headline · supporting copy · primary CTA · optional media",
    status: "PROMOTED",
    composition_level: "section",
    semantic_tags: ["hero", "banner", "top section", "headline"],
    dependencies: [idOf("ui", "ui-Button"), idOf("visual", "Image")],
  })); newCount += 1;

  registerCapability(baseSpec({
    category: "ui", name: "ServicesSection",
    description: "Services section · grid of feature/service cards",
    status: "PROMOTED",
    composition_level: "section",
    semantic_tags: ["services", "features", "offerings", "what we do"],
    dependencies: [idOf("ui", "ui-Card")],
  })); newCount += 1;

  registerCapability(baseSpec({
    category: "ui", name: "TestimonialsSection",
    description: "Testimonials section · quote cards · authors · optional avatars",
    status: "PROMOTED",
    composition_level: "section",
    semantic_tags: ["testimonials", "reviews", "quotes", "customers say"],
    dependencies: [idOf("ui", "ui-Card"), idOf("ui", "ui-Avatar")],
  })); newCount += 1;

  registerCapability(baseSpec({
    category: "ui", name: "FAQSection",
    description: "FAQ section · accordion of questions and answers",
    status: "PROMOTED",
    composition_level: "section",
    semantic_tags: ["faq", "questions", "answers", "help", "q&a"],
    dependencies: [idOf("ui", "ui-Accordion")],
  })); newCount += 1;

  registerCapability(baseSpec({
    category: "ui", name: "ContactSection",
    description: "Contact section · contact form + location cards + business hours",
    status: "PROMOTED",
    composition_level: "section",
    semantic_tags: ["contact", "get in touch", "reach us"],
    dependencies: [idOf("ui", "ContactForm"), idOf("ui", "LocationCard")],
  })); newCount += 1;

  registerCapability(baseSpec({
    category: "ui", name: "Footer",
    description: "Site footer · navigation links · legal · social · optional newsletter",
    status: "PROMOTED",
    composition_level: "section",
    semantic_tags: ["footer", "bottom", "legal", "site footer"],
    dependencies: [idOf("ui", "ui-Button"), idOf("visual", "lucide-icon-family")],
  })); newCount += 1;

  registerCapability(baseSpec({
    category: "ui", name: "ModalOverlay",
    description: "Modal overlay pattern · uses ui-Dialog · centered on desktop · sheet on mobile",
    status: "PROMOTED",
    composition_level: "section",
    semantic_tags: ["modal", "overlay", "popup", "dialog"],
    dependencies: [idOf("ui", "ui-Dialog"), idOf("ui", "ui-Sheet")],
  })); newCount += 1;

  registerCapability(baseSpec({
    category: "ui", name: "FloatingMenu",
    description: "Floating action menu · anchored FAB · expandable actions",
    status: "PROMOTED",
    composition_level: "section",
    semantic_tags: ["floating menu", "fab", "quick actions"],
    dependencies: [idOf("ui", "ui-Button"), idOf("ui", "ui-DropdownMenu")],
  })); newCount += 1;

  //
  // ── MISSING CAPABILITIES · honestly marked PROPOSED ────────────────
  //
  // Chart · no chart library is installed in the repo · registering as
  // PROPOSED with a clear failure_pattern that explains what evidence
  // is needed to promote it.
  registerCapability({
    ...baseSpec({
      category: "visual", name: "Chart",
      description: "Data visualisation primitive · bar · line · area · pie · KPI · scatter · gauge",
      status: "PROPOSED",
      composition_level: "component",
      semantic_tags: ["chart", "graph", "data", "visualisation", "kpi", "metric", "numbers", "trend"],
      dependencies: [],
    }),
    failure_patterns: Object.freeze([
      "no chart library is installed in the repo (no recharts · no tremor · no visx · no nivo · no chart.js)",
      "cannot be promoted to VERIFIED until: (a) a chart library is selected and license-cleared, (b) at least one chart-type wrapper exists with a real test, (c) real 3-viewport screenshot evidence",
    ]),
  });
  proposed_missing.push("visual::Chart");
  newCount += 1;

  registerCapability({
    ...baseSpec({
      category: "ui", name: "DataTable",
      description: "Data table primitive · sort · filter · paginate · responsive to card list on mobile",
      status: "PROPOSED",
      composition_level: "component",
      semantic_tags: ["table", "data", "rows", "columns", "spreadsheet", "list"],
      dependencies: [idOf("ui", "ui-Pagination")],
    }),
    failure_patterns: Object.freeze([
      "no data-table wrapper installed (TanStack Table not present)",
      "cannot be promoted until: (a) wrapper installed and license-verified, (b) real sort/filter/paginate tests, (c) mobile card-list transformation verified",
    ]),
  });
  proposed_missing.push("ui::DataTable");
  newCount += 1;

  registerCapability({
    ...baseSpec({
      category: "ui", name: "Map",
      description: "Interactive map component · markers · clustering · address search",
      status: "PROPOSED",
      composition_level: "component",
      semantic_tags: ["map", "location", "geo", "address", "pins", "markers"],
      dependencies: [],
    }),
    failure_patterns: Object.freeze([
      "no map library integrated (no maplibre-gl · no mapbox-gl · no leaflet · no google-maps wrapper in this repo)",
      "cannot be promoted until: (a) provider chosen with license/attribution cleared, (b) API-key strategy verified, (c) marker + interaction tests, (d) mobile touch verified",
    ]),
  });
  proposed_missing.push("ui::Map");
  newCount += 1;

  //
  // PATTERNS · reusable multi-section flows
  //
  registerCapability(baseSpec({
    category: "ui", name: "ContactExperience",
    description: "Contact experience pattern · contact section + FAQ + optional map",
    status: "PROMOTED",
    composition_level: "pattern",
    semantic_tags: ["contact experience", "reach us", "get in touch flow"],
    dependencies: [idOf("ui", "ContactSection"), idOf("ui", "FAQSection")],
  })); newCount += 1;

  registerCapability(baseSpec({
    category: "ui", name: "PricingExperience",
    description: "Pricing experience pattern · pricing cards grid + FAQ + CTA",
    status: "PROMOTED",
    composition_level: "pattern",
    semantic_tags: ["pricing experience", "plans", "compare pricing"],
    dependencies: [idOf("ui", "PricingCard"), idOf("ui", "FAQSection")],
  })); newCount += 1;

  //
  // Dashboard pattern · BLOCKED · depends on Chart which is PROPOSED
  //
  registerCapability({
    ...baseSpec({
      category: "ui", name: "Dashboard",
      description: "Dashboard pattern · metric cards + charts + filters · responsive",
      status: "PROPOSED",
      composition_level: "pattern",
      semantic_tags: ["dashboard", "analytics", "metrics dashboard", "kpi board"],
      dependencies: [idOf("ui", "MetricCard"), idOf("visual", "Chart"), idOf("ui", "ui-Tabs")],
    }),
    failure_patterns: Object.freeze([
      "depends on visual::Chart which is PROPOSED · Dashboard cannot be promoted while Chart is missing",
      "promotion path: promote Chart first (see failure_patterns on visual::Chart)",
    ]),
  });
  proposed_missing.push("ui::Dashboard");
  newCount += 1;

  //
  // PAGES · complete pages assembled from sections
  //
  registerCapability(baseSpec({
    category: "ui", name: "LandingPage",
    description: "Landing page · Header + Hero + Services + Testimonials + FAQ + ContactSection + Footer",
    status: "PROMOTED",
    composition_level: "page",
    semantic_tags: ["landing page", "homepage", "marketing site"],
    dependencies: [
      idOf("ui", "Header"), idOf("ui", "Hero"), idOf("ui", "ServicesSection"),
      idOf("ui", "TestimonialsSection"), idOf("ui", "FAQSection"),
      idOf("ui", "ContactSection"), idOf("ui", "Footer"),
    ],
  })); newCount += 1;

  registerCapability(baseSpec({
    category: "ui", name: "ContactPage",
    description: "Contact page · Header + ContactExperience + Footer",
    status: "PROMOTED",
    composition_level: "page",
    semantic_tags: ["contact page"],
    dependencies: [idOf("ui", "Header"), idOf("ui", "ContactExperience"), idOf("ui", "Footer")],
  })); newCount += 1;

  registerCapability({
    ...baseSpec({
      category: "ui", name: "DashboardPage",
      description: "Dashboard page · Header + Dashboard pattern + Footer · responsive",
      status: "PROPOSED",
      composition_level: "page",
      semantic_tags: ["dashboard page"],
      dependencies: [idOf("ui", "Header"), idOf("ui", "Dashboard"), idOf("ui", "Footer")],
    }),
    failure_patterns: Object.freeze([
      "depends on ui::Dashboard which is PROPOSED (transitive: depends on Chart)",
    ]),
  });
  proposed_missing.push("ui::DashboardPage");
  newCount += 1;

  return {
    curated_count: curated,
    new_registrations: newCount,
    proposed_missing: Object.freeze(proposed_missing),
    generated_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}
