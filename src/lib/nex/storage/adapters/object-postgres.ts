// NEX ObjectStorage · Postgres adapter · Phase 3a
//
// First production ObjectStorage adapter. Stores binary blobs in
// nex.object_blobs (BYTEA) with a nex.object_blob_current pointer to
// the current live version per (bucket, key).
//
// Why Postgres over an external SaaS:
//   · NEX-owned end-to-end · no external dependency
//   · Cross-machine transparent · every worker on any deployment sees
//     the same bytes as long as it can reach NEX Postgres
//   · Zero perpetuation of Supabase (per Philip's mandate)
//   · Size profile fits inbox uploads (typically < 5 MB)
//   · Rollback trivial (delete adapter + flip env)
//
// This adapter is INACTIVE unless NEX_OBJECT_BACKEND=postgres AND
// NEX_POSTGRES_URL is present. The default backend remains
// "filesystem" so this file lands without touching production
// behaviour.

import { createHash, randomBytes } from "node:crypto";
import type { PgClientLike } from "@/lib/nex/db";
// Wave 11 · Step 7 · F34 · shared canonical strict variant. Object
// storage cannot degrade gracefully without a backend so the strict
// wrapper (throws with .code="pg-not-configured") preserves the
// original divergent-throw semantic. Bound to the callsite name
// `withBrainRole` so all 5 downstream call sites continue unchanged.
import { withBrainRoleStrict as withBrainRoleImpl } from "@/lib/nex/db/with-brain-role";
// Local closure preserves the context-tag for error messages.
const withBrainRole = <T>(fn: (c: PgClientLike) => Promise<T>): Promise<T> => withBrainRoleImpl(fn, "object-pg");
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

// ── Key validation (mirrors filesystem adapter) ─────────────────────

const INVALID_SEGMENTS = new Set(["", ".", ".."]);

function validateKey(key: string): void {
  if (typeof key !== "string" || key.length === 0) throw new Error("[object-pg] key must be non-empty string");
  if (key.length > 1024) throw new Error("[object-pg] key too long (max 1024)");
  if (key.startsWith("/") || key.startsWith("\\")) throw new Error("[object-pg] key must be relative");
  if (/[\x00-\x1f]/.test(key)) throw new Error("[object-pg] key contains control chars");
  for (const seg of key.split(/[/\\]/)) {
    if (INVALID_SEGMENTS.has(seg)) throw new Error(`[object-pg] key segment invalid: "${seg}"`);
  }
}

function validateBucket(bucket: string): void {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(bucket)) {
    throw new Error(`[object-pg] bucket must be [a-z0-9][a-z0-9_-]{0,63}: "${bucket}"`);
  }
}

// ── Version-id generation · timestamp-sortable so listVersions is
//    ORDER BY version_id DESC without an extra column.
function newVersionId(): string {
  const ts = Date.now().toString().padStart(13, "0");
  const rand = randomBytes(4).toString("hex");
  return `v${ts}-${rand}`;
}

// Wave 11 F34 · transaction discipline delegated to the shared
// canonical helper. The `withBrainRole` name above is bound via
// import-alias closure so every callsite below is unchanged.

// ── The adapter ─────────────────────────────────────────────────────

export class PostgresObjectStorage implements ObjectStorage {
  readonly name = "postgres";
  readonly capabilities: ObjectStorageCapabilities = {
    nativePresign:        false,   // no native signed URLs · returns app-route URL
    nativeVersioning:     true,    // versions live in object_blobs rows
    imageTransforms:      false,
    multipartUpload:      false,   // could add later via chunked BYTEA rows
    presignPost:          false,
    lifecycleRules:       false,
    serverSideEncryption: false,   // relies on Postgres at-rest encryption if configured
    publicUrls:           false,
  };

  async put(bucket: string, key: string, input: PutInput): Promise<PutResult> {
    validateBucket(bucket);
    validateKey(key);
    if (!Buffer.isBuffer(input.body)) throw new Error("[object-pg] input.body must be a Buffer");

    const versionId    = newVersionId();
    const contentHash  = createHash("sha256").update(input.body).digest("hex");
    const sizeBytes    = input.body.byteLength;
    const mimeType     = input.mime_type ?? "application/octet-stream";
    const uploadedAt   = new Date().toISOString();

    await withBrainRole(async (c) => {
      // Write the version row (bytes + metadata).
      await c.query(
        `INSERT INTO nex.object_blobs
           (bucket, key, version_id, content_hash, size_bytes, mime_type, body,
            is_delete_marker, uploaded_at, uploaded_by, business_id, source_ref, custom)
         VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8::timestamptz,$9,$10,$11,$12::jsonb)`,
        [
          bucket, key, versionId, contentHash, sizeBytes, mimeType, input.body,
          uploadedAt, input.uploaded_by ?? null, input.business_id ?? null,
          input.source_ref ?? null, JSON.stringify(input.custom ?? {}),
        ],
      );
      // Flip the current pointer atomically.
      await c.query(
        `INSERT INTO nex.object_blob_current (bucket, key, version_id, is_delete_marker, updated_at)
         VALUES ($1, $2, $3, false, NOW())
         ON CONFLICT (bucket, key) DO UPDATE SET
           version_id       = EXCLUDED.version_id,
           is_delete_marker = false,
           updated_at       = NOW()`,
        [bucket, key, versionId],
      );
    });

    return {
      bucket, key,
      version_id:   versionId,
      content_hash: contentHash,
      size_bytes:   sizeBytes,
      mime_type:    mimeType,
      uploaded_at:  uploadedAt,
    };
  }

  async get(bucket: string, key: string, versionId?: string): Promise<ReadResult | null> {
    validateBucket(bucket);
    validateKey(key);
    return withBrainRole(async (c) => {
      // Resolve version_id if not explicitly supplied · use current pointer.
      let vid = versionId;
      let currentIsDeleteMarker = false;
      if (!vid) {
        const cur = await c.query(
          `SELECT version_id, is_delete_marker FROM nex.object_blob_current
            WHERE bucket = $1 AND key = $2`,
          [bucket, key],
        );
        if (cur.rowCount === 0) return null;
        vid = cur.rows[0].version_id as string;
        currentIsDeleteMarker = Boolean(cur.rows[0].is_delete_marker);
        if (currentIsDeleteMarker) return null;
      }
      const r = await c.query(
        `SELECT bucket, key, version_id, content_hash, size_bytes, mime_type,
                body, is_delete_marker, uploaded_at, uploaded_by, business_id,
                source_ref, custom
           FROM nex.object_blobs
          WHERE bucket = $1 AND key = $2 AND version_id = $3`,
        [bucket, key, vid],
      );
      if (r.rowCount === 0) return null;
      const row = r.rows[0];
      if (row.is_delete_marker) return null;
      return {
        meta: rowToMeta(row),
        body: Buffer.from(row.body as Buffer),
      };
    });
  }

  async head(bucket: string, key: string, versionId?: string): Promise<ObjectMeta | null> {
    validateBucket(bucket);
    validateKey(key);
    return withBrainRole(async (c) => {
      let vid = versionId;
      if (!vid) {
        const cur = await c.query(
          `SELECT version_id, is_delete_marker FROM nex.object_blob_current
            WHERE bucket = $1 AND key = $2`,
          [bucket, key],
        );
        if (cur.rowCount === 0) return null;
        vid = cur.rows[0].version_id as string;
        if (cur.rows[0].is_delete_marker) return null;
      }
      const r = await c.query(
        `SELECT bucket, key, version_id, content_hash, size_bytes, mime_type,
                is_delete_marker, uploaded_at, uploaded_by, business_id,
                source_ref, custom
           FROM nex.object_blobs
          WHERE bucket = $1 AND key = $2 AND version_id = $3`,
        [bucket, key, vid],
      );
      if (r.rowCount === 0) return null;
      const row = r.rows[0];
      if (row.is_delete_marker) return null;
      return rowToMeta(row);
    });
  }

  async presign(bucket: string, key: string, options: PresignOptions): Promise<string> {
    validateBucket(bucket);
    validateKey(key);
    // Postgres has no native signed URLs · return an app-route URL that
    // an /api/nex/objects/[bucket]/[key] handler will serve (route not
    // yet wired · dev-honest per the filesystem adapter's precedent).
    const expires = options.expires_seconds ?? 900;
    return `/api/nex/objects/${bucket}/${key}?op=${options.operation}&exp=${expires}`;
  }

  async list(bucket: string, prefix: string, options?: ListOptions): Promise<ListItem[]> {
    validateBucket(bucket);
    const limit = Math.min(Math.max(1, options?.limit ?? 100), 10000);
    const orderDir = options?.order_dir ?? "desc";
    const includeDeleted = options?.include_delete_markers ?? false;
    return withBrainRole(async (c) => {
      const params: unknown[] = [bucket, prefix + "%"];
      let sql = `
        SELECT bucket, key, version_id, content_hash, size_bytes, mime_type,
               uploaded_at, is_delete_marker
          FROM nex.object_blobs
         WHERE bucket = $1 AND key LIKE $2
      `;
      if (!includeDeleted) sql += ` AND is_delete_marker = false`;
      if (options?.since) {
        params.push(options.since);
        sql += ` AND uploaded_at >= $${params.length}::timestamptz`;
      }
      sql += ` ORDER BY uploaded_at ${orderDir === "asc" ? "ASC" : "DESC"}`;
      params.push(limit);
      sql += ` LIMIT $${params.length}`;
      const r = await c.query(sql, params);
      return r.rows.map(rowToListItem);
    });
  }

  async delete(bucket: string, key: string, options?: DeleteOptions): Promise<void> {
    validateBucket(bucket);
    validateKey(key);
    if (options?.hard) {
      // Hard delete: remove ALL versions (or a specific one) + pointer if it
      // targeted the live version.
      await withBrainRole(async (c) => {
        if (options.version_id) {
          await c.query(
            `DELETE FROM nex.object_blobs WHERE bucket=$1 AND key=$2 AND version_id=$3`,
            [bucket, key, options.version_id],
          );
          await c.query(
            `DELETE FROM nex.object_blob_current
              WHERE bucket=$1 AND key=$2 AND version_id=$3`,
            [bucket, key, options.version_id],
          );
        } else {
          await c.query(`DELETE FROM nex.object_blobs WHERE bucket=$1 AND key=$2`, [bucket, key]);
          await c.query(`DELETE FROM nex.object_blob_current WHERE bucket=$1 AND key=$2`, [bucket, key]);
        }
      });
      return;
    }
    // Soft delete · write a delete-marker version and flip pointer.
    const versionId = newVersionId();
    await withBrainRole(async (c) => {
      await c.query(
        `INSERT INTO nex.object_blobs
           (bucket, key, version_id, content_hash, size_bytes, mime_type, body,
            is_delete_marker, uploaded_at, custom)
         VALUES ($1,$2,$3,'',0,'application/x-delete-marker',NULL,true,NOW(),'{}'::jsonb)`,
        [bucket, key, versionId],
      );
      await c.query(
        `INSERT INTO nex.object_blob_current (bucket, key, version_id, is_delete_marker, updated_at)
         VALUES ($1, $2, $3, true, NOW())
         ON CONFLICT (bucket, key) DO UPDATE SET
           version_id       = EXCLUDED.version_id,
           is_delete_marker = true,
           updated_at       = NOW()`,
        [bucket, key, versionId],
      );
    });
  }

  async listVersions(bucket: string, key: string): Promise<ListItem[]> {
    validateBucket(bucket);
    validateKey(key);
    return withBrainRole(async (c) => {
      const r = await c.query(
        `SELECT bucket, key, version_id, content_hash, size_bytes, mime_type,
                uploaded_at, is_delete_marker
           FROM nex.object_blobs
          WHERE bucket = $1 AND key = $2
          ORDER BY uploaded_at DESC`,
        [bucket, key],
      );
      return r.rows.map(rowToListItem);
    });
  }
}

// ── Row → typed shape converters ────────────────────────────────────

function rowToMeta(row: Record<string, unknown>): ObjectMeta {
  return {
    bucket:           String(row.bucket),
    key:              String(row.key),
    version_id:       String(row.version_id),
    content_hash:     String(row.content_hash),
    size_bytes:       Number(row.size_bytes),
    mime_type:        String(row.mime_type),
    uploaded_at:      new Date(row.uploaded_at as string).toISOString(),
    uploaded_by:      (row.uploaded_by as string | null) ?? null,
    business_id:      (row.business_id as string | null) ?? null,
    source_ref:       (row.source_ref as string | null) ?? null,
    is_delete_marker: Boolean(row.is_delete_marker),
    custom:           (row.custom as Record<string, string>) ?? {},
  };
}

function rowToListItem(row: Record<string, unknown>): ListItem {
  return {
    bucket:           String(row.bucket),
    key:              String(row.key),
    version_id:       String(row.version_id),
    content_hash:     String(row.content_hash),
    size_bytes:       Number(row.size_bytes),
    mime_type:        String(row.mime_type),
    uploaded_at:      new Date(row.uploaded_at as string).toISOString(),
    is_delete_marker: Boolean(row.is_delete_marker),
  };
}
