// src/lib/nex/api-platform/keys.ts
//
// Founder Phase 14 · API key issuance, resolution, rotation, revocation.
//
// Discipline:
//   · Raw token returned ONCE at issuance · never storable again
//   · Storage: sha256 hex hash + first-12-char prefix for display
//   · Prefix `nex_live_` so leaked tokens are grep-detectable
//   · Every resolve() bumps request_count + last_used_at (fire-and-forget)

import { createHash, randomBytes } from "node:crypto";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export type ApiKeyTier = "free" | "pro" | "enterprise";

export interface ApiKeyRow {
  api_key_id: string;
  user_id: string;
  name: string;
  token_prefix: string;
  tier: ApiKeyTier;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  request_count: string;               // bigint arrives as text
}

// ═══════════════════════════════════════════════════════════════════
// Hash helpers
// ═══════════════════════════════════════════════════════════════════

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function makeRawToken(): string {
  return `nex_live_${randomBytes(24).toString("hex")}`;
}

// ═══════════════════════════════════════════════════════════════════
// Issue
// ═══════════════════════════════════════════════════════════════════

export interface IssueKeyArgs {
  user_id: string;
  name: string;
  tier?: ApiKeyTier;
  scopes?: string[];
}

export async function issueApiKey(args: IssueKeyArgs): Promise<{
  api_key_id: string;
  raw_token: string;               // shown once · never persisted
  token_prefix: string;
  tier: ApiKeyTier;
  scopes: string[];
}> {
  const raw = makeRawToken();
  const prefix = raw.slice(0, 12);
  const hash = hashToken(raw);
  const tier: ApiKeyTier = args.tier ?? "free";
  const scopes = args.scopes ?? ["chat:read", "chat:write"];
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `INSERT INTO nex.api_key (user_id, name, token_prefix, token_hash, tier, scopes)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING api_key_id`,
    [args.user_id, args.name.slice(0, 80), prefix, hash, tier, scopes],
  );
  return {
    api_key_id: String((r.rows[0] as { api_key_id: string }).api_key_id),
    raw_token: raw,
    token_prefix: prefix,
    tier,
    scopes,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Resolve (used by bearer-auth middleware)
// ═══════════════════════════════════════════════════════════════════

export async function resolveApiKey(rawToken: string | null | undefined): Promise<ApiKeyRow | null> {
  if (!rawToken || !rawToken.startsWith("nex_live_")) return null;
  const hash = hashToken(rawToken);
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `SELECT api_key_id::text, user_id, name, token_prefix, tier, scopes,
            created_at::text, last_used_at::text, revoked_at::text,
            request_count::text
       FROM nex.api_key
      WHERE token_hash = $1`,
    [hash],
  ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
  const row = r.rows[0] as unknown as ApiKeyRow | undefined;
  if (!row) return null;
  if (row.revoked_at) return null;
  // Bump counters fire-and-forget.
  void pool.query(
    `UPDATE nex.api_key
        SET last_used_at = now(), request_count = request_count + 1
      WHERE api_key_id = $1`,
    [row.api_key_id],
  ).catch(() => { /* best-effort */ });
  return row;
}

// ═══════════════════════════════════════════════════════════════════
// List / Revoke / Rotate
// ═══════════════════════════════════════════════════════════════════

export async function listApiKeys(user_id: string): Promise<ApiKeyRow[]> {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `SELECT api_key_id::text, user_id, name, token_prefix, tier, scopes,
            created_at::text, last_used_at::text, revoked_at::text,
            request_count::text
       FROM nex.api_key
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [user_id],
  );
  return r.rows as unknown as ApiKeyRow[];
}

export async function revokeApiKey(user_id: string, api_key_id: string): Promise<boolean> {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `UPDATE nex.api_key
        SET revoked_at = now()
      WHERE user_id = $1 AND api_key_id = $2 AND revoked_at IS NULL`,
    [user_id, api_key_id],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function rotateApiKey(user_id: string, api_key_id: string): Promise<{
  raw_token: string;
  token_prefix: string;
} | null> {
  const pool = getKnowledgeFactoryDbPool();
  // Verify ownership.
  const own = await pool.query(
    `SELECT name, tier, scopes FROM nex.api_key WHERE user_id = $1 AND api_key_id = $2 AND revoked_at IS NULL`,
    [user_id, api_key_id],
  );
  const row = own.rows[0] as { name: string; tier: ApiKeyTier; scopes: string[] } | undefined;
  if (!row) return null;
  // Revoke old.
  await pool.query(`UPDATE nex.api_key SET revoked_at = now() WHERE api_key_id = $1`, [api_key_id]);
  // Issue new with same name/tier/scopes.
  const fresh = await issueApiKey({ user_id, name: row.name, tier: row.tier, scopes: row.scopes });
  return { raw_token: fresh.raw_token, token_prefix: fresh.token_prefix };
}
