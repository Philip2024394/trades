// POST /api/os/properties/claim
//
// Homeowner supplies their real address (they've been living with a
// placeholder since AI Visualiser registration). We upgrade the
// property row with the full address, or merge into an existing
// canonical row if one already exists at that address.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  claimProperty,
  computeAddressHash,
  findOrCreateProperty,
  normalisePostcode,
  isValidUkPostcode
} from "@/lib/os/properties";
import { requireHomeownerSession } from "@/lib/os/homeownerSession";
import { recordTimelineEvent } from "@/lib/os/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  addressLines?: unknown;
  city?: unknown;
  postcode?: unknown;
  uprn?: unknown;
  role?: unknown;
};

export async function POST(req: NextRequest) {
  let party;
  try {
    party = await requireHomeownerSession();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 }
    );
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const addressLines = Array.isArray(body.addressLines)
    ? (body.addressLines.filter(
        (v): v is string => typeof v === "string" && v.trim().length > 0
      ) as string[])
    : [];
  const city =
    typeof body.city === "string" && body.city.trim().length > 0
      ? body.city.trim()
      : null;
  const postcodeRaw = typeof body.postcode === "string" ? body.postcode : "";
  const uprnRaw = typeof body.uprn === "number" ? body.uprn : null;
  const role =
    body.role === "owner" || body.role === "occupier" || body.role === "agent"
      ? body.role
      : "occupier";

  if (addressLines.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Address is required." },
      { status: 400 }
    );
  }
  const postcode = normalisePostcode(postcodeRaw);
  if (!isValidUkPostcode(postcode)) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid UK postcode." },
      { status: 400 }
    );
  }

  const canonical = await findOrCreateProperty({
    addressLines,
    postcode,
    city,
    uprn: uprnRaw,
    actorPartyId: party.id
  });

  // If this party already has a placeholder property (from AI Visualiser
  // registration) and it isn't the canonical one, transfer the claim +
  // link the placeholder to the canonical. Homeowner rows on
  // app_ai_visualiser_homeowners still reference the placeholder — we
  // update those FKs so nothing dangles.
  const { data: existingClaims } = await supabaseAdmin
    .from("os_property_claims")
    .select("id, property_id")
    .eq("party_id", party.id)
    .is("revoked_at", null);

  const canonicalHash = computeAddressHash(addressLines, postcode);

  for (const claim of existingClaims || []) {
    if (claim.property_id === canonical.id) continue;
    // Look up the placeholder — if it's a "Home at NG7 4AB (…)" row,
    // move the party's data over and revoke the placeholder claim.
    const { data: placeholder } = await supabaseAdmin
      .from("os_properties")
      .select("id, address_hash, address_lines")
      .eq("id", claim.property_id)
      .maybeSingle();
    if (!placeholder) continue;
    const isPlaceholder =
      placeholder.address_lines.length === 1 &&
      typeof placeholder.address_lines[0] === "string" &&
      placeholder.address_lines[0].startsWith("Home at ");
    if (!isPlaceholder) continue;

    // Redirect AI Visualiser homeowner rows to the canonical property
    await supabaseAdmin
      .from("app_ai_visualiser_homeowners")
      .update({ property_id: canonical.id })
      .eq("property_id", placeholder.id)
      .eq("party_id", party.id);

    // Redirect any renders that pointed at projects on the placeholder
    const { data: placeholderProjects } = await supabaseAdmin
      .from("os_projects")
      .select("id")
      .eq("property_id", placeholder.id);
    if (placeholderProjects && placeholderProjects.length > 0) {
      const ids = placeholderProjects.map((p) => p.id);
      await supabaseAdmin
        .from("os_projects")
        .update({ property_id: canonical.id })
        .in("id", ids);
      await supabaseAdmin
        .from("os_home_timeline_events")
        .update({ property_id: canonical.id })
        .in("project_id", ids);
    }

    // Revoke placeholder claim
    await supabaseAdmin
      .from("os_property_claims")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", claim.id);
  }

  // Persist the canonical claim (idempotent)
  await claimProperty({
    propertyId: canonical.id,
    partyId: party.id,
    role
  });

  // Timeline event
  await recordTimelineEvent({
    propertyId: canonical.id,
    actorPartyId: party.id,
    verb: "property.verified",
    subjectType: "property",
    subjectId: canonical.id,
    headline: `Address confirmed: ${addressLines.join(", ")}`,
    payload: { canonical_hash: canonicalHash }
  });

  return NextResponse.json({
    ok: true,
    property: {
      id: canonical.id,
      addressLines: canonical.address_lines,
      postcode: canonical.postcode,
      city: canonical.city
    }
  });
}
