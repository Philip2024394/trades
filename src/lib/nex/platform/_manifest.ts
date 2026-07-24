// Brain Manifest — the schema every brain.json in brains/**/ follows.
// Runtime-validated with Zod so a malformed brain.json fails loudly at
// boot rather than silently at runtime.
//
// Every field is optional at the schema level EXCEPT slug + title +
// version — so an in-development Brain can ship with just the shell
// and gets filled in as content arrives.

import { z } from "zod";

export const BrainStatusSchema = z.enum(["live", "coming_soon", "disabled"]);
export type BrainStatus = z.infer<typeof BrainStatusSchema>;

export const BrainPluginsSchema = z.object({
  wood_gallery:         z.boolean().default(false),
  expertise_detector:   z.boolean().default(false),
  competitor_query:     z.boolean().default(false),
  vision_extraction:    z.boolean().default(false),
  estimator:            z.boolean().default(false)
}).partial().default({});
export type BrainPlugins = z.infer<typeof BrainPluginsSchema>;

export const BrainManifestSchema = z.object({
  // Identity
  slug:                z.string().min(1).regex(/^[a-z][a-z0-9_-]*$/, "slug must be lowercase snake/kebab"),
  title:               z.string().min(1),
  description:         z.string().default(""),
  version:             z.string().default("1.0.0"),

  // Categorisation + surfacing
  category:            z.string().default("general"),
  icon:                z.string().default(""),                   // emoji or icon key
  keywords:            z.array(z.string()).default([]),
  supported_languages: z.array(z.string()).default(["en-GB"]),

  // Content locations — globs relative to the brain.json file
  prompt_file:         z.string().default("./prompt.md"),
  knowledge_paths:     z.array(z.string()).default(["./knowledge/*.json"]),
  product_paths:       z.array(z.string()).default([]),
  image_paths:         z.array(z.string()).default([]),
  video_paths:         z.array(z.string()).default([]),
  document_paths:      z.array(z.string()).default([]),
  faq_paths:           z.array(z.string()).default([]),

  // Optional plugins this Brain enables — most Brains enable none
  plugins:             BrainPluginsSchema,

  // Lifecycle
  enabled:             z.boolean().default(true),
  priority:            z.number().int().default(100),
  status:              BrainStatusSchema.default("coming_soon"),

  // Optional developer-facing
  author:              z.string().optional(),
  license:             z.string().optional(),
  updated_at:          z.string().optional()
});
export type BrainManifest = z.infer<typeof BrainManifestSchema>;

// Runtime descriptor — a BrainManifest plus the discovery info the
// platform needs (filesystem paths resolved from globs, manifest
// origin, load timestamp).
export type BrainDescriptor = BrainManifest & {
  _manifestPath:  string;       // absolute path to brain.json on disk
  _rootDir:       string;       // absolute directory containing brain.json
  _resolvedKnowledge: string[]; // absolute file paths matching knowledge_paths
  _loadedAt:      number;       // ms timestamp
  _loadError?:    string;       // populated if manifest was valid but content failed to load
};
