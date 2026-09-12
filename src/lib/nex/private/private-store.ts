// src/lib/nex/private/private-store.ts
//
// NEX Y-P3 · Server domain for user-owned encrypted content
// Philip 2026-09-07
//
// The store NEVER accepts, returns, or transports plaintext content.
// Every input is opaque ciphertext + a 12-byte IV. Every output is the
// same opaque bytes. Decryption is a client concern.
//
// Every function requires `actor_user_id` and refuses any operation
// where the actor is not the owner of the row in question. RLS is a
// backstop; this module enforces the same rule at the domain layer so
// the API surface is uniform whether or not RLS is momentarily disabled.

import "server-only";
import { supabaseNexAdmin } from "@/lib/supabaseNexAdmin";

export interface PrivateObjectRow {
  id: string;
  owner_user_id: string;
  object_type: string;
  ciphertext_b64: string;    // base64-encoded on the way out
  iv_b64: string;            // base64-encoded on the way out
  key_version: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type PrivateStoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string };

function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** Server never sees plaintext. Inputs are opaque bytes. */
export interface PutPrivateInput {
  actor_user_id: string;
  object_type: string;
  ciphertext_b64: string;   // base64
  iv_b64: string;           // base64 · must decode to exactly 12 bytes
  key_version?: number;
  metadata?: Record<string, unknown>;
}

const MAX_METADATA_BYTES = 2048;

function decodeB64(b64: string): Uint8Array {
  try {
    return new Uint8Array(Buffer.from(b64, "base64"));
  } catch { return new Uint8Array(0); }
}
function encodeB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export async function putPrivate(input: PutPrivateInput): Promise<PrivateStoreResult<PrivateObjectRow>> {
  const { actor_user_id, object_type, ciphertext_b64, iv_b64, key_version = 1, metadata = {} } = input;

  if (!isUuid(actor_user_id))            return { ok: false, status: 400, error: "actor_user_id must be a uuid" };
  if (typeof object_type !== "string" || object_type.length < 1 || object_type.length > 64) {
    return { ok: false, status: 400, error: "object_type must be a string of 1-64 chars" };
  }
  if (typeof ciphertext_b64 !== "string" || ciphertext_b64.length === 0) {
    return { ok: false, status: 400, error: "ciphertext_b64 required" };
  }
  if (typeof iv_b64 !== "string" || iv_b64.length === 0) {
    return { ok: false, status: 400, error: "iv_b64 required" };
  }
  if (!Number.isInteger(key_version) || key_version < 1) {
    return { ok: false, status: 400, error: "key_version must be a positive integer" };
  }

  const ct = decodeB64(ciphertext_b64);
  const iv = decodeB64(iv_b64);
  if (ct.length < 16)  return { ok: false, status: 400, error: "ciphertext too short" };
  if (ct.length > 1_048_576) return { ok: false, status: 413, error: "ciphertext exceeds 1MB" };
  if (iv.length !== 12) return { ok: false, status: 400, error: "iv must be exactly 12 bytes" };

  // metadata guard · non-sensitive by contract but bounded so the plaintext
  // metadata column can't be used as a covert plaintext channel.
  let metaJson: string;
  try { metaJson = JSON.stringify(metadata ?? {}); } catch { return { ok: false, status: 400, error: "metadata not serializable" }; }
  if (metaJson.length > MAX_METADATA_BYTES) return { ok: false, status: 413, error: "metadata exceeds 2KB" };

  const { data, error } = await supabaseNexAdmin
    .from("nex_private_object")
    .insert({
      owner_user_id: actor_user_id,
      object_type,
      ciphertext: ct,
      iv,
      key_version,
      metadata,
    })
    .select("id, owner_user_id, object_type, ciphertext, iv, key_version, metadata, created_at, updated_at")
    .single();
  if (error) return { ok: false, status: 500, error: `put_failed: ${error.message}` };
  return { ok: true, value: rowToPublic(data as Record<string, unknown>) };
}

export interface GetPrivateInput { actor_user_id: string; id: string; }
export async function getPrivate(input: GetPrivateInput): Promise<PrivateStoreResult<PrivateObjectRow | null>> {
  if (!isUuid(input.actor_user_id)) return { ok: false, status: 400, error: "actor_user_id must be a uuid" };
  if (!isUuid(input.id))            return { ok: false, status: 400, error: "id must be a uuid" };
  const { data, error } = await supabaseNexAdmin
    .from("nex_private_object")
    .select("id, owner_user_id, object_type, ciphertext, iv, key_version, metadata, created_at, updated_at")
    .eq("id", input.id)
    .maybeSingle();
  if (error) return { ok: false, status: 500, error: `get_failed: ${error.message}` };
  if (!data) return { ok: true, value: null };
  // OWNERSHIP CHECK · the actor MUST be the owner. A non-owner is a 403,
  // not a 404 · this is the same information disclosure boundary the
  // API contract promises.
  const row = data as Record<string, unknown>;
  if (row.owner_user_id !== input.actor_user_id) {
    return { ok: false, status: 403, error: "not_owner" };
  }
  return { ok: true, value: rowToPublic(row) };
}

export interface ListPrivateInput { actor_user_id: string; object_type?: string; }
export async function listPrivate(input: ListPrivateInput): Promise<PrivateStoreResult<PrivateObjectRow[]>> {
  if (!isUuid(input.actor_user_id)) return { ok: false, status: 400, error: "actor_user_id must be a uuid" };
  let q = supabaseNexAdmin
    .from("nex_private_object")
    .select("id, owner_user_id, object_type, ciphertext, iv, key_version, metadata, created_at, updated_at")
    .eq("owner_user_id", input.actor_user_id);
  if (input.object_type) {
    if (typeof input.object_type !== "string" || input.object_type.length > 64) {
      return { ok: false, status: 400, error: "object_type invalid" };
    }
    q = q.eq("object_type", input.object_type);
  }
  const { data, error } = await q.order("updated_at", { ascending: false });
  if (error) return { ok: false, status: 500, error: `list_failed: ${error.message}` };
  return { ok: true, value: (data ?? []).map((r) => rowToPublic(r as Record<string, unknown>)) };
}

export interface DeletePrivateInput { actor_user_id: string; id: string; }
export async function deletePrivate(input: DeletePrivateInput): Promise<PrivateStoreResult<{ deleted: boolean }>> {
  if (!isUuid(input.actor_user_id)) return { ok: false, status: 400, error: "actor_user_id must be a uuid" };
  if (!isUuid(input.id))            return { ok: false, status: 400, error: "id must be a uuid" };
  // Read first so we can enforce ownership and return 403 vs 404 correctly.
  const existing = await getPrivate({ actor_user_id: input.actor_user_id, id: input.id });
  if (!existing.ok) return existing;
  if (!existing.value) return { ok: true, value: { deleted: false } };
  const { error } = await supabaseNexAdmin
    .from("nex_private_object")
    .delete()
    .eq("id", input.id)
    .eq("owner_user_id", input.actor_user_id);
  if (error) return { ok: false, status: 500, error: `delete_failed: ${error.message}` };
  return { ok: true, value: { deleted: true } };
}

function rowToPublic(row: Record<string, unknown>): PrivateObjectRow {
  // Supabase returns bytea as Node Buffer on the JS side. Base64-encode
  // on egress so the API surface is JSON-safe.
  const ctBuf = row.ciphertext as Buffer | Uint8Array | string;
  const ivBuf = row.iv         as Buffer | Uint8Array | string;
  const ciphertext_b64 = ctBuf instanceof Uint8Array || Buffer.isBuffer?.(ctBuf as never)
    ? encodeB64(ctBuf as Uint8Array)
    : typeof ctBuf === "string"
      ? // Supabase sometimes returns bytea as a "\\x..." hex string
        (ctBuf.startsWith("\\x") ? Buffer.from(ctBuf.slice(2), "hex").toString("base64") : ctBuf)
      : "";
  const iv_b64 = ivBuf instanceof Uint8Array || Buffer.isBuffer?.(ivBuf as never)
    ? encodeB64(ivBuf as Uint8Array)
    : typeof ivBuf === "string"
      ? (ivBuf.startsWith("\\x") ? Buffer.from(ivBuf.slice(2), "hex").toString("base64") : ivBuf)
      : "";
  return {
    id:             String(row.id),
    owner_user_id:  String(row.owner_user_id),
    object_type:    String(row.object_type),
    ciphertext_b64,
    iv_b64,
    key_version:    Number(row.key_version ?? 1),
    metadata:       (row.metadata as Record<string, unknown>) ?? {},
    created_at:     String(row.created_at),
    updated_at:     String(row.updated_at),
  };
}
