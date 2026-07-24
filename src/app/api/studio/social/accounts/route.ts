// GET  /api/studio/social/accounts        — list merchant's connected accounts
// POST /api/studio/social/accounts        — connect (pass 1: manual token; pass 2: OAuth callback)
// DELETE /api/studio/social/accounts?platform=facebook — disconnect

import { NextResponse, type NextRequest } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { listAccounts, connectAccount, disconnectAccount, type SocialPlatform, SOCIAL_PLATFORMS } from "@/lib/nex/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function assertPlatform(p: string | null): SocialPlatform {
  if (!p || !(SOCIAL_PLATFORMS as readonly string[]).includes(p)) throw new Error("unknown_platform");
  return p as SocialPlatform;
}

export async function GET(): Promise<NextResponse> {
  const session = await loadStudioSession();
  if (!session) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const accounts = await listAccounts(session.merchant.slug);
  return NextResponse.json({ ok: true, accounts });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await loadStudioSession();
  if (!session) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const body = await req.json().catch(() => null) as {
    platform?:            string;
    display_name?:        string;
    platform_account_id?: string;
    scopes?:              string[];
    access_token?:        string;
    refresh_token?:       string;
    token_expires_at?:    string;
  } | null;
  if (!body?.platform || !body.access_token || !body.display_name) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  try {
    const account = await connectAccount({
      merchantSlug:      session.merchant.slug,
      platform:          assertPlatform(body.platform),
      displayName:       body.display_name,
      platformAccountId: body.platform_account_id,
      scopes:            body.scopes ?? [],
      accessToken:       body.access_token,
      refreshToken:      body.refresh_token,
      tokenExpiresAt:    body.token_expires_at
    });
    return NextResponse.json({ ok: true, account });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "connect_failed" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await loadStudioSession();
  if (!session) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const platform = new URL(req.url).searchParams.get("platform");
  try {
    await disconnectAccount({ merchantSlug: session.merchant.slug, platform: assertPlatform(platform), actor: "merchant" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "disconnect_failed" }, { status: 400 });
  }
}
