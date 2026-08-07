// NEX Comms Centre · Social · OAuth flow orchestration.
//
// One place that ties together:
//   1. state generation via oauth/state.ts
//   2. adapter authorizeUrl construction
//   3. state consumption on callback
//   4. adapter exchangeCode
//   5. account persistence via oauth/accounts.ts
//
// API routes call these functions · they do not orchestrate directly.

import { createHash, randomBytes } from "node:crypto";
import { withTenantClient } from "../db";
import type { SocialAccount, SocialPlatform, TenantId, UserId } from "../types";
import { getAdapter } from "../adapters/registry";
import { initOAuthState, consumeOAuthState } from "./state";
import { connectAccount } from "./accounts";

export interface InitiateOAuthInput {
  tenant_id:     TenantId;
  platform:      SocialPlatform;
  initiated_by:  UserId;
  redirect_uri:  string;                  // must match provider's registered URI
  scopes?:       string[];                // defaults to adapter's scopes_available
  redirect_to?:  string;                  // where to send merchant after successful callback
  ttl_seconds?:  number;
}

export interface InitiateOAuthResult {
  authorize_url: string;
  state:         string;
  expires_at:    string;
}

// Generates the state · optionally PKCE verifier · calls adapter.authorizeUrl.
export async function initiateOAuth(input: InitiateOAuthInput): Promise<InitiateOAuthResult> {
  const adapter = getAdapter(input.platform);
  const authCap = adapter.authCapabilities();
  const scopes  = input.scopes && input.scopes.length > 0 ? input.scopes : authCap.scopes_available;

  let code_verifier: string | undefined;
  let code_challenge: string | undefined;
  if (authCap.supports_pkce) {
    code_verifier  = randomBytes(48).toString("base64url"); // 64 chars-ish · well within PKCE spec
    code_challenge = createHash("sha256").update(code_verifier).digest("base64url");
  }

  const result = await withTenantClient(input.tenant_id, async (c) => {
    const s = await initOAuthState({
      client:       c,
      tenant_id:    input.tenant_id,
      platform:     input.platform,
      initiated_by: input.initiated_by,
      redirect_to:  input.redirect_to,
      code_verifier,
      ttl_seconds:  input.ttl_seconds,
    });
    const url = adapter.authorizeUrl({
      state:          s.state_token,
      redirect_uri:   input.redirect_uri,
      scopes,
      code_challenge,
    }).url;
    return { authorize_url: url, state: s.state_token, expires_at: s.expires_at };
  });
  if (!result) throw new Error("initiateOAuth: database unavailable");
  return result;
}

export interface HandleCallbackInput {
  tenant_id:    TenantId;
  platform:     SocialPlatform;
  code:         string;
  state:        string;
  redirect_uri: string;
}

export type HandleCallbackResult =
  | { ok: true;  account: SocialAccount; redirect_to: string | null }
  | { ok: false; reason: string };

export async function handleCallback(input: HandleCallbackInput): Promise<HandleCallbackResult> {
  const adapter = getAdapter(input.platform);
  const result = await withTenantClient(input.tenant_id, async (c) => {
    // 1. Consume state (atomic single-use).
    const state = await consumeOAuthState({
      client:      c,
      tenant_id:   input.tenant_id,
      platform:    input.platform,
      state_token: input.state,
    });
    if (!state.ok) return { ok: false as const, reason: `state_${state.reason}` };

    // 2. Retrieve encrypted PKCE verifier if present.
    let code_verifier: string | undefined;
    const s = await c.query(
      `SELECT code_verifier, code_verifier_nonce, code_verifier_dek_id
         FROM nex.social_oauth_states
        WHERE state_token = $1`,
      [input.state],
    );
    if (s.rows[0]?.code_verifier && s.rows[0]?.code_verifier_dek_id) {
      const row = s.rows[0];
      const ctFull = Buffer.from(row.code_verifier as Uint8Array);
      // We packed ciphertext||auth_tag; auth_tag is the last 16 bytes.
      const ct = ctFull.subarray(0, ctFull.length - 16);
      const tag = ctFull.subarray(ctFull.length - 16);
      const { decryptForTenant } = await import("../crypto/envelope");
      code_verifier = await decryptForTenant({
        client:     c,
        tenant_id:  input.tenant_id,
        purpose:    "oauth_state",
        dek_id:     String(row.code_verifier_dek_id),
        ciphertext: ct,
        nonce:      Buffer.from(row.code_verifier_nonce as Uint8Array),
        auth_tag:   tag,
      });
    }

    // 3. Exchange code with adapter.
    const exch = await adapter.exchangeCode({
      code:         input.code,
      redirect_uri: input.redirect_uri,
      code_verifier,
    });
    if (!exch.ok) return { ok: false as const, reason: `exchange_${exch.error_class}` };

    // 4. Persist encrypted tokens.
    const account = await connectAccount({
      client:              c,
      tenant_id:           input.tenant_id,
      platform:            input.platform,
      display_name:        exch.display_name ?? undefined,
      platform_account_id: exch.platform_account_id ?? undefined,
      scopes:              exch.scopes,
      access_token:        exch.access_token,
      refresh_token:       exch.refresh_token ?? undefined,
      token_expires_at:    exch.token_expires_at ?? undefined,
      granted_by:          state.initiated_by,
    });

    return { ok: true as const, account, redirect_to: state.redirect_to };
  });
  if (!result) return { ok: false, reason: "db_unavailable" };
  return result;
}
