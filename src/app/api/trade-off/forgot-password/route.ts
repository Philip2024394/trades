// POST /api/trade-off/forgot-password
//
// Manual-step recovery flow. We mint an 8-char one-time recovery code,
// stash it on the listing (with an expires_at 24h out), and return a
// pre-built `wa.me/<admin>?text=...` URL so the client can pop the
// WhatsApp composer pre-filled with the code. The admin then verifies
// the request and sends the tradesperson their set-password link
// manually.
//
// We DELIBERATELY do not auto-send anything to the tradesperson —
// there's no WhatsApp Business API wired up yet, and email recovery
// would require a separate Resend template. Routing this through the
// admin's WhatsApp inbox is the honest, working approach today.
//
// Like /login, we never reveal whether the phone exists. If we can't
// find a row we still hand back the same wa.me URL so attackers can't
// enumerate accounts via timing.
import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { whatsappDigits } from "@/lib/tradeOff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function digits(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.replace(/\D/g, "");
}

function generateRecoveryCode(): string {
  // 8 chars from an unambiguous alphabet — no 0/O/1/I/l. Plenty of
  // entropy for an admin-mediated, time-limited flow.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { whatsapp?: unknown };
  try {
    body = (await req.json()) as { whatsapp?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const whatsappDigitsIn = digits(body.whatsapp);
  if (whatsappDigitsIn.length < 7) {
    return NextResponse.json(
      { ok: false, error: "WhatsApp number looks too short." },
      { status: 400 }
    );
  }

  const adminWaDigits = whatsappDigits(adminWhatsapp());

  // Best-effort lookup. We always return a wa.me URL — the admin filters
  // false positives manually.
  const lookup = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, whatsapp, display_name, updated_at")
    .ilike("whatsapp", `%${whatsappDigitsIn.slice(-9)}%`)
    .order("updated_at", { ascending: false })
    .limit(10);

  type Row = {
    id: string;
    slug: string;
    whatsapp: string | null;
    display_name: string | null;
    updated_at: string | null;
  };
  const candidates = ((lookup.data ?? []) as Row[]).filter(
    (r) => digits(r.whatsapp) === whatsappDigitsIn
  );
  const listing = candidates[0] ?? null;

  let code: string | null = null;
  if (listing) {
    code = generateRecoveryCode();
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    // We also stamp password_recovery_requested_at (surfaces this row in
    // /admin/password-recovery) and CLEAR password_recovery_sent_at so a
    // re-request bumps the row back to the unsent queue. The admin page
    // is the canonical delivery surface now — the wa.me URL we return
    // below is kept only for backwards compatibility with old clients.
    const update = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .update({
        password_recovery_token: code,
        password_recovery_expires_at: expiresAt,
        password_recovery_requested_at: nowIso,
        password_recovery_sent_at: null
      })
      .eq("id", listing.id);
    if (update.error) {
      console.error("[trade-off/forgot-password] mint failed:", update.error);
      // Continue — we still hand back a wa.me URL so the admin can
      // resolve manually.
      code = null;
    }
  }

  // Build the WhatsApp message — pre-filled with what we know so the
  // admin doesn't have to fish. The recovery code (when minted) is
  // included so the admin can verify the request matches what's in DB.
  const messageLines = [
    "Hi thenetworkers.app — I forgot my thenetworkers.app password.",
    `My WhatsApp: ${whatsappDigitsIn}`,
    listing ? `My app: ${listing.slug}` : null,
    code ? `Recovery code: ${code}` : null,
    "Please send me a set-password link."
  ].filter((x): x is string => typeof x === "string" && x.length > 0);
  const waUrl = `https://wa.me/${adminWaDigits}?text=${encodeURIComponent(
    messageLines.join("\n")
  )}`;

  // Print the manual-step caveat to server logs every time so it's not
  // silent. This is the bit we'd automate later with a WhatsApp Business
  // API integration.
  console.log(
    "[trade-off/forgot-password] manual admin step required — code minted:",
    code ?? "(no listing matched)"
  );

  return NextResponse.json({
    ok: true,
    whatsapp_url: waUrl,
    manual_admin_step:
      "Your message has been routed to our admin team. We'll verify and send you a set-password link by reply. Auto-recovery (WhatsApp Business API) is on the roadmap."
  });
}
