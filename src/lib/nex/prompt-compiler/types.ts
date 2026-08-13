// Prompt Compiler · types.
//
// Bridge between the Design Document and any image model (diffusion · flow
// matching · transformer · future). Compiles a structured brief that PRESERVES
// every design decision as an explicit prompt fragment · so the image model
// becomes a `paint` executor rather than a `design` decider.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

export type ImageModelTarget =
  | "diffusion_sdxl" | "diffusion_flux" | "diffusion_stable_diffusion_3"
  | "transformer_dalle" | "transformer_imagen"
  | "flow_matching"
  | "future";

export type CompiledPrompt = {
  target: ImageModelTarget;
  positive: string;                      // primary prompt string
  negative: string;                      // things to avoid
  reference_images?: readonly { role: "hero" | "style" | "material" | "camera"; url: string; weight: number }[];
  control_maps?: readonly { kind: "depth" | "pose" | "canny" | "segmentation" | "normal"; url: string; weight: number }[];
  guidance_scale?: number;
  steps?: number;
  seed_policy: "deterministic" | "random" | "explicit";
  seed?: number;
  aspect_ratio?: string;                 // e.g. "1:1" · "9:16" · resolved from design-sizes
  target_size?: { width_px: number; height_px: number };
  compiler_version: string;
  provenance: {
    design_document_id: string;
    theme_pack?: string;
    layout_family?: string;
    camera_profile?: string;
    lighting_profile?: string;
    materials?: readonly string[];
    scene_summary?: string;
  };
};

export type CompileOptions = {
  target: ImageModelTarget;
  aspect_ratio?: string;
  target_size?: { width_px: number; height_px: number };
  seed_policy?: "deterministic" | "random" | "explicit";
  seed?: number;
};
