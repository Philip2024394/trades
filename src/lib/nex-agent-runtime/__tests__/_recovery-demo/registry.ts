// NEX1 · Rung-4 recovery demo · isolated mini-registry.
// Deterministic · zero LLM · used ONLY by the recovery.test.ts demonstration.
// Structurally identical to a production registry so Capability K's dataflow
// tracer recognises the same pattern. Founder-authorised 2026-09-15.

export interface DemoAgent {
  readonly id: string;
  readonly label: string;
}

export const DEMO_REGISTRY: readonly DemoAgent[] = Object.freeze([
  { id: "keep-alpha", label: "Keep Alpha" },

  { id: "recovery-alpha", label: "Keep Alpha" },
  { id: "recovery-beta", label: "Keep Alpha" },
 ]);
