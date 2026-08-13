// NEX KPE · Plugin Registry
//
// The load-bearing primitive of the entire KPE. Every stage of the pipeline
// looks up its implementation through this registry — never imports concrete
// classes directly. This is what makes it possible to swap the AI Gateway
// (mock → Hugging Face → local llama) or the Classifier or the OCR engine
// without touching pipeline code.
//
// RULES FOR PLUGIN AUTHORS
// 1. Never break the input/output contract for a stage (see types.ts).
//    Contract changes = major version bump + coordinated migration.
// 2. Every plugin must be replaceable with the reference implementation
//    without data migration.
// 3. Register at module load time via `registerPlugin` — never inside a
//    request handler.

import type { PipelineStage, StageName } from "./types";

type AnyStage = PipelineStage<unknown, unknown>;

const registry = new Map<StageName, AnyStage>();

/**
 * Register a plugin implementation. Last registration wins — this makes it
 * trivial to override defaults from an app-specific bootstrap file.
 */
export function registerPlugin<I, O>(stage: PipelineStage<I, O>): void {
  registry.set(stage.name, stage as AnyStage);
}

/**
 * Look up the current implementation of a stage. Throws if unregistered —
 * we want a hard, immediate failure at boot, not a mysterious runtime error.
 */
export function getPlugin<I, O>(name: StageName): PipelineStage<I, O> {
  const stage = registry.get(name);
  if (!stage) throw new Error(`[kpe.registry] no plugin registered for stage: ${name}`);
  return stage as PipelineStage<I, O>;
}

/** Snapshot of every registered plugin (for /api/nex/kpe/plugins). */
export function listPlugins(): Array<{ name: StageName; version: string }> {
  return [...registry.entries()]
    .map(([name, stage]) => ({ name, version: stage.version }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Test-only: reset the registry. Never call from production code. */
export function _resetRegistryForTests(): void {
  registry.clear();
}

// ── Auto-load defaults on first import ───────────────────────────
// Defer via dynamic import to avoid circular refs at module init time.
// The pipeline orchestrator calls `ensureDefaultsLoaded()` before its first run.
let defaultsLoaded = false;

export async function ensureDefaultsLoaded(): Promise<void> {
  if (defaultsLoaded) return;
  await import("./plugins/default");
  defaultsLoaded = true;
}
