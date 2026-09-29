"use client";

// src/app/nex-native/_push-subscribe-hub.tsx
//
// Bridge 89b · Requests Notification permission + registers the
// nex-native service worker + subscribes to Web Push + POSTs the
// subscription to the server. Mounted from layout.tsx alongside the
// incoming-call hub so it runs on every nex-native page.
// ------------------------------------------------------------------
// Permission strategy: DON'T prompt immediately on page load (users
// hate that). Instead, request when the user opens ANY peer chat for
// the first time · that's a natural "you're using messaging, would
// you like to be notified?" moment. Also request on the /settings
// page for users who want to enable it deliberately.
//
// For MVP we skip the prompt gating and request on layout mount ONCE
// per browser (localStorage guard). Users who dismiss get a normal
// browser "you can enable this in settings" fallback. Refined
// prompting UX is a follow-up.

import * as React from "react";
import { upsertPushSubscriptionAction } from "./_actions";

const PROMPT_GUARD_KEY = "nex-native:push-prompted-at";
const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days between prompts

export interface PushSubscribeHubProps {
  vapidPublicKey: string | null;
  disabled?: boolean;
}

export function PushSubscribeHub(props: PushSubscribeHubProps): null {
  React.useEffect(() => {
    if (props.disabled) return;
    if (!props.vapidPublicKey) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    let cancelled = false;
    (async () => {
      try {
        // Register / update the service worker · scope covers the whole
        // /nex-native/ segment so notifications from a chat surface
        // land properly.
        const reg = await navigator.serviceWorker.register(
          "/nex-native-sw.js",
          { scope: "/nex-native/" },
        );
        if (cancelled) return;

        // Stash the VAPID key in a cache the SW can read on
        // pushsubscriptionchange so it can silently re-subscribe.
        try {
          const cache = await caches.open("nex-native-push-config");
          await cache.put(
            "/nex-native-push-vapid",
            new Response(props.vapidPublicKey, {
              headers: { "content-type": "text/plain" },
            }),
          );
        } catch { /* not fatal · cache may be disabled */ }

        // If we already have a subscription, POST a heartbeat to
        // refresh last_seen_at and exit.
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          await postSubscription(existing);
          return;
        }

        // First-run · check permission. If default (not yet asked),
        // gate on the prompt cooldown so we don't nag users who
        // dismissed. If denied · nothing to do.
        const permission = Notification.permission;
        if (permission === "denied") return;
        if (permission === "default") {
          const last = Number(localStorage.getItem(PROMPT_GUARD_KEY) ?? 0);
          if (Date.now() - last < PROMPT_COOLDOWN_MS) return;
          localStorage.setItem(PROMPT_GUARD_KEY, String(Date.now()));
          const requested = await Notification.requestPermission();
          if (requested !== "granted") return;
        }

        // Subscribe.
        const key = urlBase64ToUint8Array(props.vapidPublicKey);
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        });
        if (cancelled) return;
        await postSubscription(sub);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[nex push subscribe]", (e as Error).message);
      }
    })();

    return () => { cancelled = true; };
  }, [props.vapidPublicKey, props.disabled]);

  return null;
}

async function postSubscription(sub: PushSubscription): Promise<void> {
  const wire = sub.toJSON();
  if (!wire.endpoint || !wire.keys?.p256dh || !wire.keys?.auth) return;
  const fd = new FormData();
  fd.set("endpoint", wire.endpoint);
  fd.set("p256dh", wire.keys.p256dh);
  fd.set("auth", wire.keys.auth);
  if (typeof navigator !== "undefined") {
    fd.set("user_agent", navigator.userAgent);
  }
  await upsertPushSubscriptionAction(fd);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
