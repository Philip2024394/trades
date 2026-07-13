// Notification dispatch — persists a row in app_notifications and, when
// the recipient has a Web Push subscription, pushes it to their device
// so they get the sound + red badge on the app icon.

import "server-only";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RecipientKind = "trade" | "merchant";

export type DispatchNotificationInput = {
  recipientKind: RecipientKind;
  recipientId:   string;
  kind:          string;           // event type from the OS bus
  title:         string;
  body:          string;
  actionUrl?:    string;
  subjectType?:  string;
  subjectId?:    string;
  payload?:      Record<string, unknown>;
  /** Optional unread count for the app badge (defaults to server count). */
  badgeCount?:   number;
};

const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.XRATED_VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.XRATED_VAPID_SUBJECT ?? "mailto:admin@theconstructionnotebook.com";
let vapidConfigured = false;
function configureVapidIfPossible(): boolean {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidConfigured = true;
  return true;
}

/**
 * Persist a notification for a recipient. Fires a push to every enabled
 * subscription. Never throws — a push provider failure just marks that
 * subscription's `failure_count`.
 */
export async function dispatchNotification(input: DispatchNotificationInput): Promise<{ notificationId: string | null; pushSent: number }> {
  // 1. Persist
  const { data: notification, error } = await supabaseAdmin
    .from("app_notifications")
    .insert({
      recipient_kind: input.recipientKind,
      recipient_id:   input.recipientId,
      kind:           input.kind,
      title:          input.title,
      body:           input.body,
      action_url:     input.actionUrl ?? null,
      subject_type:   input.subjectType ?? null,
      subject_id:     input.subjectId ?? null,
      payload:        input.payload ?? {}
    })
    .select("id")
    .single();
  if (error || !notification) {
    // eslint-disable-next-line no-console
    console.error("[TC notif] persist failed:", error?.message);
    return { notificationId: null, pushSent: 0 };
  }

  // 2. Look up subscriptions
  const { data: subs } = await supabaseAdmin
    .from("app_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("recipient_kind", input.recipientKind)
    .eq("recipient_id",   input.recipientId)
    .eq("enabled",        true);

  if (!subs || subs.length === 0) return { notificationId: notification.id, pushSent: 0 };
  if (!configureVapidIfPossible()) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log(`[TC notif · dev fallback] ${input.title} → ${input.recipientKind}:${input.recipientId}`);
    }
    return { notificationId: notification.id, pushSent: 0 };
  }

  // 3. Count unread for the badge
  const { count: unreadCount } = await supabaseAdmin
    .from("app_notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_kind", input.recipientKind)
    .eq("recipient_id",   input.recipientId)
    .is("read_at", null);

  const pushBody = JSON.stringify({
    title:  input.title,
    body:   input.body,
    tag:    input.subjectId ?? input.kind,
    data: {
      url:     input.actionUrl ?? "/tc/hub",
      badge:   input.badgeCount ?? unreadCount ?? 0,
      kind:    input.kind,
      subject: input.subjectId ?? null
    },
    vibrate: [200, 100, 200]
  });

  let pushSent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          pushBody
        );
        pushSent++;
        await supabaseAdmin
          .from("app_push_subscriptions")
          .update({ last_delivered_at: new Date().toISOString(), failure_count: 0 })
          .eq("id", s.id);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode ?? 0;
        // 404/410 = subscription gone; disable
        if (status === 404 || status === 410) {
          await supabaseAdmin
            .from("app_push_subscriptions")
            .update({ enabled: false, failure_count: 999 })
            .eq("id", s.id);
        } else {
          await supabaseAdmin
            .from("app_push_subscriptions")
            .update({ failure_count: 999 })  // increments would need RPC; flat cap is fine
            .eq("id", s.id);
        }
      }
    })
  );

  return { notificationId: notification.id, pushSent };
}
