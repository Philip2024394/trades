// NEX Data Platform · Dual-Write adapter
//
// Wraps two StorageBackends: a PRIMARY (source of truth for reads) and a
// SECONDARY (parallel writes for migration verification).
//
// SEMANTICS
//   · Writes: primary first (throws propagate). Secondary is fire-and-forget
//     with a warn log · secondary failures NEVER break the caller.
//   · Reads: always from primary. Parity endpoint compares both sides.
//
// This is the safe migration pattern: run both stores in parallel, let
// parity checks confirm they agree over a 5-7 day window, THEN flip
// primary + secondary in the registry to promote the new backend.
//
// After migration completes, remove this wrapper entirely — the promoted
// backend becomes the direct target.

import type { CollectionStats, QueryFilter, StorageBackend, StorageBackendCapability, StorageBackendCapabilities } from "../types";

// Contract §14.4 · dual-write reports the INTERSECTION of primary and
// secondary capabilities. A capability is claimed only if BOTH sides can
// honour it, so callers don't build reliance on features that vanish
// after cutover.
function intersectStorageCaps(a: StorageBackendCapabilities, b: StorageBackendCapabilities): StorageBackendCapabilities {
  const keys = Object.keys(a) as StorageBackendCapability[];
  const out = {} as Record<StorageBackendCapability, boolean>;
  for (const k of keys) out[k] = a[k] && b[k];
  return out;
}

export class DualWriteStorage implements StorageBackend {
  readonly name: string;
  readonly capabilities: StorageBackendCapabilities;

  private secondaryFailures = 0;

  constructor(
    private readonly primary: StorageBackend,
    private readonly secondary: StorageBackend,
  ) {
    this.name = `dual-write(${primary.name}→${secondary.name})`;
    this.capabilities = intersectStorageCaps(primary.capabilities, secondary.capabilities);
  }

  async save<T>(collection: string, record: T): Promise<void> {
    // Primary MUST succeed — if it throws, the caller sees the failure.
    await this.primary.save(collection, record);
    // Secondary is fire-and-forget · never blocks caller · never crashes it.
    void this.secondary.save(collection, record).catch((err) => {
      this.secondaryFailures += 1;
      const msg = err instanceof Error ? err.message : String(err);
      // Rate-limit noisy logs: warn on first + every 100th.
      if (this.secondaryFailures === 1 || this.secondaryFailures % 100 === 0) {
        console.warn(
          `[dual-write] secondary (${this.secondary.name}) save failed [${this.secondaryFailures} total]: ${msg}`,
        );
      }
    });
  }

  // Reads always go to the primary. Parity comparison lives in the
  // /api/nex/storage/parity endpoint, not on every read.
  async load<T>(collection: string, id: string): Promise<T | null> {
    return this.primary.load(collection, id);
  }
  async latestPerKey<T>(collection: string, keyField: string, filter?: QueryFilter): Promise<T[]> {
    return this.primary.latestPerKey(collection, keyField, filter);
  }
  async query<T>(collection: string, filter?: QueryFilter): Promise<T[]> {
    return this.primary.query(collection, filter);
  }
  async count(collection: string, filter?: QueryFilter): Promise<number> {
    return this.primary.count(collection, filter);
  }
  async stats(collection: string): Promise<CollectionStats> {
    return this.primary.stats(collection);
  }

  /** For the parity dashboard — the wrapper exposes both sides. */
  getPrimary(): StorageBackend { return this.primary; }
  getSecondary(): StorageBackend { return this.secondary; }
  getSecondaryFailureCount(): number { return this.secondaryFailures; }
}
