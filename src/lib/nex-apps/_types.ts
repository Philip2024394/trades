// NEX Trade App — shared types for the trade-config + state machinery.
// Consumed by every trade config file, the config loader, and every
// component in `src/components/nex-app/`.
//
// Per docs/design-system/MASTER_TRADE_TEMPLATE_v1.md §6.

// ─── Conversation states (per Design Language §2) ─────────────────
export const CONVERSATION_STATES = [
  "discover",
  "compare",
  "configure",
  "price",
  "book",
  "project",
  "aftercare"
] as const;
export type ConversationState = (typeof CONVERSATION_STATES)[number];

// ─── Trade archetype clusters (per Master Trade Template §4) ──────
export type ClusterId = "visual_sell" | "trust_sell" | "transformation_sell" | "volume_commerce";

// ─── Discover-state module identifiers ────────────────────────────
export const DISCOVER_MODULES = [
  "hero",
  "company_branding",
  "nex_ai_panel",
  "quick_actions",
  "featured_projects",
  "products",
  "videos",
  "before_after",
  "reviews",
  "social_links",
  "contact"
] as const;
export type DiscoverModuleId = (typeof DISCOVER_MODULES)[number];

// ─── Quick-action chip config ─────────────────────────────────────
export type QuickAction = {
  label: string;
  target_state: ConversationState;
  canvas_variant?: string;    // e.g. "gallery" for Discover, "timbers" for Compare
  chat_intro?: string;        // Nex message to send when chip clicked
  filter?: Record<string, unknown>;   // pre-applied filter for Compare state
};

// ─── Regulatory hook (per Configure state §2.3) ──────────────────
export type RegulatoryHook = {
  field: string;
  operator: ">" | "<" | "=" | "!=";
  value: number | string;
  message: string;
};

// ─── Merchant profile (feeds every module) ────────────────────────
export type MerchantProfile = {
  business_name: string;
  tagline: string;
  location: string;
  logo_url?: string;
  hero_image_url?: string;
  established_year?: number;
  service_area_miles?: number;
  response_promise?: string;    // e.g. "Replies within 4h"
  accreditations?: string[];
  phone?: string;
  email?: string;
  whatsapp?: string;
  social?: {
    instagram?: string;
    facebook?: string;
    youtube?: string;
    tiktok?: string;
    linkedin?: string;
  };
};

// ─── Featured project (module-level content) ──────────────────────
export type FeaturedProject = {
  id: string;
  title: string;
  location?: string;
  trade_type?: string;         // e.g. "cut string oak"
  before_image_url?: string;
  after_image_url: string;
  story?: string;              // optional 1-2 sentence context
};

// ─── Trade config — the schema each trade Brain publishes ─────────
export type TradeConfig = {
  trade_slug: string;
  cluster: ClusterId;
  module_order_override?: DiscoverModuleId[];  // rare; overrides cluster default

  ai_panel: {
    headline: string;
    subhead: string;
  };

  hero_prompt: string;

  quick_actions: QuickAction[];

  featured_projects_title: string;
  products_title: string;      // "Products" or "Services" or "Range"
  reviews_title: string;

  regulatory_hooks?: RegulatoryHook[];

  // Brain module slugs — which parts of the Trade Brain feed each state
  compliance_module_slug?: string;
  defect_module_slug?: string;
  materials_module_slug?: string;
  workflow_module_slug?: string;

  // Content — for V1 pilot merchants without a full Business Brain, the
  // trade config carries placeholder content. Later this comes from the
  // merchant's own Business Brain instead.
  placeholder_content: {
    merchant: MerchantProfile;
    featured_projects: FeaturedProject[];
  };
};

// ─── Default module order per cluster (per Master Trade Template §4) ──
export const DEFAULT_MODULE_ORDER: Record<ClusterId, DiscoverModuleId[]> = {
  visual_sell: [
    "hero", "nex_ai_panel", "quick_actions", "featured_projects",
    "products", "before_after", "videos", "reviews",
    "company_branding", "social_links", "contact"
  ],
  trust_sell: [
    "hero", "company_branding", "nex_ai_panel", "quick_actions",
    "reviews", "featured_projects", "videos", "before_after",
    "social_links", "contact"
  ],
  transformation_sell: [
    "hero", "nex_ai_panel", "quick_actions", "before_after",
    "featured_projects", "reviews", "videos", "products",
    "company_branding", "social_links", "contact"
  ],
  volume_commerce: [
    "hero", "nex_ai_panel", "quick_actions", "products",
    "featured_projects", "reviews", "videos",
    "company_branding", "contact", "social_links"
  ]
};

export function moduleOrderFor(config: TradeConfig): DiscoverModuleId[] {
  return config.module_order_override ?? DEFAULT_MODULE_ORDER[config.cluster];
}
