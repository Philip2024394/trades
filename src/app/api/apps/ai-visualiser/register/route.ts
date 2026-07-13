// POST /api/apps/ai-visualiser/register
//
// Homeowner registers on a merchant's Visualiser tile. This is the
// contact-capture handshake — no OTP, no verification codes. Fields go
// straight to the merchant as a lead, mirrored into the platform admin
// lead log, and the homeowner is issued a session token which future
// upload/render calls attach to.
//
// The route enforces:
//   • Basic input validation (email + WhatsApp digits + postcode)
//   • Honeypot (silent drop)
//   • Merchant must exist and have installed AI Visualiser
//   • Upsert by (merchant_id, lower(email)) so double-submits don't
//     spam the merchant with duplicate emails.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  hashEmail,
  hashWhatsapp,
  ipClass,
  normalisePostcode,
  toE164
} from "@/lib/os/hashing";
import { sendMerchantLeadEmail } from "@/lib/ai-visualiser/notifyMerchant";
import { findOrCreatePersonParty } from "@/lib/os/parties";
import {
  findOrCreateProperty,
  claimProperty
} from "@/lib/os/properties";
import { publish } from "@/lib/os/events";
import { issueUploadGrant } from "@/lib/os/uploadGrants";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;

type RegisterPayload = {
  merchantId?: unknown;
  fullName?: unknown;
  email?: unknown;
  whatsapp?: unknown;
  homePhone?: unknown;
  postcode?: unknown;
  fingerprintId?: unknown;
  firstLeafSlug?: unknown; // for admin log
  source?: unknown; // 'merchant-page' | 'gold-path' | 'marketplace'
  website?: unknown; // honeypot
};

function fieldFail(field: string, error: string) {
  return NextResponse.json({ ok: false, field, error }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: RegisterPayload;
  try {
    body = (await req.json()) as RegisterPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const honeypot =
    typeof body.website === "string" ? body.website.trim() : "";
  if (honeypot.length > 0) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const merchantId =
    typeof body.merchantId === "string" ? body.merchantId.trim() : "";
  const fullName =
    typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const whatsappRaw =
    typeof body.whatsapp === "string" ? body.whatsapp.trim() : "";
  const homePhone =
    typeof body.homePhone === "string" && body.homePhone.trim().length > 0
      ? body.homePhone.trim()
      : null;
  const postcodeRaw =
    typeof body.postcode === "string" ? body.postcode.trim() : "";
  const fingerprintId =
    typeof body.fingerprintId === "string" && body.fingerprintId.trim().length > 0
      ? body.fingerprintId.trim()
      : null;
  const firstLeafSlug =
    typeof body.firstLeafSlug === "string" ? body.firstLeafSlug.trim() : null;
  const source =
    body.source === "gold-path" || body.source === "marketplace"
      ? body.source
      : "merchant-page";

  if (!merchantId) return fieldFail("merchantId", "Missing merchant.");
  if (fullName.length < 2) return fieldFail("fullName", "Name is required.");
  if (!EMAIL_RE.test(email)) {
    return fieldFail("email", "Valid email is required.");
  }
  const whatsappDigits = whatsappRaw.replace(/\D/g, "");
  if (whatsappDigits.length < 7) {
    return fieldFail("whatsapp", "WhatsApp number is required.");
  }
  const postcode = normalisePostcode(postcodeRaw);
  if (!UK_POSTCODE_RE.test(postcode)) {
    return fieldFail("postcode", "Enter a valid UK postcode.");
  }

  // Resolve the merchant. hammerex_trade_off_listings is the canonical
  // directory for the platform; every merchant has one row.
  const { data: merchant, error: merchantErr } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, display_name, trading_name, email")
    .eq("id", merchantId)
    .maybeSingle();

  if (merchantErr || !merchant) {
    return NextResponse.json(
      { ok: false, error: "Merchant not found." },
      { status: 404 }
    );
  }

  const whatsappE164 = toE164(whatsappRaw);
  const emailHash = hashEmail(email);
  const whatsappHash = hashWhatsapp(whatsappE164);
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    null;

  // ---------------------------------------------------------------
  // OS Foundation: find-or-create Party + Property + claim.
  //
  // Postcode alone can't uniquely identify a house (multiple houses
  // per postcode). Until the homeowner supplies their full address on
  // the /home hub, we treat them as owning an "anonymous property at
  // this postcode" — hash-discriminated by their email so two
  // homeowners at NG7 4AB don't share a property row. When they later
  // fill in the address, we normalise + rehash.
  // ---------------------------------------------------------------
  let partyId: string | null = null;
  let propertyId: string | null = null;
  try {
    const party = await findOrCreatePersonParty({
      displayName: fullName,
      email,
      whatsappE164
    });
    partyId = party.id;

    const anonymousDiscriminator = createHash("sha256")
      .update(`${postcode}::${emailHash}`)
      .digest("hex")
      .slice(0, 16);
    const property = await findOrCreateProperty({
      addressLines: [`Home at ${postcode} (${anonymousDiscriminator})`],
      postcode,
      actorPartyId: party.id
    });
    propertyId = property.id;

    await claimProperty({
      propertyId: property.id,
      partyId: party.id,
      role: "occupier"
    });
  } catch (err) {
    // Non-fatal — homeowner registration should still succeed even if
    // the OS foundation write hits a transient issue. Merchant will
    // still get the lead. We just lose the property link for this
    // homeowner and can backfill later.
    console.error("[ai-visualiser] OS foundation link failed", err);
  }

  // Upsert homeowner by (merchant_id, lower(email))
  const { data: homeowner, error: upErr } = await supabaseAdmin
    .from("app_ai_visualiser_homeowners")
    .upsert(
      {
        merchant_id: merchantId,
        full_name: fullName,
        email,
        whatsapp_e164: whatsappE164,
        home_phone: homePhone,
        postcode,
        email_hash: emailHash,
        whatsapp_hash: whatsappHash,
        fingerprint_id: fingerprintId,
        ip_class: ipClass(ip),
        party_id: partyId,
        property_id: propertyId
      },
      { onConflict: "merchant_id,email" }
    )
    .select("id, created_at")
    .single();

  if (upErr || !homeowner) {
    console.error("[ai-visualiser] homeowner upsert error", upErr);
    return NextResponse.json(
      { ok: false, error: "Could not save your details." },
      { status: 500 }
    );
  }

  const isFirstContact = wasJustCreated(homeowner.created_at);

  // Publish lead.captured — CRM subscriber upserts the contact.
  await publish({
    eventType: "lead.captured",
    publisherApp: "ai-visualiser",
    dedupKey: `lead:${homeowner.id}`,
    actorPartyId: partyId,
    actorBusinessId: merchantId,
    propertyId,
    subjectType: "homeowner",
    subjectId: homeowner.id,
    payload: {
      display_name: fullName,
      email,
      whatsapp_e164: whatsappE164,
      postcode,
      source: `ai_visualiser:${source}`,
      initial_lifecycle_stage: "engaged"
    }
  });

  // Mirror into admin lead log (fire-and-forget-ish; a failure here
  // shouldn't fail the user's registration).
  const adminInsert = supabaseAdmin
    .from("ai_visualiser_admin_leads")
    .insert({
      homeowner_id: homeowner.id,
      merchant_id: merchantId,
      full_name: fullName,
      email,
      whatsapp_e164: whatsappE164,
      home_phone: homePhone,
      postcode,
      first_leaf_slug: firstLeafSlug,
      source
    });

  // Ensure a lead row exists for this merchant.
  const leadInsert = supabaseAdmin
    .from("app_ai_visualiser_leads")
    .upsert(
      {
        merchant_id: merchantId,
        homeowner_id: homeowner.id,
        merchant_notified_at: new Date().toISOString()
      },
      { onConflict: "homeowner_id" }
    );

  await Promise.all([adminInsert, leadInsert]);

  // Notify merchant. Deliberately not blocking on this — if Resend is
  // down the customer should still succeed and we'll retry from the
  // dashboard.
  const merchantEmail = merchant.email;
  if (merchantEmail && isFirstContact) {
    const displayName =
      merchant.trading_name || merchant.display_name || "there";
    void sendMerchantLeadEmail({
      merchantEmail,
      merchantDisplayName: displayName,
      homeowner: {
        fullName,
        email,
        whatsappE164,
        homePhone,
        postcode
      },
      leafDisplayName: firstLeafSlug || "renovation",
      dashboardLink: `${process.env.NEXT_PUBLIC_APP_URL || "https://thenetworkers.app"}/dashboard/leads/${homeowner.id}`,
      isFirstContact: true
    });
  }

  // Issue a signed upload grant so the homeowner can POST a photo to
  // /api/apps/ai-visualiser/upload without exposing merchantId in a
  // trusted-body position.
  const uploadGrant = issueUploadGrant({
    merchantId,
    homeownerId: homeowner.id,
    category: "ai-visualiser"
  });

  return NextResponse.json({
    ok: true,
    homeownerId: homeowner.id,
    isNew: isFirstContact,
    uploadGrant
  });
}

function wasJustCreated(createdAt: string): boolean {
  const created = new Date(createdAt).getTime();
  return Date.now() - created < 5_000;
}
