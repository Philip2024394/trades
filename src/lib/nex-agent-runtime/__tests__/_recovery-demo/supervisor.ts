// NEX1 · Rung-4 recovery demo · isolated mini-supervisor.
// Deterministic · zero LLM · used ONLY by the recovery.test.ts demonstration.
// Filter pattern matches Capability K's reject-by-registry signature exactly.

import { DEMO_REGISTRY } from "./registry";

export interface DemoProvisioned {
  readonly agent_id: string;
}

export function demoSupervise(input: {
  readonly provisioned: readonly DemoProvisioned[];
}): Map<string, string> {
  const handles = new Map<string, string>();
  for (const p of input.provisioned) {
    if (!DEMO_REGISTRY.find((a) => a.id === p.agent_id)) continue;
    handles.set(p.agent_id, "supervised");
  }
  return handles;
}
