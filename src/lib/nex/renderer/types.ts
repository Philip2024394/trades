// Pixel Rendering Engine · Phase E.0 · type system.
//
// The complete schema for BannerSpecification (input to renderer) + Layer/Component
// definitions + Token references. The renderer draws WHAT this schema declares · it
// makes NO design decisions of its own.
//
// Doctrine: docs/brains/nex-pixel-rendering-engine-phase-e0-philip-2026-08-04.md

export type BrandPersonality = "luxury" | "professional" | "sales_event" | "family" | "heritage" | "lifestyle";

export type CTAArchitecture = "bottom_right_contact_box" | "full_width_cta_bar" | "split_cta_and_contact" | "floating_contact_badge" | "qr_code_cta" | "multi_channel_contact_panel";

export type LayoutFamily = "premium_trade_banner_v1" | "classic_trade_layout_v1" | "curved_lifestyle_layout_v1" | "curved_lifestyle_layout_v2" | "curved_lifestyle_layout_v3";

export type OutputFormat = "svg" | "png" | "jpeg" | "webp" | "pdf";

export type ExportSize = {
  name: string;                          // "facebook_feed" · "instagram_story" · etc.
  width_px: number;
  height_px: number;
  dpi?: number;
};

export type ThemePack = {
  id: string;                            // "luxury_burgundy" · "aqua_teal" · etc.
  colors: {
    primary: string;                     // hex
    secondary: string;
    accent: string;
    background: string;
    text_primary: string;
    text_on_primary: string;
    cta_background: string;
    cta_text: string;
    border: string;
    shadow: string;
  };
  fonts: {
    headline: string;
    subheadline: string;
    body: string;
    cta: string;
  };
  spacing: {
    section: number;                     // px
    default: number;
    padding_container: number;
    padding_text_inner: number;
    safe_margin: number;
  };
  radius: {
    cta: number;
    contact_box: number;
    hero: number;
  };
  icon: {
    size_feature: number;
    size_social: number;
    style: "line" | "filled" | "duotone";
  };
};

export type Position = { x: number; y: number };
export type Size = { width: number; height: number };
export type Box = Position & Size;

export type LayerBase = {
  id: string;
  z_index: number;
  box: Box;                              // absolute px inside canvas
  padding?: number;
  opacity?: number;
};

export type TextLayer = LayerBase & {
  type: "text";
  text: string;
  font_family: string;
  font_weight: number;                   // 400 · 700 · etc.
  font_size_px: number;
  color: string;
  letter_spacing?: string;
  line_height?: number;
  text_align?: "left" | "center" | "right";
  max_lines?: number;
  transform?: "uppercase" | "lowercase" | "capitalize" | "none";
};

export type ShapeLayer = LayerBase & {
  type: "shape";
  shape: "rect" | "rounded_rect" | "circle" | "ellipse";
  fill: string;
  stroke?: string;
  stroke_width?: number;
  corner_radius?: number;                // for rounded_rect
};

export type ImageLayer = LayerBase & {
  type: "image";
  href: string;                          // resolved URL from Asset Resolver
  preserve_aspect?: "xMidYMid meet" | "xMidYMid slice" | "none";
  alt?: string;
};

export type IconLayer = LayerBase & {
  type: "icon";
  icon_name: string;                     // "phone" · "whatsapp" · "email" · etc.
  fill: string;
};

export type FeatureListLayer = LayerBase & {
  type: "feature_list";
  items: Array<{ icon: string; label: string }>;
  font_family: string;
  font_size_px: number;
  color: string;
  icon_size_px: number;
  spacing_px: number;
};

export type ContactBoxLayer = LayerBase & {
  type: "contact_box";
  contacts: Array<{ kind: "phone" | "whatsapp" | "website" | "email" | "instagram" | "facebook" | "tiktok" | "linkedin" | "qr_code" | "address"; value: string }>;
  background: string;
  text_color: string;
  font_family: string;
  corner_radius: number;
  alignment: "left" | "center" | "right";
  max_lines: number;
};

export type Layer = TextLayer | ShapeLayer | ImageLayer | IconLayer | FeatureListLayer | ContactBoxLayer;

export type BannerSpecification = {
  spec_version: string;                  // "1.0"
  banner_id: string;
  template_family: string;
  layout_family: LayoutFamily;
  brand_personality: BrandPersonality;
  cta_architecture: CTAArchitecture;
  theme_pack: ThemePack;
  export: ExportSize;
  layers: readonly Layer[];              // z-index ordered
  metadata: {
    hero_product_type?: string;
    timber_profile?: string;
    marketing_tone?: string;
    campaign_type?: string;
    audience?: string;
    persona?: string;
    campaign_family?: string;
  };
};

export type ResolvedAssets = {
  hero_url?: string;
  logo_url?: string;
  icon_bundle_id?: string;
  background_texture_url?: string;
  resolved_at: string;
  cache_key: string;
};

export type GrammarViolation = {
  rule: string;
  severity: "info" | "warn" | "error";
  layer_id?: string;
  message: string;
};

export type RenderedBanner = {
  format: OutputFormat;
  content: string;                       // SVG string · or base64-encoded raster for future formats
  width_px: number;
  height_px: number;
  spec_hash: string;
  metadata: BannerSpecification["metadata"];
  component_positions: Record<string, Box>;
  render_log: readonly string[];
  grammar_violations: readonly GrammarViolation[];
  performance: {
    render_ms: number;
    layers_rendered: number;
  };
};
