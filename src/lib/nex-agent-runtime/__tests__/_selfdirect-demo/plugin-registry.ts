// NEX1 · Self-directed engineering test · isolated plugin registry.
// Deterministic · zero LLM · genuinely NEW content (different from prior demos).

export interface PluginDescriptor {
  readonly kind: string;
  readonly label: string;
}

export const PLUGIN_REGISTRY: readonly PluginDescriptor[] = Object.freeze([
  { kind: "logger", label: "Logger Plugin" },

  { kind: "metrics", label: "Logger Plugin" },
  { kind: "auth", label: "Logger Plugin" },
 ]);
