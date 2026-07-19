// beaconNotify — dual-channel notification for beacon claim assignments.
//
// Fires the moment a trade is assigned a new claim (via runFanoutWave):
//   1. Web Push to their PWA home-screen icon (via sendLeadAlert +
//      hammerex_xrated_push_subscriptions) — includes native badge +
//      vibration + tap-to-open the inbox
//   2. Resend email as fallback for merchants who haven't installed
//      the PWA / opted into push
//
// Different subject + CTA per readiness tier:
//   Tier 1 (active-ready): "Real job in {city} — claim within 2h"
//     → directly opens their /install-leads inbox
//   Tier 2 (warm — no washers OR no WhatsApp): "Someone wants to hire
//     you — set up WhatsApp / top up washers to unlock"
//     → routes to /washers or /edit for setup
//   Tier 3 (cold — both missing): skip both channels; they won't
//     convert without both fixes and we'd rather not spam them.
//
// Best-effort — both channels log but never throw. If RESEND_API_KEY
// or VAPID keys aren't set, the respective send is a no-op.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendLeadAlert } from "@/lib/leadAlerts";

type SendOpts = {
  merchantId:      string;
  merchantSlug:    string;
  readinessTier:   1 | 2 | 3;
  beaconId:        string;
  customerName:    string;
  customerCity:    string | null;
  tradeSlug:       string;
  description:     string;
  slaHours:        number;
};

const FROM = process.env.HAMMEREX_TRADE_FROM_EMAIL
  || process.env.RESEND_FROM_EMAIL
  || "The Network <noreply@thenetworkers.app>";
const CANONICAL = process.env.NEXT_PUBLIC_CANONICAL_ORIGIN ?? "https://thenetworkers.app";

async function sendViaResend(opts: { to: string; subject: string; html: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[beaconNotify] RESEND_API_KEY not set — skipping "${opts.subject}"`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ from: FROM, to: [opts.to], subject: opts.subject, html: opts.html })
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error(`[beaconNotify] Resend ${res.status}: ${txt}`);
    }
  } catch (err) {
    console.error("[beaconNotify] send threw:", err);
  }
}

async function recipientEmail(merchantId: string): Promise<{ email: string; firstName: string; editToken: string; slug: string } | null> {
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("email, display_name, edit_token, slug")
    .eq("id", merchantId)
    .eq("status", "live")
    .maybeSingle();
  const email = res.data?.email as string | null | undefined;
  if (!email) return null;
  return {
    email,
    firstName: ((res.data!.display_name as string) ?? "there").split(/\s+/)[0],
    editToken: (res.data!.edit_token as string) ?? "",
    slug:      (res.data!.slug as string) ?? ""
  };
}

/** Send the appropriate notification for a newly-assigned beacon
 *  claim. Called from runFanoutWave after the claim rows are
 *  inserted. Best-effort per merchant — one failure doesn't block
 *  the wave. Fires TWO channels in parallel:
 *    (a) Web Push to home-screen PWA (via sendLeadAlert)
 *    (b) Resend email fallback */
export async function notifyBeaconAssigned(opts: SendOpts): Promise<void> {
  if (opts.readinessTier === 3) return; // cold — don't spam

  // Look up recipient early so we have edit_token for the push URL
  // (routes to the merchant's magic-linked /install-leads inbox).
  const to = await recipientEmail(opts.merchantId);

  // (a) Web push to their PWA home-screen icon — fires immediately,
  //     native badge/sound/vibration on the merchant's phone.
  //     sendLeadAlert handles quiet-hours, mutes, throttling, dead-
  //     subscription cleanup. Never throws.
  if (to) {
    sendLeadAlert(opts.merchantId, {
      type: "beacon_claim",
      data: {
        customer_name:       opts.customerName,
        customer_city:       opts.customerCity ?? "",
        trade_label:         opts.tradeSlug.replace(/-/g, " "),
        project_excerpt:     opts.description.slice(0, 180),
        merchant_slug:       to.slug,
        merchant_edit_token: to.editToken,
        sla_hours:           opts.slaHours,
        readiness_tier:      opts.readinessTier
      }
    }).catch((err) => console.error("[beaconNotify] push failed:", err));
  }

  // (b) Resend email fallback — reaches merchants who haven't
  //     installed the PWA / opted into push
  if (!to) return;

  const cityBit = opts.customerCity ? ` in ${opts.customerCity}` : "";
  const inboxUrl = `${CANONICAL}/trade-off/edit/${encodeURIComponent(to.slug)}/install-leads?token=${encodeURIComponent(to.editToken)}`;
  const briefEscaped = escapeHtml(opts.description.slice(0, 320));

  if (opts.readinessTier === 1) {
    // Active-ready — can claim immediately
    const subject = `New job${cityBit} — claim within ${opts.slaHours}h`;
    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0a0a0a">
        <p style="font-size:11px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:#7A5B00;margin:0 0 8px 0">
          Community job request · ${opts.slaHours}h SLA
        </p>
        <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:900;line-height:1.2">
          ${escapeHtml(opts.customerName)} needs ${escapeHtml(opts.tradeSlug.replace(/-/g, " "))}${cityBit}
        </h1>
        <blockquote style="margin:0 0 16px 0;padding:12px 14px;background:#FFF7DB;border-left:3px solid #FFB300;font-size:13px;line-height:1.5;color:#333;border-radius:6px">
          &ldquo;${briefEscaped}${opts.description.length > 320 ? "…" : ""}&rdquo;
        </blockquote>
        <p style="margin:0 0 16px 0;font-size:13px;line-height:1.5;color:#333">
          Claim the lead in your inbox — 1 washer per claim, opens WhatsApp with the customer's contact pre-filled. Fastest trade wins.
        </p>
        <a href="${inboxUrl}" style="display:inline-block;background:#166534;color:#fff;text-decoration:none;padding:14px 22px;border-radius:9999px;font-weight:900;font-size:12px;letter-spacing:0.1em;text-transform:uppercase">
          Open your inbox
        </a>
        <p style="margin:24px 0 0 0;font-size:11px;color:#666">
          If you don't claim within ${opts.slaHours} hours, the lead re-routes to another trade and you'll see it as expired in your inbox.
        </p>
      </div>
    `;
    await sendViaResend({ to: to.email, subject, html });
    return;
  }

  // Tier 2 — warm. Different CTA depending on what's blocking them.
  // We don't know exactly which is missing here without more data;
  // send the generic "unlock to claim" version.
  const subject = `Someone wants to hire you — activate to reply`;
  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0a0a0a">
      <p style="font-size:11px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:#B8860B;margin:0 0 8px 0">
        Real customer wants to hire you
      </p>
      <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:900;line-height:1.2">
        ${escapeHtml(opts.customerName)}${cityBit} needs a ${escapeHtml(opts.tradeSlug.replace(/-/g, " "))} — you're first choice
      </h1>
      <blockquote style="margin:0 0 16px 0;padding:12px 14px;background:#FFF7DB;border-left:3px solid #FFB300;font-size:13px;line-height:1.5;color:#333;border-radius:6px">
        &ldquo;${briefEscaped}${opts.description.length > 320 ? "…" : ""}&rdquo;
      </blockquote>
      <p style="margin:0 0 16px 0;font-size:13px;line-height:1.5;color:#333">
        To message this customer, your Tradesite needs to have a WhatsApp number connected AND at least 1 washer (WhatsApp lead credit) in your bag. Set that up in 60 seconds — it also unlocks every future lead.
      </p>
      <a href="${inboxUrl}" style="display:inline-block;background:#166534;color:#fff;text-decoration:none;padding:14px 22px;border-radius:9999px;font-weight:900;font-size:12px;letter-spacing:0.1em;text-transform:uppercase">
        Set up + claim this lead
      </a>
      <p style="margin:24px 0 0 0;font-size:11px;color:#666">
        Fastest trades to activate get the lead. Later trades see "SLA missed" in their inbox.
      </p>
    </div>
  `;
  await sendViaResend({ to: to.email, subject, html });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
