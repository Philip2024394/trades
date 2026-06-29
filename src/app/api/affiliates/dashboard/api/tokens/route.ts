// POST /api/affiliates/dashboard/api/tokens — mint a new API token.
//
// Returns the full 40-char random token ONCE; the row stores the same
// string but the affiliate UI never re-displays it after the create
// response. Authentication: the affiliate session cookie.
import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { readAffiliateSession } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function randomToken(): string {
  // 40-char alphanumeric. randomBytes(30) → 240 bits → ~40 chars
  // base64url, then trimmed to 40.
  return randomBytes(30)
    .toString("base64")
    .replace(/\+/g, "A")
    .replace(/\//g, "B")
    .replace(/=+$/, "")
    .slice(0, 40);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = readAffiliateSession(req);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Not signed in." },
      { status: 401 }
    );
  }
  let body: { label?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const label =
    typeof body.label === "string" ? body.label.trim().slice(0, 80) || null : null;
  const token = randomToken();

  const ins = await supabaseAdmin
    .from("hammerex_affiliate_api_tokens")
    .insert({
      affiliate_id: session.affiliate_id,
      token,
      label
    })
    .select("id, label, created_at, last_used_at, revoked_at")
    .maybeSingle();
  if (ins.error || !ins.data) {
    return NextResponse.json(
      { ok: false, error: ins.error?.message ?? "Insert failed." },
      { status: 500 }
    );
  }
  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "affiliate",
    actor_id: String(session.affiliate_id),
    action: "api_token.create",
    target_id: ins.data.id
  });
  return NextResponse.json({
    ok: true,
    token,
    row: {
      id: ins.data.id,
      label: ins.data.label,
      prefix: token.slice(0, 8),
      created_at: ins.data.created_at,
      last_used_at: ins.data.last_used_at,
      revoked_at: ins.data.revoked_at
    }
  });
}
