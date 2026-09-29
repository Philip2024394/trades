// src/app/nex-native/chat/page.tsx
//
// NEX Chat hub · destination of Home tile 1 ("Chat with friends").
// -------------------------------------------------------------------------
// Landscape-card contacts view with a top toggle bar:
//
//   [ Friends ]  [ Business ]  [ Groups ]
//        ────
//
// Active tab has a cyan underline. Cards are wide horizontal tiles with
// avatar + name + subtitle + arrow. Tapping a card opens either the
// person's /u/[handle] profile (for now) or the existing
// conversation thread for a business relationship.
//
// Data sources · all real, no fabrication:
//   · Friends  → friend-service.listFriends (nex_friend_edge accepted)
//                 joined with account-service for display_name + handle
//   · Business → conversation-service.listConversationsForAccount filtered
//                 to my_side === "customer", deduped by business_id
//   · Groups   → empty for now (schema does not yet include a group
//                 table · sealed for Bridge 3+)
//
// Signed-out visitors → /sign-in.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as friendService from "@/lib/nex-native/friend-service";
import * as accountService from "@/lib/nex-native/account-service";
import * as conversationService from "@/lib/nex-native/conversation-service";
import { NEX_COMMERCE_ENABLED } from "@/lib/nex-native/launch-flags";
import type { NexBusinessRow, NexChatTheme } from "@/lib/nex-native/types";
import { NexPageHeader } from "../_page-header";
import {
  acceptFriendInviteAction,
  declineFriendInviteAction,
} from "../_actions";
import {
  NEX_OFFICIAL_CHAT_HREF,
  NEX_OFFICIAL_DISPLAY_NAME,
  NEX_OFFICIAL_HANDLE,
} from "@/lib/nex-native/nex-official";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Tab = "friends" | "business" | "groups";
// Bridge 55 · Phase 1 launch · Business tab is a commerce surface
// (shows buyer↔seller conversations) so it drops out when commerce
// is off. Friends + Groups remain always.
const TABS: readonly Tab[] = NEX_COMMERCE_ENABLED
  ? (["friends", "business", "groups"] as const)
  : (["friends", "groups"] as const);
const TAB_LABEL: Record<Tab, string> = {
  friends: "Friends",
  business: "Business",
  groups: "Groups",
};

// Preview mock cards · gated by NEX_ALLOW_DEV_ADMIN=1 so they render in
// local development but never in production. Populate the visual design
// while real friend / business / group data is still empty. Cards use
// slightly muted borders in preview so they're distinguishable from
// real cards on inspection but read as native to the surface.
//
// Each mock also previews the "world-class chat" design details we
// haven't shipped for real yet (sealed 2026-09-27):
//   · presence:      colours the fingerprint chip ring on the right
//                    · green active · yellow busy · gray offline
//   · last seen:     small "25m" label under the fingerprint chip
//                    (offline only)
//   · unread pill:   small orange badge on avatar top-right
//   · shop tag:      "🛍 Shop" pill under name if user owns a shop
//   · profession +   location as subtitle · richer than a bare handle
// These affordances only render on preview cards until the real
// presence system + unread aggregation + peer chat exist.
type MockPresence = "green" | "yellow" | "clear";
type MockReceiptState = "sent" | "read" | "inbound" | null;

/** Colour a card's left accent stripe takes on based on the person's
 *  chat_theme (nex_account.chat_theme). Businesses (which have no
 *  chat theme) always get NEX cyan. Missing/default theme → cyan.
 *
 *  This is the brand-identity moment for the world-class card design:
 *  every friend's card carries a subtle 3px stripe of *their* colour.
 *  You know who a card is from before you read the name. */
function accentForTheme(theme: NexChatTheme | string | null | undefined): string {
  switch (theme) {
    case "titanium":
      return "#B0B7C3";
    case "pink":
      return "#EC4899";
    case "gold":
      return "#F59E0B";
    case "night":
      return "#3B82F6";
    case "default":
    default:
      return "#00AFFF"; // NEX cyan
  }
}

// Sample avatar URLs from Unsplash · public, no attribution required for
// small previews. Only used by mock cards (dev-only) · never persisted.
// Preview shop targets by kind · admin taps a mock friend and lands on
// the flow that matches what they sell. Sealed with founder 2026-09-29.
//   · restaurant → Story Reel (interactive multi-item swipe menu)
//   · products   → Direct-Price gallery (single-product Direct Price)
//   · null       → not a shop · card stays unclickable
// Swap these hrefs for real seeded business URLs when live seed data
// lands · both routes render the same visual flow already.
type MockShopKind = "restaurant" | "products" | null;
const MOCK_SHOP_HREF: Record<Exclude<MockShopKind, null>, string> = {
  restaurant: "/nex-native/shop-prototypes/story-reel",
  products: "/nex-native/shop-prototypes/direct-price",
};

const MOCK_FRIENDS: ReadonlyArray<{
  name: string;
  handle: string;
  profession: string;
  location: string;
  presence: MockPresence;
  unread: number;
  hasShop: boolean;
  /** null when hasShop is false · otherwise picks which prototype the
   *  card routes to so admin can walk both flows end-to-end. */
  shopKind: MockShopKind;
  avatarUrl: string;
  lastMessage: string | null;
  receiptState: MockReceiptState;
  typing: boolean;
  /** Preview-only · chat_theme drives the 3px accent stripe colour on
   *  the left edge of the card. Varied across mocks so the full palette
   *  is visible in preview. */
  chatTheme: NexChatTheme;
}> = [
  {
    name: "Maria Santos",
    handle: "nex-27418",
    profession: "Product seller · leather shoes",
    location: "Bandung",
    presence: "green",
    unread: 0,
    hasShop: true,
    shopKind: "products",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
    lastMessage: "Yeah I'll be there — 2 pm works ✓",
    receiptState: "read",
    typing: false,
    chatTheme: "pink",
  },
  {
    name: "Aisha Rahman",
    handle: "nex-52091",
    profession: "Product seller · vintage cameras",
    location: "Jakarta",
    presence: "yellow",
    unread: 2,
    hasShop: true,
    shopKind: "products",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop",
    lastMessage: "Just got a Leica M4 in — want photos?",
    receiptState: "inbound",
    typing: true,
    chatTheme: "gold",
  },
  {
    name: "Kenji Tanaka",
    handle: "nex-38754",
    profession: "Photographer · portrait sessions",
    location: "Tokyo",
    presence: "clear",
    unread: 0,
    hasShop: false,
    shopKind: null,
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
    lastMessage: null,
    receiptState: null,
    typing: false,
    chatTheme: "titanium",
  },
  {
    name: "Lucas Ferreira",
    handle: "nex-15662",
    profession: "Student · Design",
    location: "Rio de Janeiro",
    presence: "green",
    unread: 0,
    hasShop: false,
    shopKind: null,
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop",
    lastMessage: "Thanks for the portfolio review!",
    receiptState: "sent",
    typing: false,
    chatTheme: "default",
  },
  {
    name: "Priya Patel",
    handle: "nex-91280",
    profession: "Restaurant · Priya's Mumbai Cafe",
    location: "Mumbai",
    presence: "clear",
    unread: 5,
    hasShop: true,
    shopKind: "restaurant",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop",
    lastMessage: "Delivery is out for tomorrow morning 🚗",
    receiptState: "inbound",
    typing: false,
    chatTheme: "night",
  },
  // Founder direction 2026-09-29 · two DEMO cards so admin can walk the
  // full flow: tap the card → the matching shop swipe surface opens →
  // add to cart / order. Explicit role names make it obvious which
  // flow each one demonstrates.
  {
    name: "Warung Sate Bunda",
    handle: "nex-77321",
    profession: "Restaurant · Indonesian sate & rice",
    location: "Yogyakarta",
    presence: "green",
    unread: 1,
    hasShop: true,
    shopKind: "restaurant",
    avatarUrl: "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=200&h=200&fit=crop",
    lastMessage: "Fresh sate off the grill — order by 7pm",
    receiptState: "inbound",
    typing: false,
    chatTheme: "titanium",
  },
  {
    name: "Toko Kopi Nara",
    handle: "nex-88450",
    profession: "Product seller · single-origin coffee beans",
    location: "Bali",
    presence: "green",
    unread: 0,
    hasShop: true,
    shopKind: "products",
    avatarUrl: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=200&h=200&fit=crop",
    lastMessage: "New harvest — Gayo 250g back in stock",
    receiptState: "read",
    typing: false,
    chatTheme: "default",
  },
] as const;

const MOCK_BUSINESSES: ReadonlyArray<{
  name: string;
  slug: string;
  /** Preview equivalent of businessSellsCaption() output · what the
   *  shop makes or sells, shown under the name. */
  sells: string;
  subtitle: string;
  hoursAgo: number;
  unread: number;
  receiptState: MockReceiptState;
}> = [
  {
    name: "Cake Shop Jogja",
    slug: "cakeshopjogja",
    sells: "Bakery",
    subtitle: "New batch of sourdough this Saturday · save one?",
    hoursAgo: 2,
    unread: 3,
    receiptState: "inbound",
  },
  {
    name: "Bandung Bakery",
    slug: "bandung-bakery",
    sells: "Bakery",
    subtitle: "Order confirmed · pickup 3pm tomorrow.",
    hoursAgo: 6,
    unread: 0,
    receiptState: "read",
  },
  {
    name: "Warung Nasi Padang",
    slug: "warung-nasi-padang",
    sells: "Restaurant",
    subtitle: "Payment received · terima kasih!",
    hoursAgo: 24,
    unread: 1,
    receiptState: "inbound",
  },
  {
    name: "Tukang Kayu Kreatif",
    slug: "tukang-kayu-kreatif",
    sells: "Tradesperson · furniture",
    subtitle: "Custom shelf · 4 weeks turnaround · deposit ready?",
    hoursAgo: 72,
    unread: 0,
    receiptState: "sent",
  },
] as const;

/** Preview-only pending incoming friend requests · shown behind
 *  ?preview=1 so the Waiting-for-you bucket has content in demos even
 *  when the real inbox is empty. Real data comes from
 *  friendService.listPendingIncoming. */
const MOCK_PENDING: ReadonlyArray<{
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  chatTheme: NexChatTheme | null;
  profession: string | null;
  location: string | null;
}> = [
  {
    id: "mock-pending-rahmi",
    name: "Rahmi Ayu",
    handle: "nex-64821",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop",
    chatTheme: "pink",
    profession: "Baker · pandan chiffon cakes",
    location: "Yogyakarta",
  },
  {
    id: "mock-pending-arif",
    name: "Arif Hidayat",
    handle: "nex-33009",
    avatarUrl: null,
    chatTheme: "default",
    profession: "Photographer · pre-wedding shoots",
    location: "Bali",
  },
] as const;

const MOCK_GROUPS: ReadonlyArray<{
  name: string;
  members: number;
  subtitle: string;
  unread: number;
}> = [
  {
    name: "NEX Founders Circle",
    members: 12,
    subtitle: "Started by Maria · daily active",
    unread: 8,
  },
  {
    name: "Bandung Coffee Meetup",
    members: 27,
    subtitle: "Meets Saturdays 10am",
    unread: 0,
  },
  {
    name: "Bali Digital Nomads",
    members: 45,
    subtitle: "Coworking · rides · food tips",
    unread: 2,
  },
] as const;

interface PageProps {
  searchParams: Promise<{ tab?: string; preview?: string }>;
}

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Reduce a profession string to WHAT this person actually sells or
 *  does · not their role label. When the string uses a "role · what"
 *  pattern (middle-dot or pipe separator), we drop the role prefix and
 *  keep the tail. Without a separator, the whole string reads fine.
 *
 *  Founder direction 2026-09-28 · friend cards should show what the
 *  person sells (their trade), not the label "Reseller". So we ELIDE
 *  the leading role token and prefer the descriptive tail.
 *
 *   "Reseller · vintage cameras"  → "vintage cameras"
 *   "Baker · sourdough & croissants" → "sourdough & croissants"
 *   "Photographer · portraits"    → "portraits"
 *   "Student · Design"            → "Design"
 *   "Bakery owner"                → "Bakery owner"  (no separator)
 *   "Photographer"                → "Photographer"  (no separator)
 *  Null / empty stays null. */
/** Category slug → human label for the Business-tab card caption.
 *  Founder direction 2026-09-28 · every business card should tell the
 *  buyer WHAT this shop makes or sells at a glance. Mirrors the
 *  NEX_BUSINESS_CATEGORIES enum in site-templates.ts. */
const NEX_BUSINESS_CATEGORY_LABEL: Record<string, string> = {
  "bakery": "Bakery",
  "restaurant": "Restaurant",
  "cafe": "Cafe",
  "ice-cream": "Ice cream shop",
  "dessert-shop": "Dessert shop",
  "drinks-shop": "Drinks shop",
  "juice-bar": "Juice bar",
  "tradesperson": "Tradesperson",
  "construction": "Construction",
  "staircase-company": "Staircase maker",
  "salon": "Salon",
  "beauty": "Beauty",
  "fitness": "Fitness studio",
  "consultant": "Consultant",
  "agency": "Agency",
  "ecommerce": "Online shop",
  "product-brand": "Product brand",
  "local-service": "Local service",
  "portfolio": "Portfolio",
  "community": "Community",
  "event": "Event organiser",
  "creator": "Creator",
  "professional-service": "Professional service",
};

/** Renders the "what this business makes / sells" caption for the
 *  Business-tab card. Preference order:
 *   1. Category label mapped from business_category slug
 *   2. First line of the description (up to 60 chars)
 *   3. null · caption row omitted
 *  Sealed 2026-09-28 · Bridge 30. */
function businessSellsCaption(b: NexBusinessRow): string | null {
  if (b.business_category) {
    const label = NEX_BUSINESS_CATEGORY_LABEL[b.business_category];
    if (label) return label;
  }
  if (b.description) {
    const firstLine = b.description.split(/\r?\n/)[0]?.trim() ?? "";
    if (firstLine) {
      return firstLine.length > 60 ? firstLine.slice(0, 57) + "…" : firstLine;
    }
  }
  return null;
}

function professionCaption(profession: string | null): string | null {
  if (!profession) return null;
  const trimmed = profession.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s*[·|]\s*/).filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(1).join(" · ").trim() || parts[0]!;
  }
  return trimmed;
}

export default async function ChatHubPage({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const sp = await searchParams;
  const activeTab: Tab = TABS.includes(sp.tab as Tab)
    ? (sp.tab as Tab)
    : "friends";
  // Preview mocks now gate on the explicit ?preview=1 query param instead
  // of a global env var · this stops fake cards competing with real
  // friends in normal browsing. Founder direction 2026-09-28.
  const showPreview = sp.preview === "1";

  // Load only the data for the active tab · keeps the page cheap.
  let friendCards: Array<{
    id: string;
    name: string;
    handle: string | null;
    href: string;
    avatarUrl: string | null;
    chatTheme: NexChatTheme | null;
    profession: string | null;
    location: string | null;
    hasShop: boolean;
    /** Heuristic derived from last peer-chat activity ·
     *  green (< 5 min) · yellow (< 30 min) · clear (older/none).
     *  Real presence Bridge will replace this without changing the UI. */
    presence: "green" | "yellow" | "clear";
    /** Numeric sort key · lower = higher rank (online first). */
    presenceRank: number;
  }> = [];
  /** Pending incoming friend requests · shown as a bucket ABOVE the
   *  Online / Busy / Offline sections. These are the only cards on the
   *  Friends tab that require an action (Accept / Decline). Founder
   *  direction 2026-09-28. */
  let pendingCards: Array<{
    id: string;
    name: string;
    handle: string | null;
    avatarUrl: string | null;
    chatTheme: NexChatTheme | null;
    profession: string | null;
    location: string | null;
  }> = [];
  let businessCards: Array<{
    conversationId: string;
    businessName: string;
    slug: string;
    /** Category label ("Bakery", "Restaurant") or first line of the
     *  business description · the "what they make or sell" caption
     *  shown under the business name. Null when nothing to display. */
    sells: string | null;
    /** Last-message body preview · the second line of the card. */
    subtitle: string;
    lastAt: string | null;
    /** Read state of my own last message on this thread:
     *  'sent'      · last message is mine, not yet read by them
     *  'read'      · last message is mine, they've opened after it
     *  'inbound'   · last message is from them (no receipt shown)
     *  null        · no messages yet */
    myReceiptState: "sent" | "read" | "inbound" | null;
  }> = [];

  if (activeTab === "friends") {
    const [ids, pendingRows] = await Promise.all([
      friendService.listFriends(session.account.id).catch(() => []),
      friendService.listPendingIncoming(session.account.id).catch(() => []),
    ]);
    // Hydrate pending senders · these are the accounts that requested us.
    // listPendingIncoming already filters to incoming-only rows.
    const pendingSenderIds = pendingRows.map((r) => r.requested_by);
    const pendingProfileSvc = await import(
      "@/lib/nex-native/account-profile-service"
    );
    const pendingHydrated = await Promise.all(
      pendingSenderIds.map(async (id) => {
        const [account, profile] = await Promise.all([
          accountService.getAccountById(id),
          pendingProfileSvc.getProfileByAccountId(id).catch(() => null),
        ]);
        if (!account) return null;
        return { account, profile };
      }),
    );
    pendingCards = pendingHydrated
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map(({ account: r, profile }) => ({
        id: r.id,
        name: r.display_name,
        handle: r.nex_handle,
        avatarUrl: profile?.avatar_url ?? null,
        chatTheme: r.chat_theme,
        profession: professionCaption(profile?.profession ?? null),
        location: profile?.location_label ?? null,
      }));

    const rows = await Promise.all(ids.map((id) => accountService.getAccountById(id)));
    // Enrich with profile.avatar_url so real friend cards can show real images.
    const profiles = await Promise.all(
      rows
        .filter((r): r is NonNullable<typeof r> => !!r)
        .map(async (r) => ({
          account: r,
          profile: await (async () => {
            try {
              return await (
                await import("@/lib/nex-native/account-profile-service")
              ).getProfileByAccountId(r.id);
            } catch {
              return null;
            }
          })(),
        })),
    );
    // Presence heuristic · derive from Bridge 3 last_message_at on the
    // peer conversation between the viewer and each friend. Cheap enough
    // for a friend list (5-50 rows); if it becomes hot, batch to one
    // query. When the real presence Bridge lands, swap this loop for a
    // single service call and the sort order stays the same.
    const peerSvc = await import(
      "@/lib/nex-native/peer-conversation-service"
    );
    const withPresence = await Promise.all(
      profiles.map(async ({ account: r, profile }) => {
        const conv = await peerSvc
          .findPeerConversation(session.account.id, r.id)
          .catch(() => null);
        const lastAt = conv?.last_message_at
          ? new Date(conv.last_message_at).getTime()
          : null;
        const ageMinutes =
          lastAt != null ? (Date.now() - lastAt) / 60_000 : Number.POSITIVE_INFINITY;
        let presence: "green" | "yellow" | "clear";
        let presenceRank: number;
        if (ageMinutes < 5) {
          presence = "green";
          presenceRank = 0;
        } else if (ageMinutes < 30) {
          presence = "yellow";
          presenceRank = 1;
        } else {
          presence = "clear";
          presenceRank = 2;
        }
        return { account: r, profile, presence, presenceRank };
      }),
    );

    friendCards = withPresence
      .map(({ account: r, profile, presence, presenceRank }) => {
        const kind = profile?.kind ?? null;
        const hasShop =
          kind === "business_owner" ||
          kind === "reseller" ||
          kind === "seller" ||
          kind === "maker" ||
          kind === "affiliate";
        return {
          id: r.id,
          name: r.display_name,
          handle: r.nex_handle,
          href: `/nex-native/chat/peer/${r.id}`,
          avatarUrl: profile?.avatar_url ?? null,
          chatTheme: r.chat_theme,
          // Show WHAT they sell (or do), not their role label ·
          // "Reseller · vintage cameras" becomes "vintage cameras",
          // "Photographer" stays "Photographer" (no separator). The
          // caption still truncates with ellipsis on the card if needed.
          profession: professionCaption(profile?.profession ?? null),
          location: profile?.location_label ?? null,
          hasShop,
          presence,
          presenceRank,
        };
      })
      // Online first · then busy · then offline. Within the same tier,
      // preserve original friend-service order (which is created-at asc).
      .sort((a, b) => a.presenceRank - b.presenceRank);
  } else if (activeTab === "business") {
    const summaries = await conversationService
      .listConversationsForAccount(session.account.id)
      .catch(() => []);
    // Only conversations where the caller is on the customer side · dedupe
    // by business so a customer with multiple product-scoped threads for the
    // same business sees ONE card (the most recent thread wins).
    const perBusiness = new Map<string, (typeof summaries)[number]>();
    for (const s of summaries) {
      if (s.my_side !== "customer") continue;
      const existing = perBusiness.get(s.business.id);
      const stamp = s.last_message?.created_at ?? s.conversation.created_at;
      if (!existing) {
        perBusiness.set(s.business.id, s);
        continue;
      }
      const existingStamp =
        existing.last_message?.created_at ?? existing.conversation.created_at;
      if (stamp > existingStamp) perBusiness.set(s.business.id, s);
    }
    // Hydrate the full business rows in one shot so we can filter to
    // verified real businesses only (Founder doctrine 2026-09-28) and
    // pull the category label for the "what they make or sell" caption.
    const businessIds = Array.from(perBusiness.keys());
    const businessSvc = await import("@/lib/nex-native/business-service");
    const businessRows = await businessSvc
      .listBusinessesByIds(businessIds)
      .catch(() => [] as NexBusinessRow[]);
    const verifiedById = new Map<string, NexBusinessRow>();
    for (const b of businessRows) {
      if (b.verified_at) verifiedById.set(b.id, b);
    }

    businessCards = Array.from(perBusiness.values())
      // Drop conversations whose linked business isn't verified · they
      // still live in the DB and buyers can still open them via product /
      // menu / direct link, but this "trusted directory" tab hides them.
      .filter((s) => verifiedById.has(s.business.id))
      .map((s) => {
        let myReceiptState: "sent" | "read" | "inbound" | null = null;
        if (s.last_message) {
          if (s.last_message.sender_account_id === session.account.id) {
            const readTs = s.other_last_read_at;
            myReceiptState =
              readTs && readTs >= s.last_message.created_at ? "read" : "sent";
          } else {
            myReceiptState = "inbound";
          }
        }
        const full = verifiedById.get(s.business.id)!;
        return {
          conversationId: s.conversation.id,
          businessName: s.business.display_name,
          slug: s.business.slug,
          sells: businessSellsCaption(full),
          subtitle: s.last_message
            ? s.last_message.body.slice(0, 90)
            : "No messages yet",
          lastAt: s.last_message?.created_at ?? null,
          myReceiptState,
        };
      });
    businessCards.sort((a, b) => {
      const at = a.lastAt ?? "";
      const bt = b.lastAt ?? "";
      return at > bt ? -1 : at < bt ? 1 : 0;
    });
  }

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        [data-nex-chat-root] * { box-sizing: border-box; }
        [data-nex-chat-card]:hover {
          border-color: ${NEX.cyan};
          box-shadow: 0 0 24px rgba(0, 175, 255, 0.15);
        }
      `}</style>
      <main
        data-nex-chat-root
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          // Trimmed horizontal padding so friend cards get more room
          // on narrow viewports · 375px viewport now has 351px inner
          // container (was 335px).
          padding: "16px 12px 32px",
          position: "relative",
          // overflow-x hidden clips any incidental horizontal overflow
          // (radial background, decorative shadows) without breaking
          // vertical page scroll when the friend list is long.
          overflowX: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(60% 40% at 50% 0%, rgba(0,175,255,0.09), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
          {/* Shared header · magnifier (search) · NEX wordmark (home) · gear (settings) */}
          <NexPageHeader dataScope="chat" />

          {/* Toggle bar · Friends · Business · Groups */}
          <nav
            aria-label="Chat categories"
            data-nex-chat-toggle
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              borderBottom: `1px solid ${NEX.cyanFaint}`,
            }}
          >
            {TABS.map((t) => {
              const isActive = t === activeTab;
              return (
                <Link
                  key={t}
                  href={`/nex-native/chat?tab=${t}`}
                  data-nex-chat-tab={t}
                  data-nex-chat-tab-active={isActive ? "true" : "false"}
                  style={{
                    position: "relative",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "14px 8px 12px",
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: isActive ? NEX.textPrimary : NEX.textSecondary,
                    textDecoration: "none",
                  }}
                >
                  {TAB_LABEL[t]}
                  {isActive && (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        bottom: -1,
                        left: "20%",
                        right: "20%",
                        height: 3,
                        background: NEX.cyan,
                        borderRadius: "3px 3px 0 0",
                        boxShadow: `0 0 12px ${NEX.cyan}`,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Panel · landscape cards for the active tab */}
          <section style={{ marginTop: 22 }}>
            {activeTab === "friends" && (
              <FriendsPanel
                pendingCards={pendingCards}
                friendCards={friendCards}
                showPreview={showPreview}
              />
            )}

            {activeTab === "business" && (
              <div style={{ display: "grid", gap: 12 }}>
                {businessCards.map((c) => (
                  <BusinessCard
                    key={c.conversationId}
                    href={`/nex-native/conversations/${c.conversationId}`}
                    name={c.businessName}
                    slug={c.slug}
                    sells={c.sells}
                    subtitle={c.subtitle}
                    lastAt={c.lastAt}
                    receiptState={c.myReceiptState}
                  />
                ))}
                {showPreview &&
                  MOCK_BUSINESSES.map((c, i) => (
                    <BusinessCard
                      key={`mock-${i}`}
                      // Preview business cards route to the Story Reel
                      // prototype · the current interactive shop-swipe
                      // surface · until real seeded businesses land.
                      href={MOCK_SHOP_HREF}
                      name={c.name}
                      slug={c.slug}
                      sells={c.sells}
                      subtitle={c.subtitle}
                      lastAt={new Date(Date.now() - c.hoursAgo * 3600_000).toISOString()}
                      unread={c.unread}
                      receiptState={c.receiptState}
                      preview
                    />
                  ))}
                {businessCards.length === 0 && !showPreview && (
                  <EmptyState
                    icon="🛍"
                    title="No verified businesses yet"
                    body="This tab only shows NEX-verified businesses · shops we've confirmed as real trading entities. Chat with any shop lives on the shop's landing page until they're verified."
                    ctaHref="/nex-native/search"
                    ctaLabel="Find a business"
                  />
                )}
              </div>
            )}

            {activeTab === "groups" && (
              <div style={{ display: "grid", gap: 12 }}>
                {showPreview &&
                  MOCK_GROUPS.map((c, i) => (
                    <GroupCard
                      key={`mock-${i}`}
                      name={c.name}
                      subtitle={c.subtitle}
                      members={c.members}
                      unread={c.unread}
                      preview
                    />
                  ))}
                {!showPreview && (
                  <EmptyState
                    icon="👨‍👩‍👧"
                    title="Groups coming soon"
                    body="Group chats are on the NEX roadmap. Until then, keep the conversations one-to-one."
                  />
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

type CardPresence = "green" | "yellow" | "clear";

function PersonCard(props: {
  href: string | null;
  name: string;
  subtitle: string;
  preview?: boolean;
  /** Real avatar URL from nex_account_profile.avatar_url · null falls
   *  back to initials. */
  avatarUrl?: string | null;
  /** Presence · drives the fingerprint chip ring colour. "clear" (or
   *  omitted) renders a neutral fingerprint. Sealed 2026-09-27:
   *  presence lives on the ACTION target (fingerprint), not the avatar. */
  presence?: CardPresence;
  /** Unread count · when > 0 the fingerprint chip renders the number
   *  instead of the icon. Zero hides / falls back to the icon. */
  unread?: number;
  /** Preview-only · "🛍 Shop" tag under the name when the person owns a shop. */
  hasShop?: boolean;
  /** Read-receipt state for my outbound last message · shown before the
   *  subtitle text · null hides. */
  receiptState?: "sent" | "read" | "inbound" | null;
  /** Preview-only · replaces subtitle with an animated "typing…" bubble. */
  typing?: boolean;
  /** Profession / role / study focus · shown as a small subdued caption
   *  under the last-message line so the viewer knows what this person
   *  does at a glance. Kept small so the card height doesn't grow.
   *  From `nex_account_profile.profession` when we wire real friends. */
  profession?: string | null;
  /** Chat theme drives the 3px accent stripe colour on the left edge
   *  of the card · this is the brand-identity moment · every friend
   *  wears their own colour. Null / missing → NEX cyan. */
  chatTheme?: NexChatTheme | string | null;
}) {
  const avatarRing = presenceRingColour(props.presence);
  const isPresenceActive =
    props.presence === "green" || props.presence === "yellow";
  const avatarHalo = isPresenceActive
    ? `0 0 0 3px ${avatarRing}22, 0 2px 8px rgba(0,0,0,0.35)`
    : "0 2px 8px rgba(0,0,0,0.35)";
  // Avatar sits INSIDE the card at a fixed 52px · previous half-outside
  // design forced 38+28px of reserved horizontal margin per card which
  // squeezed the content and blew past narrow viewports. Sealed
  // 2026-09-27: friend list cards fill the container width, Portrait
  // Bloom lives on the individual chat surfaces.
  const AVATAR_SIZE = 52;
  const cardBody = (
    <>
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          position: "relative",
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: "50%",
          border: `2px solid ${avatarRing}`,
          boxShadow: avatarHalo,
          background: NEX.panel,
          overflow: "visible",
        }}
      >
        {props.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={props.avatarUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: NEX.cyanFaint,
              color: NEX.cyan,
              display: "grid",
              placeItems: "center",
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}
          >
            {initialsFromName(props.name)}
          </div>
        )}
        {props.hasShop && <ShopBadge />}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            // Locked to a single row · name truncates with ellipsis if
            // the chip pushes it beyond available width. Wrapping would
            // grow the card and break the uniform row height.
            flexWrap: "nowrap",
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
              flexShrink: 1,
            }}
          >
            {props.name}
          </span>
        </div>
        {props.typing ? (
          <TypingBubble />
        ) : (
          <div
            style={{
              marginTop: 2,
              fontSize: 12,
              color: NEX.textSecondary,
              lineHeight: 1.3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {(props.receiptState === "sent" || props.receiptState === "read") && (
              <ReadReceipt state={props.receiptState} />
            )}
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {props.subtitle}
            </span>
          </div>
        )}
        {props.profession && (
          <div
            style={{
              marginTop: 2,
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: NEX.cyan,
              opacity: 0.75,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <ProfessionIcon />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {props.profession}
            </span>
          </div>
        )}
      </div>
      <FingerprintChip
        presence={props.presence}
        unread={props.unread}
      />
    </>
  );
  const style: React.CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 10,
    // Card fills the container width · avatar and chip both live INSIDE
    // the border now, so no reserved left/right margin is needed.
    padding: "12px 12px",
    background: NEX.panel,
    border: `1px solid ${props.preview ? "rgba(0,175,255,0.18)" : NEX.cyanSoft}`,
    borderRadius: 14,
    textDecoration: "none",
    color: NEX.textPrimary,
    minHeight: 76,
    transition: "border-color 200ms ease, box-shadow 200ms ease",
    opacity: props.preview ? 0.75 : 1,
    overflow: "hidden",
  };
  // AccentStripe (chat-theme colour on left edge) is dropped from
  // PersonCard while the avatar sits on the left edge · the stripe
  // would collide with the avatar visually. BusinessCard and GroupCard
  // still render their stripes (their left edges are free).
  const stripe: React.ReactNode = null;
  if (!props.href) {
    return (
      <div
        data-nex-chat-card
        data-nex-chat-card-kind="person"
        data-nex-chat-card-preview={props.preview ? "true" : undefined}
        style={style}
      >
        {stripe}
        {cardBody}
      </div>
    );
  }
  return (
    <Link
      href={props.href}
      data-nex-chat-card
      data-nex-chat-card-kind="person"
      style={style}
    >
      {stripe}
      {cardBody}
    </Link>
  );
}

function BusinessCard(props: {
  href: string | null;
  name: string;
  slug: string;
  /** What this business makes or sells · shown as a small caption row
   *  under the name. Comes from business_category or description in
   *  the real data path · null hides the row. Bridge 30. */
  sells?: string | null;
  subtitle: string;
  lastAt: string | null;
  preview?: boolean;
  /** Preview-only · unread count pill on the avatar top-right. Zero hides it. */
  unread?: number;
  /** Read-receipt state for my outbound last message. */
  receiptState?: "sent" | "read" | "inbound" | null;
}) {
  const timeLabel = props.lastAt
    ? new Date(props.lastAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  // Timestamp moved from top-right to bottom-right in Bridge 30 so the
  // top row can host name + "verified" mark + "sells" caption without
  // colliding with the date. The date reads naturally next to the last
  // message preview and no longer squeezes the name column.
  const cardBody = (
    <>
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          position: "relative",
          width: 48,
          height: 48,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: NEX.cyanFaint,
            color: NEX.cyan,
            display: "grid",
            placeItems: "center",
            fontSize: 22,
            lineHeight: 1,
          }}
        >
          🛍
        </div>
        {typeof props.unread === "number" && props.unread > 0 && (
          <UnreadPill count={props.unread} />
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
              flexShrink: 1,
            }}
          >
            {props.name}
          </span>
          <VerifiedTick />
        </div>
        {props.sells && (
          <div
            style={{
              marginTop: 2,
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: NEX.cyan,
              opacity: 0.75,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {props.sells}
          </div>
        )}
        <div
          style={{
            marginTop: 4,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 8,
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: NEX.textSecondary,
              lineHeight: 1.4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "flex",
              alignItems: "center",
              gap: 6,
              minWidth: 0,
              flex: 1,
            }}
          >
            {(props.receiptState === "sent" || props.receiptState === "read") && (
              <ReadReceipt state={props.receiptState} />
            )}
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {props.subtitle}
            </span>
          </div>
          {timeLabel && (
            <div
              style={{
                flexShrink: 0,
                fontSize: 10,
                color: NEX.textSecondary,
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
              }}
            >
              {timeLabel}
            </div>
          )}
        </div>
      </div>
    </>
  );
  const style: React.CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px 14px 20px",
    background: NEX.panel,
    border: `1px solid ${props.preview ? "rgba(0,175,255,0.18)" : NEX.cyanSoft}`,
    borderRadius: 12,
    textDecoration: "none",
    color: NEX.textPrimary,
    minHeight: 76,
    transition: "border-color 200ms ease, box-shadow 200ms ease",
    opacity: props.preview ? 0.75 : 1,
    overflow: "hidden",
  };
  const stripe = <AccentStripe color={accentForTheme("default")} />;
  if (!props.href) {
    return (
      <div
        data-nex-chat-card
        data-nex-chat-card-kind="business"
        data-nex-chat-card-preview={props.preview ? "true" : undefined}
        style={style}
      >
        {stripe}
        {cardBody}
      </div>
    );
  }
  return (
    <Link
      href={props.href}
      data-nex-chat-card
      data-nex-chat-card-kind="business"
      style={style}
    >
      {stripe}
      {cardBody}
    </Link>
  );
}

function GroupCard(props: {
  name: string;
  subtitle: string;
  members: number;
  preview?: boolean;
  /** Preview-only · unread count pill on the avatar top-right. */
  unread?: number;
}) {
  return (
    <div
      data-nex-chat-card
      data-nex-chat-card-kind="group"
      data-nex-chat-card-preview={props.preview ? "true" : undefined}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px 14px 20px",
        background: NEX.panel,
        border: `1px solid ${props.preview ? "rgba(0,175,255,0.18)" : NEX.cyanSoft}`,
        borderRadius: 12,
        color: NEX.textPrimary,
        minHeight: 76,
        opacity: props.preview ? 0.75 : 1,
        overflow: "hidden",
      }}
    >
      <AccentStripe color={accentForTheme("default")} />
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          position: "relative",
          width: 48,
          height: 48,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: NEX.cyanFaint,
            color: NEX.cyan,
            display: "grid",
            placeItems: "center",
            fontSize: 22,
            lineHeight: 1,
          }}
        >
          👥
        </div>
        {typeof props.unread === "number" && props.unread > 0 && (
          <UnreadPill count={props.unread} />
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {props.name}
          </span>
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            color: NEX.textSecondary,
            lineHeight: 1.4,
          }}
        >
          <span style={{ color: NEX.cyan }}>{props.members} members</span>
          {" · "}
          {props.subtitle}
        </div>
      </div>
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          color: NEX.textSecondary,
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        →
      </div>
    </div>
  );
}

/** Hybrid action chip · when the friend has unread messages, the chip
 *  displays the count as a large number (way more scannable than a
 *  tiny badge on the avatar). When unread is zero, the chip falls back
 *  to the fingerprint icon — the "tap to chat" affordance for quiet
 *  cards.
 *
 *  56px container that sits HALF OUTSIDE the card's right edge via
 *  negative margin — reads as a distinct action target while staying
 *  visually attached to the card. Ring colour carries presence:
 *  green (online) · yellow (busy) · gray (offline / unknown).
 *
 *  Sealed 2026-09-27: presence lives on the action target. Uniquely NEX
 *  affordance — one signal for "who is around" + "how many are waiting"
 *  + "tap to talk to them". */
function FingerprintChip(props: {
  presence?: CardPresence;
  unread?: number;
}) {
  const isOffline = !props.presence || props.presence === "clear";
  // Presence colour always reflects real state · preview cards still get
  // the full colour so mocks demonstrate the design. Preview visual
  // distinguisher lives on the card border + opacity, not on presence.
  const ring = presenceRingColour(props.presence);
  const bg = presenceFillColour(props.presence);
  const stroke = presenceStrokeColour(props.presence);
  const hasUnread = typeof props.unread === "number" && props.unread > 0;
  const unreadLabel = hasUnread
    ? (props.unread as number) > 99
      ? "99+"
      : String(props.unread)
    : "";
  const CHIP_SIZE = 48;
  return (
    <div
      aria-hidden
      title={presenceTitle(props.presence)}
      style={{
        flexShrink: 0,
        width: CHIP_SIZE,
        height: CHIP_SIZE,
        borderRadius: "50%",
        background: NEX.panel,
        border: `2px solid ${ring}`,
        color: stroke,
        boxShadow: !isOffline
          ? `0 0 0 3px ${ring}22, 0 2px 8px rgba(0,0,0,0.35)`
          : "0 2px 8px rgba(0,0,0,0.35)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Coloured tint layer · sits on top of the panel background so
          the presence hue reads without letting the card border show
          through the chip. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: bg,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
        }}
      >
        {hasUnread ? (
          <span
            style={{
              // Bold count · scannable at a glance at 48px chip.
              fontSize: unreadLabel.length >= 3 ? 13 : 18,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: NEX.orange,
              lineHeight: 1,
            }}
          >
            {unreadLabel}
          </span>
        ) : (
          <FingerprintIcon size={26} />
        )}
      </div>
    </div>
  );
}

const PRESENCE_GREEN = "#10b981";
const PRESENCE_YELLOW = "#f59e0b";
const PRESENCE_GRAY = "rgba(125,155,192,0.55)";

function presenceRingColour(p: CardPresence | undefined): string {
  switch (p) {
    case "green":
      return PRESENCE_GREEN;
    case "yellow":
      return PRESENCE_YELLOW;
    default:
      return PRESENCE_GRAY;
  }
}

function presenceFillColour(p: CardPresence | undefined): string {
  switch (p) {
    case "green":
      return "rgba(16,185,129,0.12)";
    case "yellow":
      return "rgba(245,158,11,0.12)";
    default:
      return "rgba(125,155,192,0.08)";
  }
}

function presenceStrokeColour(p: CardPresence | undefined): string {
  switch (p) {
    case "green":
      return PRESENCE_GREEN;
    case "yellow":
      return PRESENCE_YELLOW;
    default:
      return NEX.textSecondary;
  }
}

function presenceTitle(p: CardPresence | undefined): string {
  switch (p) {
    case "green":
      return "Online · tap to chat";
    case "yellow":
      return "Busy · tap to chat";
    default:
      return "Offline · tap to chat";
  }
}

/** Fingerprint icon · the tap-to-open-chat affordance on friend cards.
 *  Replaces the generic arrow with a signal of *personal identity* — the
 *  friend is on the other end. Uniquely NEX among chat apps · Founder
 *  brief 2026-09-27. Sized to match the arrow (18px) so cards stay
 *  balanced. */
/** Small briefcase icon rendered before the profession text · inherits
 *  currentColor so it matches the caption's cyan tint automatically. */
function ProfessionIcon({ size = 11 }: { size?: number } = {}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  );
}

function FingerprintIcon({ size = 20 }: { size?: number } = {}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 11c0 4-2 6-2 6" />
      <path d="M8 15c1-1 1.5-2 1.5-4a2.5 2.5 0 0 1 5 0v1a5 5 0 0 1-.5 2" />
      <path d="M5 13a7 7 0 0 1 14 0v1" />
      <path d="M3 11a9 9 0 0 1 18 0" />
      <path d="M14 20c.5-1 1-2 1-4" />
      <path d="M17 20c.5-1.5.8-3 .8-5" />
    </svg>
  );
}

/** Unread count overlaid on the avatar's top-right corner. Small orange
 *  pill · reads as a number when ≤99, "99+" otherwise. Never renders
 *  when count is zero (the caller filters that). */
function UnreadPill({ count }: { count: number }) {
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      aria-label={`${count} unread`}
      style={{
        position: "absolute",
        top: -4,
        right: -4,
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        borderRadius: 9,
        background: NEX.orange,
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 700,
        border: `2px solid ${NEX.panel}`,
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}

/** Read-receipt inline mark before an outbound message subtitle.
 *  ✓ single tick = sent · ✓✓ cyan double tick = read by the other party.
 *  Same visual language iMessage / WhatsApp / Signal share · NEX uses
 *  cyan instead of blue for the "read" state to match the palette. */
function ReadReceipt({ state }: { state: "sent" | "read" }) {
  const color = state === "read" ? NEX.cyan : NEX.textSecondary;
  const label = state === "read" ? "Read" : "Sent";
  return (
    <span
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
        color,
        lineHeight: 1,
      }}
    >
      {state === "read" ? (
        <svg width="14" height="10" viewBox="0 0 24 16" fill="none" aria-hidden>
          <path
            d="M1 8 L6 13 L14 3"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 8 L14 13 L23 3"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M1 8 L6 13 L15 3"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

/** Animated "typing…" bubble that replaces the subtitle when the other
 *  party is actively composing. Real-time typing is deferred until we
 *  have a Realtime channel wired · this component preview-visualises the
 *  intended shape for design consistency. Three cyan dots pulse with a
 *  staggered animation. */
function TypingBubble() {
  return (
    <>
      <style>{`
        @keyframes nex-typing-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30%           { opacity: 1;   transform: translateY(-2px); }
        }
      `}</style>
      <div
        role="status"
        aria-label="typing"
        style={{
          marginTop: 4,
          marginBottom: 4,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "3px 10px",
          borderRadius: 999,
          background: "rgba(0,175,255,0.10)",
          color: NEX.cyan,
          fontSize: 11,
          fontStyle: "italic",
          letterSpacing: "0.02em",
        }}
      >
        <span>typing</span>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: NEX.cyan,
              animation: `nex-typing-dot 1.4s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>
    </>
  );
}

/** 3px vertical stripe on the left inside edge of a card · coloured by
 *  the person's chat_theme. Zero interaction cost · pure identity signal
 *  · you learn to recognise cards by their stripe over time (Superhuman,
 *  Basecamp both use this pattern). Absolute-positioned so it never
 *  affects card layout · overflow-hidden on the parent trims the top and
 *  bottom into the rounded corners. */
/** Small cyan verified tick · rendered next to the name on Business-tab
 *  cards. Every card in that tab is verified (Founder doctrine 2026-09-28)
 *  so the tick is unconditional here. Also used sparingly elsewhere when
 *  we need to signal "this business has been checked by NEX". */
function VerifiedTick({ size = 14 }: { size?: number } = {}) {
  return (
    <span
      aria-label="Verified business"
      title="Verified by NEX"
      style={{
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: NEX.cyan,
        color: "#0B0F1A",
        lineHeight: 1,
      }}
    >
      <svg
        width={size * 0.68}
        height={size * 0.68}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M5 12 L10 17 L20 6" />
      </svg>
    </span>
  );
}

function AccentStripe({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        background: color,
        // Matches the card's borderRadius on the left corners · needed
        // because the card now uses overflow: visible (to let the
        // fingerprint chip spill out on the right).
        borderTopLeftRadius: 12,
        borderBottomLeftRadius: 12,
      }}
    />
  );
}

/** "🛍 Shop" pill · rendered under the name when the person owns a shop.
 *  Preview surface for the future world-class card design · real friend
 *  cards will read `nex_business.owner_account_id` when it's built. */
function ShopTag() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.06em",
        color: NEX.orange,
        border: `1px solid rgba(255, 114, 0, 0.4)`,
        borderRadius: 4,
        lineHeight: 1.3,
      }}
    >
      <span aria-hidden>🛍</span>
      Shop
    </span>
  );
}

/** Floating shop badge · sits on the avatar's bottom-right corner like
 *  a sticker · signals "this person also has a NEX Shop" without
 *  adding vertical space to the card. Absolute-positioned so it never
 *  grows the card · uniform row height regardless of hasShop.
 *
 *  Founder-supplied glossy 3D orange storefront button · sealed
 *  2026-09-28. Replaces the earlier flat-orange SVG dot. Rendered at
 *  22px so it lifts off the panel without dominating the 52px avatar. */
function ShopBadge() {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/nex-native/friends/shop-badge.png"
      alt=""
      aria-label="Has a NEX Shop"
      title="NEX Shop owner"
      width={22}
      height={22}
      draggable={false}
      style={{
        position: "absolute",
        bottom: -3,
        right: -3,
        width: 22,
        height: 22,
        // Drop-shadow matches the earlier badge lift so the image
        // still reads as a distinct sticker over the avatar.
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.55))",
        pointerEvents: "none",
      }}
    />
  );
}

function EmptyState(props: {
  icon: string;
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div
      data-nex-chat-empty
      style={{
        padding: "24px 20px",
        border: `1px dashed ${NEX.cyanSoft}`,
        borderRadius: 12,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 36, lineHeight: 1, marginBottom: 10 }} aria-hidden>
        {props.icon}
      </div>
      <h2
        style={{
          margin: 0,
          fontSize: 15,
          fontWeight: 500,
          color: NEX.textPrimary,
        }}
      >
        {props.title}
      </h2>
      <p
        style={{
          marginTop: 6,
          fontSize: 12,
          color: NEX.textSecondary,
          lineHeight: 1.5,
        }}
      >
        {props.body}
      </p>
      {props.ctaHref && props.ctaLabel && (
        <Link
          href={props.ctaHref}
          style={{
            marginTop: 14,
            display: "inline-flex",
            padding: "8px 14px",
            color: NEX.cyan,
            border: `1px solid ${NEX.cyanSoft}`,
            borderRadius: 6,
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          {props.ctaLabel}
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Bridge 29 · FriendsPanel + sub-components (sealed 2026-09-28)
// ---------------------------------------------------------------------
// The Friends tab is a stack of headed sections rather than a flat list:
//
//   ┌─ 📨 Waiting for you · N       (pending incoming friend requests)
//   ├─ ● Online · N                  (green presence)
//   ├─ ● Busy · N                    (yellow presence)
//   └─ ○ Offline · N                 (gray presence)
//
// Empty sections drop out entirely. The Pending bucket sits at the top
// because it's the only place on this tab that requires a decision.
// Founder direction 2026-09-28.

type PendingCard = {
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  chatTheme: NexChatTheme | null;
  profession: string | null;
  location: string | null;
};

type FriendCard = {
  id: string;
  name: string;
  handle: string | null;
  href: string;
  avatarUrl: string | null;
  chatTheme: NexChatTheme | null;
  profession: string | null;
  location: string | null;
  hasShop: boolean;
  presence: "green" | "yellow" | "clear";
  presenceRank: number;
};

type MockFriend = (typeof MOCK_FRIENDS)[number];

function FriendsPanel(props: {
  pendingCards: PendingCard[];
  friendCards: FriendCard[];
  showPreview: boolean;
}) {
  const online = props.friendCards.filter((c) => c.presence === "green");
  const busy = props.friendCards.filter((c) => c.presence === "yellow");
  const offline = props.friendCards.filter((c) => c.presence === "clear");

  const previewOnline = props.showPreview
    ? MOCK_FRIENDS.filter((m) => m.presence === "green")
    : [];
  const previewBusy = props.showPreview
    ? MOCK_FRIENDS.filter((m) => m.presence === "yellow")
    : [];
  const previewOffline = props.showPreview
    ? MOCK_FRIENDS.filter((m) => m.presence === "clear")
    : [];

  const pendingCount =
    props.pendingCards.length + (props.showPreview ? MOCK_PENDING.length : 0);
  const onlineCount = online.length + previewOnline.length;
  const busyCount = busy.length + previewBusy.length;
  const offlineCount = offline.length + previewOffline.length;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* NEX support · pinned to the top of the Friends tab · always
          visible so users don't need to remember the URL. Bridge 32a. */}
      <div>
        <SectionHeader
          icon="🤝"
          label="NEX support"
          count={1}
          accent={NEX.cyan}
        />
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <NexOfficialCard />
        </div>
      </div>
      {props.pendingCards.length + props.friendCards.length === 0 && !props.showPreview && (
        <EmptyState
          icon="👥"
          title="No friends yet"
          body="Send an invite from your friends surface · or someone can add you first."
          ctaHref="/nex-native/friends"
          ctaLabel="Manage friends"
        />
      )}
      {pendingCount > 0 && (
        <div>
          <SectionHeader
            icon="📨"
            label="Waiting for you"
            count={pendingCount}
            accent={NEX.orange}
          />
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {props.pendingCards.map((c) => (
              <PendingRequestCard key={c.id} card={c} />
            ))}
            {props.showPreview &&
              MOCK_PENDING.map((c) => (
                <PendingRequestCard key={c.id} card={c} preview />
              ))}
          </div>
        </div>
      )}
      {onlineCount > 0 && (
        <FriendSection
          label="Online"
          count={onlineCount}
          dotColor={PRESENCE_GREEN}
          real={online}
          preview={previewOnline}
        />
      )}
      {busyCount > 0 && (
        <FriendSection
          label="Busy"
          count={busyCount}
          dotColor={PRESENCE_YELLOW}
          real={busy}
          preview={previewBusy}
        />
      )}
      {offlineCount > 0 && (
        <FriendSection
          label="Offline"
          count={offlineCount}
          dotColor={PRESENCE_GRAY}
          real={offline}
          preview={previewOffline}
        />
      )}
    </div>
  );
}

function FriendSection(props: {
  label: string;
  count: number;
  dotColor: string;
  real: FriendCard[];
  preview: MockFriend[];
}) {
  return (
    <div>
      <SectionHeader dotColor={props.dotColor} label={props.label} count={props.count} />
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {props.real.map((c) => (
          <PersonCard
            key={c.id}
            href={c.href}
            name={c.name}
            subtitle={c.location ?? c.handle ?? `${c.id.slice(0, 8)}…`}
            profession={c.profession}
            presence={c.presence}
            hasShop={c.hasShop}
            avatarUrl={c.avatarUrl}
            chatTheme={c.chatTheme}
          />
        ))}
        {props.preview.map((c, i) => (
          <PersonCard
            key={`preview-${props.label}-${i}`}
            // Bridge 55 · Phase 1 launch · commerce hidden ·
            // shop-routing + shop badge on mock preview cards
            // suppressed. Commerce-on returns to the routed
            // Story-Reel / Direct-Price previews.
            href={
              NEX_COMMERCE_ENABLED && c.shopKind
                ? MOCK_SHOP_HREF[c.shopKind]
                : null
            }
            name={c.name}
            subtitle={c.lastMessage ?? `${c.location}`}
            profession={professionCaption(c.profession)}
            presence={c.presence}
            unread={c.unread}
            hasShop={NEX_COMMERCE_ENABLED && c.hasShop}
            avatarUrl={c.avatarUrl}
            receiptState={c.receiptState}
            typing={c.typing}
            chatTheme={c.chatTheme}
            preview
          />
        ))}
      </div>
    </div>
  );
}

function SectionHeader(props: {
  label: string;
  count: number;
  icon?: string;
  dotColor?: string;
  accent?: string;
}) {
  const accentColor = props.accent ?? NEX.textSecondary;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 4px 6px",
        borderBottom: `1px solid ${NEX.cyanFaint}`,
      }}
    >
      {props.dotColor && (
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: props.dotColor,
            boxShadow: `0 0 0 3px ${props.dotColor}22`,
            flexShrink: 0,
          }}
        />
      )}
      {props.icon && (
        <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
          {props.icon}
        </span>
      )}
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          fontWeight: 600,
          color: accentColor,
        }}
      >
        {props.label}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: NEX.textSecondary,
          opacity: 0.7,
        }}
      >
        · {props.count}
      </span>
    </div>
  );
}

/** Pinned NEX support card · always visible at the top of the Friends
 *  tab. Wraps the seeded NEX1 account (nex-official.ts constants) with
 *  a cyan-forward treatment + verified tick so it reads as the one
 *  official support surface. Sealed 2026-09-28 · Bridge 32a. */
function NexOfficialCard() {
  return (
    <Link
      href={NEX_OFFICIAL_CHAT_HREF}
      data-nex-chat-card
      data-nex-chat-card-kind="nex-official"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 12px",
        background: NEX.panel,
        border: `1px solid ${NEX.cyan}`,
        borderRadius: 14,
        textDecoration: "none",
        color: NEX.textPrimary,
        minHeight: 76,
        transition: "border-color 200ms ease, box-shadow 200ms ease",
        overflow: "hidden",
        boxShadow: "0 0 0 1px rgba(0,175,255,0.10) inset, 0 0 20px rgba(0,175,255,0.10)",
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          position: "relative",
          width: 52,
          height: 52,
          borderRadius: "50%",
          // Ring is white per Founder direction 2026-09-28 · matches
          // the page header text colour so the card reads as neutral
          // NEX identity rather than "another cyan chip".
          border: `2px solid ${NEX.textPrimary}`,
          boxShadow: `0 0 0 3px rgba(242,245,248,0.15), 0 2px 8px rgba(0,0,0,0.35)`,
          background: NEX.cyanFaint,
          // "NEX" label inside the avatar uses the same white header
          // text colour, not the cyan accent.
          color: NEX.textPrimary,
          display: "grid",
          placeItems: "center",
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "0.05em",
        }}
      >
        NEX
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
              flexShrink: 1,
            }}
          >
            {NEX_OFFICIAL_DISPLAY_NAME}
          </span>
          <VerifiedTick size={14} />
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            color: NEX.textSecondary,
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          Ask about upgrades · features · account help
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: NEX.cyan,
            opacity: 0.75,
            lineHeight: 1.2,
          }}
        >
          {NEX_OFFICIAL_HANDLE}.nex · Official
        </div>
      </div>
    </Link>
  );
}

function PendingRequestCard(props: { card: PendingCard; preview?: boolean }) {
  const { card } = props;
  const avatarRing = "rgba(255,114,0,0.65)";
  const returnTo = "/nex-native/chat?tab=friends";
  return (
    <div
      data-nex-chat-card
      data-nex-chat-card-kind="pending"
      data-nex-chat-card-preview={props.preview ? "true" : undefined}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 12px",
        background: NEX.panel,
        border: `1px solid ${props.preview ? "rgba(255,114,0,0.18)" : "rgba(255,114,0,0.40)"}`,
        borderRadius: 14,
        color: NEX.textPrimary,
        minHeight: 76,
        opacity: props.preview ? 0.75 : 1,
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          position: "relative",
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: `2px solid ${avatarRing}`,
          boxShadow: "0 0 0 3px rgba(255,114,0,0.10), 0 2px 8px rgba(0,0,0,0.35)",
          background: NEX.panel,
          overflow: "visible",
        }}
      >
        {card.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={card.avatarUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: "rgba(255,114,0,0.12)",
              color: NEX.orange,
              display: "grid",
              placeItems: "center",
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}
          >
            {initialsFromName(card.name)}
          </div>
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 6,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
              flexShrink: 1,
            }}
          >
            {card.name}
          </span>
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 11,
            color: NEX.orange,
            lineHeight: 1.3,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          wants to be friends
        </div>
        {card.profession && (
          <div
            style={{
              marginTop: 2,
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: NEX.cyan,
              opacity: 0.75,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <ProfessionIcon />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {card.profession}
            </span>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
        <form action={acceptFriendInviteAction}>
          <input type="hidden" name="other_account_id" value={card.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <button
            type="submit"
            disabled={props.preview}
            aria-label={`Accept ${card.name}'s request`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 70,
              padding: "6px 12px",
              borderRadius: 999,
              border: "none",
              background: NEX.orange,
              color: "#0B0F1A",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: props.preview ? "default" : "pointer",
              opacity: props.preview ? 0.7 : 1,
            }}
          >
            Accept
          </button>
        </form>
        <form action={declineFriendInviteAction}>
          <input type="hidden" name="other_account_id" value={card.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <button
            type="submit"
            disabled={props.preview}
            aria-label={`Decline ${card.name}'s request`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 70,
              padding: "6px 12px",
              borderRadius: 999,
              background: "transparent",
              color: NEX.textSecondary,
              border: `1px solid ${NEX.cyanFaint}`,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: props.preview ? "default" : "pointer",
            }}
          >
            Decline
          </button>
        </form>
      </div>
    </div>
  );
}
