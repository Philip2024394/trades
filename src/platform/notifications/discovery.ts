// Platform Notifications Discovery + Delivery.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  Notification delivery must be uniform. If each
//    App shipped its own email/push/SSE pipeline, users would have
//    N inconsistent preferences UIs and inconsistent unread state.
//    Users configure preferences once for every App.
//
// 2. Which future Apps benefit?  Every App that emits user-visible
//    events. Marketplace (`marketplace.back_in_stock`), Orders
//    (`orders.dispatched`), Reviews (`reviews.published`), Messages
//    (`messages.received`), Community (`community.mentioned`).
//
// 3. Which doc authorises?  ADR-049 + TRADE_CENTER_PLATFORM_DELTA
//    §6 Week 2 "Notifications system (registry + preferences + SSE
//    bell)".
//
// ─── Design ─────────────────────────────────────────────────────────
//
// Week 2 ships:
//   • Discovery — every notification kind declared on every App.
//   • In-memory delivery inbox — the bell UI reads from here.
//   • Preferences shape — persisted per user per kind per channel
//     (Wave 2 to tc_notifications_preferences).
//
// Real channel delivery (SSE, email via Resend, Web Push) lands as
// ADR-049b once the notifications inbox has a persistent home.

import { appRegistry } from "@/platform/registry";
import { emitBaseline } from "@/platform/telemetry/baseline";
import type { NotificationKindDeclaration } from "@/platform/manifest/types";

// ─── Types ─────────────────────────────────────────────────────

export type NotificationChannel = "in-app" | "email" | "push";

export type Notification = {
  id: string;
  kind: string;          // e.g. "orders.dispatched"
  userSlug: string;
  title: string;
  body?: string;
  href?: string;
  createdAt: number;
  readAt?: number;
};

// ─── Discovery ────────────────────────────────────────────────

export type DiscoveredNotificationKind = NotificationKindDeclaration & {
  appSlug: string;
  appName: string;
};

export function discoverNotificationKinds(): DiscoveredNotificationKind[] {
  const out: DiscoveredNotificationKind[] = [];
  for (const app of appRegistry.list()) {
    if (!app.notificationKinds?.length) continue;
    for (const n of app.notificationKinds) {
      out.push({ ...n, appSlug: app.slug, appName: app.name });
    }
  }
  return out;
}

// ─── In-memory delivery inbox ─────────────────────────────────

const inbox: Notification[] = [];

/** Emit a notification. Real delivery pipeline (SSE / email / push)
 *  is Wave 2 — Week 2 stores in an in-memory inbox so the bell UI
 *  can read + count. */
export function deliver(input: {
  kind: string;
  userSlug: string;
  title: string;
  body?: string;
  href?: string;
}): Notification {
  // Verify the kind is declared by some App — reject undeclared
  // emissions silently (dev-warned).
  const declared = discoverNotificationKinds().some((d) => d.kind === input.kind);
  if (!declared) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        `[notifications] rejected: kind "${input.kind}" not declared by any App`
      );
    }
    // Return a rejected sentinel so callers can log but not treat
    // as successful.
    return {
      id: "rejected",
      kind: input.kind,
      userSlug: input.userSlug,
      title: input.title,
      body: input.body,
      href: input.href,
      createdAt: Date.now()
    };
  }
  const notification: Notification = {
    id: `${input.kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    userSlug: input.userSlug,
    title: input.title,
    body: input.body,
    href: input.href,
    createdAt: Date.now()
  };
  inbox.push(notification);
  emitBaseline("plugin.event.emitted", 1, {
    app: "shell",
    kind: "notifications.delivered"
  });
  return notification;
}

export function listForUser(userSlug: string): Notification[] {
  return inbox
    .filter((n) => n.userSlug === userSlug)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function unreadCountForUser(userSlug: string): number {
  return inbox.filter((n) => n.userSlug === userSlug && !n.readAt).length;
}

export function markRead(notificationId: string): void {
  const n = inbox.find((n) => n.id === notificationId);
  if (n && !n.readAt) {
    n.readAt = Date.now();
    emitBaseline("plugin.event.emitted", 1, {
      app: "shell",
      kind: "notifications.marked_read"
    });
  }
}

// ─── Reset (verification harness) ─────────────────────────────

export function resetNotificationsForTests(): void {
  inbox.length = 0;
}
