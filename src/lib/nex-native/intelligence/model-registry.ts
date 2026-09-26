// src/lib/nex-native/intelligence/model-registry.ts
//
// NEX Generation Engine · Model registry + selection (server-only).
// -----------------------------------------------------------------
// The registry is a small typed table of every model the NEX Generation
// Engine can drive. Selection is a single function that picks the best
// available model for a given surface / role.
//
// Today: one production-safe model (Qwen2.5-0.5B-Instruct · Apache-2.0).
// The shape is deliberately ready for a multi-model architecture —
// specialist models (billing / booking / dispatch / etc.) plug in behind
// this same interface without changing the engine or the adapter.
//
// Every entry MUST pass the licence gate (commercialUsePermitted=true).
// Research-only models are refused at selection.

import "server-only";
import type { NexGenerationModel } from "./models/types";
import { qwen25_05b_instruct } from "./models/qwen25-05b-instruct";
import { qwen25_15b_instruct } from "./models/qwen25-15b-instruct";

export type NexModelRole =
  | "default"          // baseline conversational NEX assistant
  | "conversation"     // reserved · same as default today
  | "booking"          // reserved · future specialist
  | "billing";         // reserved · future specialist

interface Registration {
  model: NexGenerationModel;
  priority: number;
  roles: readonly NexModelRole[];
}

const REGISTRY: readonly Registration[] = [
  {
    // 0.5B · current proven backend (highest priority = active selection)
    model: qwen25_05b_instruct,
    priority: 100,
    roles: ["default", "conversation"],
  },
  {
    // 1.5B · registered replacement candidate · same contract, larger model
    // Priority 90 · registry-level priority swap is all it takes to make
    // this the active backend if/when runtime evaluation confirms quality.
    model: qwen25_15b_instruct,
    priority: 90,
    roles: ["default", "conversation"],
  },
];

/**
 * Pick the highest-priority commercial-safe model registered for the
 * given role. Refuses to return any model whose licence disallows
 * commercial use (research-only, gated, etc.).
 */
export function selectModel(role: NexModelRole = "default"): NexGenerationModel | null {
  const candidates = REGISTRY
    .filter((r) => r.roles.includes(role))
    .filter((r) => r.model.licence.commercialUsePermitted === true)
    .sort((a, b) => b.priority - a.priority);
  return candidates[0]?.model ?? null;
}

/** List every registered model (for diagnostics / reporting). */
export function listRegisteredModels(): readonly NexGenerationModel[] {
  return REGISTRY.map((r) => r.model);
}

/** Look up a model by its stable id · null if not registered. */
export function findModelById(id: string): NexGenerationModel | null {
  return REGISTRY.find((r) => r.model.id === id)?.model ?? null;
}
