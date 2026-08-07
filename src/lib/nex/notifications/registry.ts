// NEX Notifications Runtime · registry
//
// Per-channel adapter selection. Env vars name the active provider per
// channel · defaults reflect the recommended provider for each channel.
//
//   NEX_NOTIFICATIONS_WHATSAPP_PROVIDER  · default "meta"
//   NEX_NOTIFICATIONS_SMS_PROVIDER       · default "twilio"    (adapter arrives Phase 3d.2b)
//   NEX_NOTIFICATIONS_PUSH_PROVIDER      · default "web-push"  (adapter arrives Phase 3d.2b)
//
// Adding a new adapter = one entry in `build()` + one file in
// ./adapters/. Callers never import adapters directly.

import type { NotificationAdapter, NotificationChannel } from "./types";
import { isWhatsappMetaHealthy, whatsappMetaAdapter } from "./adapters/whatsapp_meta";

const cache = new Map<NotificationChannel, NotificationAdapter>();

export function getNotifications(channel: NotificationChannel): NotificationAdapter {
  const cached = cache.get(channel);
  if (cached) return cached;
  const provider = (process.env[`NEX_NOTIFICATIONS_${channel.toUpperCase()}_PROVIDER`] ?? defaultProvider(channel)).toLowerCase();
  const built = build(channel, provider);
  cache.set(channel, built);
  return built;
}

function defaultProvider(channel: NotificationChannel): string {
  switch (channel) {
    case "whatsapp": return "meta";
    case "sms":      return "twilio";
    case "push":     return "web-push";
    case "in_app":   return "native";
  }
}

function build(channel: NotificationChannel, provider: string): NotificationAdapter {
  if (channel === "whatsapp" && provider === "meta") return whatsappMetaAdapter;
  throw new Error(`[nex-notifications] no adapter for channel="${channel}" provider="${provider}" · check NEX_NOTIFICATIONS_${channel.toUpperCase()}_PROVIDER`);
}

/** Test-only reset · lets tests point at a different provider. */
export function _resetNotificationsForTests(): void {
  cache.clear();
}

/**
 * Every channel × provider combination the runtime knows about. `active`
 * reflects the current NEX_NOTIFICATIONS_{channel}_PROVIDER selection.
 */
export function knownAdapters(): Array<{ channel: NotificationChannel; provider: string; label: string; status: "supported" | "planned"; active: boolean; note?: string }> {
  const active: Record<NotificationChannel, string> = {
    whatsapp: (process.env.NEX_NOTIFICATIONS_WHATSAPP_PROVIDER ?? "meta").toLowerCase(),
    sms:      (process.env.NEX_NOTIFICATIONS_SMS_PROVIDER ?? "twilio").toLowerCase(),
    push:     (process.env.NEX_NOTIFICATIONS_PUSH_PROVIDER ?? "web-push").toLowerCase(),
    in_app:   (process.env.NEX_NOTIFICATIONS_IN_APP_PROVIDER ?? "native").toLowerCase(),
  };
  return [
    { channel: "whatsapp", provider: "meta",     label: "WhatsApp · Meta Business Cloud",  status: "supported", active: active.whatsapp === "meta" },
    { channel: "whatsapp", provider: "twilio",   label: "WhatsApp · Twilio",                status: "planned",   active: active.whatsapp === "twilio" },
    { channel: "sms",      provider: "twilio",   label: "SMS · Twilio",                     status: "planned",   active: active.sms === "twilio" },
    { channel: "sms",      provider: "aws-sns",  label: "SMS · AWS SNS",                    status: "planned",   active: active.sms === "aws-sns" },
    { channel: "push",     provider: "web-push", label: "Push · Web Push VAPID",            status: "planned",   active: active.push === "web-push" },
    { channel: "push",     provider: "fcm",      label: "Push · Firebase Cloud Messaging",  status: "planned",   active: active.push === "fcm" },
    { channel: "push",     provider: "apns",     label: "Push · Apple Push",                status: "planned",   active: active.push === "apns" },
    { channel: "in_app",   provider: "native",   label: "In-app · NEX native store",        status: "planned",   active: active.in_app === "native" },
  ];
}

export async function isNotificationsChannelHealthy(channel: NotificationChannel): Promise<{ healthy: boolean; detail?: string; provider: string }> {
  const adapter = getNotifications(channel);
  if (adapter.name === "meta") {
    const r = await isWhatsappMetaHealthy();
    return { ...r, provider: "meta" };
  }
  return { healthy: false, detail: `no health probe for ${channel}/${adapter.name}`, provider: adapter.name };
}
