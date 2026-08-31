// src/app/api/nex-sign-on/otp/verify/route.ts
//
// Stage 3.33 · Phase 26 · Sign-on OTP verify (Philip 2026-08-31).
//
// POST body: { phone: string, prefix: string, code: string /* 6 digits */ }
// Success:   200 { ok: true, session: { fullE164, verifiedAt } }
// Bad input: 400 { ok: false, reason: "bad_input", detail }
// Not-ok:    401 { ok: false, reason: "no_code_issued"|"code_expired"|"too_many_attempts"|"wrong_code" }
//
// Session creation is intentionally minimal for this scaffold — a real
// implementation writes to hammerex_nex_users + auth.users via a
// service-role Supabase client. Left as a follow-on because it needs
// the auth backend decision (Supabase Auth phone provider vs custom).
// The verified phone + timestamp are returned so the client can hold
// the session and the wider auth wiring can consume it.

import { NextResponse } from "next/server";
import { consumeCode } from "@/lib/nex/signon/otp-store";

const SUPPORTED_PREFIXES = new Set(["+62", "+44", "+1", "+61", "+65", "+64", "+91"]);

export async function POST(req: Request): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_input", detail: "invalid json" }, { status: 400 });
  }

  const p = payload as { phone?: unknown; prefix?: unknown; code?: unknown };
  const phone  = typeof p.phone  === "string" ? p.phone.replace(/\D/g, "") : "";
  const prefix = typeof p.prefix === "string" ? p.prefix : "";
  const code   = typeof p.code   === "string" ? p.code.replace(/\D/g, "") : "";

  if (!phone || phone.length < 6 || phone.length > 14) {
    return NextResponse.json({ ok: false, reason: "bad_input", detail: "phone digits out of range" }, { status: 400 });
  }
  if (!SUPPORTED_PREFIXES.has(prefix)) {
    return NextResponse.json({ ok: false, reason: "bad_input", detail: `unsupported prefix ${prefix}` }, { status: 400 });
  }
  if (code.length !== 6) {
    return NextResponse.json({ ok: false, reason: "bad_input", detail: "code must be 6 digits" }, { status: 400 });
  }

  const fullE164 = prefix + phone;
  const outcome = consumeCode(fullE164, code);
  if (!outcome.ok) {
    return NextResponse.json({ ok: false, reason: outcome.reason }, { status: 401 });
  }

  // Session issuance is scaffold-only · real auth backend writes
  // hammerex_nex_users + auth.users + preferred_lang here. See
  // 20260831000000_nex_users_preferred_lang.sql for the column.
  return NextResponse.json({
    ok: true,
    session: {
      fullE164,
      verifiedAt: new Date().toISOString(),
      // preferred_lang is derived client-side from the prefix (see
      // src/app/nex-sign-on/page.tsx choosePrefix effect) and written
      // to localStorage.nex_user_lang. When the durable auth backend
      // lands it also writes hammerex_nex_users.preferred_lang.
    },
  });
}
