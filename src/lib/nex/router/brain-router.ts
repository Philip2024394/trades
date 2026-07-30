// NEX Brain Router · Consciousness Layer routing decision
//
// Philip 2026-07-30 · Step 1 → Step 3 of the plan:
//   Step 1 · Build router (done)
//   Step 2 · Symptom routing (done)
//   Step 3 · TEST THE ROUTER (in progress — required this split)
//
// This file is the server-only entry point. Real logic lives in
// brain-router-core.ts so the test corpus at
// scripts/nex-router-corpus-test.mts can exercise the exact same code
// path in a plain Node process (no Next.js runtime available).
//
// Do not add logic here — edit brain-router-core.ts instead. This file
// is intentionally a thin barrel with the server-only marker so that
// accidental client-bundle imports fail loud at build time.

import "server-only";

export {
  routeToBrain,
  brainHintForPrompt,
  type BrainDestination,
  type RouteDecision,
} from "./brain-router-core";
