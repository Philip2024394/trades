// GET /api/trade-off/product-og?slug=<listing-slug>&productSlug=<product-slug>
//
// Open Graph image for the per-product PDP at /<slug>/shop/<productSlug>.
// 1200×630 PNG. Composition:
//
//   ┌──────────────────────────────────────────────────┐
//   │ Product cover (left half)  │ Dark panel (right)   │
//   │ contained-fit on black     │ yellow "PRODUCT"     │
//   │ background                 │ eyebrow              │
//   │                            │ Product name (h1)    │
//   │                            │ Price (large yellow) │
//   │                            │ Tradesperson · City  │
//   │                            │ Hammerex hint        │
//   └──────────────────────────────────────────────────┘
//
// Cached `Cache-Control: public, s-maxage=86400` — 24h is plenty for a
// social-share preview, and tradespeople rarely rename SKUs.

import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tradeLabel } from "@/lib/tradeOff";

export const runtime = "nodejs";

const WIDTH = 1200;
const HEIGHT = 630;
const LEFT_WIDTH = 600;
const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK = "#0A0A0A";

function formatGbp(pence: number): string {
  if (!Number.isFinite(pence) || pence <= 0) return "£0";
  const pounds = pence / 100;
  return pounds % 1 === 0
    ? `£${pounds.toLocaleString("en-GB")}`
    : `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get("slug") ?? "").trim();
  const productSlug = (req.nextUrl.searchParams.get("productSlug") ?? "").trim();
  if (!slug || !productSlug) {
    return new Response("Missing slug or productSlug", { status: 400 });
  }

  const listingRes = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, display_name, primary_trade, city")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  if (!listingRes.data) {
    return new Response("Listing not found", { status: 404 });
  }

  const productRes = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("name, price_pence, cover_url, category")
    .eq("listing_id", listingRes.data.id)
    .eq("slug", productSlug)
    .eq("status", "live")
    .maybeSingle();
  if (!productRes.data) {
    return new Response("Product not found", { status: 404 });
  }

  const product = productRes.data;
  const listing = listingRes.data;
  const trade = tradeLabel(listing.primary_trade);
  const footer = `${listing.display_name} · ${listing.city}`;
  const cover = (product.cover_url as string | null) ?? null;
  const category = (product.category as string | null) ?? trade;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: BRAND_BLACK,
          position: "relative"
        }}
      >
        {/* LEFT — product cover, contained on black so the proportion
            shows honestly (cropping a tool's silhouette is worse than
            letterboxing it). */}
        <div
          style={{
            display: "flex",
            position: "relative",
            width: LEFT_WIDTH,
            height: HEIGHT,
            background: "#1A1A1A",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden"
          }}
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              width={LEFT_WIDTH}
              height={HEIGHT}
              style={{
                width: LEFT_WIDTH,
                height: HEIGHT,
                objectFit: "cover"
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                color: BRAND_YELLOW,
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: "0.22em",
                textTransform: "uppercase"
              }}
            >
              No image
            </div>
          )}
          {/* Right-edge fade into the dark panel — softens the seam. */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 160,
              height: HEIGHT,
              background:
                "linear-gradient(90deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.85) 100%)"
            }}
          />
        </div>

        {/* RIGHT — dark info panel. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: WIDTH - LEFT_WIDTH,
            height: HEIGHT,
            background: BRAND_BLACK,
            padding: "56px 60px 40px 60px",
            color: "#FFFFFF",
            position: "relative"
          }}
        >
          <div
            style={{
              display: "flex",
              color: BRAND_YELLOW,
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "0.22em",
              textTransform: "uppercase"
            }}
          >
            {category.slice(0, 24)}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 16,
              color: "#FFFFFF",
              fontSize: 52,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.02em"
            }}
          >
            {(product.name as string).slice(0, 90)}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              color: BRAND_YELLOW,
              fontSize: 66,
              fontWeight: 800,
              letterSpacing: "-0.02em"
            }}
          >
            {formatGbp(product.price_pence as number)}
          </div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: "flex",
              color: "rgba(255,255,255,0.78)",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.01em"
            }}
          >
            {footer.slice(0, 60)}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 8,
              color: "rgba(255,255,255,0.45)",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase"
            }}
          >
            Xrated Trades
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800"
      }
    }
  );
}
