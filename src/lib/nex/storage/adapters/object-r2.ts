// NEX ObjectStorage · Cloudflare R2 adapter · Philip 2026-08-27.
//
// Implements the 7-method ObjectStorage contract against Cloudflare R2 via
// the S3-compatible SDK. Egress from R2 is $0 (Bandwidth Alliance) — see
// project_nex_free_infrastructure_principle_2026_08_27.
//
// ENV VARS (dev opens .env.local, prod uses secret manager):
//   R2_ACCOUNT_ID            — from Cloudflare dashboard
//   R2_ACCESS_KEY_ID         — from R2 API token
//   R2_SECRET_ACCESS_KEY     — from R2 API token
//   R2_BUCKET_MEDIA          — bucket name (default "nex-media")
//
// SEMANTICS
//   · Versioning is APP-LAYER: R2 doesn't support arbitrary version IDs, so
//     the adapter stores each version as its own key: `{key}#v={versionId}`,
//     and maintains a "current pointer" object at `{key}` that redirects to
//     the live version. This matches the filesystem adapter's semantics.
//   · Soft delete writes a delete-marker to the current pointer + preserves
//     historical versions until hard-delete or lifecycle policy removes them.
//   · Presign returns S3-compatible signed URLs — real, native, browser-usable.
//
// SAFETY
//   · Same key validation as filesystem adapter (path traversal, control chars)
//   · Content-hash computed application-side (deterministic across adapters)
//   · Metadata stored as R2 custom metadata (2KB limit per S3 spec)

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

// ── Key validation (same rules as filesystem adapter) ─────────────
const INVALID_SEGMENTS = new Set(["", ".", ".."]);
function validateKey(key: string): void {
  if (typeof key !== "string" || key.length === 0) throw new Error("[object-r2] key must be non-empty string");
  if (key.length > 1024) throw new Error("[object-r2] key too long (max 1024)");
  if (key.startsWith("/") || key.startsWith("\\")) throw new Error("[object-r2] key must be relative");
  if (/[\x00-\x1f]/.test(key)) throw new Error("[object-r2] key contains control chars");
  for (const seg of key.split(/[/\\]/)) {
    if (INVALID_SEGMENTS.has(seg)) throw new Error(`[object-r2] key segment invalid: "${seg}"`);
  }
}
function validateBucket(bucket: string): void {
  if (typeof bucket !== "string" || bucket.length === 0) throw new Error("[object-r2] bucket must be non-empty string");
  if (bucket.length > 63) throw new Error("[object-r2] bucket too long (max 63)");
  if (!/^[a-z0-9-]+$/.test(bucket)) throw new Error("[object-r2] bucket must match /^[a-z0-9-]+$/");
}
function nowIso(): string { return new Date().toISOString(); }
function newVersionId(): string { return `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`; }
function versionedKey(key: string, versionId: string): string { return `${key}#v=${versionId}`; }
function pointerKey(key: string): string { return `${key}#current`; }

// ── Metadata serialization (R2 user-metadata limit ~2KB) ─────────
function serializeMeta(meta: Partial<ObjectMeta>): Record<string, string> {
  const out: Record<string, string> = {};
  if (meta.version_id) out["nex-version"] = meta.version_id;
  if (meta.content_hash) out["nex-hash"] = meta.content_hash;
  if (meta.uploaded_at) out["nex-uploaded-at"] = meta.uploaded_at;
  if (meta.uploaded_by) out["nex-uploaded-by"] = meta.uploaded_by.slice(0, 200);
  if (meta.business_id) out["nex-business-id"] = meta.business_id.slice(0, 200);
  if (meta.source_ref) out["nex-source-ref"] = meta.source_ref.slice(0, 200);
  if (meta.is_delete_marker) out["nex-delete-marker"] = "1";
  if (meta.custom) {
    for (const [k, v] of Object.entries(meta.custom)) {
      out[`nex-cx-${k}`.toLowerCase()] = String(v).slice(0, 200);
    }
  }
  return out;
}

function parseMeta(raw: Record<string, string> | undefined, bucket: string, key: string, size: number, mime: string): ObjectMeta {
  const m = raw ?? {};
  const custom: Record<string, string> = {};
  for (const [k, v] of Object.entries(m)) {
    if (k.startsWith("nex-cx-")) custom[k.slice(7)] = v;
  }
  return {
    bucket,
    key,
    version_id: m["nex-version"] ?? "unknown",
    content_hash: m["nex-hash"] ?? "",
    size_bytes: size,
    mime_type: mime || "application/octet-stream",
    uploaded_at: m["nex-uploaded-at"] ?? new Date(0).toISOString(),
    uploaded_by: m["nex-uploaded-by"] ?? null,
    business_id: m["nex-business-id"] ?? null,
    source_ref: m["nex-source-ref"] ?? null,
    is_delete_marker: m["nex-delete-marker"] === "1",
    custom,
  };
}

// ── The adapter ───────────────────────────────────────────────────
export class R2ObjectStorage implements ObjectStorage {
  readonly name = "r2";
  readonly capabilities: ObjectStorageCapabilities = Object.freeze({
    nativePresign: true,          // real S3 signed URLs
    nativeVersioning: false,      // R2 versioning is not enabled by default · we emulate app-side
    imageTransforms: false,       // R2 alone doesn't transform · pair with Workers or sharp for that
    multipartUpload: false,       // reserved for a follow-up (currently single-shot put)
    presignPost: true,            // browser-direct PUT works via presign()
    lifecycleRules: true,         // R2 supports lifecycle policies (Philip configures in dashboard)
    serverSideEncryption: true,   // R2 encrypts at rest by default
    publicUrls: false,            // access via signed URLs; public URLs available if bucket public (opt-in)
  });

  private readonly client: S3Client;
  private readonly bucketOverride: string | null;

  constructor(opts?: { accountId?: string; accessKeyId?: string; secretAccessKey?: string; bucket?: string }) {
    const accountId = opts?.accountId ?? process.env.R2_ACCOUNT_ID;
    const accessKeyId = opts?.accessKeyId ?? process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = opts?.secretAccessKey ?? process.env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error("[object-r2] missing R2 credentials · set R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY");
    }
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    this.bucketOverride = opts?.bucket ?? process.env.R2_BUCKET_MEDIA ?? null;
  }

  private resolveBucket(bucket: string): string {
    return this.bucketOverride ?? bucket;
  }

  async put(bucket: string, key: string, input: PutInput): Promise<PutResult> {
    validateBucket(bucket); validateKey(key);
    if (!Buffer.isBuffer(input.body)) throw new Error("[object-r2] body must be Buffer");
    const b = this.resolveBucket(bucket);
    const versionId = newVersionId();
    const contentHash = createHash("sha256").update(input.body).digest("hex");
    const uploadedAt = nowIso();
    const mime = input.mime_type ?? "application/octet-stream";
    const meta = serializeMeta({
      version_id: versionId,
      content_hash: contentHash,
      uploaded_at: uploadedAt,
      uploaded_by: input.uploaded_by ?? null,
      business_id: input.business_id ?? null,
      source_ref: input.source_ref ?? null,
      is_delete_marker: false,
      custom: input.custom,
    });
    // Store the versioned copy (the immutable payload)
    await this.client.send(new PutObjectCommand({
      Bucket: b, Key: versionedKey(key, versionId),
      Body: input.body, ContentType: mime, Metadata: meta,
    }));
    // Update the current pointer to redirect readers to this version.
    // The pointer object is a small JSON blob that names the live version.
    const pointer = Buffer.from(JSON.stringify({ version_id: versionId, is_delete_marker: false, updated_at: uploadedAt }));
    await this.client.send(new PutObjectCommand({
      Bucket: b, Key: pointerKey(key),
      Body: pointer, ContentType: "application/json", Metadata: { "nex-pointer": "1" },
    }));
    return { bucket, key, version_id: versionId, content_hash: contentHash, size_bytes: input.body.length, mime_type: mime, uploaded_at: uploadedAt };
  }

  private async readPointer(bucket: string, key: string): Promise<{ version_id: string; is_delete_marker: boolean } | null> {
    try {
      const r = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: pointerKey(key) }));
      const bodyBytes = await streamToBuffer(r.Body);
      const parsed = JSON.parse(bodyBytes.toString("utf8"));
      return { version_id: String(parsed.version_id), is_delete_marker: Boolean(parsed.is_delete_marker) };
    } catch (e: unknown) {
      const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) return null;
      throw e;
    }
  }

  async get(bucket: string, key: string, versionId?: string): Promise<ReadResult | null> {
    validateBucket(bucket); validateKey(key);
    const b = this.resolveBucket(bucket);
    let v = versionId;
    if (!v) {
      const p = await this.readPointer(b, key);
      if (!p) return null;
      if (p.is_delete_marker) return null;
      v = p.version_id;
    }
    try {
      const r = await this.client.send(new GetObjectCommand({ Bucket: b, Key: versionedKey(key, v) }));
      const body = await streamToBuffer(r.Body);
      const meta = parseMeta(r.Metadata, bucket, key, body.length, r.ContentType ?? "application/octet-stream");
      return { meta, body };
    } catch (e: unknown) {
      const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) return null;
      throw e;
    }
  }

  async head(bucket: string, key: string, versionId?: string): Promise<ObjectMeta | null> {
    validateBucket(bucket); validateKey(key);
    const b = this.resolveBucket(bucket);
    let v = versionId;
    if (!v) {
      const p = await this.readPointer(b, key);
      if (!p) return null;
      v = p.version_id;
    }
    try {
      const r = await this.client.send(new HeadObjectCommand({ Bucket: b, Key: versionedKey(key, v) }));
      return parseMeta(r.Metadata, bucket, key, Number(r.ContentLength ?? 0), r.ContentType ?? "application/octet-stream");
    } catch (e: unknown) {
      const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) return null;
      throw e;
    }
  }

  async presign(bucket: string, key: string, options: PresignOptions): Promise<string> {
    validateBucket(bucket); validateKey(key);
    const b = this.resolveBucket(bucket);
    const expires = options.expires_seconds ?? 900;
    if (options.operation === "put") {
      // For direct-browser upload we sign against a NEW versioned key. The
      // caller (upload-url route) captures the returned version and later
      // calls a separate "commit" endpoint that updates the pointer + writes
      // the manifest. This keeps the put flow race-safe.
      const versionId = newVersionId();
      const cmd = new PutObjectCommand({
        Bucket: b, Key: versionedKey(key, versionId), ContentType: options.content_type,
      });
      const url = await getSignedUrl(this.client, cmd, { expiresIn: expires });
      // Encode the assigned versionId in the URL fragment so caller retrieves it.
      return `${url}#nex-version=${versionId}`;
    }
    // GET presign resolves to the current version at the time of signing.
    const p = await this.readPointer(b, key);
    if (!p || p.is_delete_marker) throw new Error(`[object-r2] cannot presign GET · no live version for ${bucket}/${key}`);
    const cmd = new GetObjectCommand({ Bucket: b, Key: versionedKey(key, p.version_id) });
    return await getSignedUrl(this.client, cmd, { expiresIn: expires });
  }

  async list(bucket: string, prefix: string, options?: ListOptions): Promise<ListItem[]> {
    validateBucket(bucket);
    const b = this.resolveBucket(bucket);
    const limit = Math.min(Math.max(options?.limit ?? 100, 1), 1000);
    // List only pointers, then resolve each to its current version's metadata.
    // R2 (S3) list is by prefix, no filter on custom metadata; we filter
    // client-side for "#current" suffix.
    const includeMarkers = options?.include_delete_markers === true;
    const cmd = new ListObjectsV2Command({ Bucket: b, Prefix: prefix, MaxKeys: 1000 });
    const r = await this.client.send(cmd);
    const items: ListItem[] = [];
    for (const obj of r.Contents ?? []) {
      const rawKey = obj.Key ?? "";
      if (!rawKey.endsWith("#current")) continue;
      const originalKey = rawKey.slice(0, -"#current".length);
      const p = await this.readPointer(b, originalKey);
      if (!p) continue;
      if (p.is_delete_marker && !includeMarkers) continue;
      const meta = await this.head(bucket, originalKey);
      if (!meta) continue;
      items.push({
        bucket, key: originalKey, version_id: meta.version_id,
        content_hash: meta.content_hash, size_bytes: meta.size_bytes,
        mime_type: meta.mime_type, uploaded_at: meta.uploaded_at,
        is_delete_marker: p.is_delete_marker,
      });
    }
    if (options?.since) {
      const cutoff = new Date(options.since).getTime();
      items.splice(0, items.length, ...items.filter((i) => new Date(i.uploaded_at).getTime() >= cutoff));
    }
    items.sort((a, b) => (options?.order_dir === "asc" ? 1 : -1) * (new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime()));
    return items.slice(0, limit);
  }

  async delete(bucket: string, key: string, options?: DeleteOptions): Promise<void> {
    validateBucket(bucket); validateKey(key);
    const b = this.resolveBucket(bucket);
    if (options?.hard) {
      // Hard delete: remove all versions + pointer. In this Stage 1 impl
      // hard delete only removes the CURRENT version + pointer. Historical
      // version cleanup is a lifecycle-rule concern.
      const p = await this.readPointer(b, key);
      if (p) {
        await this.client.send(new DeleteObjectCommand({ Bucket: b, Key: versionedKey(key, p.version_id) }));
      }
      await this.client.send(new DeleteObjectCommand({ Bucket: b, Key: pointerKey(key) }));
      return;
    }
    // Soft delete: overwrite pointer with a delete-marker.
    const marker = Buffer.from(JSON.stringify({ version_id: newVersionId(), is_delete_marker: true, updated_at: nowIso() }));
    await this.client.send(new PutObjectCommand({
      Bucket: b, Key: pointerKey(key), Body: marker,
      ContentType: "application/json", Metadata: { "nex-pointer": "1", "nex-delete-marker": "1" },
    }));
  }

  async listVersions(bucket: string, key: string): Promise<ListItem[]> {
    validateBucket(bucket); validateKey(key);
    const b = this.resolveBucket(bucket);
    // List all objects at `{key}#v=*` and enumerate.
    const cmd = new ListObjectsV2Command({ Bucket: b, Prefix: `${key}#v=`, MaxKeys: 1000 });
    const r = await this.client.send(cmd);
    const items: ListItem[] = [];
    for (const obj of r.Contents ?? []) {
      const rawKey = obj.Key ?? "";
      const marker = rawKey.indexOf("#v=");
      if (marker < 0) continue;
      const versionId = rawKey.slice(marker + 3);
      const head = await this.client.send(new HeadObjectCommand({ Bucket: b, Key: rawKey }));
      const meta = parseMeta(head.Metadata, bucket, key, Number(head.ContentLength ?? 0), head.ContentType ?? "application/octet-stream");
      items.push({
        bucket, key, version_id: versionId,
        content_hash: meta.content_hash, size_bytes: meta.size_bytes,
        mime_type: meta.mime_type, uploaded_at: meta.uploaded_at,
        is_delete_marker: meta.is_delete_marker,
      });
    }
    items.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
    return items;
  }
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);
  const s = stream as AsyncIterable<Uint8Array>;
  const chunks: Buffer[] = [];
  for await (const chunk of s) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
