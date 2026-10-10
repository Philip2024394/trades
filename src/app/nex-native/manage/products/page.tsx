// src/app/nex-native/manage/products/page.tsx
//
// Bridge 66 · Seller product list · per-card sold-out/available toggle.
// ---------------------------------------------------------------------
// Server Component. Reads every product the caller owns for their
// first business and renders a compact list matching the visual
// language of /nex-native/manage/menu (dark navy panel · cyan
// eyebrow · orange accents · pill toggle button).
//
// Doctrine kept:
//   · Availability toggle is not delete · sold-out just paints a
//     red pill and dims the row on the public shop.
//   · Manage layout (Bridge 55) already gates the whole /manage/*
//     subtree behind the Phase 1 commerce flag · no per-page gate.
//   · Redirects to /nex-native/onboarding?commerce=1 when the caller
//     has not yet created a business (mirrors the menu page).

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import type { NexProductRow } from "@/lib/nex-native/types";
import { toggleProductStockAction } from "./_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  cyanSoft: "rgba(0,175,255,0.5)",
  orange: "#FF7200",
  orangeSoft: "rgba(255,114,0,0.6)",
  green: "#16D66B",
  amber: "#F59E0B",
  red: "#FF3355",
};

export default async function ManageProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; m?: string }>;
}) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;

  const businesses = await businessService.listBusinessesByOwner(
    session.account.id,
  );
  const business = businesses[0] ?? null;

  if (!business) {
    redirect("/nex-native/onboarding?commerce=1");
  }

  const products = await productService.listProductsByBusiness(business.id);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: 60,
      }}
    >
      {/* --- Top bar ---------------------------------------------------- */}
      <header
        style={{
          padding: "calc(env(safe-area-inset-top, 0) + 14px) 16px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${NEX.border}`,
        }}
      >
        <Link
          href="/nex-native/manage"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: NEX.textDim,
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          ← Manage
        </Link>
        <Link
          href={`/nex-native/${business.slug}`}
          style={{
            fontSize: 11,
            color: NEX.cyan,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          View shop ↗
        </Link>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: NEX.orange,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          Products
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            marginBottom: 6,
          }}
        >
          {business.display_name}
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 13,
            color: NEX.textDim,
            lineHeight: 1.55,
          }}
        >
          Every product you sell · toggle a line to <b>sold out</b> when
          stock runs out without hiding it from the shop · flip it back to{" "}
          <b>available</b> when it&apos;s restocked. No deletes here · the
          full editor lives on the shop editor.
        </p>

        {banner && <Banner code={banner.code} message={banner.message} />}

        {products.length === 0 ? (
          <EmptyState businessSlug={business.slug} />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {products.map((product) => (
              <ProductRow key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Product row · thumb + name + price + sold-out toggle                  *
 * --------------------------------------------------------------------- */

function ProductRow({ product }: { product: NexProductRow }) {
  const isSoldOut = product.stock_status === "sold_out";
  const nextStatus = isSoldOut ? "in_stock" : "sold_out";
  const priceIdr = Math.round(product.price_pence / 100);
  const price = new Intl.NumberFormat("id-ID").format(priceIdr);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "56px 1fr auto",
        gap: 12,
        alignItems: "flex-start",
        padding: 12,
        borderRadius: 12,
        background: "rgba(0,0,0,0.32)",
        border: `1px solid ${NEX.border}`,
        opacity: isSoldOut ? 0.75 : 1,
      }}
    >
      {/* thumb */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 8,
          background: product.image_url
            ? `url(${product.image_url}) center/cover`
            : "rgba(139,169,209,0.08)",
          border: `1px solid ${NEX.border}`,
          flexShrink: 0,
        }}
      />

      {/* meta */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 4,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "-0.005em",
            }}
          >
            {product.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: NEX.orange,
              fontWeight: 700,
            }}
          >
            {product.currency === "IDR" ? "Rp " : `${product.currency} `}
            {price}
          </div>
          {product.status !== "live" && (
            <span style={statusPillStyle}>{product.status}</span>
          )}
          {isSoldOut && <span style={soldOutPillStyle}>Sold out</span>}
          {product.stock_status === "low_stock" && (
            <span style={lowStockPillStyle}>Low stock</span>
          )}
          {product.stock_status === "made_to_order" && (
            <span style={madeToOrderPillStyle}>Made to order</span>
          )}
        </div>
        {product.description && (
          <div
            style={{
              fontSize: 12,
              color: NEX.textDim,
              lineHeight: 1.5,
              marginBottom: 6,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {product.description}
          </div>
        )}

        {/* action row · toggle */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <form action={toggleProductStockAction}>
            <input type="hidden" name="product_id" value={product.id} />
            <input type="hidden" name="next_status" value={nextStatus} />
            <button
              type="submit"
              style={{
                ...pillButtonStyle,
                color: isSoldOut ? NEX.green : NEX.textDim,
                borderColor: isSoldOut
                  ? "rgba(22,214,107,0.35)"
                  : NEX.borderStrong,
                background: isSoldOut
                  ? "rgba(22,214,107,0.10)"
                  : "rgba(0,0,0,0.28)",
              }}
            >
              {isSoldOut ? "Mark available" : "Mark sold out"}
            </button>
          </form>
        </div>
      </div>

      {/* right column reserved · empty for now */}
      <div />
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Empty state                                                           *
 * --------------------------------------------------------------------- */

function EmptyState({ businessSlug }: { businessSlug: string }) {
  return (
    <div
      style={{
        padding: "28px 20px",
        textAlign: "center",
        color: NEX.textMute,
        fontSize: 13,
        lineHeight: 1.55,
        border: `1px dashed ${NEX.borderStrong}`,
        borderRadius: 14,
        marginBottom: 20,
      }}
    >
      No products yet.
      <div style={{ marginTop: 12 }}>
        <Link
          href={`/nex-native/${businessSlug}`}
          style={{
            display: "inline-block",
            padding: "10px 16px",
            borderRadius: 12,
            background: NEX.orange,
            color: "#0B0F1A",
            fontSize: 12,
            fontWeight: 700,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            boxShadow: "0 8px 22px rgba(255,114,0,0.35)",
          }}
        >
          Open your shop editor
        </Link>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Banner                                                                *
 * --------------------------------------------------------------------- */

function Banner({ code, message }: { code: string; message: string }) {
  const isError = code.endsWith("_failed") || code.endsWith("_forbidden") ||
    code === "not_owner" || code === "product_not_found" ||
    code === "invalid_stock_status" || code === "missing_product_id";
  return (
    <div
      role="status"
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: isError
          ? "rgba(255,51,85,0.10)"
          : "rgba(22,214,107,0.10)",
        border: `1px solid ${
          isError ? "rgba(255,51,85,0.4)" : "rgba(22,214,107,0.4)"
        }`,
        color: isError ? "#FFB4C0" : "#B8F1CC",
        fontSize: 13,
        marginBottom: 18,
      }}
    >
      {message}
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Shared styles                                                         *
 * --------------------------------------------------------------------- */

const pillButtonStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: `1px solid ${NEX.borderStrong}`,
  background: "rgba(0,0,0,0.32)",
  color: NEX.text,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
  fontFamily: "inherit",
};

const soldOutPillStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: NEX.red,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 999,
  border: `1px solid rgba(255,51,85,0.35)`,
  background: "rgba(255,51,85,0.10)",
};

const lowStockPillStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: NEX.amber,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 999,
  border: `1px solid rgba(245,158,11,0.35)`,
  background: "rgba(245,158,11,0.10)",
};

const madeToOrderPillStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: NEX.cyan,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 999,
  border: `1px solid ${NEX.cyanSoft}`,
  background: "rgba(0,175,255,0.10)",
};

const statusPillStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: NEX.textMute,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 999,
  border: `1px solid ${NEX.border}`,
  background: "rgba(139,169,209,0.08)",
};
