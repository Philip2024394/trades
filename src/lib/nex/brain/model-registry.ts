// NEX AI · local model registry.
//
// Defines the small deliberate model fleet NEX uses on the dev
// laptop (32 GB RAM · RTX 2050 4 GB VRAM · i5-12450H) and the
// runtime roles each model fills. Every role reads from env with a
// sensible default so operators can override per-host without a
// code change.
//
// Design intent (2026-08-30 · Philip):
//   - "Do not simply make everything use one model."
//   - "I want a proper NEX AI MODEL STACK where each model is used
//     for the job it is best suited for."
//   - "Do not necessarily use this exact schema if the repository
//     already has a better architecture." — no existing registry
//     was found in the audit, so this is the first cut. Callers
//     (resolver, future fast-router, vision path) consult it.
//
// The registry does NOT do provider selection · that stays in
// resolve.ts. It answers: "given role X, what OLLAMA MODEL TAG
// should be used?"

export type NexModelRole =
  /** Main NEX chat reasoning · balanced quality + latency · tool-calling. */
  | "brain.primary_local"
  /** Fast classification, intent routing, one-line answers. */
  | "brain.fast_local"
  /** Local image understanding (photos, screenshots). Vision-capable. */
  | "vision.primary_local";

export type NexModelEntry = {
  role: NexModelRole;
  /** Ollama model tag exactly as `ollama list` prints it. */
  ollamaTag: string;
  /** One-line description of what this model is for. */
  purpose: string;
  /** Approximate weights footprint in GB (VRAM if fully GPU-offloaded,
   *  otherwise system RAM). Excludes KV cache. */
  weightsGb: number;
  /** Whether the model supports Ollama tool calling. Text-only models
   *  can still classify / summarise / write, they just can't emit
   *  structured tool_calls. */
  supportsTools: boolean;
  /** Whether the model accepts image inputs. */
  supportsVision: boolean;
  /** Model's declared context window. */
  contextTokens: number;
  /** Measured tokens/sec on this hardware after warm-up. `null` if
   *  not benchmarked. Provisional field · updated when new benchmarks
   *  land. */
  measuredTps: number | null;
};

/** Env-overridable role → model tag defaults. Values chosen from the
 *  2026-08-30 benchmark on this laptop (see the session final report). */
const ROLE_DEFAULTS: Record<NexModelRole, string> = {
  "brain.primary_local":  process.env.NEX_MODEL_BRAIN_PRIMARY  ?? "qwen2.5:7b-instruct-q3_K_M",
  "brain.fast_local":     process.env.NEX_MODEL_BRAIN_FAST     ?? "qwen2.5:3b",
  "vision.primary_local": process.env.NEX_MODEL_VISION_PRIMARY ?? "qwen2.5vl:3b",
};

/** Known-fleet metadata. Keyed by ollama tag. When a role resolves to
 *  a tag not in this table, we still return a usable entry with
 *  conservative defaults · but callers lose the metadata sugar. */
const KNOWN_MODELS: Record<string, Omit<NexModelEntry, "role" | "ollamaTag">> = {
  "qwen2.5:7b-instruct-q3_K_M": {
    purpose: "Main NEX chat · balanced Indonesian + English reasoning · tool-calling · fits 4 GB VRAM tightly",
    weightsGb: 3.8,
    supportsTools: true,
    supportsVision: false,
    contextTokens: 32_768,
    measuredTps: 12,
  },
  "qwen2.5:3b": {
    purpose: "Fast classification, intent detection, short responses · sits fully in VRAM",
    weightsGb: 1.9,
    supportsTools: true,
    supportsVision: false,
    contextTokens: 32_768,
    measuredTps: 50,
  },
  "qwen2.5vl:3b": {
    purpose: "Local image understanding (photos, screenshots, receipts) · Qwen2.5-VL family · 128K context",
    weightsGb: 3.2,
    supportsTools: false,
    supportsVision: true,
    contextTokens: 128_000,
    measuredTps: null,
  },
  "moondream:latest": {
    purpose: "Lightweight vision fallback · Phi-2 base + CLIP · low quality vs Qwen2.5-VL but tiny",
    weightsGb: 1.7,
    supportsTools: false,
    supportsVision: true,
    contextTokens: 2_048,
    measuredTps: null,
  },
};

/** Resolve the ollama tag + metadata for a role. */
export function getModelForRole(role: NexModelRole): NexModelEntry {
  const tag = ROLE_DEFAULTS[role];
  const meta = KNOWN_MODELS[tag] ?? {
    purpose: "Unknown model · no metadata in NEX registry",
    weightsGb: 0,
    supportsTools: role !== "vision.primary_local",
    supportsVision: role === "vision.primary_local",
    contextTokens: 8_192,
    measuredTps: null,
  };
  return { role, ollamaTag: tag, ...meta };
}

/** List every known-fleet entry (regardless of whether a role
 *  currently points at it). Useful for HQ dashboards + verification. */
export function listKnownFleet(): Array<{ ollamaTag: string } & Omit<NexModelEntry, "role" | "ollamaTag">> {
  return Object.entries(KNOWN_MODELS).map(([ollamaTag, meta]) => ({ ollamaTag, ...meta }));
}

/** List which model each role currently points at. */
export function listRoleAssignments(): NexModelEntry[] {
  return (Object.keys(ROLE_DEFAULTS) as NexModelRole[]).map(getModelForRole);
}

/** Look up capabilities for a given ollama tag without needing a role.
 *  Returns the KNOWN_MODELS metadata if we've indexed it, otherwise a
 *  conservative default that assumes text-only tool support. */
export function capabilitiesForTag(ollamaTag: string): { supportsTools: boolean; supportsVision: boolean; contextTokens: number } {
  const meta = KNOWN_MODELS[ollamaTag];
  if (meta) return { supportsTools: meta.supportsTools, supportsVision: meta.supportsVision, contextTokens: meta.contextTokens };
  return { supportsTools: true, supportsVision: false, contextTokens: 8_192 };
}
