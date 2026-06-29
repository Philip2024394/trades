// PATCH /api/affiliates/profile — update optional affiliate fields.
import { NextResponse, type NextRequest } from "next/server";
import { readAffiliateSession } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// Field caps deliberately wider than the UI inputs — server treats
// every value as untrusted and slices to a sane upper bound.
const STRING_FIELDS = [
  "first_name",
  "last_name",
  "company_name",
  "country",
  "email",
  "website",
  "avatar_url",
  "address_line_1",
  "address_line_2",
  "city",
  "postal_code",
  "state_region",
  "bio",
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "twitter",
  "linkedin"
] as const;

// Per-field max length. Anything not listed falls back to 240 — the
// historic default for the original optional fields.
const MAX: Partial<Record<(typeof STRING_FIELDS)[number], number>> = {
  email: 200,
  avatar_url: 600,
  address_line_1: 240,
  address_line_2: 240,
  city: 120,
  postal_code: 40,
  state_region: 120,
  bio: 280 // hard cap — matches the "280 characters" UI promise
};

function s(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = readAffiliateSession(req);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const patch: Record<string, string | null> = {};
  for (const field of STRING_FIELDS) {
    if (field in body) {
      patch[field] = s(body[field], MAX[field] ?? 240);
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const upd = await supabaseAdmin
    .from("hammerex_affiliates")
    .update(patch)
    .eq("affiliate_id", session.affiliate_id);
  if (upd.error) {
    console.error("[affiliates/profile] update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: upd.error.message },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "affiliate",
    actor_id: String(session.affiliate_id),
    action: "profile.update",
    target_id: String(session.affiliate_id),
    details: { fields: Object.keys(patch) }
  });

  return NextResponse.json({ ok: true });
}
