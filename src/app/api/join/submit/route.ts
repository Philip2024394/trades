// POST /api/join/submit
//
// Creates a new trade Notebook. Insert into hammerex_trade_off_listings
// (the sync trigger mirrors it to os_business_listings automatically),
// generates a slug + edit_token, sends the welcome email.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashEmail } from "@/lib/os/hashing";
import { notifyTradeWelcome } from "@/lib/tradeJoinNotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  displayName: string;
  primaryTrade: string;
  city: string;
  postcode: string;
  email: string;
  whatsapp?: string;
  businessType?: string;
  companiesHouseNumber?: string;
  inviteToken?: string | null;
};

function slugify(name: string, city: string): string {
  const base = `${name}-${city}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base.slice(0, 80) || "trade";
}

async function findUniqueSlug(base: string): Promise<string> {
  const { data: hit } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug")
    .eq("slug", base)
    .maybeSingle();
  if (!hit) return base;
  for (let n = 2; n <= 50; n++) {
    const candidate = `${base}-${n}`;
    const { data: taken } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("slug")
      .eq("slug", candidate)
      .maybeSingle();
    if (!taken) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  const displayName = (body.displayName ?? "").trim();
  const primaryTrade = (body.primaryTrade ?? "").trim();
  const city = (body.city ?? "").trim();
  const postcode = (body.postcode ?? "").trim().toUpperCase();
  const email = (body.email ?? "").trim().toLowerCase();
  const whatsapp = (body.whatsapp ?? "").trim();

  if (!displayName || !primaryTrade || !city || !postcode || !email) {
    return NextResponse.json(
      { ok: false, error: "missing_required_fields" },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 400 }
    );
  }

  // Email uniqueness check — don't silently create duplicates.
  const { data: existingByEmail } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug")
    .eq("email", email)
    .maybeSingle();
  if (existingByEmail) {
    return NextResponse.json(
      { ok: false, error: "email_in_use" },
      { status: 409 }
    );
  }

  const slug = await findUniqueSlug(slugify(displayName, city));
  const postcodePrefix = postcode.split(/\s+/)[0] || null;

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .insert({
      slug,
      display_name: displayName,
      primary_trade: primaryTrade,
      city,
      postcode_prefix: postcodePrefix,
      email,
      whatsapp: whatsapp || "",
      bio: "",
      status: "draft"
    })
    .select("id, slug, edit_token")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { ok: false, error: "insert_failed", detail: insertErr?.message },
      { status: 500 }
    );
  }

  // Auto-create/link the trade's os_parties row so they can sign in and
  // see their engagements. Best-effort — join succeeds even if this
  // step fails.
  try {
    const emailHashVal = hashEmail(email);

    let tradeParty: { id: string } | null = null;
    const { data: existingParty } = await supabaseAdmin
      .from("os_parties")
      .select("id")
      .eq("email_hash", emailHashVal)
      .maybeSingle();
    if (existingParty) {
      tradeParty = existingParty;
    } else {
      const { data: createdParty } = await supabaseAdmin
        .from("os_parties")
        .insert({
          kind: "person",
          display_name: displayName,
          email,
          email_hash: emailHashVal
        })
        .select("id")
        .single();
      tradeParty = createdParty;
    }

    // The sync trigger from hammerex_trade_off_listings → os_business_listings
    // runs on insert. Link party_id on that mirrored row.
    if (tradeParty) {
      await supabaseAdmin
        .from("os_business_listings")
        .update({ party_id: tradeParty.id })
        .eq("slug", inserted.slug);
    }
  } catch {
    /* swallow */
  }

  // If this join came from a homeowner invitation, close the loop —
  // mark the invite accepted, link it to the new listing, and (if the
  // invite carried an engagement) update that engagement's business_id
  // so the foreman's site instantly shows the linked trade.
  if (body.inviteToken) {
    const { data: acceptedInvite } = await supabaseAdmin
      .from("os_homeowner_trade_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        resulting_business_listing_id: inserted.id
      })
      .eq("token", body.inviteToken)
      .eq("status", "pending")
      .select("engagement_id")
      .single();

    if (acceptedInvite?.engagement_id) {
      // Lookup the mirrored os_business_listings row via slug, then
      // fill it into the engagement.
      const { data: osBusiness } = await supabaseAdmin
        .from("os_business_listings")
        .select("id")
        .eq("slug", inserted.slug)
        .maybeSingle();
      if (osBusiness) {
        await supabaseAdmin
          .from("os_site_engagements")
          .update({
            business_id: osBusiness.id,
            status: "accepted"
          })
          .eq("id", acceptedInvite.engagement_id);
      }
    }
  }

  // Best-effort welcome email — the merchant still lands on /join/done
  // even if delivery fails.
  try {
    await notifyTradeWelcome({
      email,
      displayName,
      slug: inserted.slug,
      editToken: inserted.edit_token
    });
  } catch {
    /* swallow */
  }

  return NextResponse.json({ ok: true, slug: inserted.slug });
}
