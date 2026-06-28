// POST /api/trade-off/login
//
// Phone + password login for tradespeople. We never reveal whether a
// phone number exists in the database — wrong-password and unknown-phone
// both return the same 401 / generic error string. The only deliberate
// information leak is `requires_first_login: true` when the listing
// exists but its password_hash is null (legacy users from before this
// auth shipped); the client uses that signal to route the user into the
// /trade-off/set-password flow, where they prove ownership with their
// existing edit_token.
import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { setTradeSessionCookie } from "@/lib/tradeSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function digits(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.replace(/\D/g, "");
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { whatsapp?: unknown; password?: unknown };
  try {
    body = (await req.json()) as { whatsapp?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const whatsappDigits = digits(body.whatsapp);
  const password = typeof body.password === "string" ? body.password : "";

  if (whatsappDigits.length < 7 || password.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Invalid phone or password" },
      { status: 401 }
    );
  }

  // Look up by the digits-only form of the WhatsApp number. We compare
  // by stripping non-digits from each stored row (Supabase doesn't have
  // a portable regex_replace on the WHERE side that's RLS-safe, so we
  // fetch any row whose whatsapp ends with the supplied tail and verify
  // in JS). To keep this O(few rows) we also try the exact digits match
  // first.
  const lookup = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, whatsapp, password_hash, updated_at")
    .ilike("whatsapp", `%${whatsappDigits.slice(-9)}%`)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (lookup.error) {
    console.error("[trade-off/login] lookup failed:", lookup.error);
    return NextResponse.json(
      { ok: false, error: "Invalid phone or password" },
      { status: 401 }
    );
  }

  type Row = {
    id: string;
    slug: string;
    whatsapp: string | null;
    password_hash: string | null;
    updated_at: string | null;
  };
  const candidates = ((lookup.data ?? []) as Row[]).filter(
    (r) => digits(r.whatsapp) === whatsappDigits
  );

  if (candidates.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Invalid phone or password" },
      { status: 401 }
    );
  }

  // Most-recently-active first — when multiple listings share the same
  // number (operator added a teammate later, etc.) we prefer the freshest.
  const listing = candidates[0];

  // Legacy users with no password set — route them to the first-login
  // / set-password flow. We DO leak that the phone exists in this
  // branch; that's intentional (it's how they discover they need to
  // claim their account) and isn't worse than the existing magic-link
  // email flow already revealing the same fact.
  if (!listing.password_hash) {
    return NextResponse.json(
      { ok: false, requires_first_login: true, slug: listing.slug },
      { status: 200 }
    );
  }

  let match = false;
  try {
    match = await bcrypt.compare(password, listing.password_hash);
  } catch (err) {
    console.error("[trade-off/login] bcrypt compare threw:", err);
    match = false;
  }

  if (!match) {
    return NextResponse.json(
      { ok: false, error: "Invalid phone or password" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true, slug: listing.slug });
  setTradeSessionCookie(response, listing.id, listing.slug);
  return response;
}
