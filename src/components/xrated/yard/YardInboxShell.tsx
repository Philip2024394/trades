"use client";

// The Yard Inbox — 3-column messaging-inbox layout for the trade
// chat / hire / product feed. Modelled on the "THE NETWORK" mockup:
// left = conversation list, centre = active thread, right = poster +
// post summary. Renamed conceptually — each yard post is a THREAD.
//
// Mobile pattern: single-column list, tap → thread stack view with
// a sticky post-summary pill; right column becomes a bottom sheet
// via the info button in the thread header.
//
// All initial data is loaded server-side and passed in; the shell
// keeps `selectedId` in local state so switching between threads is
// sub-100ms, no round-trip. Facebook Messenger / Groups pattern.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Angry,
  Bell,
  Bookmark,
  ChevronLeft,
  EyeOff,
  Filter,
  Flame,
  Flag,
  Frown,
  Heart,
  Image as ImageIcon,
  Info,
  Laugh,
  Link as LinkIcon,
  MessageCircle,
  MoreHorizontal,
  Package,
  Phone,
  Plus,
  Search,
  Send,
  Shield,
  ThumbsUp,
  User,
  UserPlus,
  Video,
  X
} from "lucide-react";
import { BottomSheet } from "@/platform/ui/sheets/BottomSheet";
import { tradeLabel } from "@/lib/tradeOff";
import type { HammerexTradeOffYardPost } from "@/lib/supabase";
import type { ReactionCounts } from "@/lib/yardReactions";
import type { YardPoster } from "./YardPostCard";
import { YardCommentsPanel } from "./YardCommentsPanel";
import { YardInlineComposer } from "./YardInlineComposer";
import { TradeCounterSlideOut } from "./TradeCounterSlideOut";
import Link from "next/link";
import {
  MOOD_LIBRARY,
  readMoodFrom,
  suggestMood,
  type MoodDef
} from "@/lib/yardMoods";
import {
  buildYardWhatsappUrl,
  timeAgoShort,
  daysRemaining,
  isNewPost
} from "@/lib/yardPosts";

const BRAND = "#FFB300";
const BRAND_HOVER = "#E5A500";
const BG = "#FBF6EC";
const CARD_BORDER = "#EDE4CE";

type Tab = "all" | "unread" | "archived";
type KindFilter = "all" | "chat" | "needed" | "available" | "product" | "beacon";

type Props = {
  posts: HammerexTradeOffYardPost[];
  posters: Record<string, YardPoster>;
  reactions: Record<string, ReactionCounts>;
  viewerCircleIds: string[];
};

export function YardInboxShell({
  posts,
  posters,
  reactions,
  viewerCircleIds
}: Props) {
  // Start with NO thread focused so the composer + top of the feed
  // stays in view. Focus (and its auto-scroll) only fires when the
  // user picks a thread from the left column.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  // Mobile default = feed view (Facebook News Feed pattern) not list.
  // Users can jump to the compact conversation picker via "Threads".
  const [mobileSheet, setMobileSheet] = useState<"list" | "thread">("thread");
  const [rightSheet, setRightSheet] = useState(false);
  const [tradeCounterOpen, setTradeCounterOpen] = useState(false);
  const [hiddenSet, setHiddenSet] = useState<Set<string>>(new Set());
  const circleSet = useMemo(() => new Set(viewerCircleIds), [viewerCircleIds]);

  // Load device-scoped hidden posts on mount.
  useEffect(() => {
    setHiddenSet(readSet(LS_HIDDEN));
  }, []);

  const filtered = useMemo(() => {
    let list = posts.filter((p) => !hiddenSet.has(p.id));
    if (tab === "unread") list = list.filter((p) => isNewPost(p.created_at));
    if (kindFilter !== "all") list = list.filter((p) => p.kind === kindFilter);
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter((p) => {
        const poster = posters[p.listing_id];
        const name = (
          poster?.trading_name ??
          poster?.display_name ??
          ""
        ).toLowerCase();
        return (
          p.title?.toLowerCase().includes(q) ||
          p.body?.toLowerCase().includes(q) ||
          name.includes(q)
        );
      });
    }
    return list;
  }, [posts, tab, kindFilter, searchQ, posters, hiddenSet]);

  // Keep selection valid if filters change and the current selection
  // is filtered out — default to the first item in view.
  useEffect(() => {
    if (!selectedId) return;
    if (!filtered.some((p) => p.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  const selected = selectedId
    ? posts.find((p) => p.id === selectedId) ?? null
    : null;
  const selectedPoster = selected
    ? posters[selected.listing_id] ?? null
    : null;
  const selectedReactions = selected ? reactions[selected.id] ?? {} : {};

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      {/* AppShell (parent layout) already renders the persistent top
          bar with logo + search + auth. We just add the sub-nav +
          page title strip below it. */}
      <SubNav />
      <PageTitleStrip totalCount={filtered.length} />

      <div className="mx-auto w-full max-w-[1400px] px-3 pb-24 md:px-6 md:pb-8">
        {/* Desktop: 3-column grid. Mobile: single-column stack that
            swaps between list + thread via mobileSheet state. */}
        <div className="grid gap-4 md:grid-cols-[300px_1fr] lg:grid-cols-[300px_1fr_320px]">
          {/* LEFT — conversation list */}
          <aside
            className={
              mobileSheet === "list"
                ? "md:block"
                : "hidden md:block"
            }
          >
            <ConversationList
              posts={filtered}
              posters={posters}
              circleSet={circleSet}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setMobileSheet("thread");
              }}
              tab={tab}
              onTabChange={setTab}
              searchQ={searchQ}
              onSearch={setSearchQ}
              onCloseToFeed={() => setMobileSheet("thread")}
              kindFilter={kindFilter}
              onKindFilterChange={setKindFilter}
              kindCounts={countByKind(posts)}
            />
          </aside>

          {/* CENTRE — Facebook-style vertical feed. Every filtered
              post renders as its own card, stacked. Left-column click
              scrolls the centre to the picked post; right column
              tracks whichever post is being interacted with. */}
          <main
            className={
              mobileSheet === "thread"
                ? "md:block"
                : "hidden md:block"
            }
          >
            <VerticalFeed
              posts={filtered}
              posters={posters}
              reactions={reactions}
              circleSet={circleSet}
              focusedId={selectedId}
              onFocus={setSelectedId}
              onBack={() => setMobileSheet("list")}
              onOpenInfo={() => setRightSheet(true)}
              onOpenTradeCounter={() => setTradeCounterOpen(true)}
            />
          </main>

          {/* RIGHT — poster + post summary when a thread is focused,
              otherwise a welcome + trending panel so the column
              stays balanced (Facebook Groups pattern). */}
          <aside className="hidden lg:block">
            {selected && selectedPoster ? (
              <RightPanel post={selected} poster={selectedPoster} />
            ) : (
              <DefaultRightPanel
                posts={posts}
                posters={posters}
                onSelect={setSelectedId}
              />
            )}
          </aside>
        </div>
      </div>

      {/* Mobile right-column sheet */}
      {rightSheet && selected && selectedPoster && (
        <MobileRightSheet
          post={selected}
          poster={selectedPoster}
          onClose={() => setRightSheet(false)}
        />
      )}

      {/* Trade Counter slide-out — 60% mobile, 70% desktop, right edge */}
      <TradeCounterSlideOut
        open={tradeCounterOpen}
        onClose={() => setTradeCounterOpen(false)}
      />
    </div>
  );
}

// ─── SUB-NAV ───────────────────────────────────────────────────────

function SubNav() {
  const items = [
    { label: "Feed", href: "/trade-off/yard", active: true, icon: MessageCircle },
    { label: "Canteens", href: "/trade-off/yard/canteens" },
    { label: "Trade News", href: "/trade-off/yard?topic=news" },
    { label: "Merchants", href: "/trade-off" },
    { label: "Products", href: "/products" },
    { label: "Services", href: "/trade-off/yard?kind=chat" },
    { label: "Plant Hire", href: "/trade-off/yard?trade=plant-hire" },
    { label: "Deals", href: "/trade-off/yard?kind=product" },
    { label: "Suppliers", href: "/trade-off/yard?trade=building-merchant" },
    { label: "How it works", href: "/trade-off/how-it-works" }
  ];
  return (
    <nav
      className="hidden border-b bg-white md:block"
      style={{ borderColor: CARD_BORDER }}
    >
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-6 overflow-x-auto px-6 py-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <a
              key={it.label}
              href={it.href}
              className={
                "inline-flex shrink-0 items-center gap-1.5 text-[13px] font-bold tracking-wide transition " +
                (it.active
                  ? "text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-800")
              }
            >
              {Icon && <Icon size={15} aria-hidden="true" />}
              {it.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

// ─── PAGE TITLE STRIP ──────────────────────────────────────────────

function PageTitleStrip({ totalCount }: { totalCount: number }) {
  return (
    <section
      className="border-b bg-white"
      style={{ borderColor: CARD_BORDER }}
    >
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-3 py-6 md:px-6 md:py-8">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-black leading-tight text-neutral-900 md:text-[32px]">
            The Yard
          </h1>
          <p className="mt-1 text-[13px] text-neutral-600 md:text-[14px]">
            Connect, chat and close more deals · {totalCount} live threads
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2012,%202026,%2002_22_39%20AM.png"
          alt=""
          aria-hidden
          className="h-20 w-auto shrink-0 object-contain sm:h-24 md:h-28"
        />
      </div>
    </section>
  );
}

// ─── KIND FILTER CHIPS ─────────────────────────────────────────────
// Facebook-feed style horizontal chip strip. Sticky, one-tap slice.
// Counts derive from the *unfiltered* post pool so numbers don't
// change when you tap between chips.

const KIND_CHIPS: Array<{ id: KindFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "chat", label: "Chat" },
  { id: "needed", label: "Hiring" },
  { id: "available", label: "Available" },
  { id: "product", label: "For sale" },
  { id: "beacon", label: "Beacons" }
];

function countByKind(
  posts: HammerexTradeOffYardPost[]
): Record<KindFilter, number> {
  const c: Record<KindFilter, number> = {
    all: posts.length,
    chat: 0,
    needed: 0,
    available: 0,
    product: 0,
    beacon: 0
  };
  for (const p of posts) {
    if (p.kind === "chat") c.chat++;
    else if (p.kind === "needed") c.needed++;
    else if (p.kind === "available") c.available++;
    else if (p.kind === "product") c.product++;
    else if (p.kind === "beacon") c.beacon++;
  }
  return c;
}

function KindFilterChips({
  active,
  onChange,
  counts
}: {
  active: KindFilter;
  onChange: (k: KindFilter) => void;
  counts: Record<KindFilter, number>;
}) {
  return (
    <div
      className="sticky top-[60px] z-20 border-b backdrop-blur sm:top-[68px]"
      style={{ borderColor: CARD_BORDER, backgroundColor: "rgba(251,246,236,0.96)" }}
    >
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-2 overflow-x-auto px-3 py-3 md:px-6">
        {KIND_CHIPS.map((chip) => {
          const isActive = chip.id === active;
          const count = counts[chip.id];
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onChange(chip.id)}
              className={
                "inline-flex shrink-0 items-baseline gap-1 whitespace-nowrap px-2 py-1 text-[12.5px] font-black uppercase tracking-[0.08em] transition " +
                (isActive
                  ? "text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-800")
              }
              style={{
                borderBottom: isActive ? "2px solid #FFB300" : "2px solid transparent",
                background: "transparent",
                boxShadow: "none"
              }}
              aria-pressed={isActive}
            >
              {chip.label}
              <span
                className="text-[10.5px] font-black tabular-nums"
                style={{ color: isActive ? "#0A0A0A" : "#94908A" }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── LEFT: CONVERSATION LIST ───────────────────────────────────────

function ConversationList({
  posts,
  posters,
  circleSet,
  selectedId,
  onSelect,
  tab,
  onTabChange,
  searchQ,
  onSearch,
  onCloseToFeed,
  kindFilter,
  onKindFilterChange,
  kindCounts
}: {
  posts: HammerexTradeOffYardPost[];
  posters: Record<string, YardPoster>;
  circleSet: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  tab: Tab;
  onTabChange: (t: Tab) => void;
  searchQ: string;
  onSearch: (q: string) => void;
  onCloseToFeed?: () => void;
  kindFilter?: KindFilter;
  onKindFilterChange?: (k: KindFilter) => void;
  kindCounts?: Record<KindFilter, number>;
}) {
  const tabs: Tab[] = ["all", "unread", "archived"];
  return (
    <div
      className="flex h-[calc(100vh-14rem)] flex-col overflow-hidden rounded-2xl border bg-white"
      style={{ borderColor: CARD_BORDER }}
    >
      <div
        className="border-b p-3"
        style={{ borderColor: CARD_BORDER }}
      >
        {/* Mobile-only Close button — yellow, right-aligned. Returns
            the user to the live main feed. Desktop hides it because
            the feed is always visible in the centre column. */}
        {onCloseToFeed && (
          <div className="mb-3 flex items-center justify-between md:hidden">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
              Threads
            </div>
            <button
              type="button"
              onClick={onCloseToFeed}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider shadow-sm hover:brightness-105"
              style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
            >
              Close
              <X size={12} strokeWidth={2.5}/>
            </button>
          </div>
        )}
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQ}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search conversations…"
              className="h-9 w-full rounded-lg border bg-neutral-50 pl-8 pr-3 text-[13px] outline-none focus:bg-white"
              style={{ borderColor: CARD_BORDER }}
            />
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white text-neutral-500 hover:bg-neutral-50"
            style={{ borderColor: CARD_BORDER }}
            aria-label="Filter"
          >
            <Filter size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-center gap-1 text-[12px] font-bold">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTabChange(t)}
              className={
                "relative rounded-md px-2.5 py-1 uppercase tracking-wide transition " +
                (tab === t
                  ? "text-neutral-900"
                  : "text-neutral-400 hover:text-neutral-700")
              }
            >
              {t}
              {tab === t && (
                <span
                  className="absolute inset-x-1 -bottom-[7px] h-[2px] rounded-full"
                  style={{ background: BRAND }}
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Secondary kind filter — moved here from the sticky top strip.
          Compact text row with a yellow underline for the active slice
          so the ConversationList is the single home for "narrow the
          feed" controls. */}
      {kindFilter !== undefined && onKindFilterChange && kindCounts && (
        <div
          className="flex items-center gap-3 overflow-x-auto border-b px-3 py-2 text-[11.5px]"
          style={{ borderColor: CARD_BORDER }}
        >
          {KIND_CHIPS.map((chip) => {
            const isActive = chip.id === kindFilter;
            const count = kindCounts[chip.id];
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onKindFilterChange(chip.id)}
                className={
                  "inline-flex shrink-0 items-baseline gap-1 whitespace-nowrap px-1 py-0.5 font-black uppercase tracking-[0.06em] transition " +
                  (isActive
                    ? "text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-800")
                }
                style={{
                  borderBottom: isActive ? "2px solid #FFB300" : "2px solid transparent"
                }}
                aria-pressed={isActive}
              >
                {chip.label}
                <span
                  className="text-[9.5px] tabular-nums"
                  style={{ color: isActive ? "#0A0A0A" : "#94908A" }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <ul
        className="flex-1 overflow-y-auto divide-y"
        style={{ borderColor: CARD_BORDER }}
      >
        {posts.length === 0 ? (
          <li className="p-6 text-center text-[13px] text-neutral-500">
            No threads match your search.
          </li>
        ) : (
          posts.map((p) => (
            <ThreadRow
              key={p.id}
              post={p}
              poster={posters[p.listing_id] ?? null}
              inCircle={circleSet.has(p.listing_id)}
              selected={p.id === selectedId}
              onClick={() => onSelect(p.id)}
            />
          ))
        )}
      </ul>
      <div
        className="border-t p-3"
        style={{ borderColor: CARD_BORDER }}
      >
        <button
          type="button"
          className="w-full text-center text-[12px] font-bold text-neutral-500 hover:text-neutral-800"
        >
          View archived
        </button>
      </div>
    </div>
  );
}

function ThreadRow({
  post,
  poster,
  inCircle,
  selected,
  onClick
}: {
  post: HammerexTradeOffYardPost;
  poster: YardPoster | null;
  inCircle: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const name = poster?.trading_name?.trim() || poster?.display_name || "Member";
  const initial = name.charAt(0).toUpperCase();
  const preview = post.body?.slice(0, 60) ?? post.title ?? "";
  const isNew = isNewPost(post.created_at);
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={
          "flex w-full items-start gap-3 px-3 py-3 text-left transition " +
          (selected ? "" : "hover:bg-neutral-50")
        }
        style={
          selected
            ? {
                background: `${BRAND}14`,
                borderLeft: `3px solid ${BRAND}`
              }
            : undefined
        }
      >
        <Avatar name={name} url={poster?.avatar_url ?? null} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[13px] font-extrabold text-neutral-900">
              {name}
            </p>
            {inCircle && (
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: BRAND }}
                aria-label="In your circle"
              />
            )}
            <p className="ml-auto shrink-0 text-[11px] font-medium text-neutral-500">
              {timeAgoShort(post.created_at)}
            </p>
          </div>
          <p className="mt-0.5 truncate text-[12px] leading-snug text-neutral-600">
            {preview}
          </p>
        </div>
        {isNew && (
          <span
            className="mt-1 inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-black text-neutral-900"
            style={{ background: BRAND }}
          >
            •
          </span>
        )}
      </button>
    </li>
  );
}

// ─── CENTRE: VERTICAL FEED ─────────────────────────────────────────

function VerticalFeed({
  posts,
  posters,
  reactions,
  circleSet,
  focusedId,
  onFocus,
  onBack,
  onOpenInfo,
  onOpenTradeCounter
}: {
  posts: HammerexTradeOffYardPost[];
  posters: Record<string, YardPoster>;
  reactions: Record<string, ReactionCounts>;
  circleSet: Set<string>;
  focusedId: string | null;
  onFocus: (id: string) => void;
  onBack: () => void;
  onOpenInfo: () => void;
  onOpenTradeCounter?: () => void;
}) {
  // Auto-scroll to the focused post when the left-column selection
  // changes. Uses element.id so a browser hash also lands correctly.
  useEffect(() => {
    if (!focusedId) return;
    const el = document.getElementById(`thread-${focusedId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focusedId]);

  if (posts.length === 0) {
    return <EmptyThread onBack={onBack} />;
  }

  return (
    <div className="space-y-4">
      {/* Mobile toolbar — Feed header + jump nav. Thread link opens
          the Threads panel from the right; Trade Counter opens the
          right-side slide-out; Trade Center + Trade Apps hard-nav.
          Top padding pushes "Feed" clear of the white PageTitleStrip
          border so the header sits with visible breathing room. */}
      <div className="flex flex-col gap-2 pt-4 md:hidden">
        <div>
          <h2 className="text-[15px] font-black leading-none tracking-tight text-neutral-900">
            Feed
          </h2>
          <div
            className="mt-1.5 h-1 w-14 rounded-full"
            style={{ backgroundColor: "#FFB300" }}
            aria-hidden
          />
        </div>
        <nav
          className="flex items-center gap-3 overflow-x-auto text-[10.5px] font-black uppercase tracking-[0.14em]"
          aria-label="Yard jump links"
        >
          <button
            type="button"
            onClick={onBack}
            className="whitespace-nowrap text-neutral-900"
          >
            Thread
          </button>
          <span className="text-neutral-300" aria-hidden>·</span>
          <Link
            href="/tc/trade-center"
            className="inline-flex items-center gap-1 whitespace-nowrap text-neutral-600 hover:text-neutral-900"
          >
            Trade Center
            <span
              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider"
              style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
            >
              New
            </span>
          </Link>
          <span className="text-neutral-300" aria-hidden>·</span>
          <button
            type="button"
            onClick={() => onOpenTradeCounter?.()}
            className="whitespace-nowrap text-neutral-600 hover:text-neutral-900"
          >
            Trade Counter
          </button>
          <span className="text-neutral-300" aria-hidden>·</span>
          <Link
            href="/apps"
            className="whitespace-nowrap text-neutral-600 hover:text-neutral-900"
          >
            Trade Apps
          </Link>
        </nav>
      </div>

      {/* Inline composer — Facebook's "What's on your mind?" pattern
          pinned to the top of the feed. Collapsed = 1-tap surface;
          expanded = textarea + image/video attach + post button. */}
      <YardInlineComposer />
      {posts.map((post) => {
        const poster = posters[post.listing_id];
        if (!poster) return null;
        return (
          <div key={post.id} id={`thread-${post.id}`}>
            <ThreadCard
              post={post}
              poster={poster}
              reactions={reactions[post.id] ?? {}}
              inCircle={circleSet.has(post.listing_id)}
              focused={post.id === focusedId}
              onFocus={() => onFocus(post.id)}
              onOpenInfo={onOpenInfo}
            />
          </div>
        );
      })}
    </div>
  );
}

function ThreadCard({
  post,
  poster,
  reactions,
  inCircle,
  focused,
  onFocus,
  onOpenInfo
}: {
  post: HammerexTradeOffYardPost;
  poster: YardPoster;
  reactions: ReactionCounts;
  inCircle: boolean;
  focused: boolean;
  onFocus: () => void;
  onOpenInfo: () => void;
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const name = poster.trading_name?.trim() || poster.display_name;
  const firstName = poster.display_name.split(/\s+/)[0] ?? name;
  const tradeText = tradeLabel(post.trade_slug);
  const waUrl = buildYardWhatsappUrl({
    whatsapp: poster.whatsapp,
    posterName: firstName,
    postTitle: `[Chat] ${post.title}`
  });
  return (
    <section
      onClick={onFocus}
      className={
        "overflow-hidden rounded-2xl border bg-white transition " +
        (focused ? "ring-2 ring-offset-2" : "")
      }
      style={{
        borderColor: CARD_BORDER,
        ...(focused ? { boxShadow: `0 0 0 2px ${BRAND}` } : {})
      }}
    >
      {/* Card header — poster identity + call/video/info controls.
          NOT sticky — flows with the feed like Facebook post headers. */}
      <header
        className="flex items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: CARD_BORDER }}
      >
        <Avatar name={name} url={poster.avatar_url ?? null} size={40} />
        <div className="min-w-0 flex-1">
          <a
            href={`/${poster.slug}`}
            className="block truncate text-[14px] font-extrabold text-neutral-900 hover:underline"
          >
            {name}
          </a>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "#0F7A3F" }}
              aria-hidden="true"
            />
            {tradeText}
            {post.region ? ` · ${post.region}` : ""}
            {" · "}
            {timeAgoShort(post.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-50"
            aria-label="Call on WhatsApp"
          >
            <Phone size={16} aria-hidden="true" />
          </a>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="hidden h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-50 md:inline-flex"
            aria-label="Video via WhatsApp"
          >
            <Video size={16} aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFocus();
              onOpenInfo();
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-50 lg:hidden"
            aria-label="Post details"
          >
            <Info size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOptionsOpen(true);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-50"
            aria-label="Post options"
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Post options bottom sheet — Facebook's ⋯ menu pattern.
          Renders inside the card so each post has its own sheet
          state. Backdrop click / grabber swipe closes. */}
      <PostOptionsSheet
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        post={post}
        poster={poster}
      />

      {/* Post body — amber topic bubble + optional images */}
      <div className="px-4 py-4">
        <TopicBubble post={post} poster={poster} inCircle={inCircle} />

        <MediaGrid
          images={post.image_urls ?? []}
          videos={post.video_urls ?? []}
        />
      </div>

      {/* Reactions + status pill row. ReactionPicker layers a
          Facebook-style 6-emoji long-press picker on top of the
          standard thumbs-up/down bar. */}
      <div
        className="flex items-center justify-between gap-3 border-t px-4 py-2"
        style={{ borderColor: CARD_BORDER }}
        onClick={(e) => e.stopPropagation()}
      >
        <ReactionPicker
          postId={post.id}
          fallbackCounts={reactions}
        />
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide"
          style={{
            background: `${BRAND}20`,
            color: "#7A5300"
          }}
        >
          {kindBadge(post.kind)}
        </span>
      </div>

      {/* Comments panel — collapsed by default, expand-in-place */}
      <div
        className="border-t px-4 py-3"
        style={{ borderColor: CARD_BORDER }}
        onClick={(e) => e.stopPropagation()}
      >
        <YardCommentsPanel
          postId={post.id}
          initialCount={post.comment_count ?? 0}
        />
      </div>

      {/* Reply bar — WhatsApp CTA (mimics Facebook's "Write a comment"
          strip; primary reply mode for The Yard is WhatsApp handoff). */}
      <footer
        className="flex items-center gap-2 border-t bg-neutral-50 px-4 py-3"
        style={{ borderColor: CARD_BORDER }}
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center rounded-full border bg-white px-4 text-[13px] font-medium text-neutral-500 hover:bg-neutral-50"
          style={{ borderColor: CARD_BORDER, height: 40 }}
        >
          Reply to {firstName} on WhatsApp…
        </a>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-900 transition active:scale-[0.97]"
          style={{
            background: BRAND,
            boxShadow: `0 4px 14px ${BRAND}55`
          }}
          aria-label="Send WhatsApp"
        >
          <Send size={16} aria-hidden="true" />
        </a>
      </footer>
    </section>
  );
}

// Read explicit mood from post.metadata.mood (jsonb) OR fall back
// to the keyword heuristic on the post body. Every post gets a
// character. Shared with the composer for live suggestions.
function moodFor(post: HammerexTradeOffYardPost): {
  mood: MoodDef;
  isExplicit: boolean;
} {
  const explicit = readMoodFrom(post.metadata);
  if (explicit) return { mood: MOOD_LIBRARY[explicit], isExplicit: true };
  const auto = suggestMood(`${post.title ?? ""} ${post.body ?? ""}`);
  return { mood: MOOD_LIBRARY[auto], isExplicit: false };
}

function TopicBubble({
  post,
  poster,
  inCircle
}: {
  post: HammerexTradeOffYardPost;
  poster: YardPoster;
  inCircle: boolean;
}) {
  // Poster avatar lives in the CARD HEADER above — no need to
  // duplicate it here. The mood character is now the visual anchor
  // for every post (explicit if the poster picked one; keyword-
  // heuristic otherwise). Same layout every time = predictable.
  const { mood, isExplicit } = moodFor(post);

  return (
    <article>
      {(inCircle || isExplicit) && (
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
          {inCircle && (
            <span className="font-bold" style={{ color: BRAND_HOVER }}>
              Your Circle
            </span>
          )}
          {inCircle && isExplicit && <span aria-hidden="true">·</span>}
          {isExplicit && (
            <span className="font-bold" style={{ color: BRAND_HOVER }}>
              Feeling: {mood.label}
            </span>
          )}
        </p>
      )}
      {/* Character on LEFT, bubble on RIGHT. `object-left` pins the
          character's leftmost pixel to the LEFT edge of the img
          container — so the silhouette hugs the card's left edge,
          not floats in the middle. The transparent RIGHT side of
          the PNG then falls behind the bubble via a wide negative
          margin (-mr-10 = ~40px overlap), so any remaining
          transparent gap between the character and the bubble is
          hidden under the bubble itself. */}
      <div className="relative flex items-stretch gap-0">
        <div className="relative z-10 -mr-10 w-[36%] shrink-0 sm:w-[30%]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mood.url}
            alt={mood.alt}
            className="h-full w-full object-contain object-left"
            style={{ maxHeight: 220, minHeight: 140 }}
          />
        </div>
        <div
          className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border p-3 pl-12"
          style={{
            background: "#F7F1E1",
            borderColor: CARD_BORDER
          }}
        >
          <h2 className="text-[15px] font-black leading-snug text-neutral-900">
            {post.title}
          </h2>
          {post.body && (
            <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-[1.5] text-neutral-800">
              {post.body}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function EmptyThread({ onBack }: { onBack: () => void }) {
  return (
    <div
      className="flex h-[calc(100vh-14rem)] flex-col items-center justify-center gap-3 rounded-2xl border bg-white p-8 text-center"
      style={{ borderColor: CARD_BORDER }}
    >
      <button
        type="button"
        onClick={onBack}
        className="md:hidden inline-flex items-center gap-1.5 text-[13px] font-bold text-neutral-500"
      >
        <ChevronLeft size={14} aria-hidden="true" />
        Back
      </button>
      <MessageCircle size={32} className="text-neutral-300" aria-hidden="true" />
      <p className="text-[14px] font-bold text-neutral-700">
        Pick a thread to open it
      </p>
      <p className="text-[13px] text-neutral-500">
        Every UK member you see here is a paying member of The Network.
      </p>
    </div>
  );
}

// ─── RIGHT: POSTER + POST SUMMARY ──────────────────────────────────

function RightPanel({
  post,
  poster
}: {
  post: HammerexTradeOffYardPost;
  poster: YardPoster;
}) {
  return (
    <div className="space-y-3">
      <PosterCard poster={poster} />
      <ActionList slug={poster.slug} postId={post.id} />
      <PostSummaryCard post={post} />
    </div>
  );
}

function DefaultRightPanel({
  posts,
  posters,
  onSelect
}: {
  posts: HammerexTradeOffYardPost[];
  posters: Record<string, YardPoster>;
  onSelect: (id: string) => void;
}) {
  // Top 3 by comment_count. Ties broken by created_at (freshest wins).
  const trending = useMemo(() => {
    return [...posts]
      .filter((p) => (p.comment_count ?? 0) > 0)
      .sort((a, b) => {
        const c = (b.comment_count ?? 0) - (a.comment_count ?? 0);
        if (c !== 0) return c;
        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      })
      .slice(0, 3);
  }, [posts]);

  const newTodayCount = useMemo(() => {
    const day = Date.now() - 24 * 60 * 60 * 1000;
    return posts.filter((p) => new Date(p.created_at).getTime() >= day).length;
  }, [posts]);

  return (
    <div className="space-y-3">
      <div
        className="rounded-2xl border p-4"
        style={{ borderColor: CARD_BORDER, background: `${BRAND}0F` }}
      >
        <p
          className="text-[10px] font-black uppercase tracking-[0.18em]"
          style={{ color: "#7A5300" }}
        >
          Welcome
        </p>
        <h2 className="mt-1 text-[16px] font-black leading-tight text-neutral-900">
          The Yard
        </h2>
        <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-700">
          The public trades-to-trades board. Post work, tools, and chat.
          Every post expires in 14 days. Every reply lands in WhatsApp.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-lg bg-white p-2 text-center">
            <dd className="text-[16px] font-black text-neutral-900">
              {posts.length}
            </dd>
            <dt className="mt-0.5 font-bold text-neutral-500">Live</dt>
          </div>
          <div className="rounded-lg bg-white p-2 text-center">
            <dd className="text-[16px] font-black text-neutral-900">
              {newTodayCount}
            </dd>
            <dt className="mt-0.5 font-bold text-neutral-500">Today</dt>
          </div>
        </dl>
      </div>

      {trending.length > 0 && (
        <div
          className="overflow-hidden rounded-2xl border bg-white"
          style={{ borderColor: CARD_BORDER }}
        >
          <div
            className="border-b px-4 py-3"
            style={{ borderColor: CARD_BORDER }}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
              Trending
            </p>
          </div>
          <ul className="divide-y" style={{ borderColor: CARD_BORDER }}>
            {trending.map((p) => {
              const poster = posters[p.listing_id];
              const name =
                poster?.trading_name?.trim() ||
                poster?.display_name ||
                "Member";
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(p.id)}
                    className="flex w-full items-start gap-2 px-4 py-3 text-left transition hover:bg-neutral-50"
                  >
                    <Avatar
                      name={name}
                      url={poster?.avatar_url ?? null}
                      size={28}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[12px] font-bold leading-tight text-neutral-800">
                        {p.title}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-neutral-500">
                        {p.comment_count} replies · {timeAgoShort(p.created_at)}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function PosterCard({ poster }: { poster: YardPoster }) {
  const name = poster.trading_name?.trim() || poster.display_name;
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border bg-white p-4"
      style={{ borderColor: CARD_BORDER }}
    >
      <Avatar name={name} url={poster.avatar_url ?? null} size={48} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-extrabold text-neutral-900">
          {name}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "#0F7A3F" }}
            aria-hidden="true"
          />
          Online
        </p>
      </div>
    </div>
  );
}

function ActionList({ slug, postId }: { slug: string; postId: string }) {
  const actions = [
    { label: "View profile", icon: User, href: `/${slug}` },
    { label: "See listings", icon: Package, href: `/${slug}#services` },
    { label: "Shared files", icon: ImageIcon, href: `#post-${postId}-files` },
    { label: "Gallery", icon: ImageIcon, href: `/${slug}#gallery` },
    { label: "Mute notifications", icon: Bell, href: "#" },
    { label: "Block user", icon: Shield, href: "#" }
  ];
  return (
    <div
      className="overflow-hidden rounded-2xl border bg-white"
      style={{ borderColor: CARD_BORDER }}
    >
      {actions.map((a, i) => {
        const Icon = a.icon;
        return (
          <a
            key={a.label}
            href={a.href}
            className={
              "flex items-center gap-3 px-4 py-3 text-[13px] font-medium text-neutral-800 transition hover:bg-neutral-50 " +
              (i < actions.length - 1 ? "border-b" : "")
            }
            style={i < actions.length - 1 ? { borderColor: CARD_BORDER } : undefined}
          >
            <Icon size={16} className="text-neutral-500" aria-hidden="true" />
            {a.label}
          </a>
        );
      })}
      <a
        href="#report"
        className="flex items-center gap-3 border-t px-4 py-3 text-[13px] font-medium transition hover:bg-neutral-50"
        style={{ borderColor: CARD_BORDER, color: "#B91C1C" }}
      >
        <Flag size={16} aria-hidden="true" />
        Report user
      </a>
    </div>
  );
}

function PostSummaryCard({ post }: { post: HammerexTradeOffYardPost }) {
  const priceGbp = post.day_rate_pence
    ? `£${(post.day_rate_pence / 100).toFixed(0)}`
    : post.product_price_pence
      ? `£${(post.product_price_pence / 100).toFixed(0)}`
      : null;
  const hero = post.image_urls?.[0] ?? null;
  return (
    <div
      className="overflow-hidden rounded-2xl border bg-white"
      style={{ borderColor: CARD_BORDER }}
    >
      <div
        className="border-b px-4 py-3"
        style={{ borderColor: CARD_BORDER }}
      >
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-500">
          Post summary
        </p>
      </div>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero}
              alt=""
              className="h-14 w-14 shrink-0 rounded-lg object-contain"
              style={{ background: BG }}
            />
          ) : (
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg"
              style={{ background: BG }}
            >
              <MessageCircle size={22} className="text-neutral-400" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-extrabold text-neutral-900">
              {post.title}
            </p>
            {priceGbp && (
              <p className="mt-0.5 text-[13px] font-bold text-neutral-800">
                {priceGbp}
              </p>
            )}
          </div>
        </div>
        <dl className="mt-4 space-y-2 text-[12px]">
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">Status</dt>
            <dd>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wide"
                style={{
                  background: `${BRAND}20`,
                  color: "#7A5300"
                }}
              >
                {kindBadge(post.kind)}
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">Days left</dt>
            <dd className="font-bold text-neutral-800">
              {daysRemaining(post.expires_at)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">Contacted</dt>
            <dd className="font-bold text-neutral-800">
              {post.contact_count}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">Last activity</dt>
            <dd className="font-bold text-neutral-800">
              {timeAgoShort(post.created_at)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

// ─── MOBILE RIGHT-COLUMN SHEET ─────────────────────────────────────

function MobileRightSheet({
  post,
  poster,
  onClose
}: {
  post: HammerexTradeOffYardPost;
  poster: YardPoster;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/40 lg:hidden"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-black uppercase tracking-wide text-neutral-500">
            Post details
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-3 pb-4">
          <PosterCard poster={poster} />
          <ActionList slug={poster.slug} postId={post.id} />
          <PostSummaryCard post={post} />
        </div>
      </div>
    </div>
  );
}

// ─── SHARED PRIMITIVES ─────────────────────────────────────────────

function Avatar({
  name,
  url,
  size
}: {
  name: string;
  url: string | null;
  size: number;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-contain shrink-0"
        style={{
          background: BG,
          width: size,
          height: size
        }}
      />
    );
  }
  const initial = name.charAt(0).toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-black text-neutral-900"
      style={{
        background: BRAND,
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4)
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

// ─── MEDIA GRID (adaptive 1/2/3/4+) ────────────────────────────────
// Facebook-style adaptive media layout. Combines images + videos in
// one grid so a post with 1 video + 2 images renders as 3 tiles.
//
//   1 item  → full-width, natural aspect
//   2 items → 50/50 side-by-side, aspect-square
//   3 items → 1 big hero left + 2 stacked right
//   4+      → 2×2 grid, last tile shows "+N more" overlay
//
// Video ALWAYS gets IntersectionObserver autoplay-muted (TikTok / IG /
// FB Reels pattern). User taps to unmute.

type MediaItem = { kind: "image" | "video"; url: string };

function MediaGrid({
  images,
  videos
}: {
  images: string[];
  videos: string[];
}) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const items: MediaItem[] = useMemo(
    () => [
      ...videos.map((url) => ({ kind: "video" as const, url })),
      ...images.map((url) => ({ kind: "image" as const, url }))
    ],
    [images, videos]
  );

  if (items.length === 0) return null;

  const openLightbox = (idx: number) => {
    if (items[idx].kind === "image") setLightboxIdx(idx);
  };
  const closeLightbox = () => setLightboxIdx(null);
  const nav = (dir: 1 | -1) => {
    if (lightboxIdx === null) return;
    let i = lightboxIdx + dir;
    while (i >= 0 && i < items.length && items[i].kind !== "image") i += dir;
    if (i >= 0 && i < items.length) setLightboxIdx(i);
  };

  return (
    <>
      <div className="mt-3">
        {items.length === 1 && <SingleMediaTile item={items[0]} onClick={() => openLightbox(0)} />}
        {items.length === 2 && (
          <div className="grid grid-cols-2 gap-2">
            {items.map((it, i) => (
              <MediaTile key={it.url} item={it} onClick={() => openLightbox(i)} aspect="square" />
            ))}
          </div>
        )}
        {items.length === 3 && (
          <div className="grid grid-cols-2 gap-2">
            <MediaTile item={items[0]} onClick={() => openLightbox(0)} aspect="full-height" />
            <div className="grid grid-rows-2 gap-2">
              <MediaTile item={items[1]} onClick={() => openLightbox(1)} aspect="fill" />
              <MediaTile item={items[2]} onClick={() => openLightbox(2)} aspect="fill" />
            </div>
          </div>
        )}
        {items.length >= 4 && (
          <div className="grid grid-cols-2 gap-2">
            {items.slice(0, 4).map((it, i) => {
              const overflow = i === 3 && items.length > 4;
              return (
                <div key={it.url} className="relative">
                  <MediaTile item={it} onClick={() => openLightbox(i)} aspect="square" />
                  {overflow && (
                    <button
                      type="button"
                      onClick={() => openLightbox(3)}
                      className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/60 text-[24px] font-black text-white backdrop-blur-sm"
                    >
                      +{items.length - 4}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {lightboxIdx !== null && items[lightboxIdx].kind === "image" && (
        <Lightbox
          items={items}
          index={lightboxIdx}
          onClose={closeLightbox}
          onPrev={() => nav(-1)}
          onNext={() => nav(1)}
        />
      )}
    </>
  );
}

function SingleMediaTile({
  item,
  onClick
}: {
  item: MediaItem;
  onClick: () => void;
}) {
  if (item.kind === "video") return <AutoplayVideo url={item.url} full />;
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full overflow-hidden rounded-lg transition hover:brightness-95"
      style={{ background: BG }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.url}
        alt=""
        className="mx-auto max-h-[520px] w-full object-contain"
      />
    </button>
  );
}

function MediaTile({
  item,
  onClick,
  aspect
}: {
  item: MediaItem;
  onClick: () => void;
  aspect: "square" | "full-height" | "fill";
}) {
  const cls =
    aspect === "square"
      ? "aspect-square w-full"
      : aspect === "full-height"
        ? "h-full min-h-[240px] w-full"
        : "h-full w-full";
  if (item.kind === "video") return <AutoplayVideo url={item.url} className={cls} />;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`overflow-hidden rounded-lg transition hover:brightness-95 ${cls}`}
      style={{ background: BG }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.url}
        alt=""
        className="h-full w-full object-contain"
      />
    </button>
  );
}

// ─── AUTOPLAY-ON-SCROLL VIDEO ──────────────────────────────────────

function AutoplayVideo({
  url,
  full = false,
  className
}: {
  url: string;
  full?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            el.play().catch(() => {
              // Autoplay refused — user hasn't interacted yet. No-op.
            });
          } else {
            el.pause();
          }
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const wrapperCls = full
    ? "relative w-full overflow-hidden rounded-lg bg-black"
    : `relative overflow-hidden rounded-lg bg-black ${className ?? ""}`;

  return (
    <div className={wrapperCls}>
      <video
        ref={ref}
        src={url}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        className={
          full
            ? "aspect-video w-full object-contain"
            : "h-full w-full object-contain"
        }
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMuted((m) => !m);
        }}
        className="absolute bottom-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ─── LIGHTBOX ──────────────────────────────────────────────────────
// Fullscreen image viewer with keyboard nav (Esc / Arrows) + touch
// swipe. Renders a portal-like fixed overlay. Only shows images —
// videos stay in the feed with the autoplay behaviour intact.

function Lightbox({
  items,
  index,
  onClose,
  onPrev,
  onNext
}: {
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, onPrev, onNext]);

  const current = items[index];
  if (current?.kind !== "image") return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        aria-label="Close"
      >
        <X size={18} aria-hidden="true" />
      </button>
      {items.filter((i) => i.kind === "image").length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Previous"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Next"
          >
            <ChevronLeft
              size={22}
              className="rotate-180"
              aria-hidden="true"
            />
          </button>
        </>
      )}
      <img
        src={current.url}
        alt=""
        className="max-h-[92vh] max-w-[92vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ─── REACTION PICKER ───────────────────────────────────────────────
// Facebook-style long-press reaction picker. Default state = standard
// thumbs-up + thumbs-down (falls back to the existing YardReactionBar
// so the wired API keeps working). Long-press or hover-hold on the
// primary Like button reveals a floating 6-icon strip that scales-up
// on hover. Pick one → picker collapses + fires the chosen kind.
//
// Icons only (Lucide). Colour stays on-brand via currentColor.

// Six reaction kinds — matches the existing API schema
// (like, strong, lol, fire, wow, dislike). Icons chosen to fit trade
// context: Strong=Heart (endorsement), Fire=hot take, Wow=lightbulb.
const REACTION_OPTIONS: Array<{
  id: "like" | "strong" | "lol" | "fire" | "wow" | "dislike";
  label: string;
  Icon: typeof ThumbsUp;
  tint: string;
}> = [
  { id: "like", label: "Like", Icon: ThumbsUp, tint: "#2563EB" },
  { id: "strong", label: "Strong", Icon: Heart, tint: "#DC2626" },
  { id: "lol", label: "Haha", Icon: Laugh, tint: "#F59E0B" },
  { id: "fire", label: "Fire", Icon: Flame, tint: "#EA580C" },
  { id: "wow", label: "Wow", Icon: Angry, tint: "#6366F1" },
  { id: "dislike", label: "Nah", Icon: Frown, tint: "#525252" }
];

function ReactionPicker({
  postId,
  fallbackCounts
}: {
  postId: string;
  fallbackCounts: ReactionCounts;
}) {
  type ReactionKind = (typeof REACTION_OPTIONS)[number]["id"];
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<null | ReactionKind>(null);
  const [counts, setCounts] = useState<ReactionCounts>(fallbackCounts);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on outside tap
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent | TouchEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  function startHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => setOpen(true), 400);
  }
  function cancelHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  async function pick(id: ReactionKind) {
    if (busy) return;
    setOpen(false);
    setError(null);

    // Optimistic update — swap the local pick + counts immediately.
    const previous = picked;
    const wasActive = picked === id;
    const next = wasActive ? null : id;

    setCounts((prev) => {
      const copy: ReactionCounts = { ...prev };
      if (previous) copy[previous] = Math.max(0, (copy[previous] ?? 0) - 1);
      if (next) copy[next] = (copy[next] ?? 0) + 1;
      return copy;
    });
    setPicked(next);

    // Auth via magic-link URL params (same pattern as YardReactionBar).
    // If missing, we render the pick locally so the demo feels alive
    // but note that non-authed viewers can't persist.
    const sp = new URLSearchParams(window.location.search);
    const slug = sp.get("slug") ?? "";
    const token = sp.get("token") ?? "";
    if (!slug || !token) {
      // Non-authed — leave optimistic pick in place. No persistence.
      return;
    }

    setBusy(true);
    try {
      const method = next ? "POST" : "DELETE";
      const body = next ? { slug, token, kind: next } : { slug, token };
      const res = await fetch(
        `/api/trade-off/yard/posts/${encodeURIComponent(postId)}/reactions`,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }
      );
      if (!res.ok) {
        // Rollback
        setCounts((prev) => {
          const copy: ReactionCounts = { ...prev };
          if (next) copy[next] = Math.max(0, (copy[next] ?? 0) - 1);
          if (previous) copy[previous] = (copy[previous] ?? 0) + 1;
          return copy;
        });
        setPicked(previous);
        const txt = await res.text();
        setError(`Couldn't save (${res.status}): ${txt.slice(0, 60)}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  const activeOption = picked
    ? REACTION_OPTIONS.find((r) => r.id === picked)
    : null;
  const likeCount = counts.like ?? 0;
  const totalCount = REACTION_OPTIONS.reduce(
    (sum, opt) => sum + (counts[opt.id] ?? 0),
    0
  );

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      {/* Primary reaction button. Tap = quick like. Long-press = picker. */}
      <button
        type="button"
        onClick={() => pick(picked ?? "like")}
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-extrabold transition hover:bg-neutral-50"
        style={{
          borderColor: activeOption ? activeOption.tint : CARD_BORDER,
          color: activeOption ? activeOption.tint : "#374151"
        }}
        aria-label={activeOption ? `You reacted ${activeOption.label}` : "React (hold for more)"}
      >
        {activeOption ? (
          <activeOption.Icon size={14} aria-hidden="true" />
        ) : (
          <ThumbsUp size={14} aria-hidden="true" />
        )}
        <span>{activeOption?.label ?? "Like"}</span>
        {likeCount > 0 && !activeOption && (
          <span className="ml-1 rounded-full bg-neutral-100 px-1.5 text-[10px] font-black text-neutral-700">
            {likeCount}
          </span>
        )}
      </button>

      {totalCount > 0 && (
        <span className="text-[11px] font-medium text-neutral-500">
          {totalCount} reaction{totalCount === 1 ? "" : "s"}
        </span>
      )}

      {/* Floating picker — Facebook's classic "6-emoji strip pops
          above the like button" pattern. Animates in with scale +
          fade. Each icon scales-up 1.3x on hover so the target
          feels alive. */}
      {open && (
        <div
          className="absolute bottom-full left-0 mb-2 flex items-center gap-1 rounded-full border bg-white px-2 py-1.5 shadow-xl"
          style={{
            borderColor: CARD_BORDER,
            animation: "reactionPickerIn 180ms cubic-bezier(0.2, 0.9, 0.3, 1.3)"
          }}
        >
          {REACTION_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => pick(opt.id)}
              className="group inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:scale-[1.3]"
              style={{ color: opt.tint }}
              aria-label={opt.label}
              title={opt.label}
            >
              <opt.Icon size={20} aria-hidden="true" />
            </button>
          ))}
          <style>{`
            @keyframes reactionPickerIn {
              from { opacity: 0; transform: translateY(6px) scale(0.85); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

// ─── POST OPTIONS BOTTOM SHEET ─────────────────────────────────────
// Facebook's ⋯ menu pattern: half-height sheet on mobile, centered
// modal on desktop. 5 actions — Save, Copy link, Follow poster,
// Report, Hide. Each closes the sheet after firing.

// LocalStorage keys — device-scoped state for Save / Follow / Hide.
// Not synced across devices (MVP). Backend sync is a later slice.
const LS_SAVED = "yard.savedPosts";
const LS_FOLLOWING = "yard.followingListings";
const LS_HIDDEN = "yard.hiddenPosts";

function readSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // Storage may be blocked (private mode). Silent fail — the toggle
    // still updates the local state so the user sees feedback this session.
  }
}

function toggleInSet(key: string, id: string): boolean {
  const set = readSet(key);
  const wasIn = set.has(id);
  if (wasIn) set.delete(id);
  else set.add(id);
  writeSet(key, set);
  return !wasIn;
}

function PostOptionsSheet({
  open,
  onClose,
  post,
  poster
}: {
  open: boolean;
  onClose: () => void;
  post: HammerexTradeOffYardPost;
  poster: YardPoster;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reported, setReported] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Sync from localStorage when the sheet opens.
  useEffect(() => {
    if (!open) return;
    setSaved(readSet(LS_SAVED).has(post.id));
    setFollowing(readSet(LS_FOLLOWING).has(poster.slug));
    setHidden(readSet(LS_HIDDEN).has(post.id));
  }, [open, post.id, poster.slug]);

  function flashToast(msg: string) {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
      onClose();
    }, 900);
  }

  async function handleCopy() {
    const url = `${window.location.origin}/trade-off/yard/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      flashToast("Link copied");
    } catch {
      flashToast("Copy failed");
    }
  }

  function handleSave() {
    const isSaved = toggleInSet(LS_SAVED, post.id);
    setSaved(isSaved);
    flashToast(isSaved ? "Saved" : "Removed from saved");
  }

  function handleFollow() {
    const isFollowing = toggleInSet(LS_FOLLOWING, poster.slug);
    setFollowing(isFollowing);
    flashToast(isFollowing ? `Following ${poster.trading_name?.trim() || poster.display_name}` : "Unfollowed");
  }

  function handleHide() {
    toggleInSet(LS_HIDDEN, post.id);
    setHidden(true);
    // Trigger a page reload so the hidden post drops out of the feed.
    // Cheap MVP — proper solution is to lift hidden-set into shell state.
    flashToast("Hidden");
    setTimeout(() => window.location.reload(), 500);
  }

  async function handleReport() {
    if (reporting || reported) return;
    setReporting(true);
    const sp = new URLSearchParams(window.location.search);
    const slug = sp.get("slug") ?? "";
    const token = sp.get("token") ?? "";
    if (!slug || !token) {
      setReporting(false);
      flashToast("Sign in to report");
      return;
    }
    try {
      const res = await fetch(`/api/trade-off/yard/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: post.id,
          slug,
          token,
          reason: "Reported from post options menu"
        })
      });
      if (res.ok) {
        setReported(true);
        flashToast("Reported to moderators");
      } else {
        const txt = await res.text();
        flashToast(`Report failed (${res.status})`);
        console.warn("Report failed:", txt);
      }
    } catch {
      flashToast("Network error");
    } finally {
      setReporting(false);
    }
  }

  const posterName = poster.trading_name?.trim() || poster.display_name;

  const items: Array<{
    label: string;
    hint?: string;
    icon: typeof Bookmark;
    onClick: () => void;
    danger?: boolean;
    active?: boolean;
  }> = [
    {
      label: saved ? "Saved" : "Save post",
      hint: saved ? "Tap to remove from saved" : "Read later in your saved list",
      icon: Bookmark,
      onClick: handleSave,
      active: saved
    },
    {
      label: copied ? "Link copied" : "Copy link",
      hint: "Share this thread",
      icon: LinkIcon,
      onClick: handleCopy
    },
    {
      label: following ? `Following ${posterName}` : `Follow ${posterName}`,
      hint: following ? "Tap to unfollow" : "See their posts higher in your feed",
      icon: UserPlus,
      onClick: handleFollow,
      active: following
    },
    {
      label: hidden ? "Hidden" : "Hide this post",
      hint: "You won't see it again",
      icon: EyeOff,
      onClick: handleHide,
      active: hidden
    },
    {
      label: reported ? "Reported" : reporting ? "Reporting…" : "Report post",
      hint: reported ? "Sent to moderators" : "Send to moderators",
      icon: Flag,
      onClick: handleReport,
      danger: true,
      active: reported
    }
  ];

  return (
    <BottomSheet open={open} onClose={onClose} title="Post options">
      {toast && (
        <div
          className="mx-4 mb-2 rounded-lg px-3 py-2 text-center text-[13px] font-bold text-neutral-900"
          style={{ background: `${BRAND}22` }}
        >
          {toast}
        </div>
      )}
      <ul className="divide-y" style={{ borderColor: CARD_BORDER }}>
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.label}>
              <button
                type="button"
                onClick={it.onClick}
                className={
                  "flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-neutral-50 " +
                  (it.danger ? "text-red-700" : "text-neutral-800")
                }
              >
                <Icon
                  size={18}
                  className={
                    it.danger
                      ? "text-red-500"
                      : it.active
                        ? ""
                        : "text-neutral-500"
                  }
                  style={
                    it.active && !it.danger
                      ? { color: BRAND_HOVER }
                      : undefined
                  }
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className="block text-[14px] font-bold"
                    style={
                      it.active && !it.danger
                        ? { color: BRAND_HOVER }
                        : undefined
                    }
                  >
                    {it.label}
                  </span>
                  {it.hint && (
                    <span className="mt-0.5 block text-[12px] font-medium text-neutral-500">
                      {it.hint}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}

function kindBadge(kind: string): string {
  switch (kind) {
    case "chat":
      return "In conversation";
    case "needed":
      return "Hiring";
    case "available":
      return "Available";
    case "product":
      return "For sale";
    case "beacon":
      return "Beacon";
    default:
      return kind;
  }
}

export default YardInboxShell;
