// Nex Web Push · single POST endpoint · Philip 2026-08-03.
//
// One route, action-dispatched. Keeps the surface tight while the demo
// storage is in-memory; each action becomes its own module when the
// persistent backend lands.
//
// Actions:
//   subscribe   · { sessionId, subscription }
//   unsubscribe · { sessionId }
//   schedule    · { sessionId, taskId, fireAt, payload }
//   cancel      · { taskId }
//   test        · { sessionId, payload? }
//   config      · returns { vapidPublicKey, ready }

import { NextResponse } from "next/server";
import {
  cancelScheduledPush,
  getSubscription,
  getVapidPublicKey,
  isVapidConfigured,
  removeSubscription,
  schedulePush,
  sendPushNow,
  storeSubscription,
  type NexPushSubscription,
  type PushPayload,
} from "@/lib/nex/push/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    vapidPublicKey: getVapidPublicKey(),
    ready: isVapidConfigured(),
  });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";

  switch (action) {
    case "subscribe": {
      const sessionId = String(body.sessionId ?? "");
      const subscription = body.subscription as NexPushSubscription | undefined;
      if (!sessionId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return NextResponse.json({ ok: false, error: "bad_params" }, { status: 400 });
      }
      storeSubscription(sessionId, subscription);
      return NextResponse.json({ ok: true });
    }

    case "unsubscribe": {
      const sessionId = String(body.sessionId ?? "");
      if (!sessionId) {
        return NextResponse.json({ ok: false, error: "bad_params" }, { status: 400 });
      }
      removeSubscription(sessionId);
      return NextResponse.json({ ok: true });
    }

    case "schedule": {
      const sessionId = String(body.sessionId ?? "");
      const taskId = String(body.taskId ?? "");
      const fireAt = Number(body.fireAt ?? 0);
      const payload = body.payload as PushPayload | undefined;
      if (!sessionId || !taskId || !fireAt || !payload?.title) {
        return NextResponse.json({ ok: false, error: "bad_params" }, { status: 400 });
      }
      const res = schedulePush({ sessionId, taskId, fireAt, payload });
      return NextResponse.json(res);
    }

    case "cancel": {
      const taskId = String(body.taskId ?? "");
      if (!taskId) return NextResponse.json({ ok: false, error: "bad_params" }, { status: 400 });
      const res = cancelScheduledPush(taskId);
      return NextResponse.json(res);
    }

    case "test": {
      const sessionId = String(body.sessionId ?? "");
      if (!sessionId) return NextResponse.json({ ok: false, error: "bad_params" }, { status: 400 });
      const sub = getSubscription(sessionId);
      if (!sub) return NextResponse.json({ ok: false, error: "no_subscription" }, { status: 404 });
      const payload: PushPayload = {
        title: "Nex is listening 🔔",
        body: "Reminders will now reach you even when Nex isn't open.",
        tag: "nex-test",
        data: { url: "/nex-app/chat", kind: "test" },
      };
      const res = await sendPushNow(sub, payload);
      return NextResponse.json(res);
    }

    default:
      return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  }
}
