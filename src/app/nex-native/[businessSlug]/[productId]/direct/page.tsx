// src/app/nex-native/[businessSlug]/[productId]/direct/page.tsx
//
// Bridge 49b · Buyer-facing NEX Direct Price view (D6 Swiss NEX).
// -----------------------------------------------------------------
// Alternate route to /nex-native/[businessSlug]/[productId] that
// renders the full-height Swiss-NEX Bauhaus product page with LIVE
// data: ladder from nex_product_ladder · buyer's tier from
// nex_buyer_tier_progress · compare price computed from
// nex_business.compare_markup_pct.
//
// Sealed 2026-09-29 · doctrine lives in
// memory/nex_direct_price_swiss_sealed_2026_09_29.md.
//
// Renders a "ladder is not set up yet" fallback when the seller
// hasn't opted in via /manage/ladder. The buyer can still hit the
// standard /nex-native/[businessSlug]/[productId] page for the
// classic product view.

import Link from "next/link";
import { notFound } from "next/navigation";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import * as ladderService from "@/lib/nex-native/ladder-service";
import * as friendService from "@/lib/nex-native/friend-service";
import * as accountService from "@/lib/nex-native/account-service";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { DirectPriceView } from "./_view";
import type { ActiveFriend } from "./_share-picker";

interface PageProps {
  params: Promise<{ businessSlug: string; productId: string }>;
  searchParams: Promise<{ e?: string; m?: string }>;
}

const ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function relativeLabel(iso: string | null | undefined): string {
  if (!iso) return "recently";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return "just now";
  if (diffMs < 60 * 60_000) return `${Math.round(diffMs / 60_000)}m ago`;
  if (diffMs < 24 * 60 * 60_000) return `${Math.round(diffMs / (60 * 60_000))}h ago`;
  return `${Math.round(diffMs / (24 * 60 * 60_000))}d ago`;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DirectPricePage({ params, searchParams }: PageProps) {
  const { businessSlug, productId } = await params;
  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const business = await businessService.getBusinessBySlug(businessSlug);
  if (!business) notFound();
  const product = await productService.getProductById(productId);
  if (!product || product.business_id !== business.id) notFound();

  const [session, ladder] = await Promise.all([
    resolveNexAppSessionFromContext(),
    ladderService.getLadderForBusiness(business.id).catch(() => null),
  ]);
  const buyerProgress = session
    ? await ladderService
        .getBuyerProgress(session.account.id, business.id)
        .catch(() => null)
    : null;

  // Bridge 49b-next · hydrate the buyer's ACTIVE NEX friends for the
  // share picker. "Active" = has a peer conversation with the buyer
  // AND that conversation's last_message_at is within 7 days. Server
  // enforces the same rule again on share submit (defence in depth).
  let activeFriends: ActiveFriend[] = [];
  if (session) {
    try {
      const friendIds = await friendService.listFriends(session.account.id);
      const hydrated = await Promise.all(
        friendIds.map(async (id) => {
          const [acc, conv] = await Promise.all([
            accountService.getAccountById(id),
            peerConversationService
              .findPeerConversation(session.account.id, id)
              .catch(() => null),
          ]);
          if (!acc) return null;
          const lastMs = conv?.last_message_at
            ? new Date(conv.last_message_at).getTime()
            : 0;
          if (!conv || Date.now() - lastMs > ACTIVE_WINDOW_MS) return null;
          // Best-effort avatar hydration · non-fatal if the profile
          // service isn't reachable.
          let avatarUrl: string | null = null;
          try {
            const svc = await import("@/lib/nex-native/account-profile-service");
            const profile = await svc.getProfileByAccountId(id);
            avatarUrl = profile?.avatar_url ?? null;
          } catch {
            // ignore · picker falls back to initials
          }
          return {
            id: acc.id,
            name: acc.display_name,
            handle: acc.nex_handle,
            avatarUrl,
            lastActiveLabel: relativeLabel(conv.last_message_at),
          } satisfies ActiveFriend;
        }),
      );
      activeFriends = hydrated.filter(
        (f): f is ActiveFriend => f !== null,
      );
    } catch {
      // Non-fatal · picker just shows empty state
    }
  }

  const orderCount = buyerProgress?.order_count ?? 0;
  const activeLadder = ladder && ladder.active;

  // Resolve tier position · when no ladder is set up, currentTier
  // becomes a synthetic "New here" so the price shows normal.
  const tiers = activeLadder ? ladder.tiers : [{ order: 1, discount: 0, label: "New here" }];
  const position = ladderService.resolveTierPosition(orderCount, tiers);

  // Compare price · seller-set markup on top of the NEX price.
  const markupPct = business.compare_markup_pct ?? 22;
  const comparePence = Math.round(product.price_pence * (1 + markupPct / 100));

  const chatHref = `/nex-native/chat/peer/${business.owner_account_id}`;
  const classicHref = `/nex-native/${business.slug}/${product.id}`;

  return (
    <DirectPriceView
      business={{
        id: business.id,
        name: business.display_name,
        slug: business.slug,
        location: business.city ?? "",
      }}
      product={{
        id: product.id,
        name: product.name,
        pricePence: product.price_pence,
        currency: product.currency,
        imageUrl: product.image_url ?? product.gallery_urls?.[0] ?? null,
        description: product.description ?? "",
      }}
      ladder={
        activeLadder
          ? {
              tiers,
              maxCapPct: ladder!.max_cap_pct,
              shareFriendBonusPct: ladder!.share_friend_bonus_pct,
              shareGroupBonusPct: ladder!.share_group_bonus_pct,
              shareExpiryHours: ladder!.share_expiry_hours,
              compareChannel: ladder!.compare_channel,
            }
          : null
      }
      buyerTier={{
        orderCount,
        currentTierIndex: position.currentTierIndex,
        currentDiscountPct: position.currentTier.discount,
        currentLabel: position.currentTier.label,
        nextTierIndex: position.nextTierIndex,
        nextTierOrder: position.nextTier?.order ?? null,
        nextTierDiscount: position.nextTier?.discount ?? null,
      }}
      compare={{
        markupPct,
        comparePence,
        savingPence: comparePence - product.price_pence,
      }}
      classicHref={classicHref}
      chatHref={chatHref}
      signedIn={!!session}
      activeFriends={activeFriends}
      banner={banner}
    />
  );
}
