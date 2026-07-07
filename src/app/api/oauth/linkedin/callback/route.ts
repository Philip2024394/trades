import { NextResponse } from "next/server";
import { linkedinExchangeCode } from "@/lib/oauth/linkedin";
import { persistConnections } from "@/lib/oauth/persist";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.json({ error: "code + state required" }, { status: 400 });
  }
  const result = await linkedinExchangeCode(code, state);
  if (!result) {
    return NextResponse.json(
      { error: "linkedin_oauth_failed" },
      { status: 400 }
    );
  }
  const rows: Array<{
    merchantId: string;
    channel: string;
    externalAccountId: string;
    displayName: string;
    accessToken: string;
    expiresAt: typeof result.expiresAt;
    scopes: string[];
    metadata: Record<string, unknown>;
  }> = result.organisations.map((o) => ({
    merchantId: result.merchantId,
    channel: "linkedin",
    externalAccountId: o.id,
    displayName: o.name,
    accessToken: result.accessToken,
    expiresAt: result.expiresAt,
    scopes: ["r_liteprofile", "r_organization_social", "w_organization_social"],
    metadata: { organisation_id: o.id }
  }));
  if (rows.length === 0) {
    // Personal profile posts only — insert one row without an org.
    rows.push({
      merchantId: result.merchantId,
      channel: "linkedin",
      externalAccountId: `personal_${result.merchantId.slice(0, 8)}`,
      displayName: "Personal profile",
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
      scopes: ["r_liteprofile"],
      metadata: { personal: true }
    });
  }
  await persistConnections(rows);
  return NextResponse.redirect(
    new URL(`/settings/channels?connected=linkedin&count=${rows.length}`, request.url)
  );
}
