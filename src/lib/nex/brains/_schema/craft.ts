// Craft module — core techniques, sequence, terminology.
// Per ADR-0017 §1 V1 required.

import { z } from "zod";
import { EvidenceCiteSchema, FactSchema, ModuleHeaderSchema, PlaybookSchema } from "./common";

export const CraftTermSchema = z.object({
  term:       z.string().min(1),
  definition: z.string().min(1),
  aliases:    z.array(z.string()).default([]),
  evidence:   z.array(EvidenceCiteSchema).default([])
});

export const CraftModuleSchema = z.object({
  header:     ModuleHeaderSchema,
  facts:      z.array(FactSchema).default([]),
  techniques: z.array(PlaybookSchema).default([]),
  glossary:   z.array(CraftTermSchema).default([])
});
export type CraftModule = z.infer<typeof CraftModuleSchema>;
