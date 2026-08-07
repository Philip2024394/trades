// NEX Comms Centre · Social · OAuth state (CSRF protection).
//
// The OAuth state token is a single-use, tenant-bound, expiring value
// that we generate on initiate and verify on callback. Stored in
// nex.social_oauth_states. TTL is short (default 10 minutes) so a
// stolen state loses value quickly.
//
// PKCE code_verifier (when the provider requires it) is stored
// encrypted at rest via the envelope facade using a dedicated
// 'oauth_state' DEK purpose.

import { randomBytes, timingSafeEqual } from "node:crypto";
import type { PgClientLike } from "@/lib/nex/db";
import { encryptForTenant } from "../crypto/envelope";

export interface OAuthStateInitInput {
  client:        PgClientLike;
  tenant_id:     string;
  platform:      string;
  initiated_by:  string;
  redirect_to?:  string;
  code_verifier?: string;                // when PKCE is in use
  ttl_seconds?:  number;                 // default 600 · overridable for tests
}

export interface OAuthStateInitResult {
  state_token: string;
  expires_at:  string;
}

const DEFAULT_TTL_SECONDS = 600;

export async function initOAuthState(input: OAuthStateInitInput): Promise<OAuthStateInitResult> {
  const ttl = input.ttl_seconds ?? DEFAULT_TTL_SECONDS;
  // 32 random bytes · base64url → ~43 chars · URL-safe.
  const state_token = randomBytes(32).toString("base64url");
  const expires_at  = new Date(Date.now() + ttl * 1000).toISOString();

  let code_verifier_ct: Buffer | null = null;
  let code_verifier_nonce: Buffer | null = null;
  let code_verifier_dek_id: string | null = null;
  if (input.code_verifier) {
    const enc = await encryptForTenant({
      client:    input.client,
      tenant_id: input.tenant_id,
      purpose:   "oauth_state",
      plaintext: input.code_verifier,
    });
    code_verifier_ct     = Buffer.concat([enc.ciphertext, enc.auth_tag]);
    code_verifier_nonce  = enc.nonce;
    code_verifier_dek_id = enc.dek_id;
  }

  await input.client.query(
    `INSERT INTO nex.social_oauth_states
       (state_token, tenant_id, platform, initiated_by, redirect_to,
        code_verifier, code_verifier_nonce, code_verifier_dek_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)`,
    [
      state_token,
      input.tenant_id,
      input.platform,
      input.initiated_by,
      input.redirect_to ?? null,
      code_verifier_ct,
      code_verifier_nonce,
      code_verifier_dek_id,
      expires_at,
    ],
  );

  return { state_token, expires_at };
}

export interface OAuthStateConsumeInput {
  client:      PgClientLike;
  tenant_id:   string;
  platform:    string;                   // must match initiate
  state_token: string;
  now?:        Date;                     // for deterministic tests
}

export type OAuthStateConsumeResult =
  | { ok: true;  initiated_by: string; redirect_to: string | null }
  | { ok: false; reason: "not_found" | "wrong_platform" | "wrong_tenant" | "expired" | "already_consumed" | "malformed" };

// Consume a state token in a single UPDATE + RETURNING to prevent
// TOCTOU. If already consumed OR expired OR non-matching → fail.
export async function consumeOAuthState(input: OAuthStateConsumeInput): Promise<OAuthStateConsumeResult> {
  if (!input.state_token || typeof input.state_token !== "string" || input.state_token.length < 32) {
    return { ok: false, reason: "malformed" };
  }
  const nowIso = (input.now ?? new Date()).toISOString();
  // Timing-safe presence check by fetching the row first (RLS-scoped)
  // then updating in the same TX. We keep the lookup cheap.
  const row = await input.client.query(
    `SELECT platform, tenant_id, initiated_by, redirect_to, expires_at, consumed_at
       FROM nex.social_oauth_states
      WHERE state_token = $1`,
    [input.state_token],
  );
  if (row.rowCount === 0) return { ok: false, reason: "not_found" };
  const s = row.rows[0];
  if (String(s.tenant_id) !== input.tenant_id) return { ok: false, reason: "wrong_tenant" };

  // Timing-safe platform compare (defensive · lengths equal after Buffer.from).
  const aBuf = Buffer.from(String(s.platform));
  const bBuf = Buffer.from(input.platform);
  const platformOk = aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
  if (!platformOk) return { ok: false, reason: "wrong_platform" };

  if (s.consumed_at != null) return { ok: false, reason: "already_consumed" };
  const expires = new Date(String(s.expires_at)).getTime();
  if (isNaN(expires) || expires <= new Date(nowIso).getTime()) return { ok: false, reason: "expired" };

  // Atomic single-use consume: only succeed if consumed_at IS NULL.
  const upd = await input.client.query(
    `UPDATE nex.social_oauth_states
        SET consumed_at = $2::timestamptz
      WHERE state_token = $1 AND consumed_at IS NULL AND expires_at > $2::timestamptz
      RETURNING initiated_by, redirect_to`,
    [input.state_token, nowIso],
  );
  if (upd.rowCount === 0) return { ok: false, reason: "already_consumed" };
  return {
    ok: true,
    initiated_by: String(upd.rows[0].initiated_by),
    redirect_to:  upd.rows[0].redirect_to ? String(upd.rows[0].redirect_to) : null,
  };
}
