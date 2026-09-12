// NEX Workforce v2 · Slice 1f · Explicit step-library registration barrel
// ─────────────────────────────────────────────────────────────────────────────
// Every registered capability is listed here. No filesystem-scan magic.
// Adding a new capability = one import + one register() call in this file.

import * as StepRegistry from "../lib/step_registry.mjs";
import * as overpassObserve from "./overpass_observe.mjs";
import * as overpassObserveAndStage from "./overpass_observe_and_stage.mjs";
import * as helloWorld from "./hello_world.mjs";

/** Register the set of production capabilities. */
export function registerAll() {
  // Hello-world · smoke-test only (Slice 1c legacy, still registered for A1)
  StepRegistry.register("helloworld", "helloworld", helloWorld);
  // Overpass observe · Slice 1f · records evidence only, no persistence.
  // Retained for reference / migration compatibility · NOT the production path.
  // Slice 1f 27-test contract still governs this capability.
  //
  // Slice A1 (2026-09-07 · Philip) adds "accommodation" alongside the
  // existing 4 categories. Registration only · no acquisition activated ·
  // no work items seeded · no Overpass calls made by this file.
  for (const cat of ["restaurants", "cafes", "retail-fashion", "retail-books", "accommodation"]) {
    StepRegistry.register(cat, "overpass-observe-only", overpassObserve);
  }
  // Overpass observe + stage · Slice 1g · fetches + stages + persists.
  // This is the PRODUCTION path for Overpass-sourced categories.
  // Requires nex_workforce.stage_candidates + persist_batch helpers.
  // Slice 1h will introduce real persister functions; until then, tests use
  // a mock persister via NEX_PERSISTER_FN env override.
  //
  // Slice A1 (2026-09-07 · Philip) · accommodation registered here alongside
  // the 4 existing categories. When (eventually) exercised in production, the
  // persister defaults to the mock target · a real accommodation persister
  // (nex_workforce.persist_to_accommodation_business or equivalent) is a
  // separate authorized slice · out of A1 scope.
  for (const cat of ["restaurants", "cafes", "retail-fashion", "retail-books", "accommodation"]) {
    StepRegistry.register(cat, "overpass", overpassObserveAndStage);
  }
}
