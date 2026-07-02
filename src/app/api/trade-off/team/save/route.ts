// POST /api/trade-off/team/save — replaces the merchant's team_members
// JSONB array. Server-side validation + sanitisation. First entry is
// the boss (pinned in TeamGrid slot 0).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Incoming = {
  name?: unknown;
  role?: unknown;
  years_experience?: unknown;
  avatar_url?: unknown;
  skills?: unknown;
  direct_phone?: unknown;
};

type Body = { slug: string; token: string; members: Incoming[] };

function s(v: unknown, max = 120): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t.slice(0, max);
}

function int(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.max(0, Math.min(80, Math.round(n)));
  return rounded;
}

function urlOrNull(v: unknown): string | null {
  const t = s(v, 800);
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : null;
}

function skillList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => s(x, 60))
    .filter((x): x is string => x !== null)
    .slice(0, 5);
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.slug || !body.token || !Array.isArray(body.members)) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", body.slug)
    .maybeSingle();
  if (!listing.data) return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  if (listing.data.edit_token !== body.token) {
    return NextResponse.json({ error: "bad_token" }, { status: 403 });
  }

  const normalised = body.members
    .map((m) => {
      const name = s(m.name, 80);
      const role = s(m.role, 80);
      if (!name || !role) return null;
      return {
        name,
        role,
        years_experience: int(m.years_experience),
        avatar_url: urlOrNull(m.avatar_url),
        skills: skillList(m.skills),
        direct_phone: s(m.direct_phone, 40),
        direct_extension: s((m as { direct_extension?: unknown }).direct_extension, 10)
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 10); // hard cap

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ team_members: normalised })
    .eq("id", listing.data.id);
  if (upd.error) {
    return NextResponse.json({ error: upd.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, members: normalised });
}
