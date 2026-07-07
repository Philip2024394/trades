// POST /api/apps/products/canonical
//
// Manufacturer publishes a canonical product record.
// Entitlement gate: products.manufacturer.
import { NextResponse, type NextRequest } from "next/server";
import {
  requireMerchantSession,
  MerchantNotAuthenticatedError
} from "@/lib/os/merchantSession";
import { hasActiveEntitlement } from "@/lib/os/billing/entitlements";
import { publishCanonical } from "@/lib/products/canonical";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  gtin?: unknown;
  mpn?: unknown;
  brandName?: unknown;
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  categoryPath?: unknown;
  taxonomyLeafSlug?: unknown;
  attributes?: unknown;
  heroImageUrl?: unknown;
  imageUrls?: unknown;
  warrantyYears?: unknown;
  warrantyTermsUrl?: unknown;
  msrpPence?: unknown;
};

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireMerchantSession();
  } catch (e) {
    if (e instanceof MerchantNotAuthenticatedError) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }
    throw e;
  }

  const entitled = await hasActiveEntitlement(
    session.merchantId,
    "products-manufacturer"
  );
  if (!entitled) {
    return NextResponse.json(
      { ok: false, error: "Manufacturer plan required to publish canonical products." },
      { status: 402 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const brandName = typeof body.brandName === "string" ? body.brandName.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (brandName.length < 2 || name.length < 2 || slug.length < 2) {
    return NextResponse.json(
      { ok: false, error: "brandName, name and slug are required." },
      { status: 400 }
    );
  }
  const categoryPath = Array.isArray(body.categoryPath)
    ? body.categoryPath.filter((v): v is string => typeof v === "string")
    : [];
  if (categoryPath.length === 0) {
    return NextResponse.json(
      { ok: false, error: "categoryPath must be a non-empty string array." },
      { status: 400 }
    );
  }

  try {
    const canonical = await publishCanonical({
      publisherBusinessId: session.merchantId,
      gtin: typeof body.gtin === "string" ? body.gtin : null,
      mpn: typeof body.mpn === "string" ? body.mpn : null,
      brandName,
      name,
      slug,
      description: typeof body.description === "string" ? body.description : null,
      categoryPath,
      taxonomyLeafSlug:
        typeof body.taxonomyLeafSlug === "string" ? body.taxonomyLeafSlug : null,
      attributes:
        typeof body.attributes === "object" && body.attributes !== null
          ? (body.attributes as Record<string, unknown>)
          : {},
      heroImageUrl:
        typeof body.heroImageUrl === "string" ? body.heroImageUrl : null,
      imageUrls: Array.isArray(body.imageUrls)
        ? body.imageUrls.filter((v): v is string => typeof v === "string")
        : [],
      warrantyYears:
        typeof body.warrantyYears === "number" ? body.warrantyYears : null,
      warrantyTermsUrl:
        typeof body.warrantyTermsUrl === "string" ? body.warrantyTermsUrl : null,
      msrpPence:
        typeof body.msrpPence === "number" ? body.msrpPence : null
    });
    return NextResponse.json({ ok: true, canonical });
  } catch (err) {
    console.error("[products.canonical] publish failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not publish canonical product." },
      { status: 500 }
    );
  }
}
