// NEX Storage · registry
//
// Single entry point that every service uses to reach storage. Backend
// selection driven by `NEX_STORAGE_BACKEND` env var.
//
// Values:
//   "jsonl"      · default · uses JsonlStorage (per-service legacy paths)
//   "postgres"   · uses PostgresStorage · requires NEX_POSTGRES_URL
//   "dual-write" · primary=jsonl, secondary=postgres · writes to both,
//                  reads from jsonl · parity dashboard confirms equivalence
//
// Zero service imports a concrete adapter. Always `getStorage()`.

import { JsonlStorage } from "./adapters/jsonl";
import { PostgresStorage } from "./adapters/postgres";
import { DualWriteStorage } from "./adapters/dual-write";
import type { Policy, PreferenceName, StorageBackend, StorageBackendCapability } from "./types";

let cached: StorageBackend | null = null;

export function getStorage(): StorageBackend {
  if (cached) return cached;
  const kind = (process.env.NEX_STORAGE_BACKEND ?? "jsonl").toLowerCase();
  cached = build(kind);
  return cached;
}

function build(kind: string): StorageBackend {
  switch (kind) {
    case "jsonl":
      return new JsonlStorage();
    case "postgres":
      // Fail fast if the env var isn't there — better than mysteriously
      // writing nowhere.
      if (!process.env.NEX_POSTGRES_URL) {
        throw new Error("[nex-storage] NEX_STORAGE_BACKEND=postgres but NEX_POSTGRES_URL is not set");
      }
      return new PostgresStorage();
    case "dual-write":
      if (!process.env.NEX_POSTGRES_URL) {
        throw new Error("[nex-storage] NEX_STORAGE_BACKEND=dual-write but NEX_POSTGRES_URL is not set (secondary requires it)");
      }
      return new DualWriteStorage(new JsonlStorage(), new PostgresStorage());
    default:
      throw new Error(`[nex-storage] unknown backend: ${kind}`);
  }
}

/** Test-only: reset the cached backend so a different one can be selected. */
export function _resetStorageForTests(): void {
  cached = null;
}

/**
 * Returns "which backends are we actually writing to?" for the parity
 * dashboard. During dual-write mode this exposes both sides so the parity
 * check can call each directly.
 */
export function getStorageForParity(): { primary: StorageBackend; secondary: StorageBackend | null } {
  const store = getStorage();
  if (store instanceof DualWriteStorage) {
    return { primary: store.getPrimary(), secondary: store.getSecondary() };
  }
  return { primary: store, secondary: null };
}

/**
 * Capability-driven selection · Contract §14.3 + §14.6.
 *
 * Application code asks *"give me a store that supports X, ideally with
 * Y traits"*, never *"give me the postgres store"*. Today with one
 * production adapter, the helper returns the default if it satisfies
 * `requires`, throws otherwise. `prefer` is accepted but not acted on
 * (nothing to sort with one adapter). When multiple adapters register,
 * the selector adds a sort-by-preference step — application code that
 * already passes `prefer` starts benefiting automatically with no
 * change. That's the design intent.
 */
export function selectStorage(req?: {
  requires?: StorageBackendCapability[];
  /** Soft ranking dimensions · applied when multiple capable adapters exist. See Contract §14.6. */
  prefer?: PreferenceName[];
  /** Hard business/legal/compliance constraints · reserved, currently no-op. See Contract §14.7. */
  policy?: Policy;
}): StorageBackend {
  const store = getStorage();
  const requires = req?.requires ?? [];
  if (requires.length === 0) return store;
  const missing = requires.filter((cap) => !store.capabilities[cap]);
  if (missing.length > 0) {
    throw new Error(
      `[nex-storage] active backend (${store.name}) does not support required capabilities: ${missing.join(", ")} · either enable dual-write with a capable secondary or wait for a supporting adapter to register`,
    );
  }
  // `prefer` intentionally unused today · single adapter, no ties to break.
  // `policy` intentionally unused today · reserved for when adapters declare
  // policy-relevant metadata (region, residency, compliance, classification).
  // Both activate automatically when multi-adapter routing lands · see §14.6/§14.7.
  return store;
}
