// Intermediate Representation for the Prompt Compiler.
// Per V3 Q13 — every Studio expresses intent as structured IR, never
// as English prompt text. The compiler consumes IR and emits a
// CompiledPrompt for the target model.
//
// This file is the CONTRACT between Studios and the compiler. Adding
// a new field requires bumping the compiler version.

import { z } from "zod";

// ─── Surface types (which Studio is producing) ──────────────────

export const SurfaceSchema = z.enum([
  "vehicle",
  "logo",
  "website",
  "business-card",
  "workwear",
  "signage",
  "social",
  "print",
  "invoice",
  "letterhead",
  "email-signature"
]);
export type Surface = z.infer<typeof SurfaceSchema>;

// ─── Intent atoms — the parsed merchant request ─────────────────

export const IntentSchema = z.object({
  surface:  SurfaceSchema,
  style:    z.string().optional(),          // "luxury" | "minimal" | "industrial" | ...
  goal:     z.string().optional(),          // "lead generation" | "brand refresh" | ...
  hints:    z.array(z.string()).default([]) // free-form merchant hints (extracted from natural language)
});
export type Intent = z.infer<typeof IntentSchema>;

// ─── Layout Intent ──────────────────────────────────────────────

export const LayoutIntentSchema = z.object({
  style_anchor:      z.string().optional(),  // e.g. "Luxury Minimal", "Bold Geometric"
  hero_pct:          z.number().min(0).max(100).optional(),
  negative_space_pct: z.number().min(0).max(60).optional(),
  info_groups_max:   z.number().int().min(1).max(6).default(3),
  diagonal_deg:      z.number().optional()
});
export type LayoutIntent = z.infer<typeof LayoutIntentSchema>;

// ─── Photography Intent ─────────────────────────────────────────

export const PhotographyIntentSchema = z.object({
  hero_style:  z.string().optional(),         // e.g. "luxury oak staircase"
  photo_urls:  z.array(z.string().url()).default([]),
  overlay:     z.boolean().default(false),
  grain:       z.boolean().default(false)
});
export type PhotographyIntent = z.infer<typeof PhotographyIntentSchema>;

// ─── Typography Intent ──────────────────────────────────────────

export const TypographyIntentSchema = z.object({
  aesthetic:  z.enum(["luxury", "industrial", "traditional", "modern"]).default("modern"),
  primary_family:  z.string().optional(),
  secondary_family: z.string().optional()
});
export type TypographyIntent = z.infer<typeof TypographyIntentSchema>;

// ─── Colour Intent ──────────────────────────────────────────────

export const ColourIntentSchema = z.object({
  primary:    z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondary:  z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accent:     z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  split_pct:  z.object({
    body:      z.number().default(75),
    graphics:  z.number().default(20),
    accent:    z.number().default(5)
  }).default({ body: 75, graphics: 20, accent: 5 })
});
export type ColourIntent = z.infer<typeof ColourIntentSchema>;

// ─── Vehicle sub-spec (only present when surface = vehicle) ─────

export const VehicleSpecSchema = z.object({
  model:   z.string(),                       // "Ford Transit Custom"
  body:    z.string(),                       // "L2H1"
  year:    z.number().int().optional(),
  colour:  z.object({
    name: z.string(),                        // "Frozen White"
    hex:  z.string().regex(/^#[0-9A-Fa-f]{6}$/)
  })
});
export type VehicleSpec = z.infer<typeof VehicleSpecSchema>;

// ─── Constraints (positive + negative) ──────────────────────────

export const ConstraintSchema = z.object({
  kind:    z.enum(["preserve", "forbid", "require"]),
  target:  z.string(),                       // "wheel_arches" | "gradients" | "logo_visible"
  source:  z.string(),                       // which module contributed this
  reason:  z.string().optional()
});
export type Constraint = z.infer<typeof ConstraintSchema>;

// ─── Output spec ────────────────────────────────────────────────

export const OutputSpecSchema = z.object({
  kind:        z.enum(["side", "front", "rear", "board", "spread"]),
  width_px:    z.number().int().default(1600),
  height_px:   z.number().int().default(900),
  quality:     z.enum(["low", "medium", "high", "hd"]).default("medium")
});
export type OutputSpec = z.infer<typeof OutputSpecSchema>;

// ─── Merchant memory injection ──────────────────────────────────

export const MemoryHintSchema = z.object({
  kind:       z.enum(["preference", "rejection", "acceptance", "edit-pattern"]),
  content:    z.string(),
  confidence: z.number().min(0).max(1).default(1),
  source:     z.string()                     // which memory entry
});
export type MemoryHint = z.infer<typeof MemoryHintSchema>;

// ─── The full IR ────────────────────────────────────────────────

export const DesignIRSchema = z.object({
  schema_version: z.literal("1.0.0"),
  intent:         IntentSchema,
  trade:          z.string(),                // "carpenter" | "plumber" | ...
  vehicle:        VehicleSpecSchema.optional(),
  brand_snapshot_id: z.string(),             // reference to hammerex_brand_snapshots.id
  layout:         LayoutIntentSchema,
  photography:    PhotographyIntentSchema,
  typography:     TypographyIntentSchema,
  colour:         ColourIntentSchema,
  constraints:    z.array(ConstraintSchema).default([]),
  outputs:        z.array(OutputSpecSchema).min(1),
  memory_hints:   z.array(MemoryHintSchema).default([]),
  business:       z.object({                 // for prompt text substitution
    name:      z.string(),
    tagline:   z.string().optional(),
    phone:     z.string().optional(),
    website:   z.string().optional(),
    services:  z.array(z.string()).max(6).default([])
  }),
  recipe_id:      z.string().optional()      // when a Recipe is applied
});
export type DesignIR = z.infer<typeof DesignIRSchema>;

export function parseIR(input: unknown): DesignIR {
  return DesignIRSchema.parse(input);
}
