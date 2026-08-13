// Universal Asset Library · schema for structured image knowledge (Philip 2026-08-04).
//
// Constitutional rule: no image enters the repository without becoming
// structured knowledge. Every asset must produce this rich record.
//
// This module holds the SCHEMA. Storage (`data/nex-asset-library.jsonl` +
// Supabase) and the ingestion pipeline are phased.
//
// Doctrine: docs/brains/nex-phase-e1-universal-design-studio-philip-2026-08-04.md

export type QualityRating = "flagship" | "a_plus" | "a" | "b" | "c" | "draft";

export type UniversalAsset = {
  // Identity
  id: string;
  title: string;
  description: string;

  // Industry + product
  industry: string;                      // e.g. "staircase" · "kitchen" · "joinery" · "marketing"
  product_family?: string;               // e.g. "floating_oak_staircases"
  hero_product?: string;                 // e.g. "floating oak staircase with glass balustrade"

  // Design context
  theme_pack?: string;                   // references renderer/tokens.ts theme pack id
  timber_profile?: string;               // "oak" · "walnut" · "pine" · "mahogany" · "steel" · "glass"
  colour_palette?: readonly string[];    // hex values extracted from the image
  layout_family?: string;                // references marketing layout families
  camera_angle?: string;                 // "wide" · "close_up" · "elevation" · "isometric"
  lighting?: string;                     // "morning" · "sunset" · "studio_softbox" · "warm_led"
  room_style?: string;
  architectural_style?: string;
  marketing_tone?: string;               // "premium" · "performance" · "lifestyle" · etc.

  // Quality + curation
  quality_rating: QualityRating;
  designer_notes?: string;
  recommended_usage?: readonly string[];

  // Deduplication + verification
  image_hash?: string;                   // perceptual hash for duplicate detection
  file_hash?: string;                    // sha256 of raw bytes
  content_type?: string;                 // "image/png" · "image/webp" · etc.

  // Relationships (foreign keys · resolver dereferences on demand)
  linked_articles?: readonly string[];
  linked_banner_templates?: readonly string[];
  linked_products?: readonly string[];
  linked_recommendations?: readonly string[];
  linked_render_documents?: readonly string[];
  linked_similar_assets?: readonly string[];   // asset ids visually similar

  // Usage + performance
  usage_history?: readonly { at: string; context: string }[];
  performance_metrics?: {
    times_selected?: number;
    times_rendered?: number;
    times_downloaded?: number;
    click_through_rate?: number;
    conversion_rate?: number;
  };

  // Governance + provenance (Rule c · attributable origin)
  provenance: {
    named_expert?: string;               // e.g. "Philip O'Farrell"
    authored?: string;                   // ISO
    source: "authored" | "ai_generated" | "photographed" | "rendered" | "imported" | "screenshot";
    generator?: string;                  // model/tool id if ai_generated
    licence: "internal" | "royalty_free" | "creative_commons" | "commercial_licensed" | "custom_agreement";
    commercial_use?: boolean;
  };

  // Where the bytes live
  storage: {
    url: string;
    cdn_url?: string;
    bucket?: string;
    key?: string;
  };

  created_at: string;
  updated_at?: string;
};

// ─── Ingestion contract (implementation phased) ──────────────────────────

export type AssetIngestionRequest = {
  file: { url?: string; path?: string; bytes?: Uint8Array };
  hint?: Partial<UniversalAsset>;        // caller-provided context (industry · title · etc.)
};

export type AssetIngestionResult = {
  asset: UniversalAsset;
  extracted: {
    colours?: readonly string[];
    materials?: readonly string[];
    tags?: readonly string[];
    duplicates?: readonly string[];      // ids of near-duplicates found
  };
  warnings: readonly string[];
};

/** Validate a UniversalAsset · returns any missing required fields. */
export function validateAsset(asset: Partial<UniversalAsset>): readonly string[] {
  const missing: string[] = [];
  if (!asset.id) missing.push("id");
  if (!asset.title) missing.push("title");
  if (!asset.description) missing.push("description");
  if (!asset.industry) missing.push("industry");
  if (!asset.quality_rating) missing.push("quality_rating");
  if (!asset.provenance) missing.push("provenance");
  else {
    if (!asset.provenance.source) missing.push("provenance.source");
    if (!asset.provenance.licence) missing.push("provenance.licence");
  }
  if (!asset.storage?.url) missing.push("storage.url");
  if (!asset.created_at) missing.push("created_at");
  return missing;
}
