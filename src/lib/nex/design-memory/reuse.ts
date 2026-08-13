// Design Memory · reuse workflow · "make another like last month but walnut instead of oak".
//
// Never start over · load the prior memory · swap one object via the Editing
// Platform · Design History records the operation · Renderer re-renders.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

import type { DesignMemoryEntry } from "./types";

export type ReuseRequest = {
  base_memory_id?: string;               // explicit prior render to base on
  project_id?: string;                   // if no explicit memory_id · take the latest for this project
  changes: readonly string[];            // natural-language edit commands · parsed by Editing Platform
  author: string;
  reason?: string;
};

export type ReusePlan = {
  base_entry: DesignMemoryEntry;
  changes_to_apply: readonly string[];
  preserved: readonly string[];          // path list of everything we're NOT changing
  reasoning: readonly string[];
};

/** Compose a Reuse Plan from a request. Reuse never starts from scratch. */
export function planReuse(base: DesignMemoryEntry, req: ReuseRequest): ReusePlan {
  const preserved: string[] = [];
  if (base.design_document && typeof base.design_document === "object") {
    for (const k of Object.keys(base.design_document as Record<string, unknown>)) preserved.push(`/${k}`);
  }
  const reasoning = [
    `base_memory=${base.memory_id}`,
    `project=${base.project_id}`,
    `changes_count=${req.changes.length}`,
    `preserved_top_level=${preserved.length}`,
  ];
  return {
    base_entry: base,
    changes_to_apply: req.changes,
    preserved,
    reasoning,
  };
}
