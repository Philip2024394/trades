// Persistent notifications bell — top-right on every page. Facebook /
// Instagram / LinkedIn pattern: unread count badge on the bell, drawer
// opens with a scrollable list of notifications, tap-through to source.

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  UserPlus,
  MessageSquare,
  ShoppingBag,
  Star,
  Newspaper,
  Info
} from "lucide-react";
import {
  type NotificationKind
} from "../data/socialGraph";
import { useNotifications } from "@/lib/notifications/useNotifications";

function iconForKind(kind: NotificationKind | string) {
  // OS event-bus kinds first (real notifications from the Notebook flow).
  if (kind.startsWith("notebook.quote_request")) return ShoppingBag;
  if (kind.startsWith("notebook.basket"))         return ShoppingBag;
  if (kind.startsWith("notebook.site_project"))   return Newspaper;
  // Legacy fixture kinds.
  switch (kind) {
    case "follow":       return UserPlus;
    case "message":      return MessageSquare;
    case "order":        return ShoppingBag;
    case "review":       return Star;
    case "network-post": return Newspaper;
    case "system":       return Info;
  }
  return Info;
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`;
  if (mins < 60 * 24 * 7) return `${Math.floor(mins / (60 * 24))}d`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { notifications, unread, markRead, markAllRead } = useNotifications();

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function markAllSeen() {
    markAllRead();
  }
  // Map server notifications to the display shape.
  const items = notifications.map((n) => ({
    id:             n.id,
    kind:           n.kind,
    headline:       n.title,
    detail:         n.body,
    href:           n.action_url ?? "/tc/hub",
    createdAtIso:   n.created_at,
    seen:           n.read_at !== null,
    actorInitials:  null as string | null
  }));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications ${unread > 0 ? `(${unread} unread)` : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-200/50"
      >
        <Bell size={17}/>
        {unread > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-black shadow-sm"
            style={{ backgroundColor: "#DC2626", color: "#FFFFFF" }}
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-2 w-[360px] max-w-[90vw] overflow-hidden rounded-xl border bg-white shadow-xl"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
          role="dialog"
          aria-label="Notifications"
        >
          <header className="flex items-center justify-between border-b p-3" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Notifications
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllSeen}
                className="text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
              >
                Mark all read
              </button>
            )}
          </header>

          <ul className="max-h-[480px] overflow-y-auto">
            {items.length === 0 && (
              <li className="p-6 text-center text-[11px] text-neutral-500">
                Nothing new. Come back later.
              </li>
            )}
            {items.map((n) => {
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
                    {n.actorInitials ? (
                      <span
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-black"
                        style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
                        aria-hidden
                      >
                        {n.actorInitials}
                      </span>
                    ) : (
                      <span
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: "#F5F0E4", color: "#525252" }}
                        aria-hidden
                      >
                        <Icon size={14}/>
                      </span>
                    )}
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

          <footer className="border-t p-3 text-center" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <Link
              href="/tc/hub"
              onClick={() => setOpen(false)}
              className="text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
            >
              Open Hub
            </Link>
          </footer>
        </div>
      )}
    </div>
  );
}
