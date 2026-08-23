// POST /api/nex-food/claim/start
//
// Self-service claim START endpoint. Two shapes:
//
// A) EXISTING BUSINESS CLAIM (owner tapped "Are you the owner?" on a listing):
//    Body: { businessRef: "#FL-YYYY-XXXXX", whatsapp: "+62...", ownerData?: {...} }
//    Behaviour: issues a fresh claim code · records owner-supplied fields as
//               pending · returns claimCodeId + expiry (+ code in dev mode).
//
// B) NEW BUSINESS REGISTRATION:
//    Body: { register: true, businessName, category, whatsapp, address?, ... }
//    Behaviour: creates a new food_business row at claim_status='listed' +
//               owner_status='contacted' · issues code against owner's WA.
//               Provenance for supplied fields is written as owner_verified
//               only after the code verifies (see verify route).
//
// NEVER sends outreach on its own — Discovery ≠ Outreach doctrine. The
// claim code send is the code-delivery vehicle, not a marketing message.

import { NextResponse } from "next/server";
import { getFoodDbPool } from "@/lib/nex-food/db";
import {
  requestClaimCode,
  registerNewBusiness,
  type OwnerSuppliedData,
} from "@/lib/nex-food/claim-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function bad(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

interface StartBody {
  register?: boolean;
  businessRef?: string;
  businessName?: string;
  category?: string;
  address?: string;
  district?: string;
  whatsapp?: string;
  phone?: string;
  website?: string;
  cuisine?: string;
  hours?: unknown;
  socialLinks?: unknown;
}

const REF_PATTERN = /^#FL-\d{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$/;
const WA_PATTERN = /^\+?\d{8,15}$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as StartBody | null;
  if (!body) return bad(400, "Malformed JSON body");
  const whatsapp = body.whatsapp?.trim();
  if (!whatsapp || !WA_PATTERN.test(whatsapp.replace(/\s|-/g, ""))) {
    return bad(400, "whatsapp required (E.164 · 8-15 digits · leading + optional)");
  }

  const ownerData: OwnerSuppliedData = {
    whatsapp_number: whatsapp,
    business_name: body.businessName,
    category: body.category,
    address: body.address,
    district: body.district,
    phone: body.phone,
    website: body.website,
    opening_information: body.hours,
    public_social_links: body.socialLinks,
  };

  const pool = getFoodDbPool();

  try {
    // Shape B · brand-new registration
    if (body.register) {
      if (!body.businessName?.trim()) return bad(400, "businessName required for register");
      if (!body.category?.trim()) return bad(400, "category required for register");
      const result = await registerNewBusiness({
        pool,
        actor: "owner:self_service_register",
        ownerData: {
          ...ownerData,
          business_name: body.businessName.trim(),
          category: body.category.trim(),
          whatsapp_number: whatsapp,
        },
      });
      return NextResponse.json({
        ok: true,
        entryPath: "self_service_register",
        publicListingRef: result.publicListingRef,
        businessName: result.businessName,
        claimCodeId: result.claimCodeId,
        destination: maskDestination(result.destination),
        expiresAt: result.expiresAt.toISOString(),
        devPlaintextCode: result.devPlaintextCode,
      });
    }

    // Shape A · existing business claim
    const ref = body.businessRef?.trim();
    if (!ref) return bad(400, "businessRef required for existing-business claim");
    if (!REF_PATTERN.test(ref)) return bad(400, "invalid businessRef format");

    const result = await requestClaimCode({
      pool,
      businessRef: ref,
      entryPath: "self_service_claim",
      actor: "owner:self_service_claim",
      ownerData,
    });
    return NextResponse.json({
      ok: true,
      entryPath: "self_service_claim",
      publicListingRef: ref,
      claimCodeId: result.claimCodeId,
      destination: maskDestination(result.destination),
      expiresAt: result.expiresAt.toISOString(),
      devPlaintextCode: result.devPlaintextCode,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Known-user errors surface as 400 · everything else as 500
    if (/^(No business|Cannot claim|No WhatsApp|Invalid|whatsapp|Code|Too many)/i.test(message)) {
      return bad(400, message);
    }
    console.error("[/api/nex-food/claim/start] internal error:", err);
    return bad(500, "internal error");
  }
}

/** "+6281234567890" → "+62 ••• ••• 7890" so the client can confirm the last 4 */
function maskDestination(dest: string): string {
  const digits = dest.replace(/\D/g, "");
  if (digits.length < 4) return dest;
  const tail = digits.slice(-4);
  const country = digits.length > 10 ? digits.slice(0, 2) : "";
  return `+${country} ••• ••• ${tail}`;
}
