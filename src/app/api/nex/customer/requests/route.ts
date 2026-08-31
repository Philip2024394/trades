// GET /api/nex/customer/requests?learner_ref=... · Philip 2026-08-29
//
// Customer-side symmetry of /api/nex/provider/inbox. Returns every
// service_request row this customer has ever created, newest first, joined
// to the accepted provider's profile when applicable (so the UI can show
// "Andi · Honda Vario · Black" once a provider has accepted).
//
// Doctrine: never simulate live location or ETA; the API returns raw fields
// and the client decides how to render them per the mobility UX doctrine
// (EST · nearby fallback when coords absent).

import { NextRequest, NextResponse } from "next/server";
import { getMobilityPool } from "@/lib/nex-mobility/pool";

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

  const client = await getMobilityPool().connect();
  try {
    const { rows } = await client.query(
      `SELECT r.request_id, r.service_kind, r.state,
              r.destination_text, r.origin_text,
              r.requested_at, r.accepted_at, r.completed_at, r.cancelled_at,
              r.broadcast_expires_at, r.first_accept_window_seconds,
              r.price_agreed_idr,
              r.provider_id,
              p.full_name          AS provider_name,
              p.plate              AS provider_plate,
              p.bike_slug          AS provider_bike_slug,
              p.bike_color_hex     AS provider_bike_color_hex,
              p.secondary_language AS provider_language,
              p.provides_raincoat  AS provider_raincoat,
              p.rating_avg         AS provider_rating_avg,
              m.brand              AS provider_bike_brand,
              m.model              AS provider_bike_model,
              m.cc                 AS provider_bike_cc,
              m.category           AS provider_bike_category
       FROM nex.service_request r
       LEFT JOIN nex.provider_profile p ON p.provider_id = r.provider_id
       LEFT JOIN nex.bike_model       m ON m.slug        = p.bike_slug
       WHERE r.learner_ref = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [learner],
    );

    return NextResponse.json({
      ok: true,
      requests: rows.map((r) => ({
        request_id: r.request_id,
        service_kind: r.service_kind,
        state: r.state,
        destination_text: r.destination_text,
        origin_text: r.origin_text,
        requested_at: r.requested_at,
        accepted_at: r.accepted_at,
        completed_at: r.completed_at,
        cancelled_at: r.cancelled_at,
        broadcast_expires_at: r.broadcast_expires_at,
        price_agreed_idr: r.price_agreed_idr,
        provider: r.provider_id ? {
          provider_id: r.provider_id,
          name: r.provider_name,
          plate: r.provider_plate,
          bike_slug: r.provider_bike_slug,
          bike_color_hex: r.provider_bike_color_hex,
          bike_brand: r.provider_bike_brand,
          bike_model: r.provider_bike_model,
          bike_cc: r.provider_bike_cc,
          bike_category: r.provider_bike_category,
          secondary_language: r.provider_language,
          provides_raincoat: r.provider_raincoat,
          rating_avg: r.provider_rating_avg ? Number(r.provider_rating_avg) : null,
        } : null,
      })),
    });
  } finally {
    client.release();
  }
}
