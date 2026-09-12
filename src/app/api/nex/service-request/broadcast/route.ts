// POST /api/nex/service-request/broadcast · Philip 2026-08-29
//
// Creates a service_request row and broadcasts it to the eligible set of
// providers in the requester's city.
//
// V1 eligibility (doctrine lock 33):
//   provider_profile.status = 'active'
//   provider_profile.city = requester.city
//   provider_profile.is_available = true
//   provider_profile.price_per_service_idr IS NOT NULL
//
// Extensibility (lock 36): later filters compose on top. Never rebuild.
//
// Never simulates GPS. Never fabricates ETA. Distance/ETA per provider
// left NULL in v1 — the client-side card shows "EST · nearby" until
// real location heartbeat exists.

import { NextRequest, NextResponse } from "next/server";
import pg from "pg";
import { isProviderEligibleForBroadcast } from "@/lib/nex-mobility/fee";
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

const WINDOW_SECONDS = 15;

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try { payload = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }

  const learner_ref     = String(payload.learner_ref ?? "").trim();
  const service_kind    = String(payload.service_kind ?? "bike").trim();
  const destination     = String(payload.destination_text ?? "").trim();
  const origin_text     = payload.origin_text ? String(payload.origin_text).trim() : null;
  const city            = String(payload.city ?? "").trim();

  const errors: string[] = [];
  if (!learner_ref)                                errors.push("learner_ref required");
  if (!destination)                                errors.push("destination_text required");
  if (!city)                                       errors.push("city required");
  if (!["bike","parcel","food"].includes(service_kind)) errors.push("service_kind invalid");
  if (errors.length > 0) return NextResponse.json({ ok: false, errors }, { status: 400 });

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // ── Eligible set · V1 · lock 33 + wallet gate · lock 42 ────────
    // A provider is eligible when active+city+available+price AND either
    //   · they still have monthly allowance (< 2 completed this month) OR
    //   · their wallet balance covers 8% of their listed price.
    const { rows: eligible } = await client.query(
      `SELECT p.provider_id, p.full_name, p.plate, p.secondary_language,
              p.provides_raincoat, p.bike_slug, p.bike_year, p.bike_color_hex,
              p.price_per_service_idr, p.rating_avg, p.rating_count,
              m.brand, m.model, m.cc, m.category,
              COALESCE(w.balance_idr, 0) AS wallet_balance_idr,
              (SELECT COUNT(*)::int FROM nex.service_request sr
                 WHERE sr.provider_id = p.provider_id
                   AND sr.state = 'COMPLETED'
                   AND sr.completed_at >= date_trunc('month', now())
              ) AS free_used_this_month
       FROM nex.provider_profile p
       LEFT JOIN nex.bike_model m ON m.slug = p.bike_slug
       LEFT JOIN nex.provider_wallet w ON w.provider_id = p.provider_id
       WHERE p.status = 'active'
         AND p.is_available = true
         AND p.city = $1
         AND p.price_per_service_idr IS NOT NULL
       ORDER BY (p.rating_avg IS NOT NULL) DESC, p.rating_avg DESC NULLS LAST, p.registered_at ASC
       LIMIT 20`,
      [city],
    );

    // Wallet gate · shared eligibility rule · src/lib/nex-mobility/fee.ts
    const filtered = eligible.filter(isProviderEligibleForBroadcast);

    if (filtered.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        ok: true,
        request_id: null,
        state: "NO_PROVIDERS",
        eligible_count: 0,
        providers: [],
        message: "No providers available in this city right now.",
      });
    }

    // ── Insert the service_request row ───────────────────────────
    const eligible_ids = filtered.map((r) => r.provider_id);
    const broadcast_at = new Date();
    const expires_at = new Date(broadcast_at.getTime() + WINDOW_SECONDS * 1000);

    const { rows: reqRows } = await client.query(
      `INSERT INTO nex.service_request
         (learner_ref, service_kind, destination_text, origin_text,
          state, state_entered_at,
          eligible_provider_ids, broadcast_at, first_accept_window_seconds,
          broadcast_expires_at, requested_at)
       VALUES ($1, $2, $3, $4,
               'REQUEST_BROADCAST', $5,
               $6, $5, $7, $8, $5)
       RETURNING request_id, broadcast_expires_at`,
      [learner_ref, service_kind, destination, origin_text,
       broadcast_at.toISOString(), eligible_ids,
       WINDOW_SECONDS, expires_at.toISOString()],
    );
    const request_id = reqRows[0].request_id as string;

    // ── Fan out per-provider offer rows · lock 28 ────────────────
    for (const e of eligible) {
      await client.query(
        `INSERT INTO nex.service_request_offer
           (request_id, provider_id, offered_price_idr)
         VALUES ($1, $2, $3)
         ON CONFLICT (request_id, provider_id) DO NOTHING`,
        [request_id, e.provider_id, e.price_per_service_idr],
      );
    }

    await client.query("COMMIT");

    // Return providers so the UI can show them (six-line format per lock 27)
    // NOTE: wallet_balance_idr and free_used_this_month intentionally NOT
    // returned to customer · doctrine lock 38/45.
    const providers = filtered.map((r) => ({
      provider_id:  r.provider_id,
      name:         r.full_name,
      plate:        r.plate,
      secondary_language: r.secondary_language,
      provides_raincoat: r.provides_raincoat,
      bike_slug:    r.bike_slug,
      bike_brand:   r.brand,
      bike_model:   r.model,
      bike_cc:      r.cc,
      bike_category: r.category,
      bike_year:    r.bike_year,
      bike_color_hex: r.bike_color_hex,
      price_idr:    r.price_per_service_idr,
      rating_avg:   r.rating_avg ? Number(r.rating_avg) : null,
      rating_count: r.rating_count ?? 0,
      // v1: distance + ETA null · doctrine EST fallback surfaced by client
      distance_m:   null,
      eta_seconds:  null,
      is_live:      false,
    }));

    return NextResponse.json({
      ok: true,
      request_id,
      state: "REQUEST_BROADCAST",
      broadcast_expires_at: expires_at.toISOString(),
      first_accept_window_seconds: WINDOW_SECONDS,
      eligible_count: filtered.length,
      providers,
    });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  } finally {
    client.release();
  }
}
