// Social graph — the follow relationships + notifications + feed posts
// that make Trade Center behave like Facebook / Instagram / LinkedIn.
//
// Every trade + merchant + customer eventually becomes a node in this
// graph. For the demo, Bob Watson (currentViewerTrade) is the viewer +
// centre point of the graph.
//
// LocalStorage-backed for the demo; production upgrades to Supabase
// with realtime subscription for feed + notification streams.

export type FollowerType = "trade" | "merchant" | "customer";

export type FollowRecord = {
  followerSlug: string;
  followedSlug: string;
  followedType: FollowerType;
  followedName: string;
  createdAtIso: string;
};

export const FOLLOWS_KEY = "tc.social.follows";
export const NOTIFICATIONS_KEY = "tc.social.notifications-seen";

// ─── Base counts fixture ─────────────────────────────────────────────
// Every profile has a base follower count so the demo looks real. Real
// system stores these server-side.

export const BASE_FOLLOWER_COUNTS: Record<string, number> = {
  "bob-plastering": 1247,
  "riverside-electrics": 682,
  "manchester-tools-direct": 4318,
  "leeds-builders-supplies": 1892,
  "glasgow-scaffolding-co": 3104,
  "brighton-tile-warehouse": 741
};

export const BASE_FOLLOWING_COUNTS: Record<string, number> = {
  "bob-plastering": 89,
  "riverside-electrics": 34
};

// ─── Feed posts fixture ─────────────────────────────────────────────
// Posts made by other users that show up in Bob's network feed. Real
// system aggregates from live post events across all followed accounts.

export type FeedPostAction = "product-new" | "canteen-post" | "yard-post" | "job-shared" | "rate-published" | "review-received";

export type FeedPost = {
  id: string;
  authorSlug: string;
  authorName: string;
  authorType: FollowerType;
  authorInitials: string;
  authorAreaLabel: string;         // "Trade Center" · "Canteen · Manchester Trades" · etc
  authorAreaColour: string;
  action: FeedPostAction;
  body: string;
  imageUrl?: string;
  linkHref?: string;               // deep-link to the source
  linkLabel?: string;              // "See product" · "Read post"
  createdAtIso: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
};

const iso = (mins: number) => new Date(Date.now() - mins * 60000).toISOString();

export const FEED_POST_FIXTURES: FeedPost[] = [
  {
    id: "f1",
    authorSlug: "manchester-tools-direct",
    authorName: "Manchester Tools Direct",
    authorType: "merchant",
    authorInitials: "MT",
    authorAreaLabel: "Trade Center",
    authorAreaColour: "#166534",
    action: "product-new",
    body:
      "Fresh delivery in — Marshalltown 16\" Pro Finishing Trowel now back in stock. Same-day dispatch before 2pm. Trade price live on the product page.",
    imageUrl:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2011,%202026,%2004_36_21%20AM.png",
    linkHref: "/tc/trade-center/product/marshalltown-finishing-trowel-14",
    linkLabel: "See product",
    createdAtIso: iso(38),
    likeCount: 47,
    commentCount: 6,
    shareCount: 3
  },
  {
    id: "f2",
    authorSlug: "riverside-electrics",
    authorName: "Sarah Kingsley",
    authorType: "trade",
    authorInitials: "SK",
    authorAreaLabel: "Yard · Announcement",
    authorAreaColour: "#DC2626",
    action: "yard-post",
    body:
      "Anyone in Leeds got a spare 100A consumer unit going? Emergency swap tomorrow morning — usual suppliers won't have stock until Friday.",
    createdAtIso: iso(112),
    likeCount: 12,
    commentCount: 8,
    shareCount: 1
  },
  {
    id: "f3",
    authorSlug: "leeds-builders-supplies",
    authorName: "Leeds Builders Supplies",
    authorType: "merchant",
    authorInitials: "LB",
    authorAreaLabel: "Counter · Cross-post",
    authorAreaColour: "#0A0A0A",
    action: "product-new",
    body:
      "British Gypsum bulk pallets in — 50 bags Multi-Finish £520 delivered next day within 40mi of LS10.",
    linkHref: "/tc/trade-center/merchant/leeds-builders-supplies",
    linkLabel: "View store",
    createdAtIso: iso(240),
    likeCount: 22,
    commentCount: 4,
    shareCount: 2
  },
  {
    id: "f4",
    authorSlug: "riverside-electrics",
    authorName: "Sarah Kingsley",
    authorType: "trade",
    authorInitials: "SK",
    authorAreaLabel: "Canteen · Manchester Trades",
    authorAreaColour: "#F59E0B",
    action: "canteen-post",
    body:
      "First time using Trade Center Guaranteed on a £2.6k rewire — funds held by Stripe, released same day I finished. No chasing, no factoring fees. Would recommend for any bigger job.",
    createdAtIso: iso(360),
    likeCount: 34,
    commentCount: 11,
    shareCount: 5
  },
  {
    id: "f5",
    authorSlug: "glasgow-scaffolding-co",
    authorName: "Glasgow Scaffolding Co",
    authorType: "merchant",
    authorInitials: "GS",
    authorAreaLabel: "Trade Center · Product",
    authorAreaColour: "#166534",
    action: "product-new",
    body:
      "Toe boards back in — 8ft × 9\" scaffold-grade. £8.50 each, bulk 20+ £7.20.",
    linkHref: "/tc/trade-center/merchant/glasgow-scaffolding-co",
    linkLabel: "See stock",
    createdAtIso: iso(720),
    likeCount: 19,
    commentCount: 3,
    shareCount: 0
  },
  {
    id: "f6",
    authorSlug: "manchester-tools-direct",
    authorName: "Manchester Tools Direct",
    authorType: "merchant",
    authorInitials: "MT",
    authorAreaLabel: "Trade Center",
    authorAreaColour: "#166534",
    action: "review-received",
    body:
      "Just crossed 2,500 5★ reviews. Thanks to every trade who ordered from us over 12 years. Same-day dispatch continues.",
    createdAtIso: iso(1440),
    likeCount: 89,
    commentCount: 17,
    shareCount: 12
  },
  // ─── Cross-project posts (from Thenetworkers side) ─────────────────
  // These prove unified feed aggregation works — posts made in Canteen
  // and Yard flow into the same NetworkFeedCard stream on /tc/hub.
  {
    id: "f7",
    authorSlug: "riverside-electrics",
    authorName: "Sarah Kingsley",
    authorType: "trade",
    authorInitials: "SK",
    authorAreaLabel: "Canteen · Electrical UK",
    authorAreaColour: "#F59E0B",
    action: "canteen-post",
    body:
      "Anyone else seeing the new Amendment 3 draft on notifiable work? Reading through it now — first thoughts, they've finally scoped the EV charger side properly.",
    createdAtIso: iso(180),
    likeCount: 41,
    commentCount: 23,
    shareCount: 6
  },
  {
    id: "f8",
    authorSlug: "manchester-tools-direct",
    authorName: "Manchester Tools Direct",
    authorType: "merchant",
    authorInitials: "MT",
    authorAreaLabel: "Yard · Local trades",
    authorAreaColour: "#DC2626",
    action: "yard-post",
    body:
      "Free pallet of factory-second bonding coat going to any registered trade in the M20-M22 belt tomorrow. First 3 who reply. Damaged bags but usable — we test-mixed a batch, all fine.",
    createdAtIso: iso(420),
    likeCount: 67,
    commentCount: 34,
    shareCount: 18
  },
  {
    id: "f9",
    authorSlug: "riverside-electrics",
    authorName: "Sarah Kingsley",
    authorType: "trade",
    authorInitials: "SK",
    authorAreaLabel: "Counter · Cross-post",
    authorAreaColour: "#0A0A0A",
    action: "product-new",
    body:
      "Cross-posted from my Trade Center store — 3-way switch grid kits back in, £18 for the 5-pack, LS postcodes only for direct pickup.",
    linkHref: "/tc/trade-center/merchant/riverside-electrics",
    linkLabel: "See product",
    createdAtIso: iso(600),
    likeCount: 15,
    commentCount: 2,
    shareCount: 1
  }
];

// ─── Notifications fixture ──────────────────────────────────────────

export type NotificationKind = "follow" | "message" | "order" | "review" | "network-post" | "system";

export type Notification = {
  id: string;
  kind: NotificationKind;
  actorName?: string;
  actorInitials?: string;
  actorColour?: string;
  headline: string;
  detail?: string;
  href: string;
  createdAtIso: string;
  seen: boolean;
};

export const NOTIFICATION_FIXTURES: Notification[] = [
  {
    id: "n1",
    kind: "follow",
    actorName: "Sarah Kingsley",
    actorInitials: "SK",
    actorColour: "#166534",
    headline: "Sarah Kingsley followed you",
    detail: "Electrical trade in Leeds · Verified 7/8",
    href: "/tc/trade/riverside-electrics",
    createdAtIso: iso(20),
    seen: false
  },
  {
    id: "n2",
    kind: "message",
    actorName: "Manchester Tools Direct",
    actorInitials: "MT",
    actorColour: "#0A0A0A",
    headline: "New message about the Marshalltown twin-pack",
    detail: "\"Yeah the twin-pack is fine — will you get it here for Wednesday?\"",
    href: "/tc/messages/t-mtd-marshalltown",
    createdAtIso: iso(9),
    seen: false
  },
  {
    id: "n3",
    kind: "order",
    headline: "Delivery confirmed on Manchester Tools order",
    detail: "£264 released to merchant in 14 days · Release now available",
    href: "/tc/orders/ord_20260706_215",
    createdAtIso: iso(160),
    seen: false
  },
  {
    id: "n4",
    kind: "network-post",
    actorName: "Manchester Tools Direct",
    actorInitials: "MT",
    actorColour: "#166534",
    headline: "Manchester Tools posted a new product",
    detail: "Marshalltown 16\" Pro Finishing Trowel back in stock",
    href: "/tc/hub",
    createdAtIso: iso(38),
    seen: true
  },
  {
    id: "n5",
    kind: "review",
    headline: "New review on your profile",
    detail: "5★ from David Watson — \"walls like a mirror\"",
    href: "/tc/trade/bob-plastering",
    createdAtIso: iso(720),
    seen: true
  }
];

// ─── LocalStorage helpers ───────────────────────────────────────────

export function loadFollows(): FollowRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FOLLOWS_KEY);
    return raw ? (JSON.parse(raw) as FollowRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveFollows(list: FollowRecord[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FOLLOWS_KEY, JSON.stringify(list));
}

export function isFollowing(viewerSlug: string, targetSlug: string): boolean {
  return loadFollows().some(
    (f) => f.followerSlug === viewerSlug && f.followedSlug === targetSlug
  );
}
