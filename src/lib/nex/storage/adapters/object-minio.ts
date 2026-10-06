// NEX ObjectStorage · MinIO adapter · sealed 2026-10-06 (Phase 1.0).
//
// Implements the 7-method ObjectStorage contract against a self-hosted
// MinIO server via the S3-compatible SDK (same client as the R2 adapter).
// MinIO is NEX-owned infrastructure (runs on-prem · zero third-party
// dependency per the sealed free-infrastructure principle) and is the
// default home for user-uploaded videos.
//
// ENV VARS (dev opens .env.local, prod uses secret manager):
//   NEX_MINIO_ENDPOINT       — e.g. "http://localhost:9000" (default)
//   NEX_MINIO_ACCESS_KEY     — e.g. "nex_admin"
//   NEX_MINIO_SECRET_KEY     — matching MINIO_ROOT_PASSWORD
//   NEX_MINIO_REGION         — default "us-east-1" (MinIO is region-agnostic
//                              but the SDK requires one)
//   NEX_MINIO_BUCKET_OVERRIDE — optional · forces every call onto one
//                              bucket (useful for tests). Defaults to
//                              honouring the caller-supplied bucket.
//
// SEMANTICS
//   · Versioning is APP-LAYER (identical to R2 adapter): each put writes
//     `{key}#v={versionId}` + updates a tiny `{key}#current` pointer JSON.
//     This keeps the semantics byte-equivalent to filesystem + R2, so
//     dual-write replication across adapters remains possible.
//   · Soft delete overwrites the pointer with a delete-marker JSON. Hard
//     delete removes the latest version object + pointer. Historical
//     version pruning is a lifecycle concern (manual on MinIO today).
//   · presign() returns a short-lived S3-signed URL exactly as R2 does.
//
// SAFETY
//   · Same key / bucket validation as the R2 and filesystem adapters.
//   · Content hash is computed application-side (deterministic across
//     adapters · immutable-by-content keys stay identical regardless of
//     backend).
//   · Metadata lives in S3 user-metadata (2 KB limit per S3 spec);
//     callers that need more go in `custom` and overflow-safe truncate.
//
// COMPATIBILITY
//   · forcePathStyle: true · MinIO uses path-style addressing by default.
//   · Error handling converts "NoSuchKey" / 404s into `null` returns
//     exactly like R2 so callers never see raw AWS SDK exceptions.

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
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

// ── Key validation (same rules as R2 / filesystem adapters) ────────
const INVALID_SEGMENTS = new Set(["", ".", ".."]);
function validateKey(key: string): void {
  if (typeof key !== "string" || key.length === 0)
    throw new Error("[object-minio] key must be non-empty string");
  if (key.length > 1024) throw new Error("[object-minio] key too long (max 1024)");
  if (key.startsWith("/") || key.startsWith("\\"))
    throw new Error("[object-minio] key must be relative");
  if (/[\x00-\x1f]/.test(key))
    throw new Error("[object-minio] key contains control chars");
  for (const seg of key.split(/[/\\]/)) {
    if (INVALID_SEGMENTS.has(seg))
      throw new Error(`[object-minio] key segment invalid: "${seg}"`);
  }
}
function validateBucket(bucket: string): void {
  if (typeof bucket !== "string" || bucket.length === 0)
    throw new Error("[object-minio] bucket must be non-empty string");
  if (bucket.length > 63) throw new Error("[object-minio] bucket too long (max 63)");
  if (!/^[a-z0-9-]+$/.test(bucket))
    throw new Error("[object-minio] bucket must match /^[a-z0-9-]+$/");
}
function nowIso(): string {
  return new Date().toISOString();
}
function newVersionId(): string {
  return `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}
function versionedKey(key: string, versionId: string): string {
  return `${key}#v=${versionId}`;
}
function pointerKey(key: string): string {
  return `${key}#current`;
}

// ── Metadata serialization (S3 user-metadata limit ~2 KB) ──────────
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

function parseMeta(
  raw: Record<string, string> | undefined,
  bucket: string,
  key: string,
  size: number,
  mime: string,
): ObjectMeta {
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

// ── The adapter ────────────────────────────────────────────────────
export interface MinioAdapterOpts {
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  bucket?: string;
}

export class MinioObjectStorage implements ObjectStorage {
  readonly name = "minio";
  readonly capabilities: ObjectStorageCapabilities = Object.freeze({
    nativePresign: true, // real S3 signed URLs via @aws-sdk/s3-request-presigner
    nativeVersioning: false, // emulated app-side (parity with R2 + filesystem)
    imageTransforms: false, // MinIO alone doesn't transform
    multipartUpload: false, // reserved for a follow-up (currently single-shot put)
    presignPost: true, // browser-direct PUT via presign()
    lifecycleRules: false, // MinIO supports lifecycle but we don't wire it here
    serverSideEncryption: false, // MinIO can SSE-S3 but not configured in this adapter
    publicUrls: false, // reads go through signed URLs
  });

  private readonly client: S3Client;
  private readonly bucketOverride: string | null;
  private readonly endpoint: string;

  constructor(opts?: MinioAdapterOpts) {
    const endpoint =
      opts?.endpoint ?? process.env.NEX_MINIO_ENDPOINT ?? "http://localhost:9000";
    const accessKeyId = opts?.accessKeyId ?? process.env.NEX_MINIO_ACCESS_KEY;
    const secretAccessKey =
      opts?.secretAccessKey ?? process.env.NEX_MINIO_SECRET_KEY;
    const region = opts?.region ?? process.env.NEX_MINIO_REGION ?? "us-east-1";
    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        "[object-minio] missing MinIO credentials · set NEX_MINIO_ACCESS_KEY + NEX_MINIO_SECRET_KEY (see deploy/minio/README.md)",
      );
    }
    this.endpoint = endpoint;
    this.client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      // MinIO uses path-style addressing by default. Without this flag the
      // SDK sends bucket.endpoint-style requests which MinIO rejects.
      forcePathStyle: true,
    });
    this.bucketOverride =
      opts?.bucket ?? process.env.NEX_MINIO_BUCKET_OVERRIDE ?? null;
  }

  private resolveBucket(bucket: string): string {
    return this.bucketOverride ?? bucket;
  }

  async put(bucket: string, key: string, input: PutInput): Promise<PutResult> {
    validateBucket(bucket);
    validateKey(key);
    if (!Buffer.isBuffer(input.body))
      throw new Error("[object-minio] body must be Buffer");
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
    await this.client.send(
      new PutObjectCommand({
        Bucket: b,
        Key: versionedKey(key, versionId),
        Body: input.body,
        ContentType: mime,
        Metadata: meta,
      }),
    );
    const pointer = Buffer.from(
      JSON.stringify({
        version_id: versionId,
        is_delete_marker: false,
        updated_at: uploadedAt,
      }),
    );
    await this.client.send(
      new PutObjectCommand({
        Bucket: b,
        Key: pointerKey(key),
        Body: pointer,
        ContentType: "application/json",
        Metadata: { "nex-pointer": "1" },
      }),
    );
    return {
      bucket,
      key,
      version_id: versionId,
      content_hash: contentHash,
      size_bytes: input.body.length,
      mime_type: mime,
      uploaded_at: uploadedAt,
    };
  }

  private async readPointer(
    bucket: string,
    key: string,
  ): Promise<{ version_id: string; is_delete_marker: boolean } | null> {
    try {
      const r = await this.client.send(
        new GetObjectCommand({ Bucket: bucket, Key: pointerKey(key) }),
      );
      const bodyBytes = await streamToBuffer(r.Body);
      const parsed = JSON.parse(bodyBytes.toString("utf8"));
      return {
        version_id: String(parsed.version_id),
        is_delete_marker: Boolean(parsed.is_delete_marker),
      };
    } catch (e: unknown) {
      const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404)
        return null;
      throw e;
    }
  }

  async get(
    bucket: string,
    key: string,
    versionId?: string,
  ): Promise<ReadResult | null> {
    validateBucket(bucket);
    validateKey(key);
    const b = this.resolveBucket(bucket);
    let v = versionId;
    if (!v) {
      const p = await this.readPointer(b, key);
      if (!p) return null;
      if (p.is_delete_marker) return null;
      v = p.version_id;
    }
    try {
      const r = await this.client.send(
        new GetObjectCommand({ Bucket: b, Key: versionedKey(key, v) }),
      );
      const body = await streamToBuffer(r.Body);
      const meta = parseMeta(
        r.Metadata,
        bucket,
        key,
        body.length,
        r.ContentType ?? "application/octet-stream",
      );
      return { meta, body };
    } catch (e: unknown) {
      const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404)
        return null;
      throw e;
    }
  }

  async head(
    bucket: string,
    key: string,
    versionId?: string,
  ): Promise<ObjectMeta | null> {
    validateBucket(bucket);
    validateKey(key);
    const b = this.resolveBucket(bucket);
    let v = versionId;
    if (!v) {
      const p = await this.readPointer(b, key);
      if (!p) return null;
      v = p.version_id;
    }
    try {
      const r = await this.client.send(
        new HeadObjectCommand({ Bucket: b, Key: versionedKey(key, v) }),
      );
      return parseMeta(
        r.Metadata,
        bucket,
        key,
        Number(r.ContentLength ?? 0),
        r.ContentType ?? "application/octet-stream",
      );
    } catch (e: unknown) {
      const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404)
        return null;
      throw e;
    }
  }

  async presign(
    bucket: string,
    key: string,
    options: PresignOptions,
  ): Promise<string> {
    validateBucket(bucket);
    validateKey(key);
    const b = this.resolveBucket(bucket);
    const expires = options.expires_seconds ?? 900;
    if (options.operation === "put") {
      const versionId = newVersionId();
      const cmd = new PutObjectCommand({
        Bucket: b,
        Key: versionedKey(key, versionId),
        ContentType: options.content_type,
      });
      const url = await getSignedUrl(this.client, cmd, { expiresIn: expires });
      return `${url}#nex-version=${versionId}`;
    }
    const p = await this.readPointer(b, key);
    if (!p || p.is_delete_marker)
      throw new Error(
        `[object-minio] cannot presign GET · no live version for ${bucket}/${key}`,
      );
    const cmd = new GetObjectCommand({
      Bucket: b,
      Key: versionedKey(key, p.version_id),
    });
    return await getSignedUrl(this.client, cmd, { expiresIn: expires });
  }

  async list(
    bucket: string,
    prefix: string,
    options?: ListOptions,
  ): Promise<ListItem[]> {
    validateBucket(bucket);
    const b = this.resolveBucket(bucket);
    const limit = Math.min(Math.max(options?.limit ?? 100, 1), 1000);
    const includeMarkers = options?.include_delete_markers === true;
    const cmd = new ListObjectsV2Command({
      Bucket: b,
      Prefix: prefix,
      MaxKeys: 1000,
    });
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
        bucket,
        key: originalKey,
        version_id: meta.version_id,
        content_hash: meta.content_hash,
        size_bytes: meta.size_bytes,
        mime_type: meta.mime_type,
        uploaded_at: meta.uploaded_at,
        is_delete_marker: p.is_delete_marker,
      });
    }
    if (options?.since) {
      const cutoff = new Date(options.since).getTime();
      items.splice(
        0,
        items.length,
        ...items.filter((i) => new Date(i.uploaded_at).getTime() >= cutoff),
      );
    }
    items.sort(
      (a, b) =>
        (options?.order_dir === "asc" ? 1 : -1) *
        (new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime()),
    );
    return items.slice(0, limit);
  }

  async delete(
    bucket: string,
    key: string,
    options?: DeleteOptions,
  ): Promise<void> {
    validateBucket(bucket);
    validateKey(key);
    const b = this.resolveBucket(bucket);
    if (options?.hard) {
      const p = await this.readPointer(b, key);
      if (p) {
        await this.client.send(
          new DeleteObjectCommand({
            Bucket: b,
            Key: versionedKey(key, p.version_id),
          }),
        );
      }
      await this.client.send(
        new DeleteObjectCommand({ Bucket: b, Key: pointerKey(key) }),
      );
      return;
    }
    const marker = Buffer.from(
      JSON.stringify({
        version_id: newVersionId(),
        is_delete_marker: true,
        updated_at: nowIso(),
      }),
    );
    await this.client.send(
      new PutObjectCommand({
        Bucket: b,
        Key: pointerKey(key),
        Body: marker,
        ContentType: "application/json",
        Metadata: { "nex-pointer": "1", "nex-delete-marker": "1" },
      }),
    );
  }

  async listVersions(bucket: string, key: string): Promise<ListItem[]> {
    validateBucket(bucket);
    validateKey(key);
    const b = this.resolveBucket(bucket);
    const cmd = new ListObjectsV2Command({
      Bucket: b,
      Prefix: `${key}#v=`,
      MaxKeys: 1000,
    });
    const r = await this.client.send(cmd);
    const items: ListItem[] = [];
    for (const obj of r.Contents ?? []) {
      const rawKey = obj.Key ?? "";
      const marker = rawKey.indexOf("#v=");
      if (marker < 0) continue;
      const versionId = rawKey.slice(marker + 3);
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: b, Key: rawKey }),
      );
      const meta = parseMeta(
        head.Metadata,
        bucket,
        key,
        Number(head.ContentLength ?? 0),
        head.ContentType ?? "application/octet-stream",
      );
      items.push({
        bucket,
        key,
        version_id: versionId,
        content_hash: meta.content_hash,
        size_bytes: meta.size_bytes,
        mime_type: meta.mime_type,
        uploaded_at: meta.uploaded_at,
        is_delete_marker: meta.is_delete_marker,
      });
    }
    items.sort(
      (a, b) =>
        new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
    );
    return items;
  }
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);
  const s = stream as AsyncIterable<Uint8Array>;
  const chunks: Buffer[] = [];
  for await (const chunk of s)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
