// src/lib/nex/config/gates.ts
//
// Wave 11 · Step 11 · Group F · F29 remediation.
//
// SINGLE authoritative reader for the six Headquarters feature gates.
// Provides `getFeatureGates()` returning a stable, typed snapshot that
// the `/api/nex/storage/gates` endpoint + future NexStoragePanel
// section render for the operator.
//
// The six gates (Philip 2026-08-11 · locked scope):
//
//   1 · NEX_BRAIN_BACKEND        · Brain persistence selector
//                                   (filesystem | supabase | postgres)
//   2 · NEX_STORAGE_BACKEND      · NEX Storage runtime selector
//                                   (jsonl | postgres | dual-write)
//   3 · NEX_INBOX_READ_BACKEND   · Knowledge Inbox read source
//                                   (filesystem | postgres)
//   4 · NEX_INBOX_SHADOW_POSTGRES · Inbox shadow-write gate
//                                   (on | off)
//   5 · NEX_BRAIN_SHADOW_SUPABASE · Reverse-shadow gate (Wave 7)
//                                   (on | off)
//   6 · NEX_OBJECT_BACKEND       · Object Storage selector
//                                   (filesystem | postgres)
//
// Every gate returns a value · never null · never throws. Unset →
// "unset" (an honest report state, not a fabricated default), which
// the endpoint surfaces so operators can distinguish "reading = fs
// because chosen" from "reading = fs because gate was never set."
//
// This module is CONSULTATIVE · it does NOT drive backend selection.
// The Brain selector (storage.ts::activeBackend) and NEX Storage
// selector (registry.ts::build) remain authoritative for their own
// scope · gates.ts is the observability read-side · same env vars.
// The drift-catcher enforces that fact so gates.ts does not become
// a second Brain-selection code path.

import { hasPostgresUrl } from "./pg";

// Injection point for tests · production callers pass no argument.
type EnvLike = Record<string, string | undefined>;

function readEnv(env?: EnvLike): EnvLike {
  return env ?? (process.env as EnvLike);
}

// ── typed value per gate ─────────────────────────────────────────────

export type BrainBackend    = "filesystem" | "supabase" | "postgres" | "unset";
export type StorageBackend  = "jsonl" | "postgres" | "dual-write" | "unset";
export type InboxReadSource = "filesystem" | "postgres" | "unset";
export type ShadowState     = "on" | "off" | "unset";
export type ObjectBackend   = "filesystem" | "postgres" | "unset";

export interface FeatureGates {
  brain_backend:         BrainBackend;
  storage_backend:       StorageBackend;
  inbox_read_backend:    InboxReadSource;
  inbox_shadow_postgres: ShadowState;
  brain_shadow_supabase: ShadowState;
  object_backend:        ObjectBackend;
  /** True iff NEX_POSTGRES_URL resolves to a syntactically valid URL. */
  postgres_url_present:  boolean;
}

// ── per-gate coercers ────────────────────────────────────────────────

function toBrainBackend(raw: string | undefined): BrainBackend {
  if (raw === "postgres" || raw === "supabase" || raw === "filesystem") return raw;
  return "unset";
}

function toStorageBackend(raw: string | undefined): StorageBackend {
  const v = (raw ?? "").toLowerCase();
  if (v === "postgres" || v === "jsonl" || v === "dual-write") return v as StorageBackend;
  return "unset";
}

function toInboxReadBackend(raw: string | undefined): InboxReadSource {
  const v = (raw ?? "").toLowerCase();
  if (v === "postgres" || v === "filesystem") return v as InboxReadSource;
  return "unset";
}

// The two shadow gates use "1" for on (matches existing production
// convention) · anything else (including "0" · "true" · unset) → "off"
// unless the value is truly missing, in which case "unset". This
// distinction matters for observability: "off" means the operator
// explicitly disabled shadow · "unset" means they never opted in.
function toShadowState(raw: string | undefined): ShadowState {
  if (raw === undefined) return "unset";
  if (raw === "1") return "on";
  return "off";
}

function toObjectBackend(raw: string | undefined): ObjectBackend {
  const v = (raw ?? "").toLowerCase();
  if (v === "postgres" || v === "filesystem") return v as ObjectBackend;
  return "unset";
}

// ── main snapshot ────────────────────────────────────────────────────

/**
 * Returns the current feature-gate snapshot. Pure function of the
 * environment · never throws · every field always populated with a
 * typed value ("unset" is a valid, honest observability state).
 *
 * Consumed by `/api/nex/storage/gates` (Wave 11 · Step 11 · F29) and,
 * in a follow-up UI step, by the NexStoragePanel "Feature Gates"
 * section for the HQ operator.
 */
export function getFeatureGates(env?: EnvLike): FeatureGates {
  const e = readEnv(env);
  return {
    brain_backend:         toBrainBackend(e.NEX_BRAIN_BACKEND),
    storage_backend:       toStorageBackend(e.NEX_STORAGE_BACKEND),
    inbox_read_backend:    toInboxReadBackend(e.NEX_INBOX_READ_BACKEND),
    inbox_shadow_postgres: toShadowState(e.NEX_INBOX_SHADOW_POSTGRES),
    brain_shadow_supabase: toShadowState(e.NEX_BRAIN_SHADOW_SUPABASE),
    object_backend:        toObjectBackend(e.NEX_OBJECT_BACKEND),
    postgres_url_present:  hasPostgresUrl(e as { NEX_POSTGRES_URL?: string; NODE_ENV?: string }),
  };
}

/**
 * Enumerated names of every gate. Used by the drift-catcher to prove
 * that `getFeatureGates()` covers every gate the codebase reads.
 */
export const GATE_ENV_NAMES = [
  "NEX_BRAIN_BACKEND",
  "NEX_STORAGE_BACKEND",
  "NEX_INBOX_READ_BACKEND",
  "NEX_INBOX_SHADOW_POSTGRES",
  "NEX_BRAIN_SHADOW_SUPABASE",
  "NEX_OBJECT_BACKEND",
] as const;
