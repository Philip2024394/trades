// NEX Comms Centre · Social · account connect / disconnect / read.
//
// Every write is tenant-scoped (RLS) and every token is envelope-encrypted
// at rest per Charter §S-IX. Tokens NEVER leave this module in plaintext
// except through the explicit `revealTokenForAdapter` helper, which is
// the only function permitted to hand a plaintext token to an adapter
// call. Callers should hold the plaintext only for the duration of the
// adapter call and never log it.

import { encryptForTenant, decryptForTenant, redactSecret } from "../crypto/envelope";
import type { PgClientLike } from "@/lib/nex/db";
import { emitSocialAudit } from "../audit";
import type { AccountStatus, SocialAccount, SocialPlatform, TenantId, UserId } from "../types";

export interface ConnectAccountInput {
  client:              PgClientLike;
  tenant_id:           TenantId;
  platform:            SocialPlatform;
  display_name?:       string;
  platform_account_id?: string;
  scopes:              string[];
  access_token:        string;
  refresh_token?:      string;
  token_expires_at?:   string;
  granted_by:          UserId;
}

export async function connectAccount(input: ConnectAccountInput): Promise<SocialAccount> {
  // Encrypt access token via tenant/access_token DEK.
  const access = await encryptForTenant({
    client:    input.client,
    tenant_id: input.tenant_id,
    purpose:   "access_token",
    plaintext: input.access_token,
  });
  let refreshBlob:
    | { dek_id: string; ciphertext: Buffer; nonce: Buffer; auth_tag: Buffer }
    | null = null;
  if (input.refresh_token) {
    const refresh = await encryptForTenant({
      client:    input.client,
      tenant_id: input.tenant_id,
      purpose:   "refresh_token",             // distinct DEK per S-IX
      plaintext: input.refresh_token,
    });
    refreshBlob = refresh;
  }

  const now = new Date().toISOString();
  const upsert = await input.client.query(
    `INSERT INTO nex.social_accounts
       (tenant_id, platform, display_name, platform_account_id, scopes, status,
        connected_at, token_expires_at, granted_by,
        access_dek_id, access_token_ct, access_token_nonce, access_token_auth_tag,
        refresh_dek_id, refresh_token_ct, refresh_token_nonce, refresh_token_auth_tag,
        updated_at)
     VALUES ($1,$2,$3,$4,$5,'connected',
             $6,$7,$8,
             $9,$10,$11,$12,
             $13,$14,$15,$16,
             $6)
     ON CONFLICT (tenant_id, platform, platform_account_id) DO UPDATE
       SET display_name           = EXCLUDED.display_name,
           scopes                 = EXCLUDED.scopes,
           status                 = 'connected',
           last_error             = NULL,
           connected_at           = EXCLUDED.connected_at,
           token_expires_at       = EXCLUDED.token_expires_at,
           granted_by             = EXCLUDED.granted_by,
           access_dek_id          = EXCLUDED.access_dek_id,
           access_token_ct        = EXCLUDED.access_token_ct,
           access_token_nonce     = EXCLUDED.access_token_nonce,
           access_token_auth_tag  = EXCLUDED.access_token_auth_tag,
           refresh_dek_id         = EXCLUDED.refresh_dek_id,
           refresh_token_ct       = EXCLUDED.refresh_token_ct,
           refresh_token_nonce    = EXCLUDED.refresh_token_nonce,
           refresh_token_auth_tag = EXCLUDED.refresh_token_auth_tag,
           updated_at             = EXCLUDED.updated_at
     RETURNING account_id, tenant_id, platform, display_name, platform_account_id,
               scopes, status, connected_at, last_success_at, last_error,
               token_expires_at, granted_by, created_at, updated_at`,
    [
      input.tenant_id, input.platform, input.display_name ?? null,
      input.platform_account_id ?? null, input.scopes,
      now, input.token_expires_at ?? null, input.granted_by,
      access.dek_id, access.ciphertext, access.nonce, access.auth_tag,
      refreshBlob?.dek_id ?? null,
      refreshBlob?.ciphertext ?? null,
      refreshBlob?.nonce ?? null,
      refreshBlob?.auth_tag ?? null,
    ],
  );
  const row = upsert.rows[0];

  await emitSocialAudit(input.client, {
    tenant_id:    input.tenant_id,
    event_type:   "account.connected",
    actor:        `user:${input.granted_by}`,
    subject_kind: "account",
    subject_id:   String(row.account_id),
    details:      {
      platform: input.platform,
      scopes:   input.scopes,
      // NEVER log tokens · always redact.
      access_token:  redactSecret(input.access_token),
      refresh_token: redactSecret(input.refresh_token ?? null),
    },
  });

  return rowToAccount(row);
}

export interface DisconnectInput {
  client:     PgClientLike;
  tenant_id:  TenantId;
  account_id: string;
  actor:      string;
  reason?:    string;
}

export async function disconnectAccount(input: DisconnectInput): Promise<void> {
  const upd = await input.client.query(
    `UPDATE nex.social_accounts
        SET status = 'revoked',
            access_dek_id = NULL,
            access_token_ct = NULL,
            access_token_nonce = NULL,
            access_token_auth_tag = NULL,
            refresh_dek_id = NULL,
            refresh_token_ct = NULL,
            refresh_token_nonce = NULL,
            refresh_token_auth_tag = NULL,
            updated_at = NOW()
      WHERE account_id = $1
      RETURNING account_id`,
    [input.account_id],
  );
  if (upd.rowCount === 0) return;
  await emitSocialAudit(input.client, {
    tenant_id:    input.tenant_id,
    event_type:   "account.revoked",
    actor:        input.actor,
    subject_kind: "account",
    subject_id:   input.account_id,
    details:      { reason: input.reason ?? null },
  });
}

export async function getAccount(client: PgClientLike, tenant_id: TenantId, account_id: string): Promise<SocialAccount | null> {
  const r = await client.query(
    `SELECT account_id, tenant_id, platform, display_name, platform_account_id,
            scopes, status, connected_at, last_success_at, last_error,
            token_expires_at, granted_by, created_at, updated_at
       FROM nex.social_accounts
      WHERE account_id = $1 AND tenant_id = $2`,
    [account_id, tenant_id],
  );
  return r.rows[0] ? rowToAccount(r.rows[0]) : null;
}

export async function listAccounts(client: PgClientLike, tenant_id: TenantId): Promise<SocialAccount[]> {
  const r = await client.query(
    `SELECT account_id, tenant_id, platform, display_name, platform_account_id,
            scopes, status, connected_at, last_success_at, last_error,
            token_expires_at, granted_by, created_at, updated_at
       FROM nex.social_accounts
      WHERE tenant_id = $1
      ORDER BY platform, created_at`,
    [tenant_id],
  );
  return r.rows.map(rowToAccount);
}

// ── Adapter-only helper · reveals a plaintext token ────────────
//
// The ONLY function that hands a plaintext token to a caller. Callers
// (workers · adapter drivers) should:
//   1. Call revealTokenForAdapter within a tight `withTenantClient` scope
//   2. Pass the plaintext directly to the provider adapter
//   3. Discard the reference immediately after
//   4. NEVER log · never JSON.stringify · never persist
export async function revealTokenForAdapter(
  client:    PgClientLike,
  tenant_id: TenantId,
  account_id: string,
  which:     "access" | "refresh",
): Promise<string | null> {
  const cols = which === "access"
    ? ["access_dek_id","access_token_ct","access_token_nonce","access_token_auth_tag"]
    : ["refresh_dek_id","refresh_token_ct","refresh_token_nonce","refresh_token_auth_tag"];
  const r = await client.query(
    `SELECT ${cols.join(", ")}
       FROM nex.social_accounts
      WHERE account_id = $1 AND tenant_id = $2`,
    [account_id, tenant_id],
  );
  if (r.rowCount === 0) return null;
  const row = r.rows[0];
  const dek_id  = row[cols[0]] as string | null;
  const ct      = row[cols[1]] as Uint8Array | null;
  const nonce   = row[cols[2]] as Uint8Array | null;
  const authTag = row[cols[3]] as Uint8Array | null;
  if (!dek_id || !ct || !nonce || !authTag) return null;
  return await decryptForTenant({
    client,
    tenant_id,
    purpose:    which === "access" ? "access_token" : "refresh_token",
    dek_id,
    ciphertext: Buffer.from(ct),
    nonce:      Buffer.from(nonce),
    auth_tag:   Buffer.from(authTag),
  });
}

// ── Internal · shape row → SocialAccount ───────────────────────
function isoOf(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v); const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString();
}
function rowToAccount(r: Record<string, unknown>): SocialAccount {
  return {
    account_id:          String(r.account_id),
    tenant_id:           String(r.tenant_id),
    platform:            r.platform as SocialPlatform,
    display_name:        (r.display_name as string | null) ?? null,
    platform_account_id: (r.platform_account_id as string | null) ?? null,
    scopes:              (r.scopes as string[]) ?? [],
    status:              r.status as AccountStatus,
    connected_at:        isoOf(r.connected_at),
    last_success_at:     isoOf(r.last_success_at),
    last_error:          (r.last_error as string | null) ?? null,
    token_expires_at:    isoOf(r.token_expires_at),
    granted_by:          (r.granted_by as string | null) ?? null,
    created_at:          isoOf(r.created_at) ?? new Date().toISOString(),
    updated_at:          isoOf(r.updated_at) ?? new Date().toISOString(),
  };
}
