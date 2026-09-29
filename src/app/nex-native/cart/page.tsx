// src/app/nex-native/cart/page.tsx
//
// Bridge 22 · Shopping cart · buyer-facing page.
// ----------------------------------------------
// Server Component shell · hands off to CartClient which reads
// localStorage. Per-shop groupings, per-item qty + note, per-shop
// buyer comments, Send button that posts a cart_order bubble into
// that shop owner's peer chat.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  sendCartOrderAction,
  saveServerCartAction,
} from "../_actions";
import * as cartService from "@/lib/nex-native/cart-service";
import { CartClient } from "./_cart-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  border: "rgba(139, 169, 209, 0.14)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  cyan: "#00AFFF",
  orange: "#FF7200",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const metadata = { title: "NEX · Your cart" };

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ send_error?: string; commerce?: string }>;
}) {
  const sp = await searchParams;
  // Bridge 55 · Phase 1 launch gate · commerce hidden by default.
  // Admins can still reach /cart with ?commerce=1.
  const { commerceEnabledForRequest } = await import(
    "@/lib/nex-native/launch-flags"
  );
  if (!commerceEnabledForRequest(sp)) {
    redirect("/nex-native/home");
  }
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/cart");
  }

  // Bridge 22c-3 · hydrate the server-side cart on this device · the
  // client merges it with localStorage on mount so the buyer sees
  // items they added on other devices.
  const serverCart = await cartService.getServerCart(session.account.id);

  // Bridge 49b-follow · preview the NEX Direct Price discount per
  // shop in the cart so the client can render the saving line BEFORE
  // the buyer hits Send. Best-effort · non-fatal per shop · server
  // remains authoritative at send time.
  const uniqueShopIds = Array.from(
    new Set(serverCart.items.map((i) => i.shop_id).filter(Boolean)),
  );
  const ladderSvc = await import("@/lib/nex-native/ladder-service");
  const directPricePreviews: Record<
    string,
    Awaited<ReturnType<typeof ladderSvc.resolveAppliedDiscountForBuyer>>
  > = {};
  await Promise.all(
    uniqueShopIds.map(async (shopId) => {
      try {
        directPricePreviews[shopId] =
          await ladderSvc.resolveAppliedDiscountForBuyer(
            session.account.id,
            shopId,
          );
      } catch {
        // Shop with no ladder OR service error · client falls back to
        // "no discount preview" for this shop and lets the send-time
        // authoritative calc surprise-and-delight.
      }
    }),
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
          href="/nex-native/orders"
          style={{
            fontSize: 11,
            color: NEX.cyan,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          Orders ↗
        </Link>
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "36px 20px" }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: NEX.orange,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          🛒 Your cart
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
          Ready to send
        </h1>
        <p
          style={{
            margin: "0 0 26px",
            fontSize: 14,
            lineHeight: 1.6,
            color: NEX.textDim,
          }}
        >
          Each shop&apos;s items go into their own message in the
          seller&apos;s chat · add extra details in the notes box
          before you send.
        </p>

        {sp.send_error && (
          <div
            role="status"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(255,51,85,0.10)",
              border: "1px solid rgba(255,51,85,0.35)",
              color: "#FFB4C0",
              fontSize: 13,
              marginBottom: 18,
            }}
          >
            {sp.send_error}
          </div>
        )}

        <CartClient
          sendAction={sendCartOrderAction}
          saveAction={saveServerCartAction}
          serverCart={{
            items: serverCart.items,
            delivery_address: serverCart.delivery_address,
            updated_at: serverCart.updated_at,
          }}
          directPricePreviews={directPricePreviews}
        />
      </main>
    </div>
  );
}
