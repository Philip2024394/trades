// GET /api/nex/provider/inbox?learner_ref=... · Philip 2026-08-29
//
// Returns the CURRENT set of incoming service requests waiting for THIS
// provider's response. Used by the provider inbox surface (fast accept /
// decline experience — doctrine v5).
//
// Query: pending offers for this provider where the underlying request is
// still in REQUEST_BROADCAST state and has not exceeded broadcast_expires_at.
//
// Side effect: any offer that hasn't been seen yet is stamped seen_at = now()
// so we can later measure display-latency reliability metrics per provider.
//
// Returns price_agreed BEFORE the provider accepts — doctrine transparency
// lock: provider must know the exact price before deciding.

import { NextRequest, NextResponse } from "next/server";
import pg from "pg";
import { getPostgresUrl } from "@/lib/nex/config/pg";

const { Pool } = pg;
let pool: pg.Pool | null = null;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getPostgresUrl(),
      max: 3,
    });
  }
  return pool;
}

function validateLearnerRef(ref: unknown): string | null {
  if (typeof ref !== "string") return null;
  const trimmed = ref.trim();
  if (!/^(nex_id:\d+|device:[a-zA-Z0-9-]{8,})$/.test(trimmed)) return null;
  return trimmed;
}

export async function GET(req: NextRequest) {
  const learner = validateLearnerRef(req.nextUrl.searchParams.get("learner_ref"));
  if (!learner)
    return NextResponse.json({ ok: false, error: "invalid learner_ref" }, { status: 400 });

  const client = await getPool().connect();
  try {
    // Resolve the provider row
    const { rows: pRows } = await client.query(
      `SELECT provider_id, full_name, is_available, status
       FROM nex.provider_profile
       WHERE learner_ref = $1
       LIMIT 1`,
      [learner],
    );
    if (pRows.length === 0) {
      return NextResponse.json({
        ok: true, provider: null, requests: [],
        hint: "No provider profile on this device.",
      });
    }
    const p = pRows[0];

    // Stamp seen_at on unseen open offers · reliability metric prep
    await client.query(
      `UPDATE nex.service_request_offer o
       SET seen_at = now()
       FROM nex.service_request r
       WHERE o.request_id = r.request_id
         AND o.provider_id = $1
         AND o.response IS NULL
         AND o.seen_at IS NULL
         AND r.state = 'REQUEST_BROADCAST'
         AND r.broadcast_expires_at > now()`,
      [p.provider_id],
    );

    // Fetch the open offers (post-stamp)
    const { rows: offers } = await client.query(
      `SELECT o.offer_id, o.request_id, o.offered_price_idr,
              o.sent_at, o.seen_at,
              r.service_kind, r.destination_text, r.origin_text,
              r.destination_lat, r.destination_lng,
              r.origin_lat, r.origin_lng,
              r.broadcast_expires_at
       FROM nex.service_request_offer o
       JOIN nex.service_request r ON r.request_id = o.request_id
       WHERE o.provider_id = $1
         AND o.response IS NULL
         AND r.state = 'REQUEST_BROADCAST'
         AND r.broadcast_expires_at > now()
       ORDER BY o.sent_at DESC`,
      [p.provider_id],
    );

    return NextResponse.json({
      ok: true,
      provider: {
        provider_id: p.provider_id,
        name: p.full_name,
        is_available: p.is_available,
        status: p.status,
      },
      requests: offers.map((o) => ({
        offer_id: o.offer_id,
        request_id: o.request_id,
        service_kind: o.service_kind,
        destination_text: o.destination_text,
        origin_text: o.origin_text,
        // Coordinates included when known; UI decides whether to render
        // distance. Doctrine ban: never fabricate distance from nothing.
        destination_lat: o.destination_lat,
        destination_lng: o.destination_lng,
        origin_lat: o.origin_lat,
        origin_lng: o.origin_lng,
        offered_price_idr: o.offered_price_idr,
        sent_at: o.sent_at,
        seen_at: o.seen_at,
        expires_at: o.broadcast_expires_at,
      })),
    });
  } finally {
    client.release();
  }
}
