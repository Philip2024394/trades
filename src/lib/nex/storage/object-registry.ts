// NEX ObjectStorage · registry
//
// Single entry point that every service uses to reach the object store.
// Backend selection driven by `NEX_OBJECT_BACKEND` env var.
//
// Values:
//   "filesystem" · default · uses FilesystemObjectStorage (reference)
//   "dual-write" · primary=filesystem, secondary=(TBD real adapter),
//                  writes to both, reads from primary
//
// Roadmap · NOT yet implemented in this turn (Contract §12.4):
//   "supabase" · wraps Supabase Storage
//   "r2"       · Cloudflare R2 via S3-compatible SDK
//   "imagekit" · ImageKit (asset-first with native transforms)
//   "s3"       · AWS S3 or S3-compatible
//   "minio"    · self-hosted / on-prem
//
// The registry ALSO composes the manifest-writing decorator: every put()
// through `getObjectStorage()` automatically writes a `nex.object_manifest`
// row via the record StorageBackend. Services never manage manifest rows
// directly. See Contract §12.2 principle 6.

import { randomUUID } from "node:crypto";
import { FilesystemObjectStorage } from "./adapters/object-filesystem";
import { DualWriteObjectStorage } from "./adapters/object-dual-write";
// Phase 3a · first production adapter · stores binaries in
// nex.object_blobs on our NEX Postgres. Cross-machine transparent.
import { PostgresObjectStorage } from "./adapters/object-postgres";
import { getStorage } from "./registry";
import { COLLECTIONS } from "./types";
import type {
  DeleteOptions,
  ListItem,
  ListOptions,
  ObjectMeta,
  ObjectStorage,
  ObjectStorageCapabilities,
  ObjectStorageCapability,
  PresignOptions,
  PutInput,
  PutResult,
  ReadResult,
} from "./object-types";
import type { Policy, PreferenceName, StorageBackend } from "./types";

let cached: ObjectStorage | null = null;

export function getObjectStorage(): ObjectStorage {
  if (cached) return cached;
  const kind = (process.env.NEX_OBJECT_BACKEND ?? "filesystem").toLowerCase();
  const inner = buildRaw(kind);
  cached = new ManifestWritingObjectStorage(inner, getStorage());
  return cached;
}

/** Test-only: reset the cached backend so a different one can be selected. */
export function _resetObjectStorageForTests(): void {
  cached = null;
}

/** For parity dashboards · exposes both sides during dual-write. */
export function getObjectStorageForParity(): { primary: ObjectStorage; secondary: ObjectStorage | null } {
  const store = getObjectStorage();
  const inner = store instanceof ManifestWritingObjectStorage ? store.getInner() : store;
  if (inner instanceof DualWriteObjectStorage) {
    return { primary: inner.getPrimary(), secondary: inner.getSecondary() };
  }
  return { primary: inner, secondary: null };
}

/**
 * Capability-driven selection · Contract §14.3 + §14.6.
 *
 * `selectObjectStorage({ requires: ["imageTransforms"], prefer: ["lowCost"] })`
 * is how a thumbnail worker asks for a store — never
 * `NEX_OBJECT_BACKEND === "imagekit"`. Today with one production adapter
 * the helper returns the default if it satisfies `requires`, throws
 * otherwise. `prefer` is accepted but not acted on (no ties to break).
 * When multiple adapters register (roadmap: R2 + ImageKit + Supabase
 * Storage), the selector adds a sort-by-preference step. Application
 * code that already writes `prefer` starts benefiting automatically.
 */
export function selectObjectStorage(req?: {
  requires?: ObjectStorageCapability[];
  /** Soft ranking dimensions · applied when multiple capable adapters exist. See Contract §14.6. */
  prefer?: PreferenceName[];
  /** Hard business/legal/compliance constraints · reserved, currently no-op. See Contract §14.7. */
  policy?: Policy;
}): ObjectStorage {
  const store = getObjectStorage();
  const requires = req?.requires ?? [];
  if (requires.length === 0) return store;
  const missing = requires.filter((cap) => !store.capabilities[cap]);
  if (missing.length > 0) {
    throw new Error(
      `[nex-object] active backend (${store.name}) does not support required capabilities: ${missing.join(", ")} · roadmap adapters (r2/supabase/imagekit/s3/minio) will cover most gaps · see Contract §12.4`,
    );
  }
  // `prefer` intentionally unused today · single adapter, no ties to break.
  // `policy` intentionally unused today · reserved for when adapters declare
  // region / residency / compliance / classification metadata.
  // Both activate automatically when multi-adapter routing lands · see §14.6/§14.7.
  return store;
}

function buildRaw(kind: string): ObjectStorage {
  switch (kind) {
    case "filesystem":
      return new FilesystemObjectStorage();
    case "dual-write": {
      // Until a second production adapter lands, dual-write requires the
      // caller to plug the secondary in manually. Reject with a clear
      // message so no one accidentally runs dual-write with a single-copy
      // filesystem + filesystem setup.
      throw new Error(
        "[nex-object] dual-write requires a real secondary adapter (r2/supabase/imagekit/s3/minio) · none are wired yet in this turn · see Contract §12.4 roadmap",
      );
    }
    // Phase 3a · Postgres-backed adapter · first production backend.
    // Cross-machine transparent · stores binaries in nex.object_blobs.
    case "postgres":
      return new PostgresObjectStorage();
    // Roadmap adapters — throw with clear guidance until implemented.
    case "supabase":
    case "r2":
    case "imagekit":
    case "s3":
    case "minio":
      throw new Error(
        `[nex-object] backend "${kind}" is on the Contract §12.4 roadmap but not yet implemented · use "filesystem" or "postgres" until it ships`,
      );
    default:
      throw new Error(`[nex-object] unknown backend: ${kind}`);
  }
}

// ── Manifest-writing decorator ───────────────────────────────────
//
// Wraps any ObjectStorage and automatically writes a manifest row after
// every put/delete via the record StorageBackend. Services see one
// interface; both sides stay in sync without caller ceremony.

class ManifestWritingObjectStorage implements ObjectStorage {
  readonly name: string;
  // Contract §14.4 · wrappers pass capabilities through. Writing a
  // manifest row doesn't change what the underlying store can do.
  readonly capabilities: ObjectStorageCapabilities;

  constructor(
    private readonly inner: ObjectStorage,
    private readonly storage: StorageBackend,
  ) {
    this.name = `manifest(${inner.name})`;
    this.capabilities = inner.capabilities;
  }

  getInner(): ObjectStorage { return this.inner; }

  async put(bucket: string, key: string, input: PutInput): Promise<PutResult> {
    const result = await this.inner.put(bucket, key, input);
    const manifestRow = {
      manifest_id: randomUUID(),
      bucket: result.bucket,
      key: result.key,
      version_id: result.version_id,
      content_hash: result.content_hash,
      size_bytes: result.size_bytes,
      mime_type: result.mime_type,
      uploaded_at: result.uploaded_at,
      uploaded_by: input.uploaded_by ?? null,
      business_id: input.business_id ?? null,
      source_ref: input.source_ref ?? null,
      is_delete_marker: false,
      custom: input.custom ?? {},
    };
    // Fire-and-forget manifest write · never blocks the caller and never
    // crashes if the record backend is temporarily unavailable. The
    // object itself is the source of truth; the manifest is the index.
    void this.storage.save(COLLECTIONS.object_manifest, manifestRow).catch((err) => {
      console.warn(`[nex-object] manifest save failed for ${bucket}/${key}:`, err instanceof Error ? err.message : err);
    });
    return result;
  }

  async delete(bucket: string, key: string, options?: DeleteOptions): Promise<void> {
    await this.inner.delete(bucket, key, options);
    if (options?.hard) return;   // hard-delete has no manifest row; caller can query listVersions if audit is needed
    const manifestRow = {
      manifest_id: randomUUID(),
      bucket,
      key,
      version_id: `deleted-${Date.now()}`,
      content_hash: "",
      size_bytes: 0,
      mime_type: "application/x-delete-marker",
      uploaded_at: new Date().toISOString(),
      uploaded_by: null,
      business_id: null,
      source_ref: null,
      is_delete_marker: true,
      custom: {},
    };
    void this.storage.save(COLLECTIONS.object_manifest, manifestRow).catch((err) => {
      console.warn(`[nex-object] manifest save failed for delete ${bucket}/${key}:`, err instanceof Error ? err.message : err);
    });
  }

  // Reads delegate straight through.
  async get(bucket: string, key: string, versionId?: string): Promise<ReadResult | null> {
    return this.inner.get(bucket, key, versionId);
  }
  async head(bucket: string, key: string, versionId?: string): Promise<ObjectMeta | null> {
    return this.inner.head(bucket, key, versionId);
  }
  async presign(bucket: string, key: string, options: PresignOptions): Promise<string> {
    return this.inner.presign(bucket, key, options);
  }
  async list(bucket: string, prefix: string, options?: ListOptions): Promise<ListItem[]> {
    return this.inner.list(bucket, prefix, options);
  }
  async listVersions(bucket: string, key: string): Promise<ListItem[]> {
    return this.inner.listVersions(bucket, key);
  }
}
