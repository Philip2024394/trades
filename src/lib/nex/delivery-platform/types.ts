// Delivery Platform · types.
//
// Every output format is a registered Exporter · never a bespoke renderer ·
// never a switch statement in a hot path. The Delivery Platform is a REGISTRY.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

export type DeliveryFormat =
  | "svg" | "png" | "jpg" | "webp" | "pdf" | "pdf_x1a" | "pdf_x4"
  | "docx" | "pptx" | "html"
  | "gltf" | "usd" | "usdz"
  | "mp4" | "gif" | "lottie_json"
  | "eps" | "tiff" | "psd" | "figma";

export type DeliveryStatus = "shipped" | "stub" | "external";

export type DeliveryResult = {
  format: DeliveryFormat;
  bytes?: Uint8Array;                    // raw output for binary formats
  text?: string;                         // raw output for text formats (SVG · HTML · JSON)
  url?: string;                          // where written · when persisted
  metadata: Record<string, unknown>;
  generated_at: string;
  exporter_version: string;
};

export type DeliveryOptions = {
  target_id?: string;                    // e.g. "instagram_feed" · resolves via design-sizes registry
  width_px?: number;
  height_px?: number;
  dpi?: number;
  quality?: number;                      // 0..100 · applies to jpg/webp
  colour_space?: "sRGB" | "CMYK";
  bleed_mm?: number;
  metadata_overrides?: Record<string, unknown>;
};

export type Exporter<Doc = unknown> = {
  format: DeliveryFormat;
  status: DeliveryStatus;
  supported_targets: readonly string[];  // RenderTargetId values
  export(doc: Doc, opts?: DeliveryOptions): Promise<DeliveryResult>;
  exporter_version: string;
};
