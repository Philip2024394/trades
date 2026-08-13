// Four-Layer Distinction · classifier + lookup helpers.
//
// Doctrine: docs/brains/nex-four-layer-distinction-philip-2026-08-04.md

import type { Layer, LayerAttribution } from "./types";
import { LAYER_MAP, LAYER_ORDER, LAYER_DESCRIPTION, LAYER_QUESTION, READ_ONLY_ACROSS_LAYERS } from "./types";

/** Return the Layer for a known module_id · or undefined if the module isn't
 *  registered. Registered modules must appear in `LAYER_MAP` — that mapping
 *  is the single canonical source of truth for the four-layer distinction. */
export function classifyModule(module_id: string): Layer | undefined {
  return LAYER_MAP.find((m) => m.module_id === module_id)?.layer;
}

/** Every attribution for a given Layer. */
export function modulesInLayer(layer: Layer): readonly LayerAttribution[] {
  return LAYER_MAP.filter((m) => m.layer === layer);
}

/** Human-friendly description of a Layer. */
export function describeLayer(layer: Layer): { description: string; question: string } {
  return { description: LAYER_DESCRIPTION[layer], question: LAYER_QUESTION[layer] };
}

/** Walk order · Decisions → Knowledge → Observations → Evidence. Used by Voice
 *  Intelligence to answer "why" questions from Decisions backward to Evidence. */
export function walkOrderBackward(): readonly Layer[] {
  return [...LAYER_ORDER].reverse();
}

/** Is a module allowed to read across all four layers without adding facts? */
export function isReadOnlyAcrossLayers(module_id: string): boolean {
  return READ_ONLY_ACROSS_LAYERS.has(module_id);
}

/** Guard for a PR check: throws when a module ID lands in the codebase without
 *  a Layer registration. Call from CI or from platform integration tests. */
export function requireLayerRegistration(module_id: string): LayerAttribution {
  const attr = LAYER_MAP.find((m) => m.module_id === module_id);
  if (!attr) throw new Error(`Module '${module_id}' is missing a Layer registration in src/lib/nex/four-layer/types.ts`);
  return attr;
}
