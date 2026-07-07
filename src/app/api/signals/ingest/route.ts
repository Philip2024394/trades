// POST /api/signals/ingest
//
// The single write path for engagement + conversion signals. Called by:
//   - Meta webhooks (like / comment / save)
//   - Google Business Profile insights sync
//   - Our own quote-form / phone-tap / whatsapp-tap trackers
//   - Google Search Console impressions sync (nightly)
//   - Plausible / GA analytics batch
//
// Body:
//   {
//     merchantId, publicationId?, eventId?,
//     signalType, value?, source?, metadata?, observedAt?
//   }

import { NextResponse } from "next/server";
import { insertSignal } from "@/lib/signals/loader";
import type { SignalType } from "@/lib/signals/types";

export const runtime = "nodejs";

const VALID_TYPES: SignalType[] = [
  "like",
  "comment",
  "save",
  "share",
  "click_through",
  "view",
  "lead_form_submit",
  "call",
  "whatsapp_tap",
  "booking"
];

type Body = {
  merchantId?: string;
  publicationId?: string;
  eventId?: string;
  signalType?: string;
  value?: number;
  source?: string;
  metadata?: Record<string, unknown>;
  observedAt?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.merchantId) {
    return NextResponse.json(
      { error: "merchantId required" },
      { status: 400 }
    );
  }
  if (!body.signalType || !VALID_TYPES.includes(body.signalType as SignalType)) {
    return NextResponse.json(
      { error: "invalid signalType" },
      { status: 400 }
    );
  }
  const ok = await insertSignal({
    merchantId: body.merchantId,
    publicationId: body.publicationId,
    eventId: body.eventId,
    signalType: body.signalType as SignalType,
    value: body.value,
    source: body.source,
    metadata: body.metadata,
    observedAt: body.observedAt
  });
  if (!ok) return NextResponse.json({ error: "insert failed" }, { status: 503 });
  return NextResponse.json({ ok: true });
}
