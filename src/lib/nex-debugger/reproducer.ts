// src/lib/nex-debugger/reproducer.ts
//
// NEX Debugger · reproduction harness registry.
// Deterministic. Seeded. No LLM. No network.
//
// A ReproductionFixture is a pure TypeScript function registered under an id.
// Callers reference the id (over HTTP or in-process) rather than shipping a
// live function reference. This keeps the API surface deterministic and safe.

export interface ReproductionObservation {
  readonly failed: boolean;
  readonly kind: string;                            // "exception" · "assertion_failure" · "wrong_output" · "no_failure_observed"
  readonly observed_output?: unknown;
  readonly stack_trace_hash?: string;
  readonly step_operations?: readonly string[];     // ordered ops · used to build the failure timeline
  readonly step_state_hashes?: readonly string[];   // state hash AFTER each op
  readonly failure_step_index?: number;
}

export interface ReproductionFixture {
  readonly id: string;
  readonly run: (input: unknown, seed: string) => ReproductionObservation;
}

const REGISTRY = new Map<string, ReproductionFixture>();

export function registerFixture(fx: ReproductionFixture): void {
  REGISTRY.set(fx.id, fx);
}

export function getFixture(id: string): ReproductionFixture | undefined {
  return REGISTRY.get(id);
}

export function clearFixtures(): void {
  REGISTRY.clear();
}

// Runs a fixture N times with the same seed. Returns:
//   - reproduced: true if EVERY run observed the failure
//   - deterministic: true if every run produced the same observation shape
export function runReproduction(id: string, input: unknown, seed: string, attempts = 3): {
  reproduced: boolean;
  deterministic: boolean;
  attempts: number;
  observation: ReproductionObservation | null;
} {
  const fx = REGISTRY.get(id);
  if (!fx) return { reproduced: false, deterministic: true, attempts: 0, observation: null };
  const runs: ReproductionObservation[] = [];
  for (let i = 0; i < attempts; i++) runs.push(fx.run(input, seed));
  const failedCount = runs.filter((r) => r.failed).length;
  const reproduced = failedCount === attempts;
  // Determinism = every run produced identical observation shape (excluding stack detail)
  const shapes = runs.map((r) => JSON.stringify({ failed: r.failed, kind: r.kind, step_state_hashes: r.step_state_hashes ?? [] }));
  const deterministic = shapes.every((s) => s === shapes[0]);
  return { reproduced, deterministic, attempts, observation: runs[0] };
}
