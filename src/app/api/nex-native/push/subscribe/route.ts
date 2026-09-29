// src/app/api/nex-native/push/subscribe/route.ts
//
// Bridge 89b · Endpoint used by the service worker's
// pushsubscriptionchange event to POST a rotated subscription
// without needing a full page context. The regular client-side
// subscribe flow goes through upsertPushSubscriptionAction (Server
// Action) · this exists for the SW code path that has no React tree.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { upsertPushSubscription } from "@/lib/nex-native/push-subscription-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  let body: { endpoint?: string; p256dh?: string; auth?: string };
  try {
    body = (await req.json()) as { endpoint?: string; p256dh?: string; auth?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body.endpoint || !body.p256dh || !body.auth) {
    return NextResponse.json({ ok: false, error: "invalid_subscription" }, { status: 400 });
  }
  try {
    await upsertPushSubscription(session.account.id, {
      endpoint: body.endpoint,
      p256dh: body.p256dh,
      auth: body.auth,
      user_agent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
