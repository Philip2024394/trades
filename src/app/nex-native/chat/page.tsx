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
// while real friend / business / group data is still empty. Each card
// carries a "PREVIEW" pill so nobody mistakes it for real state.
const MOCK_FRIENDS = [
  { name: "Maria Santos", handle: "nex-27418" },
  { name: "Aisha Rahman", handle: "nex-52091" },
  { name: "Kenji Tanaka", handle: "nex-38754" },
  { name: "Lucas Ferreira", handle: "nex-15662" },
  { name: "Priya Patel", handle: "nex-91280" },
] as const;

const MOCK_BUSINESSES = [
  {
    name: "Cake Shop Jogja",
    slug: "cakeshopjogja",
    subtitle: "New batch of sourdough this Saturday · save one?",
    hoursAgo: 2,
  },
  {
    name: "Bandung Bakery",
    slug: "bandung-bakery",
    subtitle: "Order confirmed · pickup 3pm tomorrow.",
    hoursAgo: 6,
  },
  {
    name: "Warung Nasi Padang",
    slug: "warung-nasi-padang",
    subtitle: "Payment received · terima kasih!",
    hoursAgo: 24,
  },
  {
    name: "Tukang Kayu Kreatif",
    slug: "tukang-kayu-kreatif",
    subtitle: "Custom shelf · 4 weeks turnaround · deposit ready?",
    hoursAgo: 72,
  },
] as const;

const MOCK_GROUPS = [
  { name: "NEX Founders Circle", members: 12, subtitle: "Started by Maria · daily active" },
  { name: "Bandung Coffee Meetup", members: 27, subtitle: "Meets Saturdays 10am" },
  { name: "Bali Digital Nomads", members: 45, subtitle: "Coworking · rides · food tips" },
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
  let friendCards: Array<{ id: string; name: string; handle: string | null; href: string }> = [];
  let businessCards: Array<{
    conversationId: string;
    businessName: string;
    slug: string;
    subtitle: string;
    lastAt: string | null;
  }> = [];

  if (activeTab === "friends") {
    const ids = await friendService.listFriends(session.account.id).catch(() => []);
    const rows = await Promise.all(ids.map((id) => accountService.getAccountById(id)));
    friendCards = rows.filter((r): r is NonNullable<typeof r> => !!r).map((r) => ({
      id: r.id,
      name: r.display_name,
      handle: r.nex_handle,
      href: r.nex_handle ? `/nex-native/u/${r.nex_handle}` : `/nex-native/u/${r.id.slice(0, 8)}`,
    }));
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
    businessCards = Array.from(perBusiness.values()).map((s) => ({
      conversationId: s.conversation.id,
      businessName: s.business.display_name,
      slug: s.business.slug,
      subtitle: s.last_message
        ? s.last_message.body.slice(0, 90)
        : "No messages yet",
      lastAt: s.last_message?.created_at ?? null,
    }));
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
                {friendCards.map((c) => (
                  <PersonCard
                    key={c.id}
                    href={c.href}
                    name={c.name}
                    subtitle={c.handle ?? `${c.id.slice(0, 8)}…`}
                  />
                ))}
                {showPreview &&
                  MOCK_FRIENDS.map((c, i) => (
                    <PersonCard
                      key={`mock-${i}`}
                      href={null}
                      name={c.name}
                      subtitle={c.handle}
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

function PersonCard(props: {
  href: string | null;
  name: string;
  subtitle: string;
  preview?: boolean;
}) {
  const cardBody = (
    <>
      <div
        aria-hidden
        style={{
          flexShrink: 0,
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
          {props.preview && <PreviewPill />}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 11,
            color: NEX.textSecondary,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {props.subtitle}
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
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px",
    background: NEX.panel,
    border: `1px solid ${props.preview ? "rgba(0,175,255,0.18)" : NEX.cyanSoft}`,
    borderRadius: 12,
    textDecoration: "none",
    color: NEX.textPrimary,
    minHeight: 76,
    transition: "border-color 200ms ease, box-shadow 200ms ease",
    opacity: props.preview ? 0.75 : 1,
  };
  if (!props.href) {
    return (
      <div
        data-nex-chat-card
        data-nex-chat-card-kind="person"
        data-nex-chat-card-preview={props.preview ? "true" : undefined}
        style={style}
      >
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
            {props.preview && <PreviewPill />}
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
          }}
        >
          {props.subtitle}
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
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px",
    background: NEX.panel,
    border: `1px solid ${props.preview ? "rgba(0,175,255,0.18)" : NEX.cyanSoft}`,
    borderRadius: 12,
    textDecoration: "none",
    color: NEX.textPrimary,
    minHeight: 76,
    transition: "border-color 200ms ease, box-shadow 200ms ease",
    opacity: props.preview ? 0.75 : 1,
  };
  if (!props.href) {
    return (
      <div
        data-nex-chat-card
        data-nex-chat-card-kind="business"
        data-nex-chat-card-preview={props.preview ? "true" : undefined}
        style={style}
      >
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
      {cardBody}
    </Link>
  );
}

function GroupCard(props: {
  name: string;
  subtitle: string;
  members: number;
  preview?: boolean;
}) {
  return (
    <div
      data-nex-chat-card
      data-nex-chat-card-kind="group"
      data-nex-chat-card-preview={props.preview ? "true" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        background: NEX.panel,
        border: `1px solid ${props.preview ? "rgba(0,175,255,0.18)" : NEX.cyanSoft}`,
        borderRadius: 12,
        color: NEX.textPrimary,
        minHeight: 76,
        opacity: props.preview ? 0.75 : 1,
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
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
          {props.preview && <PreviewPill />}
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

function PreviewPill() {
  return (
    <span
      aria-label="preview"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 6px",
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: NEX.cyan,
        border: `1px solid ${NEX.cyanSoft}`,
        borderRadius: 4,
        lineHeight: 1.3,
        flexShrink: 0,
      }}
    >
      Preview
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
