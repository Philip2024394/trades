// src/lib/nex-self-model/self-model-store.ts
//
// NEX1 · SELF-MODEL STORE + IDENTITY STORE · READ-ONLY LOADER.
//
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Discipline (self-model safety invariants SM-1 · SM-3 · SM-4):
//   · READ-ONLY. This module cannot modify the underlying JSON.
//     Changes require a founder-authored amendment. Autonomous writes
//     fail-closed by construction (no write function exists here).
//   · The identity file is IMMUTABLE. Every constitutional pin carries
//     a source reference the caller can audit.
//   · This module NEVER fabricates. If the file is unreadable, the
//     loader throws · never returns a synthesised fallback.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ─── Identity Store ────────────────────────────────────────────────

export interface IdentityStore {
  readonly version: string;
  readonly authored_by: string;
  readonly authored_at: string;
  readonly notes: string;
  readonly name: string;
  readonly role: string;
  readonly identity_authorities: readonly string[];
  readonly role_separation: Readonly<Record<string, string>>;
  readonly attribution_constants: {
    readonly external_llm_used: false;
    readonly independent_authorship_percent: 0;
    readonly taught_by: "master_ai_engineer";
    readonly adapter_scope: "code_proposal_only";
    readonly attempted_by_label_when_adapter_assisted: string;
  };
  readonly golden_rules: readonly string[];
  readonly immutable_boundaries: readonly string[];
  readonly constitutional_pins: ReadonlyArray<{
    readonly id: string;
    readonly rule: string;
    readonly source: string;
  }>;
}

let IDENTITY_CACHE: IdentityStore | null = null;

export function loadIdentity(): IdentityStore {
  if (IDENTITY_CACHE) return IDENTITY_CACHE;
  const p = resolve(process.cwd(), "data/nex1-self-model/identity.json");
  IDENTITY_CACHE = JSON.parse(readFileSync(p, "utf8")) as IdentityStore;
  return IDENTITY_CACHE;
}

// ─── Self-Model Store ──────────────────────────────────────────────

export interface CapabilityProven {
  readonly id: string;
  readonly label?: string;
  readonly evidence: string;
}
export interface CapabilityCeiling {
  readonly id: string;
  readonly label: string;
  readonly reason: string;
}
export interface BrainSelfModel {
  readonly id: string;
  readonly display_name: string;
  readonly path: string;
  readonly status: string;
  readonly role?: string;
  readonly tracks?: ReadonlyArray<{
    readonly id: string;
    readonly level_current: string;
    readonly maturity_current: string;
    readonly cases: string;
  }>;
  readonly capabilities_proven?: readonly CapabilityProven[];
  readonly capabilities_proven_pointer?: string;
  readonly capabilities_ceiling?: readonly CapabilityCeiling[];
  readonly self_repair_available?: boolean;
  readonly byte_identical_rollback?: boolean;
  readonly adapter_scope?: string;
}
export interface CrossCuttingSubstrate {
  readonly id: string;
  readonly purpose: string;
  readonly status: string;
}
export interface SelfModel {
  readonly version: string;
  readonly authored_by: string;
  readonly authored_at: string;
  readonly notes: string;
  readonly brains: readonly BrainSelfModel[];
  readonly cross_cutting: readonly CrossCuttingSubstrate[];
  readonly boundaries: Readonly<Record<string, boolean>>;
  readonly current_open_items: ReadonlyArray<{
    readonly id: string;
    readonly detail: string;
    readonly founder_action_required: boolean;
  }>;
}

let SELF_MODEL_CACHE: SelfModel | null = null;

export function loadSelfModel(): SelfModel {
  if (SELF_MODEL_CACHE) return SELF_MODEL_CACHE;
  const p = resolve(process.cwd(), "data/nex1-self-model/self-model-v0.json");
  SELF_MODEL_CACHE = JSON.parse(readFileSync(p, "utf8")) as SelfModel;
  return SELF_MODEL_CACHE;
}

export function _resetSelfModelCache(): void {
  IDENTITY_CACHE = null;
  SELF_MODEL_CACHE = null;
}

// ─── Convenience projections ───────────────────────────────────────

/**
 * @summary Return the total "cannot yet" ceiling across all brains + the
 * explicit boundaries. Per SM-5 · every self-report leads with limitations.
 */
export function cannotYet(): { boundaries: readonly string[]; ceilings: readonly CapabilityCeiling[] } {
  const sm = loadSelfModel();
  const identity = loadIdentity();
  const ceilings: CapabilityCeiling[] = [];
  for (const b of sm.brains) {
    for (const c of b.capabilities_ceiling ?? []) ceilings.push(c);
  }
  return { boundaries: identity.immutable_boundaries, ceilings };
}

/**
 * @summary Return the total "capabilities proven" across all brains, with
 * evidence pointers. Called by what_can_i_do after cannotYet.
 */
export function canDo(): ReadonlyArray<{ brain: string; capabilities: readonly CapabilityProven[] }> {
  const sm = loadSelfModel();
  return sm.brains
    .filter((b) => b.capabilities_proven && b.capabilities_proven.length > 0)
    .map((b) => ({ brain: b.display_name, capabilities: b.capabilities_proven! }));
}
