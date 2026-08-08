// NEX ObjectStorage · Dual-Write adapter
//
// Wraps two ObjectStorage backends: a PRIMARY (source of truth for reads)
// and a SECONDARY (parallel writes for migration verification). Same
// pattern as DualWriteStorage — see docs/NEX_INFRASTRUCTURE_RUNTIME.md §7 + §12.
//
// SEMANTICS
//   · Writes (put, delete): primary MUST succeed; secondary is fire-and-
//     forget with a rate-limited warn log. Secondary failures NEVER
//     break the caller.
//   · Reads (get, head, list, listVersions, presign): always primary.
//   · Parity comparison runs out-of-band (nex:verify-object-parity CLI,
//     when built) — not on every read.
//
// AFTER MIGRATION completes, remove this wrapper entirely — the promoted
// backend becomes the direct target of the registry.

import type {
  DeleteOptions,
  ListItem,
  ListOptions,
  ObjectMeta,
  ObjectStorage,
  ObjectStorageCapability,
  ObjectStorageCapabilities,
  PresignOptions,
  PutInput,
  PutResult,
  ReadResult,
} from "../object-types";

// Contract §14.4 · dual-write reports the INTERSECTION of primary and
// secondary capabilities · same rationale as DualWriteStorage.
function intersectObjectCaps(a: ObjectStorageCapabilities, b: ObjectStorageCapabilities): ObjectStorageCapabilities {
  const keys = Object.keys(a) as ObjectStorageCapability[];
  const out = {} as Record<ObjectStorageCapability, boolean>;
  for (const k of keys) out[k] = a[k] && b[k];
  return out;
}

export class DualWriteObjectStorage implements ObjectStorage {
  readonly name: string;
  readonly capabilities: ObjectStorageCapabilities;
  private secondaryFailures = 0;

  constructor(
    private readonly primary: ObjectStorage,
    private readonly secondary: ObjectStorage,
  ) {
    this.name = `dual-write-objects(${primary.name}→${secondary.name})`;
    this.capabilities = intersectObjectCaps(primary.capabilities, secondary.capabilities);
  }

  async put(bucket: string, key: string, input: PutInput): Promise<PutResult> {
    const result = await this.primary.put(bucket, key, input);
    // Secondary is fire-and-forget. Best-effort mirror.
    void this.secondary.put(bucket, key, input).catch((err) => this.recordFailure("put", err));
    return result;
  }

  async delete(bucket: string, key: string, options?: DeleteOptions): Promise<void> {
    await this.primary.delete(bucket, key, options);
    void this.secondary.delete(bucket, key, options).catch((err) => this.recordFailure("delete", err));
  }

  async get(bucket: string, key: string, versionId?: string): Promise<ReadResult | null> {
    return this.primary.get(bucket, key, versionId);
  }
  async head(bucket: string, key: string, versionId?: string): Promise<ObjectMeta | null> {
    return this.primary.head(bucket, key, versionId);
  }
  async presign(bucket: string, key: string, options: PresignOptions): Promise<string> {
    return this.primary.presign(bucket, key, options);
  }
  async list(bucket: string, prefix: string, options?: ListOptions): Promise<ListItem[]> {
    return this.primary.list(bucket, prefix, options);
  }
  async listVersions(bucket: string, key: string): Promise<ListItem[]> {
    return this.primary.listVersions(bucket, key);
  }

  getPrimary(): ObjectStorage { return this.primary; }
  getSecondary(): ObjectStorage { return this.secondary; }
  getSecondaryFailureCount(): number { return this.secondaryFailures; }

  private recordFailure(op: string, err: unknown): void {
    this.secondaryFailures += 1;
    const msg = err instanceof Error ? err.message : String(err);
    // Rate-limit noisy logs: first + every 100th.
    if (this.secondaryFailures === 1 || this.secondaryFailures % 100 === 0) {
      console.warn(
        `[dual-write-objects] secondary (${this.secondary.name}) ${op} failed [${this.secondaryFailures} total]: ${msg}`,
      );
    }
  }
}
