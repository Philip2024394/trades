// src/lib/nex-native/site-templates.ts
//
// Wave 2A · NEX App Builder Template Registry V1 · sealed 2026-09-25.
// -----------------------------------------------------------------
// Founder-sealed doctrine (see memory · doctrine_nex_app_builder_templates_2026_09_25):
//   Templates are a FOUNDATIONAL product feature, not cosmetic.
//   Bakery site must never surface construction imagery.
//   3-question intent capture (what/purpose/visual) →
//   deterministic template selection →
//   real NEX data binding →
//   subject-coherence validator (rejects mismatched combinations) →
//   Builder Engine renders.
//
// This file is the Template Intent layer.
// It sits ABOVE the existing Visual Template layer (NexSiteTemplate =
// "modern-minimal" | "warm-artisan"), and every registry entry maps to
// a compatible visual_template. Adding a new intent template does NOT
// require a DB migration on nex_generated_site.template_name CHECK.
//
// Coherence validator lives at the bottom.

import type { NexSiteTemplate, NexSiteSection, NexSiteAccent } from "./site-service";

// ---------------------------------------------------------------------------
// Enums · what/purpose/visual · Founder-sealed 3-question intent capture
// ---------------------------------------------------------------------------

/** Business category · the "WHAT is being built?" answer. */
export const NEX_BUSINESS_CATEGORIES = [
  "bakery",
  "restaurant",
  "cafe",
  "ice-cream",
  "dessert-shop",
  "drinks-shop",
  "juice-bar",
  "tradesperson",
  "construction",
  "staircase-company",
  "salon",
  "beauty",
  "fitness",
  "consultant",
  "agency",
  "ecommerce",
  "product-brand",
  "local-service",
  "portfolio",
  "community",
  "event",
  "creator",
  "professional-service",
] as const;
export type NexBusinessCategory = (typeof NEX_BUSINESS_CATEGORIES)[number];

/** Bridge 22 · food + drink verticals get a menu-first landing
 *  instead of the product-grid landing. Menu editor available
 *  under /manage/menu · shopping cart line items are of kind
 *  "menu_item" for these. */
export const NEX_MENU_FIRST_CATEGORIES = [
  "restaurant",
  "cafe",
  "bakery",
  "ice-cream",
  "dessert-shop",
  "drinks-shop",
  "juice-bar",
] as const;
export type NexMenuFirstCategory = (typeof NEX_MENU_FIRST_CATEGORIES)[number];

export function isMenuFirstCategory(
  category: string | null | undefined,
): boolean {
  if (!category) return false;
  return (NEX_MENU_FIRST_CATEGORIES as readonly string[]).includes(category);
}

/** Primary purpose · the "WHAT is the primary purpose?" answer. */
export const NEX_TEMPLATE_PURPOSES = [
  "sell-products",
  "receive-bookings",
  "generate-enquiries",
  "showcase-portfolio",
  "promote-local-business",
  "collect-leads",
  "present-services",
  "sell-appointments",
  "promote-events",
  "build-community",
] as const;
export type NexTemplatePurpose = (typeof NEX_TEMPLATE_PURPOSES)[number];

/** Visual direction · the "WHAT is the visual direction?" answer. */
export const NEX_TEMPLATE_VISUALS = [
  "premium",
  "minimal",
  "warm",
  "bold",
  "editorial",
  "luxury",
  "playful",
  "technical",
  "industrial",
  "elegant",
  "local-community",
] as const;
export type NexTemplateVisual = (typeof NEX_TEMPLATE_VISUALS)[number];

// ---------------------------------------------------------------------------
// Template entry shape
// ---------------------------------------------------------------------------

export interface NexTemplateEntry {
  /** Registry key · human-readable id. Never renamed once released. */
  id: string;
  /** Bump when the entry's information architecture changes materially. */
  version: number;
  /** The three intent answers this template satisfies. */
  business_category: NexBusinessCategory;
  primary_purpose: NexTemplatePurpose;
  visual_direction: NexTemplateVisual;
  /** Which underlying visual template the Builder Engine will render.
   *  Must be a member of NexSiteTemplate (site-service). */
  visual_template: NexSiteTemplate;
  /** Default accent for this intent · user may override. */
  default_accent: NexSiteAccent;
  /** Sections that MAY appear (whitelist) in canonical order. */
  allowed_sections: readonly NexSiteSection[];
  /** Sections that MUST appear if the template is used. */
  required_sections: readonly NexSiteSection[];
  /** Business categories whose imagery/content MUST NOT appear.
   *  Subject-coherence validator uses this to reject mismatched output. */
  prohibited_categories: readonly NexBusinessCategory[];
  /** Human-facing metadata for the template picker card. */
  display_name: string;
  short_description: string;
  suitable_for: readonly string[];
}

// ---------------------------------------------------------------------------
// Registry · V1 · 3 initial entries covering 3 distinct information
// architectures. NOT 3 colour variants of one template.
// ---------------------------------------------------------------------------

const BAKERY_WARM_V1: NexTemplateEntry = {
  id: "bakery-warm-v1",
  version: 1,
  business_category: "bakery",
  primary_purpose: "sell-products",
  visual_direction: "warm",
  visual_template: "warm-artisan",
  default_accent: "amber",
  allowed_sections: ["hero", "products", "features", "gallery", "hours_contact", "cta_band", "faq"],
  required_sections: ["hero", "products", "hours_contact"],
  prohibited_categories: [
    "construction", "staircase-company", "tradesperson",
    "fitness", "agency", "consultant", "professional-service",
  ],
  display_name: "Warm Bakery",
  short_description:
    "Warm-artisan bakery site · product-first with cheapest 3 cakes as hero, pickup hours + COD flags visible.",
  suitable_for: ["cake shop", "artisan bakery", "sourdough studio", "patisserie", "cupcake business"],
};

const RESTAURANT_WARM_V1: NexTemplateEntry = {
  id: "restaurant-warm-v1",
  version: 1,
  business_category: "restaurant",
  primary_purpose: "receive-bookings",
  visual_direction: "warm",
  visual_template: "warm-artisan",
  default_accent: "amber",
  allowed_sections: ["hero", "features", "gallery", "hours_contact", "cta_band", "faq", "testimonials"],
  required_sections: ["hero", "hours_contact", "cta_band"],
  prohibited_categories: [
    "construction", "staircase-company", "tradesperson",
    "ecommerce", "product-brand", "agency", "consultant",
  ],
  display_name: "Warm Restaurant",
  short_description:
    "Warm-artisan restaurant/café site · booking CTA, opening hours prominent, gallery of dishes, FAQ block.",
  suitable_for: ["café", "restaurant", "brunch spot", "bistro", "coffee house"],
};

const TRADESPERSON_INDUSTRIAL_V1: NexTemplateEntry = {
  id: "tradesperson-industrial-v1",
  version: 1,
  business_category: "tradesperson",
  primary_purpose: "generate-enquiries",
  visual_direction: "industrial",
  visual_template: "modern-minimal",
  default_accent: "slate",
  allowed_sections: ["hero", "features", "gallery", "products", "cta_band", "hours_contact", "faq"],
  required_sections: ["hero", "features", "cta_band"],
  prohibited_categories: [
    "bakery", "restaurant", "cafe",
    "salon", "beauty", "fitness",
    "community", "event",
  ],
  display_name: "Industrial Tradesperson",
  short_description:
    "Modern-minimal site for tradespeople · staircase, construction, carpentry · portfolio-led with enquiry CTA.",
  suitable_for: ["staircase maker", "joiner", "carpenter", "builder", "general trades"],
};

// ---------------------------------------------------------------------------
// Wave 2 · 2026-09-25 · covers Founder-mandated §20 automated-coherence
// category list: bakery ✓ / restaurant ✓ / construction / staircase /
// salon / consultant / ecommerce / local-service. Each family carries a
// distinct information architecture · not colour variants (sealed doctrine).
// ---------------------------------------------------------------------------

const CONSTRUCTION_INDUSTRIAL_V1: NexTemplateEntry = {
  id: "construction-industrial-v1",
  version: 1,
  business_category: "construction",
  primary_purpose: "generate-enquiries",
  visual_direction: "industrial",
  visual_template: "modern-minimal",
  default_accent: "slate",
  allowed_sections: ["hero", "features", "gallery", "cta_band", "hours_contact", "faq"],
  required_sections: ["hero", "features", "cta_band"],
  prohibited_categories: [
    "bakery", "restaurant", "cafe",
    "salon", "beauty", "fitness",
    "community", "event", "portfolio", "creator",
  ],
  display_name: "Industrial Construction",
  short_description:
    "Modern-minimal construction site · project portfolio, capabilities feature grid, enquiry CTA prominent.",
  suitable_for: ["general contractor", "commercial construction", "site management", "development firm"],
};

const STAIRCASE_INDUSTRIAL_V1: NexTemplateEntry = {
  id: "staircase-industrial-v1",
  version: 1,
  business_category: "staircase-company",
  primary_purpose: "generate-enquiries",
  visual_direction: "industrial",
  visual_template: "modern-minimal",
  default_accent: "black",
  allowed_sections: ["hero", "features", "gallery", "products", "cta_band", "hours_contact", "faq"],
  required_sections: ["hero", "features", "cta_band"],
  prohibited_categories: [
    "bakery", "restaurant", "cafe",
    "salon", "beauty", "fitness",
    "community", "event", "portfolio", "creator",
  ],
  display_name: "Premium Staircase Studio",
  short_description:
    "Bold-industrial staircase studio · portfolio-led, product catalogue for balustrade/spindle ranges, enquiry CTA.",
  suitable_for: ["staircase design studio", "handrail specialist", "balustrade maker", "spindle workshop"],
};

const SALON_ELEGANT_V1: NexTemplateEntry = {
  id: "salon-elegant-v1",
  version: 1,
  business_category: "salon",
  primary_purpose: "receive-bookings",
  visual_direction: "elegant",
  visual_template: "warm-artisan",
  default_accent: "rose",
  allowed_sections: ["hero", "features", "gallery", "hours_contact", "cta_band", "faq", "testimonials"],
  required_sections: ["hero", "hours_contact", "cta_band"],
  prohibited_categories: [
    "construction", "staircase-company", "tradesperson",
    "ecommerce", "product-brand", "agency", "consultant",
    "community", "event",
  ],
  display_name: "Elegant Salon",
  short_description:
    "Warm-artisan salon site · booking CTA, service gallery, testimonials, opening hours prominent.",
  suitable_for: ["hair salon", "nail salon", "beauty studio", "styling atelier"],
};

const CONSULTANT_EDITORIAL_V1: NexTemplateEntry = {
  id: "consultant-editorial-v1",
  version: 1,
  business_category: "consultant",
  primary_purpose: "generate-enquiries",
  visual_direction: "editorial",
  visual_template: "modern-minimal",
  default_accent: "indigo",
  allowed_sections: ["hero", "features", "testimonials", "cta_band", "hours_contact", "faq"],
  required_sections: ["hero", "features", "cta_band"],
  prohibited_categories: [
    "bakery", "restaurant", "cafe",
    "salon", "beauty", "fitness",
    "ecommerce", "product-brand",
    "construction", "staircase-company", "tradesperson",
    "event", "community",
  ],
  display_name: "Editorial Consultant",
  short_description:
    "Modern-minimal consulting site · advisory positioning, testimonials, enquiry CTA · light on imagery.",
  suitable_for: ["strategy consultant", "advisor", "coach", "management consultant"],
};

const ECOMMERCE_PREMIUM_V1: NexTemplateEntry = {
  id: "ecommerce-premium-v1",
  version: 1,
  business_category: "ecommerce",
  primary_purpose: "sell-products",
  visual_direction: "premium",
  visual_template: "modern-minimal",
  default_accent: "indigo",
  allowed_sections: ["hero", "products", "features", "gallery", "cta_band", "faq"],
  required_sections: ["hero", "products"],
  prohibited_categories: [
    "construction", "staircase-company", "tradesperson",
    "salon", "beauty", "fitness",
    "community", "event", "professional-service",
  ],
  display_name: "Premium Ecommerce",
  short_description:
    "Modern-minimal premium shop · product-led hero, product grid, gallery, checkout CTA · brand-first tone.",
  suitable_for: ["fashion brand", "product-led shop", "premium DTC", "lifestyle store"],
};

const LOCAL_SERVICE_WARM_V1: NexTemplateEntry = {
  id: "local-service-warm-v1",
  version: 1,
  business_category: "local-service",
  primary_purpose: "promote-local-business",
  visual_direction: "local-community",
  visual_template: "warm-artisan",
  default_accent: "sage",
  allowed_sections: ["hero", "features", "hours_contact", "cta_band", "faq", "testimonials"],
  required_sections: ["hero", "hours_contact", "cta_band"],
  prohibited_categories: [
    "bakery", "restaurant", "cafe",
    "ecommerce", "product-brand",
    "portfolio", "creator", "event",
  ],
  display_name: "Warm Local Service",
  short_description:
    "Warm-artisan local service site · service features, opening hours prominent, callout CTA, testimonials from neighbours.",
  suitable_for: ["window cleaner", "dog walker", "gardener", "handyperson", "cleaning service"],
};

export const NEX_TEMPLATE_REGISTRY: Readonly<Record<string, NexTemplateEntry>> = Object.freeze({
  [BAKERY_WARM_V1.id]: BAKERY_WARM_V1,
  [RESTAURANT_WARM_V1.id]: RESTAURANT_WARM_V1,
  [TRADESPERSON_INDUSTRIAL_V1.id]: TRADESPERSON_INDUSTRIAL_V1,
  [CONSTRUCTION_INDUSTRIAL_V1.id]: CONSTRUCTION_INDUSTRIAL_V1,
  [STAIRCASE_INDUSTRIAL_V1.id]: STAIRCASE_INDUSTRIAL_V1,
  [SALON_ELEGANT_V1.id]: SALON_ELEGANT_V1,
  [CONSULTANT_EDITORIAL_V1.id]: CONSULTANT_EDITORIAL_V1,
  [ECOMMERCE_PREMIUM_V1.id]: ECOMMERCE_PREMIUM_V1,
  [LOCAL_SERVICE_WARM_V1.id]: LOCAL_SERVICE_WARM_V1,
});

/** Ordered list · used by the template picker card grid. */
export function listTemplates(): NexTemplateEntry[] {
  return Object.values(NEX_TEMPLATE_REGISTRY);
}

/** Lookup · returns undefined for unknown ids so callers can 404 cleanly. */
export function getTemplate(id: string): NexTemplateEntry | undefined {
  return NEX_TEMPLATE_REGISTRY[id];
}

/** Category-scoped shortlist · powers the "we have templates for {category}" filter. */
export function findTemplatesByCategory(category: NexBusinessCategory): NexTemplateEntry[] {
  return listTemplates().filter((t) => t.business_category === category);
}

// ---------------------------------------------------------------------------
// Subject-coherence validator · Founder-sealed hard rule
// ---------------------------------------------------------------------------

/** Deterministic coherence rejection codes. */
export type CoherenceError =
  | "UNKNOWN_TEMPLATE_ID"
  | "BUSINESS_CATEGORY_UNKNOWN"
  | "BUSINESS_CATEGORY_MISMATCH"
  | "SECTION_NOT_ALLOWED_BY_TEMPLATE"
  | "REQUIRED_SECTION_MISSING"
  | "PROHIBITED_CATEGORY_REFERENCED";

export type CoherenceResult =
  | { ok: true; template: NexTemplateEntry }
  | { ok: false; code: CoherenceError; message: string; field_path: string };

interface CoherenceInput {
  business_category: string;   // caller-supplied · validated inside
  template_id: string;         // must exist in registry
  sections: readonly NexSiteSection[];
  /** Free-form text fields to scan for prohibited-category keywords.
   *  Typical inputs: hero_headline · hero_subline · cta_label · business.display_name */
  copy_bag?: readonly string[];
}

/** Keywords per business category · used ONLY for defensive scanning of
 *  LLM-generated copy. Deliberately narrow: false negatives are fine
 *  (validator errs toward allowing coherent copy), false positives are
 *  a bug (rejecting bakery copy that legitimately mentions "wood-fired"). */
const CATEGORY_KEYWORDS: Readonly<Record<NexBusinessCategory, readonly string[]>> = Object.freeze({
  bakery:               ["cake", "sourdough", "pastry", "bakery", "patisserie", "cupcake", "loaf"],
  restaurant:           ["menu", "restaurant", "bistro", "chef", "reservation", "brunch"],
  cafe:                 ["café", "cafe", "coffee", "espresso", "latte"],
  tradesperson:         ["staircase", "joinery", "carpentry", "builder", "trades", "installation"],
  construction:         ["construction", "excavator", "bulldozer", "concrete", "scaffolding"],
  "staircase-company":  ["staircase", "handrail", "balustrade", "newel", "spindle"],
  salon:                ["salon", "hairstylist", "manicure", "pedicure"],
  beauty:               ["beauty", "makeup", "spa", "skincare"],
  fitness:              ["gym", "fitness", "personal-trainer", "workout"],
  consultant:           ["consulting", "consultant", "advisory", "strategy"],
  agency:               ["agency", "campaign", "creative", "marketing-agency"],
  ecommerce:            ["shop", "online store", "checkout", "shipping"],
  "product-brand":      ["brand", "collection", "product-line"],
  "local-service":      ["local", "same-day", "callout"],
  portfolio:            ["portfolio", "work", "case-study"],
  community:            ["community", "members", "forum"],
  event:                ["event", "tickets", "line-up"],
  creator:              ["creator", "podcast", "newsletter"],
  "professional-service": ["law-firm", "accountant", "solicitor", "advisor"],
});

function isKnownCategory(x: string): x is NexBusinessCategory {
  return (NEX_BUSINESS_CATEGORIES as readonly string[]).includes(x);
}

// ---------------------------------------------------------------------------
// Wave 4A · deterministic spec builder from a template + real NEX business
// data. Produces a coherent NexSiteSpec by construction · never invents copy
// beyond what the business itself provides. Used by the Template Picker UI.
// ---------------------------------------------------------------------------

export interface TemplateBusinessBinding {
  business_id: string;
  display_name: string;
  description: string | null;
}

/** Structured spec builder. Pins the template's default accent, uses the
 *  template's required_sections in canonical order, and derives all copy
 *  from real business data. If the business lacks description, we use a
 *  minimal message-us line — NEVER a fabricated description. */
export function buildSpecFromTemplate(
  template: NexTemplateEntry,
  business: TemplateBusinessBinding,
): {
  version: 1;
  identity: { template: string; template_id: string };
  business: { business_id: string; category: string };
  theme: { accent: string };
  sections: Array<{ type: string }>;
  content: { hero_headline: string; hero_subline: string; cta_label: string };
  publication_state: "draft";
} {
  // Prefer business description for the subline, fall back to a NEX message.
  const description = business.description?.trim() ?? "";
  const subline = description.length > 0 && description.length < 240
    ? description
    : "Message us on NEX to start a conversation.";
  // Headline is the business name — templates own the visual · we never
  // fabricate a slogan.
  const headline = business.display_name;
  // CTA label follows the primary purpose · Wave 4 · doctrine 2026-09-25:
  // Builder produces an ENTRY EXPERIENCE (front page + NEX chat), not a
  // website. Both hero CTAs land the visitor in the owner's NEX chat where
  // products/booking/portfolio live as rich conversational cards. Labels
  // reflect the chat destination, not a separate page navigation.
  const ctaLabel = template.primary_purpose === "sell-products"
    ? "See our products in chat"
    : template.primary_purpose === "receive-bookings" || template.primary_purpose === "sell-appointments"
      ? "Book in chat"
      : template.primary_purpose === "showcase-portfolio"
        ? "See our work in chat"
        : "Chat with us";
  return {
    version: 1,
    identity: { template: template.visual_template, template_id: template.id },
    business: { business_id: business.business_id, category: template.business_category },
    theme: { accent: template.default_accent },
    sections: template.required_sections.map((type) => ({ type })),
    content: { hero_headline: headline, hero_subline: subline, cta_label: ctaLabel },
    publication_state: "draft",
  };
}

/** Runs the coherence gate. Reject-first: any rule violation returns
 *  the first offending code. Success returns the matched template. */
export function validateSubjectCoherence(input: CoherenceInput): CoherenceResult {
  const template = getTemplate(input.template_id);
  if (!template) {
    return {
      ok: false, code: "UNKNOWN_TEMPLATE_ID",
      message: `template '${input.template_id}' is not in the registry`,
      field_path: "template_id",
    };
  }
  if (!isKnownCategory(input.business_category)) {
    return {
      ok: false, code: "BUSINESS_CATEGORY_UNKNOWN",
      message: `business_category '${input.business_category}' is not a recognised NEX category`,
      field_path: "business_category",
    };
  }
  if (input.business_category !== template.business_category) {
    return {
      ok: false, code: "BUSINESS_CATEGORY_MISMATCH",
      message: `template '${template.id}' is for '${template.business_category}' businesses but was given a '${input.business_category}' business`,
      field_path: "business_category",
    };
  }
  // §1 · Every section must be in the template's whitelist.
  for (let i = 0; i < input.sections.length; i += 1) {
    const s = input.sections[i]!;
    if (!template.allowed_sections.includes(s)) {
      return {
        ok: false, code: "SECTION_NOT_ALLOWED_BY_TEMPLATE",
        message: `section '${s}' is not allowed by template '${template.id}'`,
        field_path: `sections[${i}]`,
      };
    }
  }
  // §2 · Every required section must be present.
  for (const req of template.required_sections) {
    if (!input.sections.includes(req)) {
      return {
        ok: false, code: "REQUIRED_SECTION_MISSING",
        message: `template '${template.id}' requires section '${req}' which is missing`,
        field_path: "sections",
      };
    }
  }
  // §3 · Copy bag must not surface prohibited-category keywords.
  if (input.copy_bag && input.copy_bag.length > 0) {
    const bag = input.copy_bag.map((s) => s.toLowerCase()).join("\n");
    for (const forbidden of template.prohibited_categories) {
      const kws = CATEGORY_KEYWORDS[forbidden];
      for (const kw of kws) {
        if (bag.includes(kw.toLowerCase())) {
          return {
            ok: false, code: "PROHIBITED_CATEGORY_REFERENCED",
            message: `copy references prohibited category '${forbidden}' via keyword '${kw}' (template '${template.id}' does not permit this)`,
            field_path: "copy_bag",
          };
        }
      }
    }
  }
  return { ok: true, template };
}
