// Social account connection helpers.
//
// Real OAuth handshakes per platform are deferred (each needs app
// registration + callback flow). Framework is ready — connect() stores
// tokens + status; disconnect() marks revoked.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { auditSocial } from "./audit";
import type { SocialAccount, SocialPlatform } from "./types";

export async function connectAccount(input: {
  merchantSlug:       string;
  platform:           SocialPlatform;
  displayName:        string;
  platformAccountId?: string;
  scopes:             string[];
  accessToken:        string;                              // pre-encryption; TODO KMS
  refreshToken?:      string;
  tokenExpiresAt?:    string;
}): Promise<SocialAccount> {
  // Pass 1: base64. Pass 2: use a KMS-managed key or Postgres pgcrypto.
  const enc = (s: string | undefined) => s ? Buffer.from(s, "utf-8").toString("base64") : null;

  const { data, error } = await supabaseAdmin
    .from("hammerex_nex_social_accounts")
    .upsert({
      merchant_slug:       input.merchantSlug,
      platform:            input.platform,
      display_name:        input.displayName,
      platform_account_id: input.platformAccountId ?? null,
      scopes:              input.scopes,
      status:              "connected",
      connected_at:        new Date().toISOString(),
      last_success_at:     null,
      last_error:          null,
      token_expires_at:    input.tokenExpiresAt ?? null,
      access_token_enc:    enc(input.accessToken),
      refresh_token_enc:   enc(input.refreshToken),
      updated_at:          new Date().toISOString()
    }, { onConflict: "merchant_slug,platform" })
    .select("*")
    .single();
  if (error || !data) throw new Error(`connect failed: ${error?.message}`);

  await auditSocial({
    merchantSlug: input.merchantSlug,
    actor:        "merchant",
    action:       "account.connected",
    accountId:    (data as SocialAccount).id,
    details:      { platform: input.platform, scopes: input.scopes }
  });

  return data as unknown as SocialAccount;
}

export async function disconnectAccount(input: { merchantSlug: string; platform: SocialPlatform; actor: string }): Promise<void> {
  const { data } = await supabaseAdmin
    .from("hammerex_nex_social_accounts")
    .update({
      status:            "revoked",
      access_token_enc:  null,
      refresh_token_enc: null,
      updated_at:        new Date().toISOString()
    })
    .eq("merchant_slug", input.merchantSlug)
    .eq("platform", input.platform)
    .select("id")
    .maybeSingle();

  await auditSocial({
    merchantSlug: input.merchantSlug,
    actor:        input.actor,
    action:       "account.revoked",
    accountId:    data?.id,
    details:      { platform: input.platform }
  });
}

export async function listAccounts(merchantSlug: string): Promise<SocialAccount[]> {
  const { data } = await supabaseAdmin
    .from("hammerex_nex_social_accounts")
    .select("id, merchant_slug, platform, display_name, platform_account_id, scopes, status, connected_at, last_success_at, last_error, token_expires_at, created_at, updated_at")
    .eq("merchant_slug", merchantSlug)
    .order("platform");
  return (data as unknown as SocialAccount[]) ?? [];
}

export async function setAutoPublish(input: { merchantSlug: string; enabled: boolean; actor: string }): Promise<void> {
  await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({
      auto_publish_enabled:   input.enabled,
      auto_publish_agreed_at: input.enabled ? new Date().toISOString() : null
    })
    .eq("slug", input.merchantSlug);
  await auditSocial({
    merchantSlug: input.merchantSlug,
    actor:        input.actor,
    action:       input.enabled ? "auto_publish.enabled" : "auto_publish.disabled"
  });
}
