// Brain Loader — post ADR-0042 Reference Brain Sole Authoritative Path.
//
// The filesystem loader that scanned `brains/**/brain.json` at boot has
// been SEVERED per ADR-0042. The Reference Brain now accepts content
// through exactly ONE path:
//
//   Layer 1 evidence → Layer 2 draft → review → certification → publication
//   → immutable versions (hammerex_nex_brain_versions) → Layer 3 runtime.
//
// Nothing else authoritative. See docs/DECISIONS/0042-reference-brain-sole-authoritative-path.md.
//
// This loader currently returns an EMPTY registry — no brains are yet
// published to `hammerex_nex_brain_versions`. That is Rule A compliant:
// silence is safe · fabricated is dangerous. When Terminology (or the
// first chosen module) publishes, the Supabase-backed loader will be
// added here per the Author-Driven Rule (ADR-0041) — not built before
// there is content to load.
//
// The public API contract is preserved so downstream consumers
// (`_registry.ts`, `brain-chat/route.ts`, admin panels) continue to
// compile and gracefully handle the empty-brain state (which they
// already do — `brain-chat/route.ts` returns 503 no_brains_available).
//
// Server-only.

import "server-only";
import type { BrainDescriptor } from "./_manifest";

let registry: Map<string, BrainDescriptor> | null = null;
let lastScanAt = 0;

export function loadAllBrains(): Map<string, BrainDescriptor> {
  // Sole Authoritative Path: no filesystem scan · no `.author-studio-drafts/`
  // pointer · no fallback. Registry stays empty until a brain publishes
  // to `hammerex_nex_brain_versions` and the Supabase read is wired in
  // (Author-Driven Rule · ADR-0041 · not built before the need is real).
  registry = new Map();
  lastScanAt = Date.now();
  return registry;
}

export function ensureLoaded(): Map<string, BrainDescriptor> {
  if (!registry) return loadAllBrains();
  return registry;
}

export function forceReload(): Map<string, BrainDescriptor> {
  return loadAllBrains();
}

export function getLastScanAt(): number {
  return lastScanAt;
}

export function getBrainsRootPath(): string {
  // Retained for compatibility with `brainStatistics()` in `_registry.ts`.
  // No filesystem is actually scanned; this returns the label of the
  // authoritative source.
  return "hammerex_nex_brain_versions (Supabase · Sole Authoritative Path · ADR-0042)";
}
