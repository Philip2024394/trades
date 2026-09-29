// src/app/nex-native/liked/page.tsx
//
// Bridge 18 · Liked products list · buyer-facing saved collection.
// ----------------------------------------------------------------
// Renders the viewer's saved products with bulk-delete via
// checkboxes, per-item delete, and open-in-shop links. Auth-gated ·
// anonymous visitors bounce to sign-in.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as likedProductService from "@/lib/nex-native/liked-product-service";
import {
  toggleLikeProductAction,
  bulkDeleteLikedProductsAction,
} from "../_actions";

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
  orange: "#FF7200",
  orangeSoft: "rgba(255,114,0,0.6)",
  green: "#16D66B",
  red: "#FF3355",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const metadata = { title: "NEX · Your liked items" };

export default async function LikedPage({
  searchParams,
}: {
  searchParams: Promise<{
    bulk_ok?: string;
    bulk_error?: string;
    like_error?: string;
    commerce?: string;
  }>;
}) {
  const sp = await searchParams;
  // Bridge 55 · Phase 1 launch gate · liked products hidden by default.
  const { commerceEnabledForRequest } = await import(
    "@/lib/nex-native/launch-flags"
  );
  if (!commerceEnabledForRequest(sp)) {
    redirect("/nex-native/home");
  }
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/liked");
  }

  const sp = await searchParams;
  const bundles = await likedProductService.listLikedForViewer(
    session.account.id,
  );
  const banner = sp.bulk_ok
    ? { tone: "green" as const, text: `Removed · ${sp.bulk_ok}` }
    : sp.bulk_error
      ? { tone: "red" as const, text: sp.bulk_error }
      : sp.like_error
        ? { tone: "red" as const, text: sp.like_error }
        : null;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        paddingBottom: 80,
      }}
    >
      <header
        style={{
          padding: "calc(env(safe-area-inset-top, 0) + 14px) 20px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${NEX.border}`,
        }}
      >
        <Link
          href="/nex-native/home"
          style={{
            fontSize: 11,
            color: NEX.textDim,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          ← NEX
        </Link>
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "36px 20px" }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          ❤ Your saved items
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontSize: 40,
            lineHeight: 1.08,
            letterSpacing: "-0.015em",
            fontWeight: 500,
            marginBottom: 8,
          }}
        >
          Liked shop items
        </h1>
        <p
          style={{
            margin: "0 0 26px",
            fontSize: 14,
            lineHeight: 1.6,
            color: NEX.textDim,
          }}
        >
          Products you&apos;ve hearted from any NEX shop · tap Open to
          go back to the shop or use the check boxes to remove many
          at once.
        </p>

        {banner && (
          <div
            role="status"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background:
                banner.tone === "red"
                  ? "rgba(255,51,85,0.10)"
                  : "rgba(22,214,107,0.10)",
              border: `1px solid ${
                banner.tone === "red"
                  ? "rgba(255,51,85,0.35)"
                  : "rgba(22,214,107,0.35)"
              }`,
              color: banner.tone === "red" ? "#FFB4C0" : "#B8F1CC",
              fontSize: 13,
              marginBottom: 18,
            }}
          >
            {banner.text}
          </div>
        )}

        {bundles.length === 0 ? (
          <EmptyLikedState />
        ) : (
          <form action={bulkDeleteLikedProductsAction}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: NEX.textMute,
                  fontWeight: 700,
                }}
              >
                {bundles.length} liked item{bundles.length === 1 ? "" : "s"}
              </div>
              <button
                type="submit"
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "rgba(255,51,85,0.10)",
                  border: `1px solid rgba(255,51,85,0.35)`,
                  color: NEX.red,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Delete ticked
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {bundles.map((b) => (
                <LikedRow
                  key={b.liked_id}
                  bundle={b}
                />
              ))}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Row                                                                   *
 * --------------------------------------------------------------------- */

function LikedRow({
  bundle,
}: {
  bundle: import("@/lib/nex-native/liked-product-service").LikedProductBundle;
}) {
  const { product, business, liked_id } = bundle;
  const price = formatPrice(product.price_pence, product.currency);
  const shopHref = `/nex-native/${business.slug}`;
  const productHref = `/nex-native/${business.slug}/${product.id}`;
  const removeAction = toggleLikeProductAction.bind(null, product.id);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "24px 68px 1fr",
        gap: 12,
        alignItems: "center",
        padding: "12px 14px",
        borderRadius: 14,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
      }}
    >
      {/* Bulk-select checkbox · part of the outer form */}
      <label
        style={{
          display: "grid",
          placeItems: "center",
          width: 24,
          height: 24,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          name="liked_id"
          value={liked_id}
          style={{
            width: 18,
            height: 18,
            accentColor: NEX.red,
          }}
          aria-label={`Select ${product.name} for delete`}
        />
      </label>
      {/* Product thumb */}
      <div
        style={{
          width: 68,
          height: 68,
          borderRadius: 10,
          background: product.image_url
            ? `url(${product.image_url}) center/cover`
            : "rgba(139,169,209,0.08)",
          border: `1px solid ${NEX.border}`,
        }}
      />
      {/* Meta + actions */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 3,
          }}
        >
          <Link
            href={shopHref}
            style={{ color: NEX.cyan, textDecoration: "none" }}
          >
            {business.slug}.nex
          </Link>
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "-0.003em",
            marginBottom: 3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={product.name}
        >
          {product.name}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: NEX.orange,
            marginBottom: 8,
          }}
        >
          {price}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            href={productHref}
            style={{
              padding: "5px 10px",
              borderRadius: 999,
              background: "rgba(0,175,255,0.14)",
              border: `1px solid rgba(0,175,255,0.4)`,
              color: NEX.text,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            Open →
          </Link>
          <form action={removeAction}>
            <input type="hidden" name="intent" value="unlike" />
            <input type="hidden" name="back" value="/nex-native/liked" />
            <button
              type="submit"
              style={{
                padding: "5px 10px",
                borderRadius: 999,
                background: "rgba(255,51,85,0.08)",
                border: `1px solid rgba(255,51,85,0.30)`,
                color: NEX.red,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Remove
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Empty state                                                           *
 * --------------------------------------------------------------------- */

function EmptyLikedState() {
  return (
    <div
      style={{
        padding: "36px 22px",
        borderRadius: 16,
        background: NEX.panelSoft,
        border: `1px dashed ${NEX.borderStrong}`,
        textAlign: "center",
        color: NEX.textDim,
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 8 }} aria-hidden>
        ❤
      </div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: NEX.textMute,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        No liked items yet
      </div>
      <p style={{ margin: "0 0 18px" }}>
        Tap the heart on any product to save it here · you can come
        back later to open, share, or delete them.
      </p>
      <Link
        href="/nex-native/search"
        style={{
          display: "inline-block",
          padding: "10px 16px",
          borderRadius: 12,
          background: "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
          border: `1px solid ${NEX.orangeSoft}`,
          color: "#0B0F1A",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textDecoration: "none",
          boxShadow: "0 8px 20px rgba(255,114,0,0.35)",
        }}
      >
        Browse shops →
      </Link>
    </div>
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
