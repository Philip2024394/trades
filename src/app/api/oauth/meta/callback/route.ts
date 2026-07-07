// GET /api/oauth/meta/callback?code=...&state=...
//
// Meta's redirect back after the merchant authorises. Exchanges the
// code for long-lived tokens, fetches the merchant's pages + linked
// Instagram Business accounts, and persists one
// merchant_channel_connections row per (page, channel).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { exchangeCodeAndFetchPages } from "@/lib/oauth/meta";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.json(
      { error: "code + state required" },
      { status: 400 }
    );
  }
  const result = await exchangeCodeAndFetchPages(code, state);
  if (!result) {
    return NextResponse.json(
      { error: "meta_oauth_failed", detail: "token exchange or state invalid" },
      { status: 400 }
    );
  }
  const supaUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supaUrl || !key) {
    return NextResponse.json(
      { error: "supabase_not_configured" },
      { status: 503 }
    );
  }
  const c = createClient(supaUrl, key, { auth: { persistSession: false } });

  const rows: Array<{
    merchant_id: string;
    channel: string;
    external_account_id: string;
    display_name: string;
    access_token: string;
    expires_at: string;
    scopes: string[];
    status: string;
    metadata: Record<string, unknown>;
  }> = [];
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  for (const page of result.pages) {
    // Facebook Page connection
    rows.push({
      merchant_id: result.merchantId,
      channel: "facebook",
      external_account_id: page.id,
      display_name: page.name,
      access_token: page.accessToken,
      expires_at: expiresAt,
      scopes: ["pages_manage_posts", "pages_read_engagement"],
      status: "active",
      metadata: { page_id: page.id }
    });
    // Instagram Business connection (if linked)
    if (page.instagramBusinessAccountId) {
      rows.push({
        merchant_id: result.merchantId,
        channel: "instagram",
        external_account_id: page.instagramBusinessAccountId,
        display_name: `${page.name} (IG)`,
        access_token: page.accessToken, // IG publishing uses Page token
        expires_at: expiresAt,
        scopes: ["instagram_content_publish"],
        status: "active",
        metadata: {
          page_id: page.id,
          ig_business_account_id: page.instagramBusinessAccountId
        }
      });
      // Threads shares the same Meta token surface — same connection basis.
      rows.push({
        merchant_id: result.merchantId,
        channel: "threads",
        external_account_id: `threads_${page.instagramBusinessAccountId}`,
        display_name: `${page.name} (Threads)`,
        access_token: page.accessToken,
        expires_at: expiresAt,
        scopes: ["instagram_content_publish"],
        status: "active",
        metadata: {
          page_id: page.id,
          ig_business_account_id: page.instagramBusinessAccountId
        }
      });
    }
  }

  const { error } = await c
    .from("merchant_channel_connections")
    .upsert(rows, {
      onConflict: "merchant_id,channel,external_account_id"
    });
  if (error) {
    return NextResponse.json(
      { error: "connection_persist_failed", detail: error.message },
      { status: 500 }
    );
  }

  // Bounce the merchant to a friendly landing.
  const successUrl = `/settings/channels?connected=meta&count=${rows.length}`;
  return NextResponse.redirect(new URL(successUrl, request.url));
}
