// POST /api/apprenticeships/create
// Public — no auth. Young person (16+) submits their apprenticeship
// application. We validate, insert the request row, fan-out
// notifications to verified trades in the requested trade + region,
// return the new request id.
//
// The Networkers supports UK trade youth — every apprentice we route
// to a local trade is a future member of the platform.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notify } from "@/lib/notifications/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_STRING_FIELDS = ["trade_slug", "full_name", "whatsapp"] as const;

type CreatePayload = {
  trade_slug:            string;
  full_name:             string;
  age:                   number;
  whatsapp:              string;
  city?:                 string;
  postcode?:             string;
  address_line?:         string;
  worked_before?:        boolean;
  leaving_school?:       boolean;
  experience_summary?:   string;
  duties_aware?:         boolean;
  discipline_aware?:     boolean;
  about_me?:             string;
  cv_url?:               string;
  photo_url?:            string;
};

export async function POST(req: Request) {
  let body: CreatePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  for (const f of REQUIRED_STRING_FIELDS) {
    const v = body[f];
    if (typeof v !== "string" || v.trim().length === 0) {
      return NextResponse.json({ ok: false, error: `missing:${f}` }, { status: 400 });
    }
  }
  const age = Number(body.age);
  if (!Number.isInteger(age) || age < 16 || age > 65) {
    return NextResponse.json({ ok: false, error: "age-out-of-range" }, { status: 400 });
  }
  if (!body.duties_aware || !body.discipline_aware) {
    return NextResponse.json({ ok: false, error: "must-acknowledge-duties-and-discipline" }, { status: 400 });
  }

  const insert = await supabaseAdmin
    .from("hammerex_apprenticeship_requests")
    .insert({
      trade_slug:         body.trade_slug.trim().toLowerCase(),
      full_name:          body.full_name.trim(),
      age,
      whatsapp:           body.whatsapp.trim(),
      city:               body.city?.trim() || null,
      postcode:           body.postcode?.trim().toUpperCase() || null,
      address_line:       body.address_line?.trim() || null,
      worked_before:      Boolean(body.worked_before),
      leaving_school:     Boolean(body.leaving_school),
      experience_summary: body.experience_summary?.trim() || null,
      duties_aware:       true,
      discipline_aware:   true,
      about_me:           body.about_me?.trim() || null,
      cv_url:             body.cv_url?.trim() || null,
      photo_url:          body.photo_url?.trim() || null
    })
    .select("id, trade_slug, city, full_name, age, about_me")
    .single();

  if (insert.error || !insert.data) {
    return NextResponse.json({ ok: false, error: "db-insert-failed", detail: insert.error?.message }, { status: 500 });
  }
  const request = insert.data;

  // Fan-out — find verified trades in this trade + city, notify each.
  // Deliberately loose match on city (LIKE) so 'London' matches
  // 'London N1', 'Greater London', etc. Cap at 40 recipients per
  // request to avoid inbox floods in dense areas.
  const cityFilter = request.city ? `%${request.city}%` : null;
  const merchQuery = supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug, business_name, contact_email, city")
    .eq("trade_slug", request.trade_slug)
    .eq("status", "live")
    .limit(40);
  if (cityFilter) merchQuery.ilike("city", cityFilter);
  const { data: matched } = await merchQuery;

  const firstName = request.full_name.split(/\s+/)[0] ?? request.full_name;
  const summary   = request.about_me?.slice(0, 200) ?? "Looking for an apprenticeship or mate work.";
  const requestUrl = `/apprenticeships/${request.id}`;

  // Fire-and-forget notifications; failures do not block the request.
  await Promise.allSettled((matched ?? []).map((m) =>
    notify({
      to: {
        kind:  "trade",
        id:    m.slug,
        email: m.contact_email,
        display: m.business_name
      },
      template: "trade.apprentice_alert",
      data: {
        tradeName:  request.trade_slug.replace(/-/g, " "),
        city:       request.city ?? "your area",
        firstName,
        age:        String(request.age),
        summary,
        requestUrl
      },
      channels: ["email", "in_app"],
      product:  "apprenticeships",
      relatedTargetKind: "apprenticeship_request",
      relatedTargetId:   request.id
    }).catch(() => undefined)
  ));

  return NextResponse.json({
    ok:       true,
    id:       request.id,
    notified: matched?.length ?? 0
  });
}
