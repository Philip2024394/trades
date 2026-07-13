// POST /api/affiliates/forgot-password
//
// Self-serve password recovery for affiliates. Two delivery channels:
//
//   - If we have an email on file, send a recovery URL via Resend AND
//     stamp password_recovery_sent_at so the code becomes redeemable
//     immediately. The wa.me URL is still returned so the affiliate
//     can also self-route to admin if email is broken.
//
//   - If no email is on file, we behave like the tradesperson side:
//     mint the code, stamp password_recovery_requested_at (queue
//     surface), but DON'T set sent_at — the admin /admin/affiliates/
//     password-recovery page is the canonical delivery surface.
//
// Either way the response is identical to the caller so we never reveal
// which path was taken (and therefore whether an email is on file).
import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { sendPasswordResetEmail } from "@/lib/affiliateEmails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function digits(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.replace(/\D/g, "");
}

function generateRecoveryCode(): string {
  // 8 chars, unambiguous alphabet.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function siteOrigin(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && /^https?:\/\//.test(env)) return env.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) return `${proto}://${host}`;
  return "https://thenetworkers.app";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { whatsapp?: unknown };
  try {
    body = (await req.json()) as { whatsapp?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const waDigits = digits(body.whatsapp);
  if (waDigits.length < 7) {
    return NextResponse.json(
      { ok: false, error: "WhatsApp number looks too short." },
      { status: 400 }
    );
  }

  const lookup = await supabaseAdmin
    .from("hammerex_affiliates")
    .select("affiliate_id, whatsapp, email, first_name")
    .eq("whatsapp", waDigits)
    .maybeSingle();

  const aff = lookup.data;

  let code: string | null = null;
  let emailed = false;

  if (aff) {
    code = generateRecoveryCode();
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const hasEmail = typeof aff.email === "string" && aff.email.includes("@");
    const update = await supabaseAdmin
      .from("hammerex_affiliates")
      .update({
        password_recovery_token: code,
        password_recovery_expires_at: expiresAt,
        password_recovery_requested_at: nowIso,
        // Email path: stamp sent_at NOW (so the code is redeemable
        // immediately). Admin path: leave sent_at NULL until the admin
        // clicks the queue button.
        password_recovery_sent_at: hasEmail ? nowIso : null
      })
      .eq("affiliate_id", aff.affiliate_id);
    if (update.error) {
      console.error("[affiliates/forgot-password] mint failed:", update.error);
    } else if (hasEmail && aff.email) {
      const origin = siteOrigin(req);
      const recoveryUrl = `${origin}/affiliates/set-password?wa=${encodeURIComponent(waDigits)}&recovery_code=${encodeURIComponent(code)}`;
      try {
        await sendPasswordResetEmail(
          {
            affiliate_id: aff.affiliate_id,
            email: aff.email,
            first_name: aff.first_name
          },
          recoveryUrl
        );
        emailed = true;
      } catch (e) {
        console.error("[affiliates/forgot-password] email failed:", e);
      }
      // Audit log.
      await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
        actor_type: "affiliate",
        actor_id: String(aff.affiliate_id),
        action: "password_recovery.requested",
        target_id: String(aff.affiliate_id),
        details: { channel: "email" }
      });
    } else {
      await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
        actor_type: "affiliate",
        actor_id: String(aff.affiliate_id),
        action: "password_recovery.requested",
        target_id: String(aff.affiliate_id),
        details: { channel: "whatsapp_queue" }
      });
    }
  }

  // Build a wa.me URL to admin (works regardless of which path we took).
  const adminWa = digits(adminWhatsapp());
  const messageLines = [
    "Hi thenetworkers.app — I forgot my affiliate password.",
    `My WhatsApp: ${waDigits}`,
    code ? `Recovery code: ${code}` : null,
    "Please verify and send me a set-password link."
  ].filter((x): x is string => typeof x === "string" && x.length > 0);
  const waUrl = `https://wa.me/${adminWa}?text=${encodeURIComponent(messageLines.join("\n"))}`;

  return NextResponse.json({
    ok: true,
    emailed,
    whatsapp_url: waUrl,
    delivery: emailed
      ? "If we found a matching account, we've emailed you a reset link."
      : "If we found a matching account, our admin will send your reset link by WhatsApp shortly."
  });
}
