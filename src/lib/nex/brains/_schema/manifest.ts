// Brain manifest — top-level metadata registered in hammerex_nex_brains.
// Per ADR-0017 §1 + §2.

import { z } from "zod";
import { RegionCodeSchema } from "./common";

export const BrainCategorySchema = z.enum(["trade", "business", "regulatory", "product"]);
export type BrainCategory = z.infer<typeof BrainCategorySchema>;

export const BrainStatusSchema = z.enum([
  "draft",              // Author writing · not queryable
  "author_review",      // Author submitted · Nex review
  "advisory_panel",     // With merchant advisory panel
  "published",          // Live · queryable
  "retired"             // Superseded by newer version
]);
export type BrainStatus = z.infer<typeof BrainStatusSchema>;

export const BrainManifestSchema = z.object({
  slug:                z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/),
  name:                z.string().min(1),
  category:            BrainCategorySchema,
  version:             z.string().min(1),
  status:              BrainStatusSchema,
  primary_author_id:   z.string().nullable(),
  primary_author_name: z.string().nullable(),
  primary_author_creds: z.string().nullable(),
  supported_countries: z.array(RegionCodeSchema).default([]),
  supported_regions:   z.array(RegionCodeSchema).nullable().default(null),
  published_at:        z.string().datetime().nullable(),
  last_reviewed_at:    z.string().datetime().nullable(),
  /** Which V1 modules ARE authored in this version. Missing V1 module
   *  = boot audit failure per ADR-0017 §2. */
  v1_modules_present: z.array(z.enum([
    "craft", "regulations", "materials",
    "workflow", "defects", "pricing_model"
  ])).default([])
});
export type BrainManifest = z.infer<typeof BrainManifestSchema>;
