// src/lib/nex-agent/code-engine/capability-micro-brains-instances.ts
//
// NEX1 · Concrete Micro-Brain Instances · Founder-authorised 2026-09-18.
//
// PURPOSE
//   Three distinct micro-brains, each with its own deterministic rulebook,
//   own DB (via agent-registry), own domain. Instances of the shared
//   MicroBrain pattern. Zero LLM · deterministic.
//
//   1) mb_test_shape       · recognises vitest assertion shapes
//   2) mb_identifier_hint  · predicts likely target category from tokens
//   3) mb_fix_confidence   · predicts fix likelihood from adjacent test presence
//
//   Each brain is COMPOSABLE via the cortex router (see
//   capability-cortex-router.ts).

import {
  createMicroBrain,
  type MicroBrain,
  type MicroBrainObservation,
} from "./capability-micro-brain";
import {
  registerAgent,
} from "./capability-agent-registry";

// Register the cortex router itself as an agent so it has its own DB.
registerAgent({
  id: "cortex_router",
  name: "Cortex Router · broadcast to smaller brains",
  cognitive_layer: "infrastructure_orchestrator",
  description: "Broadcasts one observation to N micro-brains and aggregates predictions deterministically.",
});

// ── Brain 1 · Test-shape recogniser ──────────────────────────────────────

export const mb_test_shape: MicroBrain = createMicroBrain({
  id: "mb_test_shape",
  name: "μBrain · test-shape recogniser",
  domain: "vitest_assertion_shape",
  cognitive_layer: "perception",
  description: "Classifies vitest assertion shapes: bare-call, member-access-on-call, member-access-on-local, chained-call.",
  rulebook: [
    {
      id: "shape.bare_call",
      matches: (obs) =>
        obs.kind === "assertion" &&
        typeof obs.data.source === "string" &&
        /^\s*expect\(\s*[a-zA-Z_$][\w$]*\s*\(\s*[^)]*\)\s*\)\s*\.(toBe|toEqual|toStrictEqual)\(/.test(obs.data.source as string),
      predict: () => ({ value: "bare_call", confidence: 0.9 }),
    },
    {
      id: "shape.member_access_on_call",
      matches: (obs) =>
        obs.kind === "assertion" &&
        typeof obs.data.source === "string" &&
        /^\s*expect\(\s*[a-zA-Z_$][\w$]*\s*\([^)]*\)\.[a-zA-Z_$][\w$]*\s*\)\s*\.(toBe|toEqual|toStrictEqual)\(/.test(obs.data.source as string),
      predict: () => ({ value: "member_access_on_call", confidence: 0.9 }),
    },
    {
      id: "shape.chained_call",
      matches: (obs) =>
        obs.kind === "assertion" &&
        typeof obs.data.source === "string" &&
        /expect\(\s*[a-zA-Z_$][\w$]*\s*\([^)]*\)\.[a-zA-Z_$][\w$]*\(/.test(obs.data.source as string),
      predict: () => ({ value: "chained_call", confidence: 0.8 }),
    },
    {
      id: "shape.member_access_on_local",
      matches: (obs) =>
        obs.kind === "assertion" &&
        typeof obs.data.source === "string" &&
        /^\s*expect\(\s*[a-zA-Z_$][\w$]*\.[a-zA-Z_$][\w$]*\s*\)\s*\.(toBe|toEqual|toStrictEqual)\(/.test(obs.data.source as string),
      predict: () => ({ value: "member_access_on_local", confidence: 0.85 }),
    },
  ],
});

// ── Brain 2 · Identifier hint ────────────────────────────────────────────

export const mb_identifier_hint: MicroBrain = createMicroBrain({
  id: "mb_identifier_hint",
  name: "μBrain · identifier hint",
  domain: "target_category_from_token",
  cognitive_layer: "semantic_memory",
  description: "Predicts likely target category (function|class|constant|file) from token shape.",
  rulebook: [
    {
      id: "id.function_lookup",
      matches: (obs) =>
        obs.kind === "identifier" &&
        typeof obs.data.token === "string" &&
        /^[a-z][a-zA-Z0-9]*$/.test(obs.data.token as string) &&
        /(check|compute|get|is|has|run|do|make|build|find|fetch|calc)/i.test(obs.data.token as string),
      predict: () => ({ value: "function", confidence: 0.75 }),
    },
    {
      id: "id.class_pascal",
      matches: (obs) =>
        obs.kind === "identifier" &&
        typeof obs.data.token === "string" &&
        /^[A-Z][a-zA-Z0-9]*$/.test(obs.data.token as string),
      predict: () => ({ value: "class", confidence: 0.8 }),
    },
    {
      id: "id.constant_upper",
      matches: (obs) =>
        obs.kind === "identifier" &&
        typeof obs.data.token === "string" &&
        /^[A-Z_][A-Z0-9_]{2,}$/.test(obs.data.token as string),
      predict: () => ({ value: "constant", confidence: 0.85 }),
    },
    {
      id: "id.file_dotted",
      matches: (obs) =>
        obs.kind === "identifier" &&
        typeof obs.data.token === "string" &&
        /\.(ts|tsx|js|jsx|mjs)$/.test(obs.data.token as string),
      predict: () => ({ value: "file", confidence: 0.95 }),
    },
  ],
});

// ── Brain 3 · Fix confidence predictor ───────────────────────────────────

export const mb_fix_confidence: MicroBrain = createMicroBrain({
  id: "mb_fix_confidence",
  name: "μBrain · fix confidence",
  domain: "fix_success_likelihood",
  cognitive_layer: "procedural_memory",
  description: "Predicts fix confidence from adjacent-test presence + assertion parseability + protected-file status.",
  rulebook: [
    {
      id: "conf.protected_path",
      matches: (obs) =>
        obs.kind === "fix_context" && obs.data.protected_target === true,
      predict: () => ({ value: "REFUSE", confidence: 0.99 }),
    },
    {
      id: "conf.no_adjacent_test",
      matches: (obs) =>
        obs.kind === "fix_context" && obs.data.adjacent_test_present === false,
      predict: () => ({ value: "LOW", confidence: 0.8 }),
    },
    {
      id: "conf.assertion_unparseable",
      matches: (obs) =>
        obs.kind === "fix_context" &&
        obs.data.adjacent_test_present === true &&
        obs.data.assertion_parseable === false,
      predict: () => ({ value: "LOW", confidence: 0.75 }),
    },
    {
      id: "conf.ready_go",
      matches: (obs) =>
        obs.kind === "fix_context" &&
        obs.data.adjacent_test_present === true &&
        obs.data.assertion_parseable === true &&
        obs.data.protected_target !== true,
      predict: () => ({ value: "HIGH", confidence: 0.85 }),
    },
  ],
});

// ── Convenience group ────────────────────────────────────────────────────

export const ALL_MICRO_BRAINS: readonly MicroBrain<MicroBrainObservation>[] = [
  mb_test_shape,
  mb_identifier_hint,
  mb_fix_confidence,
];

export const MICRO_BRAIN_INSTANCES_VERSION = "microbrain-instances.v1";
