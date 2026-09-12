// src/lib/nex/identity-auth/index.ts
//
// Founder Phase 10 · P10-2 · NEX identity + session module.
//
// · Opaque per-user identity (uuid) · no PII required at signup
// · Session cookies · HMAC-signed opaque tokens · 30-day sliding expiry
// · Sha-256 hash of token stored server-side (raw token never persisted)
// · CASCADE on account delete via ON DELETE CASCADE
//
// Doctrine anchors:
//   #4 · Memory scoped by user_id (unchanged)
//   privacy · account delete cascades all memory / session rows

import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;   // 30 days
const HMAC_SECRET = process.env.NEX_SESSION_SECRET ?? "dev-only-nex-session-secret-2026-09-10";
const COOKIE_NAME = "nex_session";
const _ACTIVE_HANDLE_MAX_LEN = 60;

// ═══════════════════════════════════════════════════════════════════
// Public types
// ═══════════════════════════════════════════════════════════════════

export interface UserAccount {
  user_id: string;
  display_name?: string | null;
  email_hash_16?: string | null;
  created_at: string;
  last_seen_at: string;
  deleted_at?: string | null;
  custom_instructions?: Record<string, unknown> | null;
}

export interface UserSession {
  user_id: string;
  session_id: string;
  issued_at: string;
  expires_at: string;
  cookie_token: string;                             // raw · returned to caller once
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

export function sha16(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}
function hashToken(t: string): string {
  return createHash("sha256").update(t).digest("hex");
}
function makeToken(): string {
  const payload = randomBytes(24).toString("hex");   // 48 hex chars
  const sig = createHmac("sha256", HMAC_SECRET).update(payload).digest("hex").slice(0, 16);
  return `${payload}.${sig}`;
}
function verifyTokenSignature(token: string): boolean {
  const [payload, sig] = String(token ?? "").split(".");
  if (!payload || !sig) return false;
  const expected = createHmac("sha256", HMAC_SECRET).update(payload).digest("hex").slice(0, 16);
  return sig === expected;
}
export function sessionCookieName(): string { return COOKIE_NAME; }

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

export async function createAccount(opts: {
  display_name?: string | null;
  email_hash_16?: string | null;
  pool?: Pool;
}): Promise<UserAccount> {
  const pool = opts.pool ?? getKnowledgeFactoryDbPool();
  const user_id = randomUUID();
  await pool.query(
    `INSERT INTO nex.user_account (user_id, display_name, email_hash_16)
     VALUES ($1, $2, $3)`,
    [user_id, opts.display_name?.slice(0, _ACTIVE_HANDLE_MAX_LEN) ?? null, opts.email_hash_16 ?? null],
  );
  return { user_id, display_name: opts.display_name ?? null, email_hash_16: opts.email_hash_16 ?? null,
    created_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), deleted_at: null };
}

export async function issueSession(user_id: string, opts: {
  ip_hash_16?: string | null;
  user_agent_hash_16?: string | null;
  pool?: Pool;
}): Promise<UserSession> {
  const pool = opts.pool ?? getKnowledgeFactoryDbPool();
  const cookie_token = makeToken();
  const token_hash = hashToken(cookie_token);
  const issued_at = new Date();
  const expires_at = new Date(issued_at.getTime() + SESSION_TTL_MS);
  const q = await pool.query(
    `INSERT INTO nex.user_session
      (session_token_hash, user_id, expires_at, ip_hash_16, user_agent_hash_16)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING session_id`,
    [token_hash, user_id, expires_at.toISOString(), opts.ip_hash_16 ?? null, opts.user_agent_hash_16 ?? null],
  );
  return {
    user_id,
    session_id: String(q.rows[0].session_id),
    issued_at: issued_at.toISOString(),
    expires_at: expires_at.toISOString(),
    cookie_token,
  };
}

export async function resolveSession(cookieToken: string | null | undefined, pool?: Pool): Promise<{
  user_id: string | null;
  account?: UserAccount;
  session_id?: string;
} | null> {
  if (!cookieToken) return null;
  if (!verifyTokenSignature(cookieToken)) return null;
  const p = pool ?? getKnowledgeFactoryDbPool();
  const token_hash = hashToken(cookieToken);
  const q = await p.query(
    `SELECT s.session_id, s.user_id, s.expires_at, s.revoked_at,
            a.display_name, a.email_hash_16, a.created_at, a.last_seen_at, a.custom_instructions, a.deleted_at
       FROM nex.user_session s
       JOIN nex.user_account a ON a.user_id = s.user_id
       WHERE s.session_token_hash = $1`,
    [token_hash],
  ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
  const row = q.rows[0];
  if (!row) return null;
  if (row.deleted_at) return null;
  if (row.revoked_at) return null;
  if (new Date(String(row.expires_at)) <= new Date()) return null;
  // Sliding expiry · touch last_seen.
  await p.query(
    `UPDATE nex.user_session SET last_seen_at = now() WHERE session_id = $1`,
    [row.session_id],
  ).catch(() => {});
  return {
    user_id: String(row.user_id),
    session_id: String(row.session_id),
    account: {
      user_id: String(row.user_id),
      display_name: (row.display_name as string) ?? null,
      email_hash_16: (row.email_hash_16 as string) ?? null,
      created_at: new Date(String(row.created_at)).toISOString(),
      last_seen_at: new Date(String(row.last_seen_at)).toISOString(),
      deleted_at: null,
      custom_instructions: (row.custom_instructions as Record<string, unknown>) ?? null,
    },
  };
}

export async function revokeSession(cookieToken: string | null | undefined, pool?: Pool): Promise<void> {
  if (!cookieToken) return;
  if (!verifyTokenSignature(cookieToken)) return;
  const p = pool ?? getKnowledgeFactoryDbPool();
  const token_hash = hashToken(cookieToken);
  await p.query(
    `UPDATE nex.user_session SET revoked_at = now() WHERE session_token_hash = $1 AND revoked_at IS NULL`,
    [token_hash],
  ).catch(() => {});
}

/**
 * Full right-to-delete · cascades to sessions + user_memory + scrubs
 * user_profile custom_instructions. Best-effort privacy compliance.
 */
export async function deleteAccount(user_id: string, pool?: Pool): Promise<void> {
  const p = pool ?? getKnowledgeFactoryDbPool();
  await p.query(
    `UPDATE nex.user_account SET deleted_at = now() WHERE user_id = $1 AND deleted_at IS NULL`,
    [user_id],
  );
  await p.query(
    `UPDATE nex.user_session SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
    [user_id],
  );
  await p.query(
    `UPDATE nex.user_memory SET deleted_at = now() WHERE user_id = $1 AND deleted_at IS NULL`,
    [user_id],
  ).catch(() => {});
  await p.query(
    `UPDATE nex.user_profile SET custom_instructions = NULL, display_name = NULL, updated_at = now()
       WHERE user_id = $1`,
    [user_id],
  ).catch(() => {});
}
