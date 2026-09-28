// src/app/nex-native/share/page.tsx
//
// Bridge 17 · Share a product with a NEX contact.
// ------------------------------------------------
// Landing page opened when a buyer taps the share icon on a product
// card. Server-side resolves the viewer's friend list · renders one
// form per contact bound to sendProductInquiryAction · submitting
// drops the product into that peer's chat as a Bridge 11 product
// card (attachment_type='product' + snapshot in attachment_meta).
//
// Sign-in gated · anonymous visitors get bounced to /sign-in with a
// `next=` parameter so they land back here.

import type * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as productService from "@/lib/nex-native/product-service";
import * as businessService from "@/lib/nex-native/business-service";
import * as accountService from "@/lib/nex-native/account-service";
import * as friendService from "@/lib/nex-native/friend-service";
import * as accountProfileService from "@/lib/nex-native/account-profile-service";
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
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const metadata = { title: "NEX · Share a product" };

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; back?: string }>;
}) {
  const sp = await searchParams;
  const productId = (sp.product ?? "").trim();
  if (!productId) notFound();

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    const qs = new URLSearchParams({
      next: `/nex-native/share?product=${productId}`,
    });
    redirect(`/nex-native/sign-in?${qs.toString()}`);
  }

  const product = await productService.getProductById(productId);
  if (!product) notFound();
  const business = await businessService.getBusinessById(product.business_id);
  if (!business) notFound();
  const backHref =
    (sp.back ?? "").startsWith("/nex-native/")
      ? (sp.back ?? "")
      : `/nex-native/${business.slug}`;

  // Fetch the viewer's accepted friends · render one row per friend.
  const friendIds = await friendService.listFriends(session.account.id);
  // Never share to the seller themselves (their own product), or to
  // themselves (self-chat isn't supported).
  const shareableIds = friendIds.filter(
    (id) => id !== session.account.id && id !== business.owner_account_id,
  );
  const friends = await Promise.all(
    shareableIds.map(async (id) => {
      const account = await accountService
        .getAccountById(id)
        .catch(() => null);
      const profile = await accountProfileService
        .getProfileByAccountId(id)
        .catch(() => null);
      return { account, profile };
    }),
  );
  const validFriends = friends.filter(
    (f): f is {
      account: NonNullable<typeof f.account>;
      profile: typeof f.profile;
    } => f.account !== null,
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
          href={backHref}
          style={{
            fontSize: 11,
            color: NEX.textDim,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          ← Back to shop
        </Link>
      </header>

      <main style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px" }}>
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
          Share product
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontSize: 34,
            lineHeight: 1.1,
            letterSpacing: "-0.012em",
            fontWeight: 500,
            marginBottom: 20,
          }}
        >
          Send to a NEX contact.
        </h1>

        {/* Product summary card */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "72px 1fr",
            gap: 14,
            padding: "14px 16px",
            borderRadius: 14,
            background: NEX.panelSoft,
            border: `1px solid ${NEX.borderStrong}`,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 10,
              background: product.image_url
                ? `url(${product.image_url}) center/cover`
                : "rgba(139,169,209,0.08)",
              border: `1px solid ${NEX.border}`,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: NEX.textMute,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              {business.display_name}
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "-0.005em",
                marginBottom: 4,
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
                fontSize: 14,
                fontWeight: 700,
                color: NEX.orange,
              }}
            >
              {formatPrice(product.price_pence, product.currency)}
            </div>
          </div>
        </div>

        {validFriends.length === 0 ? (
          <EmptyContacts />
        ) : (
          <>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: NEX.textMute,
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              Your NEX contacts
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {validFriends.map(({ account, profile }) => (
                <FriendShareRow
                  key={account.id}
                  friendId={account.id}
                  friendName={account.display_name}
                  avatarUrl={profile?.avatar_url ?? null}
                  profession={profile?.profession ?? null}
                  productId={productId}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Sub-components                                                        *
 * --------------------------------------------------------------------- */

function FriendShareRow({
  friendId,
  friendName,
  avatarUrl,
  profession,
  productId,
}: {
  friendId: string;
  friendName: string;
  avatarUrl: string | null;
  profession: string | null;
  productId: string;
}) {
  const shareAction = sendProductInquiryAction.bind(null, friendId);
  const firstName = friendName.split(/\s+/)[0] ?? friendName;
  return (
    <form
      action={shareAction}
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr auto",
        gap: 12,
        alignItems: "center",
        padding: "12px 14px",
        borderRadius: 12,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
      }}
    >
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="intent" value="ask" />
      <input
        type="hidden"
        name="body"
        value={`Look at this on NEX · ${firstName}, what do you think?`}
      />
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: avatarUrl
            ? `url(${avatarUrl}) center/cover`
            : "linear-gradient(135deg, #143552 0%, #052041 100%)",
          border: `1px solid ${NEX.border}`,
          display: "grid",
          placeItems: "center",
          color: NEX.textDim,
          fontSize: 14,
          fontWeight: 700,
        }}
        aria-hidden
      >
        {!avatarUrl && (firstName[0] ?? "?").toUpperCase()}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "-0.003em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {firstName}
        </div>
        {profession && (
          <div
            style={{
              fontSize: 11,
              color: NEX.textDim,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {profession}
          </div>
        )}
      </div>
      <button
        type="submit"
        style={{
          padding: "8px 14px",
          borderRadius: 10,
          background: "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
          border: `1px solid ${NEX.orangeSoft}`,
          color: "#0B0F1A",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: "pointer",
          fontFamily: "inherit",
          boxShadow:
            "0 6px 14px rgba(255,114,0,0.30), inset 0 1px 0 rgba(255,255,255,0.28)",
        }}
      >
        Send
      </button>
    </form>
  );
}

function EmptyContacts() {
  return (
    <div
      style={{
        padding: "32px 22px",
        borderRadius: 16,
        background: NEX.panelSoft,
        border: `1px dashed ${NEX.borderStrong}`,
        textAlign: "center",
        color: NEX.textDim,
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
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
        No contacts yet
      </div>
      <p style={{ margin: "0 0 16px" }}>
        You don&apos;t have any accepted friends on NEX yet. Add someone
        first, then come back to share this product.
      </p>
      <Link
        href="/nex-native/contacts"
        style={{
          display: "inline-block",
          padding: "10px 16px",
          borderRadius: 12,
          background: "rgba(0,175,255,0.14)",
          border: `1px solid ${NEX.cyanSoft}`,
          color: NEX.text,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textDecoration: "none",
        }}
      >
        Find contacts →
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
