// Master Brand Record — the canonical shape ChatGPT returned in the
// design-brief architecture session (Brand JSON Schema, batch 2).
//
// Every downstream surface (van wrap, logo, business card, workwear,
// invoice, canteen theme, letterhead, social banner) reads from this
// same shape. When merchants update their brand, one row changes;
// every surface can regenerate coherently.
//
// Zod-validated at every read/write boundary so agent output doesn't
// pollute the record with malformed fields.

import { z } from "zod";

// ─── Colour palette ───────────────────────────────────────────────

export const ColourPaletteSchema = z.object({
  primary:   z.string().regex(/^#[0-9A-Fa-f]{6}$/, "hex #RRGGBB"),
  secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accent:    z.string().regex(/^#[0-9A-Fa-f]{6}$/)
});
export type ColourPalette = z.infer<typeof ColourPaletteSchema>;

// ─── Typography ──────────────────────────────────────────────────

export const TypographySchema = z.object({
  primary:   z.string(),          // e.g. "Helvetica Neue"
  secondary: z.string().optional()
});
export type Typography = z.infer<typeof TypographySchema>;

// ─── Logo lockups ─────────────────────────────────────────────────

export const LogoLockupSchema = z.object({
  slug:  z.string(),              // 'horizontal' | 'stacked' | 'monogram' | 'submark'
  url:   z.string().url(),
  vector_url: z.string().url().optional()
});
export type LogoLockup = z.infer<typeof LogoLockupSchema>;

export const LogoSchema = z.object({
  symbol: z.string().optional(),  // description of the mark ('house + hammer + plane')
  lockups: z.array(LogoLockupSchema).default([])
});
export type Logo = z.infer<typeof LogoSchema>;

// ─── Imagery ─────────────────────────────────────────────────────

export const PortfolioPhotoSchema = z.object({
  url:  z.string().url(),
  role: z.enum([
    "portfolio-panel",
    "service-tile",
    "hero-panel",
    "credential-badge",
    "before-after"
  ]),
  quality_passed: z.boolean().default(true),  // Mode B rejection outcome
  width_px:  z.number().int().optional(),
  height_px: z.number().int().optional()
});
export type PortfolioPhoto = z.infer<typeof PortfolioPhotoSchema>;

export const ImagerySchema = z.object({
  hero_style: z.string().optional(),          // e.g. "luxury oak staircase"
  portfolio:  z.array(PortfolioPhotoSchema).default([])
});
export type Imagery = z.infer<typeof ImagerySchema>;

// ─── Voice ──────────────────────────────────────────────────────

export const VoiceSchema = z.object({
  tone:     z.string().default(""),           // e.g. "precise, warm, craft-forward"
  keywords: z.array(z.string()).default([])
});
export type Voice = z.infer<typeof VoiceSchema>;

// ─── Rules ──────────────────────────────────────────────────────

export const BrandRulesSchema = z.object({
  max_colours:      z.number().int().min(1).max(6).default(3),
  hero_images:      z.number().int().min(1).max(3).default(1),
  preferred_layout: z.string().optional()
});
export type BrandRules = z.infer<typeof BrandRulesSchema>;

// ─── Assets ─────────────────────────────────────────────────────

export const BrandAssetsSchema = z.object({
  svg_logo:      z.string().url().optional(),
  brand_guide:   z.string().url().optional(),
  photo_library: z.array(z.string().url()).default([])
});
export type BrandAssets = z.infer<typeof BrandAssetsSchema>;

// ─── Vehicles + Services (owned metadata) ────────────────────────

export const OwnedVehicleSchema = z.object({
  model:    z.string(),                       // e.g. "Ford Transit Custom L2H1"
  year:     z.number().int().optional(),
  colour:   z.string().optional(),            // paint colour slug
  registration: z.string().optional()
});
export type OwnedVehicle = z.infer<typeof OwnedVehicleSchema>;

// ─── The full BrandRecord ────────────────────────────────────────

export const BrandRecordSchema = z.object({
  name:        z.string().min(1).max(120),
  tagline:     z.string().max(200).default(""),
  industry:    z.string(),                    // e.g. "joinery"
  positioning: z.string().default(""),        // e.g. "luxury residential"
  personality: z.array(z.string()).default([]),
  audience:    z.string().default(""),        // e.g. "high-value homeowners"
  colour:      ColourPaletteSchema,
  typography:  TypographySchema,
  logo:        LogoSchema.default({ lockups: [] }),
  imagery:     ImagerySchema.default({ portfolio: [] }),
  voice:       VoiceSchema.default({ tone: "", keywords: [] }),
  vehicles:    z.array(OwnedVehicleSchema).default([]),
  services:    z.array(z.string()).default([]),
  rules:       BrandRulesSchema.default({ max_colours: 3, hero_images: 1 }),
  assets:      BrandAssetsSchema.default({ photo_library: [] })
});
export type BrandRecord = z.infer<typeof BrandRecordSchema>;

/** Parse + validate a brand JSON blob. Throws on malformed input. */
export function parseBrandRecord(input: unknown): BrandRecord {
  return BrandRecordSchema.parse(input);
}

/** Non-throwing variant — returns null on validation failure. */
export function safeParseBrandRecord(input: unknown): BrandRecord | null {
  const res = BrandRecordSchema.safeParse(input);
  return res.success ? res.data : null;
}
