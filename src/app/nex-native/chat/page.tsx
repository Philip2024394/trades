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
import { nexAddressForAccount } from "@/lib/nex-native/nex-address";
import type { NexChatTheme } from "@/lib/nex-native/types";
import { NexPageHeader } from "../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Tab = "friends" | "business" | "groups";
const TABS: readonly Tab[] = ["friends", "business", "groups"] as const;
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
const MOCK_FRIENDS: ReadonlyArray<{
  name: string;
  handle: string;
  profession: string;
  location: string;
  presence: MockPresence;
  /** Minutes since last active · null when unknown (presence hidden by
   *  the user or never online). Only rendered when presence = "clear". */
  lastSeenMinutes: number | null;
  unread: number;
  hasShop: boolean;
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
    profession: "Footwear designer",
    location: "Bandung",
    presence: "green",
    lastSeenMinutes: null,
    unread: 0,
    hasShop: true,
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
    lastMessage: "Yeah I'll be there — 2 pm works ✓",
    receiptState: "read",
    typing: false,
    chatTheme: "pink",
  },
  {
    name: "Aisha Rahman",
    handle: "nex-52091",
    profession: "Reseller · vintage cameras",
    location: "Jakarta",
    presence: "yellow",
    lastSeenMinutes: null,
    unread: 2,
    hasShop: true,
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop",
    lastMessage: "Just got a Leica M4 in — want photos?",
    receiptState: "inbound",
    typing: true,
    chatTheme: "gold",
  },
  {
    name: "Kenji Tanaka",
    handle: "nex-38754",
    profession: "Photographer",
    location: "Tokyo",
    presence: "clear",
    lastSeenMinutes: 25,
    unread: 0,
    hasShop: false,
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
    lastSeenMinutes: null,
    unread: 0,
    hasShop: false,
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop",
    lastMessage: "Thanks for the portfolio review!",
    receiptState: "sent",
    typing: false,
    chatTheme: "default",
  },
  {
    name: "Priya Patel",
    handle: "nex-91280",
    profession: "Bakery owner",
    location: "Mumbai",
    presence: "clear",
    lastSeenMinutes: 180,
    unread: 5,
    hasShop: true,
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop",
    lastMessage: "Delivery is out for tomorrow morning 🚗",
    receiptState: "inbound",
    typing: false,
    chatTheme: "night",
  },
] as const;

const MOCK_BUSINESSES: ReadonlyArray<{
  name: string;
  slug: string;
  subtitle: string;
  hoursAgo: number;
  unread: number;
  receiptState: MockReceiptState;
}> = [
  {
    name: "Cake Shop Jogja",
    slug: "cakeshopjogja",
    subtitle: "New batch of sourdough this Saturday · save one?",
    hoursAgo: 2,
    unread: 3,
    receiptState: "inbound",
  },
  {
    name: "Bandung Bakery",
    slug: "bandung-bakery",
    subtitle: "Order confirmed · pickup 3pm tomorrow.",
    hoursAgo: 6,
    unread: 0,
    receiptState: "read",
  },
  {
    name: "Warung Nasi Padang",
    slug: "warung-nasi-padang",
    subtitle: "Payment received · terima kasih!",
    hoursAgo: 24,
    unread: 1,
    receiptState: "inbound",
  },
  {
    name: "Tukang Kayu Kreatif",
    slug: "tukang-kayu-kreatif",
    subtitle: "Custom shelf · 4 weeks turnaround · deposit ready?",
    hoursAgo: 72,
    unread: 0,
    receiptState: "sent",
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
  searchParams: Promise<{ tab?: string }>;
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

export default async function ChatHubPage({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const sp = await searchParams;
  const activeTab: Tab = TABS.includes(sp.tab as Tab)
    ? (sp.tab as Tab)
    : "friends";
  // Preview mocks · only in local development.
  const showPreview = process.env.NEX_ALLOW_DEV_ADMIN === "1";

  // Load only the data for the active tab · keeps the page cheap.
  let friendCards: Array<{
    id: string;
    name: string;
    handle: string | null;
    href: string;
    avatarUrl: string | null;
    nexAddress: string | null;
    chatTheme: NexChatTheme | null;
  }> = [];
  let businessCards: Array<{
    conversationId: string;
    businessName: string;
    slug: string;
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
    const ids = await friendService.listFriends(session.account.id).catch(() => []);
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
    friendCards = profiles.map(({ account: r, profile }) => {
      const addr = nexAddressForAccount({
        nex_handle: r.nex_handle,
      });
      return {
        id: r.id,
        name: r.display_name,
        handle: r.nex_handle,
        href: r.nex_handle ? `/nex-native/u/${r.nex_handle}` : `/nex-native/u/${r.id.slice(0, 8)}`,
        avatarUrl: profile?.avatar_url ?? null,
        nexAddress: addr?.display ?? null,
        chatTheme: r.chat_theme,
      };
    });
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
    businessCards = Array.from(perBusiness.values()).map((s) => {
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
      return {
        conversationId: s.conversation.id,
        businessName: s.business.display_name,
        slug: s.business.slug,
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
          padding: "16px 20px 32px",
          position: "relative",
          overflow: "hidden",
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
              <div style={{ display: "grid", gap: 12 }}>
                {/*
                  Friend card destination: /nex-native/u/[handle] (profile
                  page). The fingerprint icon signals "tap to open chat"
                  but real peer-to-peer messaging depends on Bridge 3
                  (nex_conversation.business_id currently NOT NULL).
                  When Bridge 3 ships, this href becomes
                  /nex-native/conversations/peer/[peerAccountId] (or
                  whatever route peer chat lands on). The fingerprint
                  UI stays.
                */}
                {friendCards.map((c) => (
                  <PersonCard
                    key={c.id}
                    href={c.href}
                    name={c.name}
                    subtitle={c.handle ?? `${c.id.slice(0, 8)}…`}
                    avatarUrl={c.avatarUrl}
                    nexAddress={c.nexAddress}
                    chatTheme={c.chatTheme}
                  />
                ))}
                {showPreview &&
                  MOCK_FRIENDS.map((c, i) => (
                    <PersonCard
                      key={`mock-${i}`}
                      href={null}
                      name={c.name}
                      subtitle={
                        c.lastMessage ?? `${c.profession} · ${c.location}`
                      }
                      presence={c.presence}
                      lastSeenMinutes={c.lastSeenMinutes}
                      unread={c.unread}
                      hasShop={c.hasShop}
                      avatarUrl={c.avatarUrl}
                      receiptState={c.receiptState}
                      typing={c.typing}
                      nexAddress={`${c.handle}.nex`}
                      chatTheme={c.chatTheme}
                      preview
                    />
                  ))}
                {friendCards.length === 0 && !showPreview && (
                  <EmptyState
                    icon="👥"
                    title="No friends yet"
                    body="Send an invite from your friends surface · or someone can add you first."
                    ctaHref="/nex-native/friends"
                    ctaLabel="Manage friends"
                  />
                )}
              </div>
            )}

            {activeTab === "business" && (
              <div style={{ display: "grid", gap: 12 }}>
                {businessCards.map((c) => (
                  <BusinessCard
                    key={c.conversationId}
                    href={`/nex-native/conversations/${c.conversationId}`}
                    name={c.businessName}
                    slug={c.slug}
                    subtitle={c.subtitle}
                    lastAt={c.lastAt}
                    receiptState={c.myReceiptState}
                  />
                ))}
                {showPreview &&
                  MOCK_BUSINESSES.map((c, i) => (
                    <BusinessCard
                      key={`mock-${i}`}
                      href={null}
                      name={c.name}
                      slug={c.slug}
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
                    title="No business chats yet"
                    body="When you message a NEX business, they'll appear here."
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
  /** Minutes since this person was last active · only shown when
   *  presence is "clear" (offline). Formatted 2m / 25m / 3h / 1d. */
  lastSeenMinutes?: number | null;
  /** Preview-only · unread count pill on the avatar top-right. Zero hides it. */
  unread?: number;
  /** Preview-only · "🛍 Shop" tag under the name when the person owns a shop. */
  hasShop?: boolean;
  /** Read-receipt state for my outbound last message · shown before the
   *  subtitle text · null hides. */
  receiptState?: "sent" | "read" | "inbound" | null;
  /** Preview-only · replaces subtitle with an animated "typing…" bubble. */
  typing?: boolean;
  /** NEX Address display · rendered as a small monospace chip beside the
   *  name (e.g. "nex-27418.nex" or "philip.nex"). Null hides the chip. */
  nexAddress?: string | null;
  /** Chat theme drives the 3px accent stripe colour on the left edge
   *  of the card · this is the brand-identity moment · every friend
   *  wears their own colour. Null / missing → NEX cyan. */
  chatTheme?: NexChatTheme | string | null;
}) {
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
        {props.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={props.avatarUrl}
            alt=""
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: NEX.cyanFaint,
              color: NEX.cyan,
              display: "grid",
              placeItems: "center",
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}
          >
            {initialsFromName(props.name)}
          </div>
        )}
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
          {props.nexAddress && <NexAddressChip address={props.nexAddress} />}
        </div>
        {props.typing ? (
          <TypingBubble />
        ) : (
          <div
            style={{
              marginTop: 2,
              fontSize: 12,
              color: NEX.textSecondary,
              lineHeight: 1.4,
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
        {props.hasShop && (
          <div style={{ marginTop: 6 }}>
            <ShopTag />
          </div>
        )}
      </div>
      <FingerprintChip
        presence={props.presence}
        lastSeenMinutes={props.lastSeenMinutes ?? null}
        muted={props.preview}
      />
    </>
  );
  const accent = accentForTheme(props.chatTheme);
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
  const stripe = <AccentStripe color={accent} />;
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
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              minWidth: 0,
              flex: 1,
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
          {timeLabel && (
            <div
              style={{
                flexShrink: 0,
                fontSize: 10,
                color: NEX.textSecondary,
                letterSpacing: "0.02em",
              }}
            >
              {timeLabel}
            </div>
          )}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            color: NEX.textSecondary,
            lineHeight: 1.4,
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
      </div>
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          color: props.preview ? NEX.textSecondary : NEX.cyan,
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        →
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

/** Round fingerprint chip · replaces the → arrow AND the avatar presence
 *  dot on friend cards. Circular 40px container. Ring colour carries
 *  presence: green (online) · yellow (busy) · gray (offline / unknown).
 *  When offline and last-seen is known, a small "25m" label appears
 *  directly under the chip.
 *
 *  Sealed 2026-09-27: presence lives on the action target. Uniquely NEX
 *  affordance — one signal for "who is around" + "tap to talk to them". */
function FingerprintChip(props: {
  muted?: boolean;
  presence?: CardPresence;
  lastSeenMinutes?: number | null;
}) {
  const isOffline = !props.presence || props.presence === "clear";
  const ring = presenceRingColour(props.presence, !!props.muted);
  const bg = presenceFillColour(props.presence, !!props.muted);
  const stroke = presenceStrokeColour(props.presence, !!props.muted);
  const showLastSeen =
    isOffline &&
    typeof props.lastSeenMinutes === "number" &&
    Number.isFinite(props.lastSeenMinutes) &&
    props.lastSeenMinutes >= 0;
  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <div
        aria-hidden
        title={presenceTitle(props.presence, props.lastSeenMinutes ?? null)}
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: bg,
          border: `2px solid ${ring}`,
          display: "grid",
          placeItems: "center",
          color: stroke,
          boxShadow:
            !isOffline && !props.muted
              ? `0 0 0 3px ${ring}22`
              : undefined,
        }}
      >
        <FingerprintIcon />
      </div>
      {showLastSeen && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: "0.04em",
            color: NEX.textSecondary,
            lineHeight: 1,
          }}
        >
          {formatLastSeen(props.lastSeenMinutes as number)}
        </span>
      )}
    </div>
  );
}

const PRESENCE_GREEN = "#10b981";
const PRESENCE_YELLOW = "#f59e0b";
const PRESENCE_GRAY = "rgba(125,155,192,0.55)";

function presenceRingColour(p: CardPresence | undefined, muted: boolean): string {
  if (muted) return "rgba(125,155,192,0.35)";
  switch (p) {
    case "green":
      return PRESENCE_GREEN;
    case "yellow":
      return PRESENCE_YELLOW;
    default:
      return PRESENCE_GRAY;
  }
}

function presenceFillColour(p: CardPresence | undefined, muted: boolean): string {
  if (muted) return "rgba(125,155,192,0.06)";
  switch (p) {
    case "green":
      return "rgba(16,185,129,0.12)";
    case "yellow":
      return "rgba(245,158,11,0.12)";
    default:
      return "rgba(125,155,192,0.08)";
  }
}

function presenceStrokeColour(p: CardPresence | undefined, muted: boolean): string {
  if (muted) return NEX.textSecondary;
  switch (p) {
    case "green":
      return PRESENCE_GREEN;
    case "yellow":
      return PRESENCE_YELLOW;
    default:
      return NEX.textSecondary;
  }
}

function presenceTitle(
  p: CardPresence | undefined,
  lastSeenMinutes: number | null,
): string {
  switch (p) {
    case "green":
      return "Online · tap to chat";
    case "yellow":
      return "Busy · tap to chat";
    default:
      if (lastSeenMinutes != null) {
        return `Last seen ${formatLastSeen(lastSeenMinutes)} ago · tap to chat`;
      }
      return "Offline · tap to chat";
  }
}

/** 0-59 → "Nm" · 60-1439 → "Nh" · 1440+ → "Nd". Compact chat idiom. */
function formatLastSeen(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

/** Fingerprint icon · the tap-to-open-chat affordance on friend cards.
 *  Replaces the generic arrow with a signal of *personal identity* — the
 *  friend is on the other end. Uniquely NEX among chat apps · Founder
 *  brief 2026-09-27. Sized to match the arrow (18px) so cards stay
 *  balanced. */
function FingerprintIcon() {
  return (
    <svg
      width="20"
      height="20"
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

/** NEX Address chip · small monospace pill beside the name that shows
 *  the person's shareable NEX address ("nex-27418.nex" or "philip.nex").
 *  This is the brand-identity element unique to NEX · every account has
 *  one and it never changes. */
function NexAddressChip({ address }: { address: string }) {
  return (
    <span
      aria-label={`NEX Address ${address}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 6px",
        fontSize: 10,
        fontFamily: "ui-monospace, monospace",
        letterSpacing: "0.02em",
        color: NEX.textSecondary,
        background: "rgba(0, 175, 255, 0.06)",
        border: `1px solid rgba(0, 175, 255, 0.18)`,
        borderRadius: 4,
        lineHeight: 1.4,
        flexShrink: 0,
      }}
    >
      {address}
    </span>
  );
}

/** 3px vertical stripe on the left inside edge of a card · coloured by
 *  the person's chat_theme. Zero interaction cost · pure identity signal
 *  · you learn to recognise cards by their stripe over time (Superhuman,
 *  Basecamp both use this pattern). Absolute-positioned so it never
 *  affects card layout · overflow-hidden on the parent trims the top and
 *  bottom into the rounded corners. */
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
