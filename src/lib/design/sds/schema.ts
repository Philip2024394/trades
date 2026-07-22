// Structured Design Specification (SDS) — ChatGPT's game-changing
// pattern from batch 1, answer 14. Every generation is built from a
// validated schema, not a free-form prompt. The Prompt Compiler
// (src/lib/design/sds/compilers/*) translates SDS → model prompt.
//
// This is the source of truth for what the AI is being asked to make.
// Versionable, testable, debuggable. When GPT Image evolves, we ship
// a new compiler for the same SDS; every past design regenerates.

import { z } from "zod";

// ─── Vehicle spec ────────────────────────────────────────────────

export const VehicleSpecSchema = z.object({
  make:   z.string(),
  model:  z.string(),
  year:   z.number().int().optional(),
  body:   z.string(),                          // e.g. "L2H1", "L3H2", "SWB", "MWB"
  colour: z.object({
    slug: z.string(),                          // e.g. "frozen-white"
    hex:  z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    label: z.string()                          // e.g. "Frozen White"
  })
});
export type VehicleSpec = z.infer<typeof VehicleSpecSchema>;

// ─── Brand spec (subset of BrandRecord relevant to a single generation) ──

export const BrandSpecSchema = z.object({
  name:        z.string(),
  tagline:     z.string().default(""),
  position:    z.string(),                     // e.g. "Luxury Residential"
  audience:    z.string(),
  personality: z.array(z.string())
});
export type BrandSpec = z.infer<typeof BrandSpecSchema>;

// ─── Layout intent (what goes where on the vehicle) ──────────────

export const HeroImageSpecSchema = z.object({
  location: z.enum([
    "left_side_rear_quarter",
    "left_side_middle",
    "right_side_rear_quarter",
    "rear_door_left",
    "rear_door_right"
  ]),
  coverage_pct: z.number().min(5).max(40),     // % of the visible panel
  photo_url:    z.string().url().optional()    // uploaded portfolio photo, if any
});
export type HeroImageSpec = z.infer<typeof HeroImageSpecSchema>;

export const LowerSkirtSpecSchema = z.object({
  colour:      z.string(),
  stop_at:     z.enum([
    "rear_door_shut_line",
    "wheel_arch_rear",
    "body_edge"
  ]).default("rear_door_shut_line"),
  height_pct:  z.number().min(5).max(20).default(10)
});
export type LowerSkirtSpec = z.infer<typeof LowerSkirtSpecSchema>;

export const LogoPlacementSpecSchema = z.object({
  position: z.enum([
    "front_door",
    "sliding_door",
    "rear_door_upper",
    "bonnet"
  ]),
  scale:    z.enum(["small", "medium", "large"]).default("large")
});
export type LogoPlacementSpec = z.infer<typeof LogoPlacementSpecSchema>;

export const LayoutSpecSchema = z.object({
  hero_image:   HeroImageSpecSchema.optional(),
  lower_skirt:  LowerSkirtSpecSchema.optional(),
  logo:         LogoPlacementSpecSchema,
  services:     z.array(z.string()).max(6).default([]),
  show_qr:      z.boolean().default(false),
  show_website: z.boolean().default(true),
  show_phone:   z.boolean().default(true),
  show_socials: z.boolean().default(true)
});
export type LayoutSpec = z.infer<typeof LayoutSpecSchema>;

// ─── Constraints (preservation + forbidden) ──────────────────────

export const ConstraintSpecSchema = z.object({
  preserve: z.array(z.string()).default([
    "headlights",
    "tail_lights",
    "wheel_arches",
    "mirrors",
    "registration_plate",
    "door_handles"
  ]),
  forbid:   z.array(z.string()).default([
    "gradients",
    "chrome_effects",
    "3d_text",
    "drop_shadows",
    "bevel",
    "glow",
    "clip_art",
    "carbon_fibre_texture",
    "multiple_hero_images"
  ])
});
export type ConstraintSpec = z.infer<typeof ConstraintSpecSchema>;

// ─── Style DNA (drives compiler's tone) ──────────────────────────

export const StyleDNASchema = z.object({
  wrap_style:      z.string(),                 // e.g. "Minimal Luxury"
  colour_split:    z.object({                  // 80/15/5 rule
    body_pct:      z.number().default(75),
    graphics_pct:  z.number().default(20),
    accent_pct:    z.number().default(5)
  }).default({ body_pct: 75, graphics_pct: 20, accent_pct: 5 }),
  typography:      z.string(),                 // e.g. "DIN"
  mood_references: z.array(z.string()).default([]), // e.g. ["Apple", "Mercedes", "Howdens"]
  geometry:        z.string().default("architectural"), // "architectural" | "geometric" | "organic"
  photography:     z.string().optional()       // e.g. "luxury oak staircase"
});
export type StyleDNA = z.infer<typeof StyleDNASchema>;

// ─── Production hints ────────────────────────────────────────────

export const ProductionSpecSchema = z.object({
  view_kind:    z.enum(["side", "front", "rear", "board"]).default("side"),
  resolution:   z.enum(["medium", "high", "hd"]).default("medium"),
  view_width_px:  z.number().int().default(1600),
  view_height_px: z.number().int().default(900),
  reference_image_urls: z.array(z.string().url()).default([])
});
export type ProductionSpec = z.infer<typeof ProductionSpecSchema>;

// ─── Full SDS ────────────────────────────────────────────────────

export const SdsSchema = z.object({
  schema_version: z.literal("1.0.0"),
  fingerprint:    z.string(),                  // stamp from BrandRecord
  vehicle:        VehicleSpecSchema,
  brand:          BrandSpecSchema,
  layout:         LayoutSpecSchema,
  style:          StyleDNASchema,
  constraints:    ConstraintSpecSchema.default({
    preserve: ["headlights", "tail_lights", "wheel_arches", "mirrors", "registration_plate", "door_handles"],
    forbid:   ["gradients", "chrome_effects", "3d_text", "drop_shadows", "bevel", "glow", "clip_art", "carbon_fibre_texture", "multiple_hero_images"]
  }),
  production:     ProductionSpecSchema.default({
    view_kind: "side",
    resolution: "medium",
    view_width_px: 1600,
    view_height_px: 900,
    reference_image_urls: []
  })
});
export type Sds = z.infer<typeof SdsSchema>;

/** Parse + validate. Throws on malformed input. */
export function parseSds(input: unknown): Sds {
  return SdsSchema.parse(input);
}

export function safeParseSds(input: unknown): Sds | null {
  const res = SdsSchema.safeParse(input);
  return res.success ? res.data : null;
}
