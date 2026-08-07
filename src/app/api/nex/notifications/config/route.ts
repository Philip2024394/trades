// GET /api/nex/notifications/config — Notifications Runtime config surface
//
// Per-channel active provider · capabilities · env-var status · queue
// snapshot · health probes. Same shape as /api/nex/email/config.

import { NextResponse } from "next/server";
import { getNotifications, isNotificationsChannelHealthy, knownAdapters } from "@/lib/nex/notifications/registry";
import { getNotificationsQueue } from "@/lib/nex/notifications/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function maskSecret(v: string): { present: true; last4: string; length: number; masked: true } {
  return { present: true, last4: v.slice(-4), length: v.length, masked: true };
}

const TRACKED_ENV = [
  { name: "NEX_NOTIFICATIONS_WHATSAPP_PROVIDER", secret: false, purpose: "Adapter to use for WhatsApp channel (default: meta)" },
  { name: "NEX_NOTIFICATIONS_SMS_PROVIDER",      secret: false, purpose: "Adapter to use for SMS channel (default: twilio · not built)" },
  { name: "NEX_NOTIFICATIONS_PUSH_PROVIDER",     secret: false, purpose: "Adapter to use for Push channel (default: web-push · not built)" },
  { name: "META_WHATSAPP_PHONE_NUMBER_ID",       secret: false, purpose: "Meta WhatsApp sender phone number id" },
  { name: "META_WHATSAPP_ACCESS_TOKEN",          secret: true,  purpose: "Meta WhatsApp access token" },
  { name: "META_WHATSAPP_OTP_TEMPLATE",          secret: false, purpose: "Pre-approved WhatsApp template name for OTP flows (optional)" },
] as const;

export async function GET() {
  const channels: Array<"whatsapp" | "sms" | "push" | "in_app"> = ["whatsapp"];   // channels with a wired adapter today
  const perChannel = await Promise.all(channels.map(async (ch) => {
    const adapter = getNotifications(ch);
    const health = await isNotificationsChannelHealthy(ch);
    return {
      channel: ch,
      active_provider: adapter.name,
      capabilities: adapter.capabilities,
      health,
    };
  }));

  const env = TRACKED_ENV.map((e) => {
    const raw = process.env[e.name];
    if (!raw) return { name: e.name, purpose: e.purpose, secret: e.secret, present: false };
    if (e.secret) return { name: e.name, purpose: e.purpose, secret: true, ...maskSecret(raw) };
    return { name: e.name, purpose: e.purpose, secret: false, present: true, value: raw };
  });

  const queue = getNotificationsQueue().snapshot();

  return NextResponse.json({
    ok: true,
    runtime: "nex-notifications",
    channels: perChannel,
    adapters: knownAdapters(),
    queue,
    env,
    dev_mode: process.env.NODE_ENV !== "production",
    generated_at: new Date().toISOString(),
  });
}
