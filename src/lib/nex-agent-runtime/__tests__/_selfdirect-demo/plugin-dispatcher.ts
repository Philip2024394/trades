// NEX1 · Self-directed engineering test · isolated dispatcher.
// Deterministic · zero LLM · uses different field name ('kind') from prior demos.

import { PLUGIN_REGISTRY } from "./plugin-registry";

export interface PluginRequest {
  readonly kind: string;
}

export function dispatchPlugins(input: {
  readonly requested: readonly PluginRequest[];
}): Map<string, string> {
  const handles = new Map<string, string>();
  for (const r of input.requested) {
    if (!PLUGIN_REGISTRY.find((p) => p.kind === r.kind)) continue;
    handles.set(r.kind, "dispatched");
  }
  return handles;
}
