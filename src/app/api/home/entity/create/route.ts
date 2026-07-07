// POST /api/home/entity/create
// Creates a non-personal entity (business/contractor/enterprise/public
// sector) and adds the caller as owner. Sets the new entity as active.

import { NextResponse } from "next/server";
import { requireHomeownerSession } from "@/lib/os/homeownerSession";
import { createBusinessEntity, type EntityTier } from "@/lib/os/entities";
import { setActiveEntityCookie } from "@/lib/os/entitySession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TIERS: EntityTier[] = [
  "small_business",
  "contractor",
  "enterprise",
  "public_sector"
];

export async function POST(request: Request) {
  let party;
  try {
    party = await requireHomeownerSession();
  } catch {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  let body: {
    tier?: string;
    display_name?: string;
    legal_name?: string;
    companies_house_number?: string;
    postcode?: string;
    city?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const tier = (body.tier ?? "") as EntityTier;
  const displayName = (body.display_name ?? "").trim();

  if (!ALLOWED_TIERS.includes(tier)) {
    return NextResponse.json({ ok: false, error: "invalid_tier" }, { status: 400 });
  }
  if (!displayName) {
    return NextResponse.json(
      { ok: false, error: "missing_display_name" },
      { status: 400 }
    );
  }

  const entity = await createBusinessEntity({
    creatorPartyId: party.id,
    tier,
    displayName,
    legalName: body.legal_name?.trim() || undefined,
    companiesHouseNumber: body.companies_house_number?.trim() || undefined,
    postcode: body.postcode?.trim().toUpperCase() || undefined,
    city: body.city?.trim() || undefined
  });

  if (!entity) {
    return NextResponse.json(
      { ok: false, error: "create_failed" },
      { status: 500 }
    );
  }

  await setActiveEntityCookie(entity.id);
  return NextResponse.json({ ok: true, entity });
}
