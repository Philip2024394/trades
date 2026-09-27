// src/app/nex-native/[businessSlug]/[productId]/page.tsx
//
// Public product detail page · the visitor's deep-dive view of a
// single seller's product. Reached from the shop feed's "More
// Details" CTA. Same NEX identity as the shop landing · dark navy,
// serif display, editorial layout.
//
// Sticky bottom bar carries the two commerce actions:
//   · Order Now  · primary orange · goes to peer chat
//   · Chat Now   · secondary cyan · goes to peer chat
// Both currently open the chat where Bridge 11's product detail
// sheet takes over. Bridge 12b will differentiate Order into a
// direct intent send.
//
// Sealed 2026-09-27.

import Link from "next/link";
import { notFound } from "next/navigation";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NEX = {
  bg: "#020914",
  panel: "#050f1e",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.6)",
  orange: "#FF7800",
  orangeSoft: "rgba(255,120,0,0.65)",
  amber: "#F59E0B",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function Page({
  params,
}: {
  params: Promise<{ businessSlug: string; productId: string }>;
}) {
  const { businessSlug, productId } = await params;
  const business = await businessService.getBusinessBySlug(businessSlug);
  if (!business) notFound();

  const product = await productService.getProductById(productId);
  if (!product || product.business_id !== business.id) notFound();

  const variants = await productService.listVariants(product.id);

  const chatHref = `/nex-native/chat/peer/${business.owner_account_id}`;
  const shopHref = `/nex-native/${business.slug}`;
  const price = formatPrice(product.price_pence, product.currency);
  const galleryUrls = product.gallery_urls ?? [];
  const hasGallery = galleryUrls.length > 0;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 96px)",
      }}
    >
      {/* --- BACK NAV ------------------------------------------------ */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          padding: "calc(env(safe-area-inset-top, 0) + 12px) 16px 10px",
          background:
            "linear-gradient(180deg, rgba(2,9,20,0.92) 0%, rgba(2,9,20,0.6) 100%)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          href={shopHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: NEX.textDim,
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
            padding: "6px 4px",
          }}
        >
          <BackIcon />
          <span>Back to {business.display_name}</span>
        </Link>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
          }}
        >
          {business.slug}.nex
        </div>
      </div>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "8px 20px 0" }}>
        {/* --- HERO IMAGE -------------------------------------------- */}
        <div
          style={{
            width: "100%",
            aspectRatio: "4 / 3",
            borderRadius: 18,
            overflow: "hidden",
            background: NEX.panel,
            marginBottom: 20,
            position: "relative",
          }}
        >
          {product.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={product.image_url}
              alt={product.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <div
              aria-hidden
              style={{
                display: "grid",
                placeItems: "center",
                width: "100%",
                height: "100%",
                color: NEX.textMute,
                fontSize: 72,
              }}
            >
              🛍️
            </div>
          )}
          {product.stock_status && product.stock_status !== "in_stock" && (
            <div
              style={{
                position: "absolute",
                top: 14,
                left: 14,
                padding: "5px 12px",
                borderRadius: 999,
                background: "rgba(2,9,20,0.75)",
                border: `1px solid ${
                  product.stock_status === "sold_out"
                    ? "rgba(255,120,120,0.5)"
                    : NEX.borderStrong
                }`,
                color:
                  product.stock_status === "sold_out"
                    ? "#FF7A85"
                    : product.stock_status === "low_stock"
                      ? NEX.amber
                      : NEX.cyan,
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 700,
                backdropFilter: "blur(6px)",
              }}
            >
              {product.stock_status === "sold_out"
                ? "Sold out"
                : product.stock_status === "low_stock"
                  ? "Low stock"
                  : product.stock_status === "made_to_order"
                    ? "Made to order"
                    : product.stock_status.replace(/_/g, " ")}
            </div>
          )}
        </div>

        {/* --- GALLERY THUMBS --------------------------------------- */}
        {hasGallery && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                galleryUrls.length === 1
                  ? "1fr"
                  : galleryUrls.length === 2
                    ? "1fr 1fr"
                    : "1fr 1fr 1fr",
              gap: 8,
              marginBottom: 24,
            }}
          >
            {galleryUrls.slice(0, 6).map((u, i) => (
              <div
                key={`${u}-${i}`}
                style={{
                  aspectRatio: "1 / 1",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: NEX.panel,
                  border: `1px solid ${NEX.border}`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u}
                  alt={`${product.name} · view ${i + 2}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* --- NAME + PRICE ---------------------------------------- */}
        <h1
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontWeight: 500,
            fontSize: "clamp(30px, 6vw, 42px)",
            letterSpacing: "-0.012em",
            lineHeight: 1.05,
            marginBottom: 8,
          }}
        >
          {product.name}
        </h1>
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: NEX.orange,
            letterSpacing: "0.01em",
            marginBottom: 16,
          }}
        >
          {price}
        </div>

        {/* --- TAGS ------------------------------------------------- */}
        {product.tags && product.tags.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 24,
            }}
          >
            {product.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: "3px 10px",
                  borderRadius: 999,
                  border: `1px solid ${NEX.borderStrong}`,
                  background: "rgba(0,175,255,0.08)",
                  color: NEX.cyan,
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* --- DESCRIPTION ----------------------------------------- */}
        {product.description && (
          <section style={{ marginBottom: 28 }}>
            <SectionHeading eyebrow="About this piece" />
            <p
              style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.65,
                color: "rgba(244,247,252,0.9)",
                whiteSpace: "pre-wrap",
              }}
            >
              {product.description}
            </p>
          </section>
        )}

        {/* --- VARIANTS -------------------------------------------- */}
        {variants.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <SectionHeading eyebrow="Options" />
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {variants.map((v) => (
                <div
                  key={v.id}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: NEX.panelSoft,
                    border: `1px solid ${NEX.borderStrong}`,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                  }}
                >
                  <span style={{ color: NEX.text, fontWeight: 600 }}>
                    {v.name}
                  </span>
                  {v.price_pence !== null && (
                    <span
                      style={{
                        color: NEX.orange,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {formatPrice(v.price_pence, product.currency)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* --- SELLER CARD ----------------------------------------- */}
        <section style={{ marginBottom: 28 }}>
          <SectionHeading eyebrow="Sold by" />
          <Link
            href={shopHref}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: 14,
              borderRadius: 14,
              background: NEX.panelSoft,
              border: `1px solid ${NEX.border}`,
              color: NEX.text,
              textDecoration: "none",
              transition: "border-color 160ms ease",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: 52,
                height: 52,
                borderRadius: "50%",
                overflow: "hidden",
                background: NEX.panel,
                border: `1px solid ${NEX.borderStrong}`,
              }}
            >
              {business.logo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={business.logo_url}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  aria-hidden
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    color: NEX.cyan,
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  {business.display_name.slice(0, 1)}
                </div>
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontFamily: SERIF,
                  fontSize: 20,
                  fontWeight: 500,
                  letterSpacing: "-0.005em",
                  lineHeight: 1.15,
                  marginBottom: 2,
                }}
              >
                {business.display_name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: NEX.textDim,
                  letterSpacing: "0.02em",
                }}
              >
                Visit shop →
              </div>
            </div>
          </Link>
        </section>
      </main>

      {/* --- STICKY BOTTOM ACTION BAR ------------------------------ */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          padding: "10px 16px calc(env(safe-area-inset-bottom, 0) + 10px)",
          background:
            "linear-gradient(180deg, rgba(2,9,20,0) 0%, rgba(2,9,20,0.86) 40%, rgba(2,9,20,0.96) 100%)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            display: "flex",
            gap: 10,
          }}
        >
          <Link
            href={chatHref}
            style={{
              flex: 1.4,
              padding: "14px 16px",
              borderRadius: 14,
              background:
                "linear-gradient(180deg, #FF9033 0%, #FF7800 100%)",
              color: "#0B0F1A",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              textDecoration: "none",
              textAlign: "center",
              boxShadow:
                "0 12px 28px rgba(255,120,0,0.4), inset 0 1px 0 rgba(255,255,255,0.28)",
            }}
          >
            Order Now
          </Link>
          <Link
            href={chatHref}
            style={{
              flex: 1,
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(0,175,255,0.16)",
              border: `1px solid ${NEX.cyanSoft}`,
              color: NEX.text,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Chat Now
          </Link>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow }: { eyebrow: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        color: NEX.cyan,
        fontWeight: 700,
        marginBottom: 10,
      }}
    >
      {eyebrow}
    </div>
  );
}

function BackIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function formatPrice(pence: number, currency: string): string {
  const majors = Math.round(pence / 100);
  const withCommas = majors.toLocaleString();
  if (currency === "IDR") return `Rp ${withCommas}`;
  if (currency === "GBP") return `£${(pence / 100).toFixed(2)}`;
  if (currency === "USD") return `$${(pence / 100).toFixed(2)}`;
  return `${currency} ${withCommas}`;
}
