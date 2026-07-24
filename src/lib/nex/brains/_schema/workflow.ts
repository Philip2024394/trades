// Workflow module — standard sequence for common jobs.
// Per ADR-0017 §1 V1 required.

import { z } from "zod";
import { ModuleHeaderSchema, PlaybookSchema } from "./common";

export const WorkflowModuleSchema = z.object({
  header:    ModuleHeaderSchema,
  playbooks: z.array(PlaybookSchema).default([])
});
export type WorkflowModule = z.infer<typeof WorkflowModuleSchema>;
