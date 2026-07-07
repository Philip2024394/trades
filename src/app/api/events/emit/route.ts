// POST /api/events/emit
//
// The HTTP write path for the events pipeline. Every client — the
// mobile capture UI, the CRM sync, the review inbox, the checkout
// webhook — hits this endpoint to record something happening in the
// business.
//
// Body:
//   {
//     merchantId, eventType, payload, aiUnderstanding?,
//     occurredAt?, source?, idempotencyKey?
//   }
//
// Response:
//   {
//     event: { id, ... },
//     projections: [ { projectionType, status, reason? } ]
//   }

import { NextResponse } from "next/server";
import { emitEvent } from "@/lib/events/emit";
import {
  BUSINESS_EVENT_TYPES,
  isBusinessEventType
} from "@/lib/events/types";

export const runtime = "nodejs";

type Body = {
  merchantId?: string;
  eventType?: string;
  payload?: Record<string, unknown>;
  aiUnderstanding?: Record<string, unknown>;
  occurredAt?: string;
  source?: string;
  idempotencyKey?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.merchantId) {
    return NextResponse.json(
      { error: "merchantId required" },
      { status: 400 }
    );
  }
  if (!body.eventType || !isBusinessEventType(body.eventType)) {
    return NextResponse.json(
      {
        error: "unknown event_type",
        detail: `must be one of ${BUSINESS_EVENT_TYPES.join(", ")}`
      },
      { status: 400 }
    );
  }
  const result = await emitEvent({
    merchantId: body.merchantId,
    eventType: body.eventType,
    payload: body.payload ?? {},
    aiUnderstanding: body.aiUnderstanding,
    occurredAt: body.occurredAt,
    source: body.source,
    idempotencyKey: body.idempotencyKey
  });
  if (!result.event) {
    return NextResponse.json(
      { error: result.reason ?? "emit failed" },
      { status: 503 }
    );
  }
  return NextResponse.json(result);
}
