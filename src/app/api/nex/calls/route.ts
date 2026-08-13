// Nex Calls · signaling POST + inbox GET · Philip 2026-08-03.
//
// POST /api/nex/calls with { action: "signal", signal }
// GET  /api/nex/calls?sessionId=X — drains and returns pending signals
//
// When a POSTed signal is an offer OR a hangup, we ALSO try to send a
// Web Push notification to the recipient so a closed tab can wake up.
// This is the reliability piece Philip called out: "someone called me
// and I never knew" is worse than "no video." Best-effort — if the
// recipient hasn't enabled push, the offer still lands in the inbox
// (an open tab picks it up on the next poll).

import { NextResponse } from "next/server";
import {
  deliverSignal,
  drainInbox,
  type CallSignal,
} from "@/lib/nex/calls/server";
import {
  getSubscription,
  sendPushNow,
  isVapidConfigured,
  type PushPayload,
} from "@/lib/nex/push/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "missing_sessionId" }, { status: 400 });
  }
  const signals = drainInbox(sessionId);
  return NextResponse.json({ ok: true, signals });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const signal = body.signal as CallSignal | undefined;
  if (!signal || typeof signal.kind !== "string" || !signal.callId || !signal.to || !signal.from?.sessionId) {
    return NextResponse.json({ ok: false, error: "bad_signal" }, { status: 400 });
  }
  deliverSignal(signal);

  // Reliability: nudge the recipient's device on offer + hangup.
  // Offer → "someone is calling"; Hangup → dismiss the notification
  // by re-sending with the same tag + short body so it doesn't linger.
  if (isVapidConfigured() && (signal.kind === "offer" || signal.kind === "hangup")) {
    const sub = getSubscription(signal.to);
    if (sub) {
      const tag = `nex-call-${signal.callId}`;
      let payload: PushPayload;
      if (signal.kind === "offer") {
        const c = signal.contact;
        const callerName = c?.name ?? "Someone";
        const subtitle = c?.trade
          ? `${c.trade}${c.city ? " · " + c.city : ""}`
          : c?.city ?? "Incoming Nex call";
        payload = {
          title: `${callerName} is calling…`,
          body: subtitle,
          tag,
          requireInteraction: true, // stay visible until user acts
          data: {
            // Session param ensures the fresh tab hydrates with the
            // right identity so it can drain the offer from the inbox.
            url: `/nex-app/chat?session=${encodeURIComponent(signal.to)}&callId=${encodeURIComponent(signal.callId)}`,
            kind: "incoming_call",
            callId: signal.callId,
          },
        };
      } else {
        // Hangup path — replace the earlier notification (same tag) with
        // a passive "Missed call" so the user knows without a phantom
        // "ringing" notification sitting on their lock screen.
        payload = {
          title: "Missed call",
          body: "Ended before you answered",
          tag,
          requireInteraction: false,
          data: {
            url: `/nex-app/chat?session=${encodeURIComponent(signal.to)}`,
            kind: "missed_call",
            callId: signal.callId,
          },
        };
      }
      // Fire and forget · not awaiting because signaling round-trip
      // should return fast; failed pushes are logged server-side.
      void sendPushNow(sub, payload).catch(() => { /* ignore */ });
    }
  }

  return NextResponse.json({ ok: true });
}
