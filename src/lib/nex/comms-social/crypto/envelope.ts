// NEX Comms Centre · Social · envelope encryption facade.
//
// Charter §S-IX (v0.2 hardened): per-tenant DEKs · separate DEK per
// purpose ('access_token' vs 'refresh_token') · wrapped by KEK · every
// ciphertext binds (tenant_id, purpose) as AAD so it cannot be relocated
// across boundaries.
//
// This facade is the ONLY entry point application code uses to encrypt
// or decrypt tenant secrets. It hides the DB-side DEK lookup + the KEK
// wrap/unwrap dance behind two functions:
//
//   encryptForTenant({tenant_id, purpose, plaintext, client}) → {ciphertext,nonce,auth_tag,dek_id}
//   decryptForTenant({tenant_id, purpose, dek_id, ciphertext, nonce, auth_tag, client}) → plaintext
//
// The caller supplies the PG client so writes participate in the
// caller's transaction (RLS scope is preserved).

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { PgClientLike } from "@/lib/nex/db";
import type { KekBackend } from "./interface";
import { createLocalKekBackend } from "./kms-local";

// Purpose enum matches the DB CHECK constraint in migration 031.
export type DekPurpose = "access_token" | "refresh_token" | "oauth_state";

export interface EncryptForTenantInput {
  client:    PgClientLike;
  tenant_id: string;
  purpose:   DekPurpose;
  plaintext: string | Buffer;
  backend?:  KekBackend;              // defaults to local backend
}

export interface EncryptedBlob {
  dek_id:      string;
  ciphertext:  Buffer;
  nonce:       Buffer;
  auth_tag:    Buffer;
  kek_version: string;
}

export interface DecryptForTenantInput {
  client:      PgClientLike;
  tenant_id:   string;
  purpose:     DekPurpose;
  dek_id:      string;
  ciphertext:  Buffer;
  nonce:       Buffer;
  auth_tag:    Buffer;
  backend?:    KekBackend;
}

function dataAad(tenant_id: string, purpose: DekPurpose): Buffer {
  return Buffer.from(`nex-comms-social-data|${tenant_id}|${purpose}`, "utf8");
}

// ── Get or create the active DEK for (tenant, purpose) ─────────
//
// One-active-per-purpose is enforced by the partial UNIQUE index on
// nex.social_dek_wraps. If no active DEK exists we mint a fresh one,
// wrap it with the KEK, and insert. If two callers race, one INSERT
// wins and the other retries with SELECT.
async function getOrCreateActiveDek(
  client: PgClientLike,
  tenant_id: string,
  purpose: DekPurpose,
  backend: KekBackend,
): Promise<{ dek_id: string; plaintext_dek: Buffer; kek_version: string }> {
  // Attempt to read the active DEK first.
  const existing = await client.query(
    `SELECT dek_id, wrapped_dek, wrap_nonce, wrap_auth_tag, kek_version
       FROM nex.social_dek_wraps
      WHERE tenant_id = $1 AND purpose = $2 AND status = 'active'
      LIMIT 1`,
    [tenant_id, purpose],
  );
  if (existing.rowCount && existing.rowCount > 0) {
    const row = existing.rows[0];
    const plaintext_dek = await backend.unwrap({
      wrapped_dek:   Buffer.from(row.wrapped_dek as Uint8Array),
      wrap_nonce:    Buffer.from(row.wrap_nonce as Uint8Array),
      wrap_auth_tag: Buffer.from(row.wrap_auth_tag as Uint8Array),
      kek_version:   String(row.kek_version),
      purpose,
      tenant_id,
    });
    return { dek_id: String(row.dek_id), plaintext_dek, kek_version: String(row.kek_version) };
  }
  // Mint a new DEK.
  const plaintext_dek = randomBytes(32);
  const wrapped = await backend.wrap({ plaintext_dek, purpose, tenant_id });
  try {
    const inserted = await client.query(
      `INSERT INTO nex.social_dek_wraps
         (tenant_id, purpose, wrapped_dek, wrap_nonce, wrap_auth_tag, kek_version, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING dek_id`,
      [tenant_id, purpose, wrapped.wrapped_dek, wrapped.wrap_nonce, wrapped.wrap_auth_tag, wrapped.kek_version],
    );
    return {
      dek_id:        String(inserted.rows[0].dek_id),
      plaintext_dek,
      kek_version:   wrapped.kek_version,
    };
  } catch (e) {
    // Lost the race → someone else inserted an active DEK for this
    // (tenant, purpose). Re-fetch and use theirs.
    const retry = await client.query(
      `SELECT dek_id, wrapped_dek, wrap_nonce, wrap_auth_tag, kek_version
         FROM nex.social_dek_wraps
        WHERE tenant_id = $1 AND purpose = $2 AND status = 'active'
        LIMIT 1`,
      [tenant_id, purpose],
    );
    if (retry.rowCount === 0) throw e;
    const row = retry.rows[0];
    const dek = await backend.unwrap({
      wrapped_dek:   Buffer.from(row.wrapped_dek as Uint8Array),
      wrap_nonce:    Buffer.from(row.wrap_nonce as Uint8Array),
      wrap_auth_tag: Buffer.from(row.wrap_auth_tag as Uint8Array),
      kek_version:   String(row.kek_version),
      purpose,
      tenant_id,
    });
    return { dek_id: String(row.dek_id), plaintext_dek: dek, kek_version: String(row.kek_version) };
  }
}

// ── Public API ─────────────────────────────────────────────────

export async function encryptForTenant(input: EncryptForTenantInput): Promise<EncryptedBlob> {
  const backend = input.backend ?? createLocalKekBackend();
  const { dek_id, plaintext_dek, kek_version } =
    await getOrCreateActiveDek(input.client, input.tenant_id, input.purpose, backend);
  try {
    const nonce  = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", plaintext_dek, nonce);
    cipher.setAAD(dataAad(input.tenant_id, input.purpose));
    const pt = typeof input.plaintext === "string" ? Buffer.from(input.plaintext, "utf8") : input.plaintext;
    const ciphertext = Buffer.concat([cipher.update(pt), cipher.final()]);
    const auth_tag   = cipher.getAuthTag();
    return { dek_id, ciphertext, nonce, auth_tag, kek_version };
  } finally {
    // Wipe DEK material from memory as best-effort.
    plaintext_dek.fill(0);
  }
}

export async function decryptForTenant(input: DecryptForTenantInput): Promise<string> {
  const backend = input.backend ?? createLocalKekBackend();
  const wrap = await input.client.query(
    `SELECT wrapped_dek, wrap_nonce, wrap_auth_tag, kek_version
       FROM nex.social_dek_wraps
      WHERE dek_id = $1 AND tenant_id = $2 AND purpose = $3`,
    [input.dek_id, input.tenant_id, input.purpose],
  );
  if (wrap.rowCount === 0) {
    throw new Error(`decryptForTenant: no DEK found for (tenant=${input.tenant_id}, dek_id=${input.dek_id}, purpose=${input.purpose})`);
  }
  const row = wrap.rows[0];
  const plaintext_dek = await backend.unwrap({
    wrapped_dek:   Buffer.from(row.wrapped_dek as Uint8Array),
    wrap_nonce:    Buffer.from(row.wrap_nonce as Uint8Array),
    wrap_auth_tag: Buffer.from(row.wrap_auth_tag as Uint8Array),
    kek_version:   String(row.kek_version),
    purpose:       input.purpose,
    tenant_id:     input.tenant_id,
  });
  try {
    const decipher = createDecipheriv("aes-256-gcm", plaintext_dek, input.nonce);
    decipher.setAuthTag(input.auth_tag);
    decipher.setAAD(dataAad(input.tenant_id, input.purpose));
    const plain = Buffer.concat([decipher.update(input.ciphertext), decipher.final()]);
    return plain.toString("utf8");
  } finally {
    plaintext_dek.fill(0);
  }
}

// ── Token redaction helper (S-IX log-safety) ───────────────────
//
// Any string that might contain a token · use this before logging.
// Returns a fixed placeholder and never a substring of the original.
export function redactSecret(_: unknown): string { return "***redacted***"; }

export function redactObject<T extends Record<string, unknown>>(
  obj: T,
  keys: readonly string[] = ["access_token", "refresh_token", "token", "code", "state", "code_verifier", "authorization", "cookie"],
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = keys.includes(k) ? "***redacted***" : v;
  }
  return out as Partial<T>;
}
