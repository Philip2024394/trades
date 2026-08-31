// src/app/api/nex-sign-on/otp/send/route.ts
//
// Stage 3.33 · Phase 26 · Sign-on OTP send (Philip 2026-08-31).
//
// POST body: { phone: string /* digits only */, prefix: "+62" | "+44" | ... }
// Success:   200 { ok: true, channel: "whatsapp"|"sms", expiresAt: number, providerMessageId: string }
// Not-config: 501 { ok: false, reason: "provider_not_configured", channel }
// Bad input:  400 { ok: false, reason: "bad_input", detail: string }
// Provider:   502 { ok: false, reason: "provider_error", detail, channel }
//
// Boundary discipline:
//   · The route NEVER returns success when the dispatch adapter says
//     the provider isn't configured. Local dev without env vars gets
//     a visible 501 · not a silent stub.
//   · Client should treat 501 as "backend not ready" and show an
//     honest error rather than moving to the OTP screen.

import { NextResponse } from "next/server";
import { issueCode } from "@/lib/nex/signon/otp-store";
import { dispatchOtp, channelForPrefix } from "@/lib/nex/signon/otp-dispatch";

const SUPPORTED_PREFIXES = new Set(["+62", "+44", "+1", "+61", "+65", "+64", "+91"]);

export async function POST(req: Request): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_input", detail: "invalid json" }, { status: 400 });
  }

  const p = payload as { phone?: unknown; prefix?: unknown };
  const phone = typeof p.phone === "string" ? p.phone.replace(/\D/g, "") : "";
  const prefix = typeof p.prefix === "string" ? p.prefix : "";
  if (!phone || phone.length < 6 || phone.length > 14) {
    return NextResponse.json({ ok: false, reason: "bad_input", detail: "phone digits out of range" }, { status: 400 });
  }
  if (!SUPPORTED_PREFIXES.has(prefix)) {
    return NextResponse.json({ ok: false, reason: "bad_input", detail: `unsupported prefix ${prefix}` }, { status: 400 });
  }

  const fullE164 = prefix + phone;
  const { code, expiresAt } = issueCode(fullE164);

  const result = await dispatchOtp({ fullE164, prefix, code });
  if (!result.ok) {
    const status = result.reason === "provider_not_configured" ? 501 : 502;
    return NextResponse.json({
      ok: false,
      reason: result.reason,
      channel: result.channel,
      detail: "detail" in result ? result.detail : undefined,
    }, { status });
  }

  return NextResponse.json({
    ok: true,
    channel: result.channel ?? channelForPrefix(prefix),
    expiresAt,
    providerMessageId: result.providerMessageId,
  });
}
