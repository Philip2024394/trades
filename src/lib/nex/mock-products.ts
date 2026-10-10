// src/lib/nex/mock-products.ts
//
// NEX MOCK Products — shared single source of truth for the sandbox
// ================================================================
//
// **DOCTRINE**: per `project_nex_conversation_first_product_direction_permanent_2026_09_23`
// §4 "One business brain — many surfaces · do not create disconnected
// duplicate sources of truth". This module is the ONLY place the mock
// product roster lives. `NexWorkspaceProducts` and `CreateBannersClient`
// both import from here. Do NOT copy-paste this array elsewhere.
//
// **REPLACE WHEN NEX Chat Shop SCHEMA LANDS**. Every export here is
// scaffolding · the real implementation will read from the NEX Chat Shop
// products table via a Supabase query and return the same shapes (or a
// superset). The `productToBannerBrief` helper is the exact seam that
// enforces the doctrine "the product record IS the creative brief" — it
// converts a product record into the pre-filled banner form fields, and
// the anti-fabrication rule on commercial facts lives here (name / price
// / description passed verbatim, never invented).
//
// See also:
//   · project_nex_banner_creation_gated_by_chat_shop_product_2026_09_23
//   · project_nex_banner_creation_product_as_creative_brief_2026_09_23
//   · project_nex_conversation_first_product_direction_permanent_2026_09_23
//
// Boundaries:
//   · NEVER add commercial-fact fabrication here (price rounding, name
//     rewording, category re-tagging, feature invention). If a field is
//     absent on the product, it must be absent on the brief.
//   · NEVER let the Composition Engine (composition-v2) import from this
//     module. The engine must stay generic; the brief-constructor sits
//     above the engine.

export interface DemoProduct {
  id: string;
  name: string;
  priceLabel: string;
  attributes: string[];
  inStock: boolean;
  imageAccent: string;
  imageGlyph: string;
  imageIndex: number;
  imageTotal: number;
}

/**
 * Mock product roster. 4 hardcoded entries. **NO REAL DB · NO API**.
 * Every consumer that renders or reads a product goes through this array.
 */
export const MOCK_PRODUCTS: DemoProduct[] = [
  {
    id: "demo-street-runner-pro",
    name: "Street Runner Pro",
    priceLabel: "Rp850.000",
    attributes: ["Black", "Size 42", "New"],
    inStock: true,
    imageAccent: "linear-gradient(140deg, #1a1a1a 0%, #2d2d2d 55%, #3a3a3a 100%)",
    imageGlyph: "👟",
    imageIndex: 1,
    imageTotal: 5,
  },
  {
    id: "demo-nex-sound-x7",
    name: "NEX Sound X7",
    priceLabel: "Rp1.250.000",
    attributes: ["Wireless", "Black", "New"],
    inStock: true,
    imageAccent: "linear-gradient(140deg, #0e0e10 0%, #232326 55%, #2d2d33 100%)",
    imageGlyph: "🎧",
    imageIndex: 1,
    imageTotal: 4,
  },
  {
    id: "demo-chrono-max-watch",
    name: "Chrono Max Watch",
    priceLabel: "Rp2.950.000",
    attributes: ["Steel", "Water Resistant", "New"],
    inStock: true,
    imageAccent: "linear-gradient(140deg, #131518 0%, #1e2126 55%, #2a2f36 100%)",
    imageGlyph: "⌚",
    imageIndex: 1,
    imageTotal: 6,
  },
  {
    id: "demo-nex-tech-jacket",
    name: "NEX Tech Jacket",
    priceLabel: "Rp675.000",
    attributes: ["Black", "Waterproof", "New"],
    inStock: true,
    imageAccent: "linear-gradient(140deg, #101012 0%, #1c1c20 55%, #26262c 100%)",
    imageGlyph: "🧥",
    imageIndex: 1,
    imageTotal: 3,
  },
];

/** Case-sensitive lookup. Returns undefined for unknown ids. */
export function getMockProductById(id: string): DemoProduct | undefined {
  return MOCK_PRODUCTS.find((p) => p.id === id);
}

/**
 * Shape of the pre-filled banner brief that the Banner Creation
 * capability hands to the sandbox composition endpoint. The fields match
 * the sandbox `generate` request body one-to-one.
 *
 * **Anti-fabrication rule**: every field returned here traces back to a
 * property on the product record. When a product record grows fields
 * (description, category, CTA URL, brand identity), this constructor
 * extends to consume them. It NEVER invents.
 */
export interface BannerBrief {
  business_display_name: string;
  product_or_service_label: string;
  campaign_objective: string;
  headline: string;
  cta: string;
  /**
   * Non-empty when this brief was constructed from a real product record.
   * The UI uses this to render the "auto-filled from Product X" chip so
   * the member can see NEX applied information it already had.
   */
  source_product_id: string;
  source_product_name: string;
}

/**
 * Convert a mock product into a banner brief with pre-filled form fields.
 * Every field is derived verbatim from the product record — no
 * fabrication. When the real Chat Shop schema exists, this function
 * grows to consume description / category / CTA URL / brand identity
 * fields directly from the record; the shape returned stays stable.
 */
export function productToBannerBrief(product: DemoProduct): BannerBrief {
  // Business display name: the mock does not carry a business/brand
  // identity field yet — will come from the member's NEX business
  // record when Chat Shop lands. For now use a neutral sandbox label
  // rather than inventing a business name.
  const business_display_name = "NEX Sandbox Business";

  // Product / service label: verbatim product name.
  const product_or_service_label = product.name;

  // Campaign objective: assembled from product name + attributes ·
  // never invented facts, only re-composed from record fields.
  const attrs = product.attributes.join(" · ");
  const campaign_objective = attrs
    ? `${product.name} · ${attrs} · ${product.priceLabel}`
    : `${product.name} · ${product.priceLabel}`;

  // Headline: verbatim product name (the composition engine will handle
  // typography, wrapping and hierarchy).
  const headline = product.name;

  // CTA: neutral commerce prompt until the product record carries an
  // explicit cta_label / cta_url pair. This is honest scaffolding, not
  // fabrication — the button text says what will happen; it doesn't
  // invent a price, a discount, or a claim about the product.
  const cta = "Ask about this product";

  return {
    business_display_name,
    product_or_service_label,
    campaign_objective,
    headline,
    cta,
    source_product_id: product.id,
    source_product_name: product.name,
  };
}
