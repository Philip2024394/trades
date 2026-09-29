// src/app/nex-native/orders/page.tsx
//
// Bridge 19 · Buyer order history · NEX-identity rebuild.
// -------------------------------------------------------
// Full list of every order the caller has placed as a customer,
// newest-first, with a Reorder button per row that drops a fresh
// inquiry ("I'd like this again") into the seller's chat.
//
// Server Component · reads via order-service · dark-navy identity
// matching the rest of the app (was previously legacy Tailwind).

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import * as orderService from "@/lib/nex-native/order-service";
import type { NexOrderState } from "@/lib/nex-native/types";
import { sendProductInquiryAction } from "../_actions";

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

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const STATE_TONE: Record<NexOrderState, { color: string; label: string }> = {
  created: { color: NEX.cyan, label: "Placed" },
  pending: { color: NEX.amber, label: "Awaiting payment" },
  paid: { color: NEX.green, label: "Paid" },
  completed: { color: NEX.green, label: "Completed" },
  cancelled: { color: NEX.textMute, label: "Cancelled" },
  refunded: { color: NEX.red, label: "Refunded" },
};

export const metadata = { title: "NEX · Your orders" };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{ commerce?: string }>;
}) {
  // Bridge 55 · Phase 1 launch gate · orders history hidden by
  // default. Admins can reach it with ?commerce=1.
  const sp = searchParams ? await searchParams : {};
  const { commerceEnabledForRequest } = await import(
    "@/lib/nex-native/launch-flags"
  );
  if (!commerceEnabledForRequest(sp)) {
    redirect("/nex-native/home");
  }
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/orders");
  }

  const orders = await orderService.listOrdersByCustomer(session.account.id);
  const businessIds = Array.from(new Set(orders.map((o) => o.business_id)));
  const productIds = Array.from(new Set(orders.map((o) => o.product_id)));
  const [businesses, products] = await Promise.all([
    Promise.all(businessIds.map((id) => businessService.getBusinessById(id))),
    Promise.all(productIds.map((id) => productService.getProductById(id))),
  ]);
  const bizById = new Map(
    businesses.filter(Boolean).map((b) => [b!.id, b!]),
  );
  const prodById = new Map(
    products.filter(Boolean).map((p) => [p!.id, p!]),
  );

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
        <Link
          href="/nex-native/liked"
          style={{
            fontSize: 11,
            color: NEX.cyan,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          Liked ↗
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
          🛍 Your orders
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
          Recent orders
        </h1>
        <p
          style={{
            margin: "0 0 26px",
            fontSize: 14,
            lineHeight: 1.6,
            color: NEX.textDim,
          }}
        >
          Everything you&apos;ve ordered on NEX, newest first · tap
          Reorder to send a fresh request to the seller with the
          same product.
        </p>

        {orders.length === 0 ? (
          <EmptyOrdersState />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {orders.map((order) => {
              const business = bizById.get(order.business_id);
              const product = prodById.get(order.product_id);
              const tone = STATE_TONE[order.state];
              return (
                <OrderRow
                  key={order.id}
                  orderId={order.id}
                  state={order.state}
                  stateLabel={tone.label}
                  stateColor={tone.color}
                  createdAt={order.created_at}
                  price={formatPrice(order.price_pence, order.currency)}
                  productName={product?.name ?? "(product removed)"}
                  productImage={product?.image_url ?? null}
                  businessName={
                    business?.display_name ?? "(shop removed)"
                  }
                  businessSlug={business?.slug ?? null}
                  reorderAction={
                    business && product
                      ? sendProductInquiryAction.bind(
                          null,
                          business.owner_account_id,
                        )
                      : null
                  }
                  productId={order.product_id}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Row                                                                   *
 * --------------------------------------------------------------------- */

function OrderRow({
  orderId,
  state,
  stateLabel,
  stateColor,
  createdAt,
  price,
  productName,
  productImage,
  businessName,
  businessSlug,
  reorderAction,
  productId,
}: {
  orderId: string;
  state: NexOrderState;
  stateLabel: string;
  stateColor: string;
  createdAt: string;
  price: string;
  productName: string;
  productImage: string | null;
  businessName: string;
  businessSlug: string | null;
  reorderAction: ((formData: FormData) => Promise<never> | void) | null;
  productId: string;
}) {
  void state;
  const when = formatWhen(createdAt);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "72px 1fr",
        gap: 14,
        padding: "14px 16px",
        borderRadius: 14,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 10,
          background: productImage
            ? `url(${productImage}) center/cover`
            : "rgba(139,169,209,0.08)",
          border: `1px solid ${NEX.border}`,
        }}
        aria-hidden
      />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 4,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: stateColor,
              fontWeight: 800,
            }}
          >
            {stateLabel}
          </div>
          <div style={{ fontSize: 10, color: NEX.textMute }}>{when}</div>
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "-0.003em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: 2,
          }}
          title={productName}
        >
          {productName}
        </div>
        <div
          style={{
            fontSize: 11,
            color: NEX.textDim,
            marginBottom: 4,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {businessSlug ? (
            <Link
              href={`/nex-native/${businessSlug}`}
              style={{ color: NEX.cyan, textDecoration: "none" }}
            >
              {businessSlug}.nex
            </Link>
          ) : (
            businessName
          )}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: NEX.orange,
            marginBottom: 10,
          }}
        >
          {price}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            href={`/nex-native/orders/${orderId}`}
            style={pillLink()}
          >
            Details →
          </Link>
          {reorderAction && (
            <form action={reorderAction}>
              <input type="hidden" name="product_id" value={productId} />
              <input type="hidden" name="intent" value="want" />
              <input
                type="hidden"
                name="body"
                value={`I'd like this again · ${productName}`}
              />
              <button type="submit" style={reorderButton()}>
                Reorder
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Empty                                                                 *
 * --------------------------------------------------------------------- */

function EmptyOrdersState() {
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
        🛍
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
        No orders yet
      </div>
      <p style={{ margin: "0 0 18px" }}>
        Every order you place through a NEX shop will land here · you
        can Reorder in one tap from the row.
      </p>
      <Link href="/nex-native/search" style={pillLink({ primary: true })}>
        Browse shops →
      </Link>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Helpers                                                               *
 * --------------------------------------------------------------------- */

function pillLink(opts: { primary?: boolean } = {}): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "5px 12px",
    borderRadius: 999,
    background: opts.primary
      ? "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)"
      : "rgba(0,175,255,0.14)",
    border: opts.primary
      ? `1px solid ${NEX.orangeSoft}`
      : `1px solid ${NEX.cyanSoft}`,
    color: opts.primary ? "#0B0F1A" : NEX.text,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    textDecoration: "none",
    fontFamily: "inherit",
  };
}

function reorderButton(): React.CSSProperties {
  return {
    padding: "5px 12px",
    borderRadius: 999,
    background: "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
    border: `1px solid ${NEX.orangeSoft}`,
    color: "#0B0F1A",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 4px 10px rgba(255,114,0,0.35)",
  };
}

function formatPrice(pence: number, currency: string): string {
  const majors = Math.round(pence / 100);
  const withCommas = majors.toLocaleString();
  if (currency === "IDR") return `Rp ${withCommas}`;
  if (currency === "GBP") return `£${(pence / 100).toFixed(2)}`;
  if (currency === "USD") return `$${(pence / 100).toFixed(2)}`;
  return `${currency} ${withCommas}`;
}

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const min = Math.round(diffMs / 60_000);
  if (min < 60) return `${Math.max(1, min)}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}
