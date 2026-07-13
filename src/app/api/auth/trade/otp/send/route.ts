// POST /api/auth/trade/otp/send
//
// Body: { channel: "whatsapp" | "sms" | "email", destination: string }
//
// Generates a 6-digit OTP, hashes it, stores it with a 5-minute TTL,
// then dispatches through the channel. WhatsApp/SMS sends are mocked
// in dev — the code is written to server logs so a developer can
// grab it from the terminal. In prod, wire the actual WhatsApp
// Business API + SMS provider inside `dispatchOtp()`.

import { NextResponse } from "next/server";
import { createHash, randomInt } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { dispatchOtp } from "@/lib/tradeAuthDispatch";

export const dynamic = "force-dynamic";

const OTP_TTL_MINUTES = 5;
const OTP_COOLDOWN_SECONDS = 45;   // per destination + channel
const OTP_SECRET = process.env.TRADE_OTP_SECRET ?? "tc-dev-otp-secret-CHANGE-ME";

function normalisePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("07") && digits.length === 11) return "+44" + digits.slice(1); // UK mobile shortcut
  if (digits.startsWith("447") && digits.length === 12) return "+" + digits;
  return "+" + digits;
}

function normaliseEmail(input: string): string {
  return input.trim().toLowerCase();
}

function hashCode(code: string, destination: string): string {
  return createHash("sha256")
    .update(code + ":" + destination + ":" + OTP_SECRET)
    .digest("hex");
}

// Real dispatch lives in `@/lib/tradeAuthDispatch` — env-gated per
// channel, falls back to a console-log in dev so the code is visible.

export async function POST(req: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const channel = String(payload.channel ?? "");
  if (!["whatsapp", "sms", "email"].includes(channel)) {
    return NextResponse.json({ error: "invalid_channel" }, { status: 400 });
  }

  const rawDest = String(payload.destination ?? "").trim();
  if (!rawDest) {
    return NextResponse.json({ error: "missing_destination" }, { status: 400 });
  }
  const destination = channel === "email" ? normaliseEmail(rawDest) : normalisePhone(rawDest);

  // Cooldown — if a code was issued to this destination within the
  // last 45s, refuse to send a fresh one. Prevents brute-forcing send
  // costs + guards our provider spend.
  const cooldownFloor = new Date(Date.now() - OTP_COOLDOWN_SECONDS * 1000).toISOString();
  const { data: recent } = await supabaseAdmin
    .from("app_trade_otp_codes")
    .select("created_at")
    .eq("channel", channel)
    .eq("destination", destination)
    .gt("created_at", cooldownFloor)
    .limit(1)
    .maybeSingle();
  if (recent) {
    const nextAllowed = new Date(new Date(recent.created_at).getTime() + OTP_COOLDOWN_SECONDS * 1000);
    const retryAfterSec = Math.max(1, Math.ceil((nextAllowed.getTime() - Date.now()) / 1000));
    return NextResponse.json(
      { error: "cooldown", retryAfterSec },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  // Clear any older codes for this destination + channel so we don't
  // accumulate junk.
  await supabaseAdmin
    .from("app_trade_otp_codes")
    .delete()
    .eq("channel", channel)
    .eq("destination", destination);

  // Six-digit code, evenly random.
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();

  const { error } = await supabaseAdmin
    .from("app_trade_otp_codes")
    .insert({
      channel,
      destination,
      code_hash: hashCode(code, destination),
      expires_at: expiresAt
    });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await dispatchOtp(channel as "whatsapp" | "sms" | "email", destination, code);

  return NextResponse.json({
    ok: true,
    channel,
    destination,
    expiresAt,
    // Dev mode returns the code so the UI can auto-fill during preview.
    devCode: process.env.NODE_ENV !== "production" ? code : undefined
  });
}
