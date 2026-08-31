// src/lib/nex-mobility/accept-offer.ts · Philip 2026-08-29
//
// Extracted transactional core of POST /api/nex/service-request/[id]/accept.
// The HTTP route handler is a thin adapter around this function so tests can
// exercise the DB behaviour directly (concurrency, race resolution,
// price-snapshot semantics).
//
// Doctrine locks respected here:
//   · Lock 28 · first-accept-wins, enforced by partial unique index
//                uq_service_offer_one_accepted (backstop) and by row-level
//                lock (`SELECT ... FOR UPDATE` on the request row).
//   · Lock 43 · price is snapshotted from the offer at accept-time and never
//                recalculated afterwards.

import type pg from "pg";

export type AcceptAction = "accept" | "decline";

export type AcceptOfferResult =
  | {
      ok: true;
      action: "accepted";
      request_id: string;
      provider: {
        provider_id: string;
        name: string | null;
        plate: string | null;
        secondary_language: string | null;
        provides_raincoat: boolean | null;
        bike_slug: string | null;
        bike_brand: string | null;
        bike_model: string | null;
        bike_cc: number | null;
        bike_category: string | null;
        bike_year: number | null;
        bike_color_hex: string | null;
        rating_avg: number | null;
        rating_count: number;
      } | null;
      price_agreed_idr: number;
    }
  | { ok: true; action: "declined" }
  | { ok: false; error: string; message?: string; current_state?: string; status: number };

export async function acceptOffer(input: {
  pool: pg.Pool;
  requestId: string;
  providerId: string;
  action: AcceptAction;
}): Promise<AcceptOfferResult> {
  const { pool, requestId, providerId, action } = input;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: reqRows } = await client.query(
      `SELECT state, broadcast_expires_at, eligible_provider_ids
       FROM nex.service_request
       WHERE request_id = $1
       FOR UPDATE`,
      [requestId],
    );
    if (reqRows.length === 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "request not found", status: 404 };
    }
    const reqRow = reqRows[0];

    if (reqRow.state !== "REQUEST_BROADCAST") {
      await client.query("ROLLBACK");
      return {
        ok: false,
        error: "already_resolved",
        current_state: reqRow.state,
        message:
          reqRow.state === "CONNECTED"
            ? "Another provider accepted first."
            : `Request is in state ${reqRow.state}.`,
        status: 409,
      };
    }

    if (new Date(reqRow.broadcast_expires_at).getTime() < Date.now()) {
      await client.query("ROLLBACK");
      return {
        ok: false, error: "expired",
        message: "Broadcast window has expired.",
        status: 410,
      };
    }

    if (
      !Array.isArray(reqRow.eligible_provider_ids) ||
      !reqRow.eligible_provider_ids.includes(providerId)
    ) {
      await client.query("ROLLBACK");
      return { ok: false, error: "not_eligible", status: 403 };
    }

    if (action === "decline") {
      await client.query(
        `UPDATE nex.service_request_offer
         SET response = 'declined', responded_at = now()
         WHERE request_id = $1 AND provider_id = $2 AND response IS NULL`,
        [requestId, providerId],
      );
      await client.query("COMMIT");
      return { ok: true, action: "declined" };
    }

    // ── ACCEPT · race resolved by row lock + partial unique index ──────
    try {
      const { rows: offerRows } = await client.query(
        `UPDATE nex.service_request_offer
         SET response = 'accepted', responded_at = now()
         WHERE request_id = $1 AND provider_id = $2 AND response IS NULL
         RETURNING offered_price_idr`,
        [requestId, providerId],
      );
      if (offerRows.length === 0) {
        await client.query("ROLLBACK");
        return {
          ok: false,
          error: "offer_not_found_or_already_responded",
          status: 409,
        };
      }
      const offered_price_idr = offerRows[0].offered_price_idr as number;

      await client.query(
        `UPDATE nex.service_request
         SET state = 'CONNECTED',
             state_entered_at = now(),
             provider_id = $2,
             price_agreed_idr = $3,
             accepted_at = now(),
             updated_at = now()
         WHERE request_id = $1`,
        [requestId, providerId, offered_price_idr],
      );

      // Withdraw all other pending offers for this request
      await client.query(
        `UPDATE nex.service_request_offer
         SET response = 'withdrawn', responded_at = now()
         WHERE request_id = $1 AND provider_id <> $2 AND response IS NULL`,
        [requestId, providerId],
      );

      const { rows: pRows } = await client.query(
        `SELECT p.provider_id, p.full_name, p.plate, p.secondary_language,
                p.provides_raincoat, p.bike_slug, p.bike_year, p.bike_color_hex,
                p.rating_avg, p.rating_count,
                m.brand, m.model, m.cc, m.category
         FROM nex.provider_profile p
         LEFT JOIN nex.bike_model m ON m.slug = p.bike_slug
         WHERE p.provider_id = $1`,
        [providerId],
      );
      const p = pRows[0];

      await client.query("COMMIT");

      return {
        ok: true,
        action: "accepted",
        request_id: requestId,
        provider: p
          ? {
              provider_id: p.provider_id,
              name: p.full_name,
              plate: p.plate,
              secondary_language: p.secondary_language,
              provides_raincoat: p.provides_raincoat,
              bike_slug: p.bike_slug,
              bike_brand: p.brand,
              bike_model: p.model,
              bike_cc: p.cc,
              bike_category: p.category,
              bike_year: p.bike_year,
              bike_color_hex: p.bike_color_hex,
              rating_avg: p.rating_avg ? Number(p.rating_avg) : null,
              rating_count: p.rating_count ?? 0,
            }
          : null,
        price_agreed_idr: offered_price_idr,
      };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "23505") {
        await client.query("ROLLBACK");
        return {
          ok: false,
          error: "another_provider_accepted_first",
          message: "Another provider accepted first.",
          status: 409,
        };
      }
      throw err;
    }
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      status: 500,
    };
  } finally {
    client.release();
  }
}
