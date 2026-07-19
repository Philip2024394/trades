// POST /api/beacon/create
//
// Homeowner submits an enquiry from the empty-state form on
// /trade-off/inspiration/[id] (or /find/beacon). Creates the beacon
// + fans out to 3 nearest matching trades. Returns the beacon id +
// fanout summary so the client can show "sent to N trades" state.
//
// Rate-limited by IP hash (see beacon.server.ts checkBeaconRateLimit)
// so a spammer can't drain trades' washer bags via fanout notifications
// — 3/hour + 10/day per IP + 1 per (IP × trade_slug) per 15 minutes.

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createBeacon, checkBeaconRateLimit } from "@/lib/beacon.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  customer_name?:      unknown;
  customer_email?:     unknown;
  customer_whatsapp?:  unknown;
  customer_city?:      unknown;
  customer_postcode_prefix?: unknown;
  project_description: unknown;
  trade_slug:          unknown;
  source_surface?:     unknown;
  source_image_id?:    unknown;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

export async function POST(req: Request) {
  let body: Body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  const name        = str(body.customer_name);
  const description = str(body.project_description);
  const tradeSlug   = str(body.trade_slug);
  if (!name || !description || !tradeSlug) {
    return NextResponse.json({ ok: false, error: "missing-fields", detail: "customer_name + project_description + trade_slug required" }, { status: 400 });
  }
  if (description.length < 60) {
    return NextResponse.json({ ok: false, error: "description-too-short", detail: "Please describe your project in at least 60 characters." }, { status: 400 });
  }
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(tradeSlug)) {
    return NextResponse.json({ ok: false, error: "invalid-trade-slug" }, { status: 400 });
  }

  // Hash the IP for rate-limiting / abuse detection without storing raw IP.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = createHash("sha256").update(ip + "|beacon").digest("hex").slice(0, 32);

  // Enforce rate limits BEFORE createBeacon runs — cheap query,
  // stops abusers from triggering the fanout + notification cost.
  const rl = await checkBeaconRateLimit({ ipHash, tradeSlug });
  if (!rl.allowed) {
    return NextResponse.json({
      ok:      false,
      error:   "rate-limited",
      detail:  rl.reason,
      retryAfterMinutes: rl.retryAfterMinutes
    }, {
      status:  429,
      headers: rl.retryAfterMinutes ? { "Retry-After": String(rl.retryAfterMinutes * 60) } : {}
    });
  }

  try {
    const result = await createBeacon({
      customer_name:            name,
      customer_email:           str(body.customer_email),
      customer_whatsapp:        str(body.customer_whatsapp),
      customer_city:            str(body.customer_city),
      customer_postcode_prefix: str(body.customer_postcode_prefix),
      project_description:      description,
      trade_slug:               tradeSlug,
      source_surface:           str(body.source_surface) ?? "unknown",
      source_image_id:          str(body.source_image_id),
      customer_ip_hash:         ipHash
    });
    return NextResponse.json({
      ok:                 true,
      beacon_id:          result.beaconId,
      fanout_count:       result.fanoutCount,
      readiness:          result.readinessBreakdown,
      admin_residual:     result.adminResidual,
      message:            result.adminResidual
        ? "We couldn't find matching trades right now — your enquiry has been forwarded to our team who will reach out to trades directly."
        : `Sent to ${result.fanoutCount} trade${result.fanoutCount === 1 ? "" : "s"} near you. Any who claim will message you on WhatsApp within a couple of hours.`
    });
  } catch (err) {
    console.error("[beacon/create] threw:", err);
    return NextResponse.json({ ok: false, error: "internal", detail: String(err) }, { status: 500 });
  }
}
