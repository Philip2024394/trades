// UnifiedInboxBell — single header entry for both Messages and
// Notifications. Panel opens with two sections stacked:
//
//   1. Messages    (top)    — unread threads with preview + merchant
//   2. Notifications (below) — the existing notification stream
//
// Each section has its own "See all" link. The bell's red badge shows
// the combined unread count. Replaces the previous standalone Messages
// icon + NotificationBell in the header — one entry point, less chrome.

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  MessageCircle,
  UserPlus,
  MessageSquare,
  ShoppingBag,
  Star,
  Newspaper,
  Info,
  ArrowRight,
  X
} from "lucide-react";
import { useNotifications } from "@/lib/notifications/useNotifications";
import { MESSAGE_THREAD_FIXTURES } from "@/apps/messages/data/threads";
import { type NotificationKind } from "@/apps/social/data/socialGraph";

function iconForKind(kind: NotificationKind | string) {
  if (kind.startsWith("notebook.quote_request")) return ShoppingBag;
  if (kind.startsWith("notebook.basket"))         return ShoppingBag;
  if (kind.startsWith("notebook.site_project"))   return Newspaper;
  switch (kind) {
    case "follow":       return UserPlus;
    case "message":      return MessageSquare;
    case "order-status": return ShoppingBag;
    case "review":       return Star;
    default:             return Info;
  }
}

function timeAgo(iso: string): string {
  const secs = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

export function UnifiedInboxBell() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { notifications, unread: unreadNotifications, markRead, markAllRead } = useNotifications();

  // Messages preview — top 4 unread threads from the fixture set.
  // When real message threads land server-side this pulls from
  // /api/apps/messages/threads instead.
  const unreadThreads = MESSAGE_THREAD_FIXTURES
    .filter((t) => t.unreadCountForViewer > 0)
    .slice(0, 4);
  const totalUnreadMessages = MESSAGE_THREAD_FIXTURES.reduce(
    (n, t) => n + t.unreadCountForViewer,
    0
  );
  const totalUnread = unreadNotifications + totalUnreadMessages;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const notificationItems = notifications.slice(0, 6).map((n) => ({
    id:           n.id,
    kind:         n.kind,
    headline:     n.title,
    detail:       n.body,
    href:         n.action_url ?? "/tc/hub",
    createdAtIso: n.created_at,
    seen:         n.read_at !== null
  }));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Inbox ${totalUnread > 0 ? `(${totalUnread} unread)` : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-200/50"
      >
        <Bell size={17}/>
        {totalUnread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-black shadow-sm"
            style={{ backgroundColor: "#DC2626", color: "#FFFFFF" }}
          >
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-2 w-[380px] max-w-[92vw] overflow-hidden rounded-xl border bg-white shadow-xl"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
          role="dialog"
          aria-label="Inbox"
        >
          <header
            className="flex items-center justify-between gap-2 border-b px-3 py-3"
            style={{ borderColor: "rgba(139,69,19,0.10)" }}
          >
            <div className="text-[13px] font-black text-neutral-900">Inbox</div>
            <div className="flex items-center gap-2">
              {unreadNotifications > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
                >
                  Mark all read
                </button>
              )}
              {/* Yellow close button top-right — one-tap dismiss without
                  clicking outside the panel. */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close inbox"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full shadow-sm transition hover:brightness-105"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                <X size={13} strokeWidth={2.5}/>
              </button>
            </div>
          </header>

          <div className="max-h-[540px] overflow-y-auto">
            {/* ── Section 1: Messages ─────────────────────────────── */}
            <SectionHeader
              icon={<MessageCircle size={11}/>}
              label="New messages"
              count={totalUnreadMessages}
            />
            {unreadThreads.length === 0 ? (
              <div className="px-4 py-3 text-[11px] text-neutral-500">
                No unread messages.
              </div>
            ) : (
              <ul>
                {unreadThreads.map((t) => {
                  const other = t.participants.find((p) => p.kind !== "trade") ?? t.participants[0];
                  return (
                    <li key={t.id} className="border-b" style={{ borderColor: "rgba(139,69,19,0.06)" }}>
                      <Link
                        href={`/tc/messages/${t.id}`}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-3 px-3 py-3 hover:bg-neutral-50"
                      >
                        <span
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-black"
                          style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
                          aria-hidden
                        >
                          {other.initials}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="line-clamp-1 text-[12px] font-black text-neutral-900">
                              {other.name}
                            </div>
                            <div className="flex-shrink-0 text-[9.5px] font-bold uppercase tracking-wider text-neutral-500">
                              {timeAgo(t.lastMessageAtIso)}
                            </div>
                          </div>
                          <div className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-neutral-600">
                            {t.lastMessagePreview}
                          </div>
                          {t.context && (
                            <div className="mt-0.5 line-clamp-1 text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">
                              {t.context.label}
                            </div>
                          )}
                        </div>
                        {t.unreadCountForViewer > 0 && (
                          <span
                            className="mt-1 flex h-4 min-w-[16px] flex-shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-black text-white"
                            style={{ backgroundColor: "#DC2626" }}
                          >
                            {t.unreadCountForViewer}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <SeeAllLink href="/tc/messages" label="See all messages" onNavigate={() => setOpen(false)}/>

            {/* Section divider */}
            <div className="h-2" style={{ backgroundColor: "#FBF6EC" }}/>

            {/* ── Section 2: Notifications ────────────────────────── */}
            <SectionHeader
              icon={<Bell size={11}/>}
              label="Notifications"
              count={unreadNotifications}
            />
            {notificationItems.length === 0 ? (
              <div className="px-4 py-3 text-[11px] text-neutral-500">
                Nothing new. Come back later.
              </div>
            ) : (
              <ul>
                {notificationItems.map((n) => {
                  const Icon = iconForKind(n.kind);
                  return (
                    <li
                      key={n.id}
                      className={`border-b ${n.seen ? "" : "bg-amber-50/50"}`}
                      style={{ borderColor: "rgba(139,69,19,0.06)" }}
                    >
                      <Link
                        href={n.href}
                        onClick={() => {
                          if (!n.seen) markRead(n.id);
                          setOpen(false);
                        }}
                        className="flex items-start gap-3 px-3 py-3 hover:bg-neutral-50"
                      >
                        <span
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: "#F5F0E4", color: "#525252" }}
                          aria-hidden
                        >
                          <Icon size={14}/>
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className={`text-[12px] leading-snug ${n.seen ? "font-bold text-neutral-800" : "font-black text-neutral-900"}`}>
                            {n.headline}
                          </div>
                          {n.detail && (
                            <div className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-neutral-600">
                              {n.detail}
                            </div>
                          )}
                          <div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-wider text-neutral-500">
                            {timeAgo(n.createdAtIso)}
                          </div>
                        </div>
                        {!n.seen && (
                          <span
                            className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: "#DC2626" }}
                            aria-label="Unread"
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <SeeAllLink href="/tc/hub" label="See all notifications" onNavigate={() => setOpen(false)}/>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  icon,
  label,
  count
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-1.5 border-b bg-neutral-50 px-3 py-2" style={{ borderColor: "rgba(139,69,19,0.06)" }}>
      <span className="text-neutral-500">{icon}</span>
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-600">
        {label}
      </div>
      {count > 0 && (
        <span
          className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-black text-white"
          style={{ backgroundColor: "#DC2626" }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function SeeAllLink({
  href,
  label,
  onNavigate
}: {
  href: string;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center justify-between border-b bg-white px-3 py-2 text-[11px] font-black text-neutral-700 hover:bg-neutral-50"
      style={{ borderColor: "rgba(139,69,19,0.06)" }}
    >
      {label}
      <ArrowRight size={12}/>
    </Link>
  );
}
