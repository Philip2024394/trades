// NEX ObjectStorage · filesystem reference adapter
//
// The canonical implementation. Every future adapter (Supabase Storage,
// Cloudflare R2, ImageKit, S3, MinIO) must match this behaviour or the
// abstraction has failed. Full contract at NEX_INFRASTRUCTURE_RUNTIME.md §12.
//
// LAYOUT
//   data/nex-objects/
//     {bucket}/
//       {key}.versions/
//         {version_id}          ← the raw bytes for that version
//         {version_id}.meta     ← metadata sidecar (JSON)
//       {key}.current           ← file containing the live version_id
//                                  (or "DELETED:{version_id}" after a soft delete)
//
// SAFETY
//   · Keys are validated · no path traversal · no absolute paths · no NUL
//   · Version IDs are timestamp-sortable so `listVersions` is O(dir-read)
//   · Metadata is written BEFORE the current pointer flips → readers
//     never see a version whose meta is still being written
//
// PRESIGN
//   Filesystem has no HTTP · this adapter returns a URL to an endpoint
//   that would serve the file (`/api/nex/objects/{bucket}/{key}?v=...`).
//   That endpoint is not yet routed · presign here is dev-honest, not
//   production-honest. Real adapters (R2, S3, ImageKit) return native URLs.

import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import type {
  DeleteOptions,
  ListItem,
  ListOptions,
  ObjectMeta,
  ObjectStorage,
  ObjectStorageCapabilities,
  PresignOptions,
  PutInput,
  PutResult,
  ReadResult,
} from "../object-types";

const ROOT = path.join(process.cwd(), "data", "nex-objects");

// ── Key validation ──────────────────────────────────────────────

const INVALID_SEGMENTS = new Set(["", ".", ".."]);

function validateKey(key: string): void {
  if (typeof key !== "string" || key.length === 0) throw new Error("[object-fs] key must be non-empty string");
  if (key.length > 1024) throw new Error("[object-fs] key too long (max 1024)");
  if (key.startsWith("/") || key.startsWith("\\")) throw new Error("[object-fs] key must be relative");
  if (/[\x00-\x1f]/.test(key)) throw new Error("[object-fs] key contains control chars");
  for (const seg of key.split(/[/\\]/)) {
    if (INVALID_SEGMENTS.has(seg)) throw new Error(`[object-fs] key segment invalid: "${seg}"`);
  }
}

function validateBucket(bucket: string): void {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(bucket)) {
    throw new Error(`[object-fs] bucket must be [a-z0-9][a-z0-9_-]{0,63}: "${bucket}"`);
  }
}

// ── Paths ───────────────────────────────────────────────────────

function bucketDir(bucket: string): string {
  return path.join(ROOT, bucket);
}
function versionsDir(bucket: string, key: string): string {
  return path.join(bucketDir(bucket), `${key}.versions`);
}
function versionBodyFile(bucket: string, key: string, versionId: string): string {
  return path.join(versionsDir(bucket, key), versionId);
}
function versionMetaFile(bucket: string, key: string, versionId: string): string {
  return path.join(versionsDir(bucket, key), `${versionId}.meta`);
}
function currentPointerFile(bucket: string, key: string): string {
  return path.join(bucketDir(bucket), `${key}.current`);
}

// ── Version id · timestamp-sortable ─────────────────────────────

function generateVersionId(): string {
  const now = new Date();
  // Character class order intentional: Tailwind JIT scans .ts files and
  // treats bracket-colon-value patterns as arbitrary utilities, poisoning
  // globals.css. Placing the hyphen at the end (literal) avoids that.
  const iso = now.toISOString().replace(/[.:\-]/g, "");
  // trailing 6-char hex to disambiguate concurrent puts within the same ms
  const rand = randomBytes(3).toString("hex");
  return `${iso}-${rand}`;
}

// ── Filesystem helpers ──────────────────────────────────────────

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readMeta(bucket: string, key: string, versionId: string): Promise<ObjectMeta | null> {
  const file = versionMetaFile(bucket, key, versionId);
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as ObjectMeta;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function readCurrentVersionId(bucket: string, key: string): Promise<{ versionId: string; deleted: boolean } | null> {
  const file = currentPointerFile(bucket, key);
  try {
    const raw = (await fs.readFile(file, "utf8")).trim();
    if (raw.startsWith("DELETED:")) return { versionId: raw.slice("DELETED:".length), deleted: true };
    return { versionId: raw, deleted: false };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

// ── Adapter ─────────────────────────────────────────────────────

export class FilesystemObjectStorage implements ObjectStorage {
  readonly name = "filesystem";

  // Contract §14 · declared capabilities · honest defaults for a local
  // reference adapter. Every capability that requires a real cloud
  // provider is false.
  readonly capabilities: ObjectStorageCapabilities = {
    nativePresign: false,        // returns dev URL to an endpoint that may not exist yet
    nativeVersioning: false,     // app-layer versioning via {key}.versions/ dir
    imageTransforms: false,      // no sharp / ffmpeg dependency here
    multipartUpload: false,      // single-shot writeFile
    presignPost: false,
    lifecycleRules: false,       // no hot/warm/glacier tiers on a laptop disk
    serverSideEncryption: false, // filesystem perms only
    publicUrls: false,
  };

  async put(bucket: string, key: string, input: PutInput): Promise<PutResult> {
    validateBucket(bucket);
    validateKey(key);

    const versionId = generateVersionId();
    const uploadedAt = new Date().toISOString();
    const contentHash = createHash("sha256").update(input.body).digest("hex");
    const sizeBytes = input.body.length;
    const mimeType = input.mime_type ?? "application/octet-stream";

    const meta: ObjectMeta = {
      bucket,
      key,
      version_id: versionId,
      content_hash: contentHash,
      size_bytes: sizeBytes,
      mime_type: mimeType,
      uploaded_at: uploadedAt,
      uploaded_by: input.uploaded_by ?? null,
      business_id: input.business_id ?? null,
      source_ref: input.source_ref ?? null,
      is_delete_marker: false,
      custom: input.custom ?? {},
    };

    // Write body + meta BEFORE flipping the current pointer.
    await ensureDir(versionsDir(bucket, key));
    await fs.writeFile(versionBodyFile(bucket, key, versionId), input.body);
    await fs.writeFile(versionMetaFile(bucket, key, versionId), JSON.stringify(meta, null, 2), "utf8");
    // Atomic pointer flip via rename.
    const tmp = `${currentPointerFile(bucket, key)}.tmp`;
    await fs.writeFile(tmp, versionId, "utf8");
    await fs.rename(tmp, currentPointerFile(bucket, key));

    return {
      bucket,
      key,
      version_id: versionId,
      content_hash: contentHash,
      size_bytes: sizeBytes,
      mime_type: mimeType,
      uploaded_at: uploadedAt,
    };
  }

  async get(bucket: string, key: string, versionId?: string): Promise<ReadResult | null> {
    validateBucket(bucket);
    validateKey(key);

    let targetVersion = versionId;
    if (!targetVersion) {
      const cur = await readCurrentVersionId(bucket, key);
      if (!cur) return null;
      if (cur.deleted) return null;      // soft-deleted · use listVersions to recover
      targetVersion = cur.versionId;
    }
    const meta = await readMeta(bucket, key, targetVersion);
    if (!meta || meta.is_delete_marker) return null;

    const body = await fs.readFile(versionBodyFile(bucket, key, targetVersion));
    return { meta, body };
  }

  async head(bucket: string, key: string, versionId?: string): Promise<ObjectMeta | null> {
    validateBucket(bucket);
    validateKey(key);

    let targetVersion = versionId;
    if (!targetVersion) {
      const cur = await readCurrentVersionId(bucket, key);
      if (!cur) return null;
      if (cur.deleted) return null;
      targetVersion = cur.versionId;
    }
    return readMeta(bucket, key, targetVersion);
  }

  async presign(bucket: string, key: string, options: PresignOptions): Promise<string> {
    validateBucket(bucket);
    validateKey(key);
    // Dev-honest URL to an endpoint that MAY not yet be routed. Real
    // production adapters return native provider URLs.
    const expires = Math.floor(Date.now() / 1000) + (options.expires_seconds ?? 900);
    const op = options.operation;
    const params = new URLSearchParams({ op, expires: String(expires) });
    if (options.content_type) params.set("content_type", options.content_type);
    return `/api/nex/objects/${encodeURIComponent(bucket)}/${encodeURI(key)}?${params.toString()}`;
  }

  async list(bucket: string, prefix: string, options?: ListOptions): Promise<ListItem[]> {
    validateBucket(bucket);
    const limit = Math.min(Math.max(1, options?.limit ?? 100), 10_000);
    const orderDir = options?.order_dir ?? "desc";
    const since = options?.since;
    const includeDeleteMarkers = options?.include_delete_markers ?? false;

    const dir = bucketDir(bucket);
    if (!existsSync(dir)) return [];

    const items: ListItem[] = [];
    await walkKeys(dir, dir, async (relKey) => {
      if (prefix && !relKey.startsWith(prefix)) return;
      const cur = await readCurrentVersionId(bucket, relKey);
      if (!cur) return;
      if (cur.deleted && !includeDeleteMarkers) return;
      const meta = await readMeta(bucket, relKey, cur.versionId);
      if (!meta) return;
      if (since && meta.uploaded_at < since) return;
      items.push(metaToItem(meta));
    });

    items.sort((a, b) => (orderDir === "asc"
      ? a.uploaded_at.localeCompare(b.uploaded_at)
      : b.uploaded_at.localeCompare(a.uploaded_at)));
    return items.slice(0, limit);
  }

  async delete(bucket: string, key: string, options?: DeleteOptions): Promise<void> {
    validateBucket(bucket);
    validateKey(key);
    const hard = options?.hard ?? false;

    if (hard) {
      if (options?.version_id) {
        await safeUnlink(versionBodyFile(bucket, key, options.version_id));
        await safeUnlink(versionMetaFile(bucket, key, options.version_id));
        return;
      }
      // Whole-key hard delete removes ALL versions + pointer.
      await fs.rm(versionsDir(bucket, key), { recursive: true, force: true });
      await safeUnlink(currentPointerFile(bucket, key));
      return;
    }

    // Soft delete · write a delete-marker version and flip the pointer.
    const cur = await readCurrentVersionId(bucket, key);
    if (!cur || cur.deleted) return;      // idempotent · nothing live to delete

    const versionId = generateVersionId();
    const uploadedAt = new Date().toISOString();
    const meta: ObjectMeta = {
      bucket, key,
      version_id: versionId,
      content_hash: "",
      size_bytes: 0,
      mime_type: "application/x-delete-marker",
      uploaded_at: uploadedAt,
      uploaded_by: null,
      business_id: null,
      source_ref: null,
      is_delete_marker: true,
      custom: {},
    };
    await ensureDir(versionsDir(bucket, key));
    await fs.writeFile(versionBodyFile(bucket, key, versionId), Buffer.alloc(0));
    await fs.writeFile(versionMetaFile(bucket, key, versionId), JSON.stringify(meta, null, 2), "utf8");
    const tmp = `${currentPointerFile(bucket, key)}.tmp`;
    await fs.writeFile(tmp, `DELETED:${versionId}`, "utf8");
    await fs.rename(tmp, currentPointerFile(bucket, key));
  }

  async listVersions(bucket: string, key: string): Promise<ListItem[]> {
    validateBucket(bucket);
    validateKey(key);
    const dir = versionsDir(bucket, key);
    if (!existsSync(dir)) return [];
    const entries = await fs.readdir(dir);
    const items: ListItem[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".meta")) continue;
      const versionId = entry.slice(0, -".meta".length);
      const meta = await readMeta(bucket, key, versionId);
      if (meta) items.push(metaToItem(meta));
    }
    items.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
    return items;
  }
}

function metaToItem(meta: ObjectMeta): ListItem {
  return {
    bucket: meta.bucket,
    key: meta.key,
    version_id: meta.version_id,
    content_hash: meta.content_hash,
    size_bytes: meta.size_bytes,
    mime_type: meta.mime_type,
    uploaded_at: meta.uploaded_at,
    is_delete_marker: meta.is_delete_marker,
  };
}

async function safeUnlink(file: string): Promise<void> {
  try { await fs.unlink(file); }
  catch (err) { if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err; }
}

// Walk the bucket directory, reporting relative-key strings for each
// `{key}.current` file found. Handles arbitrarily-nested keys.
async function walkKeys(root: string, dir: string, onKey: (relKey: string) => Promise<void>): Promise<void> {
  let entries: string[];
  try { entries = await fs.readdir(dir); }
  catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return; else throw err; }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    let st;
    try { st = await fs.stat(full); } catch { continue; }
    if (st.isDirectory()) {
      // Skip {key}.versions dirs — they're internal storage, not enumerable keys.
      if (entry.endsWith(".versions")) continue;
      await walkKeys(root, full, onKey);
    } else if (entry.endsWith(".current")) {
      const relPointer = path.relative(root, full);
      const relKey = relPointer.slice(0, -".current".length).split(path.sep).join("/");
      await onKey(relKey);
    }
  }
}
