"use client";

// Full-size live-feed modal. Opens when the user taps any card in the
// panel or the "Open live feed" footer. Feels like a Twitter/Facebook
// live-feed page — bigger cards, more detail, pulsing LIVE header,
// filter chips per event kind, close on backdrop or ESC.
//
// Cream + amber palette to match the landing hero. Never routes away
// on card click — each card has its own "Open" button so users
// commit intentionally.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  X,
  MessageCircle,
  UserPlus,
  Hammer,
  Sparkles,
  Zap,
  ArrowRight,
  MapPin,
  Radio
} from "lucide-react";

export type ActivityEvent = {
  id: string;
  kind:
    | "comment_reply"
    | "contact_received"
    | "lead_matched"
    | "trade_joined"
    | "tier_upgraded"
    | "thread_hot"
    | "project_posted"
    | "system_tip"
    | "quoting"
    | "beacon_fired"
    | "follower_new_post"
    | "follower_gained";
  subject_type: string | null;
  subject_id: string | null;
  summary_text: string;
  action_url: string | null;
  source_display_name: string | null;
  source_trade: string | null;
  source_city: string | null;
  // Optional attached image — used by the detail modal's hero band.
  // Not persisted to the DB yet; mocks populate for design preview,
  // real events will fill this once the write hooks pass it through.
  image_url?: string | null;
  created_at: string;
};

const PALETTE = {
  cream: "#FBF6EC",
  ink: "#1B1A17",
  honey: "#B8860B",
  honeyBright: "#FFB300"
};

const FILTERS: Array<{ id: "all" | ActivityEvent["kind"]; label: string }> = [
  { id: "all", label: "All" },
  { id: "beacon_fired", label: "Beacons" },
  { id: "project_posted", label: "New projects" },
  { id: "thread_hot", label: "Yard threads" },
  { id: "follower_new_post", label: "From follows" },
  { id: "follower_gained", label: "New followers" },
  { id: "trade_joined", label: "New trades" },
  { id: "tier_upgraded", label: "Upgrades" }
];

function kindIcon(kind: ActivityEvent["kind"]) {
  switch (kind) {
    case "comment_reply":
    case "thread_hot":
      return MessageCircle;
    case "trade_joined":
      return UserPlus;
    case "project_posted":
    case "lead_matched":
      return Hammer;
    case "tier_upgraded":
      return Sparkles;
    case "beacon_fired":
      return Radio;
    case "follower_new_post":
    case "follower_gained":
      return UserPlus;
    default:
      return Zap;
  }
}

function kindLabel(kind: ActivityEvent["kind"]): string {
  switch (kind) {
    case "comment_reply":
      return "Comment reply";
    case "contact_received":
      return "New contact";
    case "lead_matched":
      return "Lead matched";
    case "trade_joined":
      return "New trade";
    case "tier_upgraded":
      return "Upgrade";
    case "thread_hot":
      return "Yard thread";
    case "project_posted":
      return "New project";
    case "system_tip":
      return "Tip";
    case "quoting":
      return "Quoting";
    case "beacon_fired":
      return "Beacon";
    case "follower_new_post":
      return "New from follow";
    case "follower_gained":
      return "New follower";
  }
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function ActivityFeedModal({
  events,
  mode,
  onClose
}: {
  events: ActivityEvent[];
  mode: "public" | "personal";
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<"all" | ActivityEvent["kind"]>("all");
  const [tick, setTick] = useState(0);

  // Live tick — re-runs timeAgo every 30s so "just now" fades to "1
  // min ago" without a full refetch. Cheap; state change only.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  useMemo(() => tick, [tick]);

  // Lock body scroll + ESC to close
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const filtered =
    filter === "all" ? events : events.filter((e) => e.kind === filter);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Live activity feed"
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(20,17,10,0.72)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          background: PALETTE.cream,
          borderColor: "rgba(27,26,23,0.10)"
        }}
      >
        {/* Header — LIVE pulse + title + close */}
        <header
          className="flex items-center justify-between border-b px-5 py-3"
          style={{ borderColor: "rgba(27,26,23,0.10)" }}
        >
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="relative inline-flex h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: "#22c55e" }}
            >
              <span
                aria-hidden
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
                style={{ backgroundColor: "#22c55e" }}
              />
            </span>
            <span
              className="text-[11px] font-black uppercase tracking-[0.24em]"
              style={{ color: PALETTE.honey }}
            >
              Live
            </span>
            <span
              className="text-[13px] font-black"
              style={{ color: PALETTE.ink }}
            >
              {mode === "personal" ? "Your day" : "On the site"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:scale-105 active:scale-95"
            style={{ background: PALETTE.honeyBright, color: PALETTE.ink }}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        {/* Filter chips */}
        <div
          className="flex gap-1.5 overflow-x-auto border-b px-4 py-2"
          style={{ borderColor: "rgba(27,26,23,0.08)" }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className="inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[11px] font-black transition"
                style={
                  active
                    ? {
                        background: PALETTE.honeyBright,
                        color: PALETTE.ink,
                        borderColor: PALETTE.honeyBright
                      }
                    : {
                        background: "transparent",
                        color: PALETTE.ink,
                        borderColor: "rgba(27,26,23,0.15)"
                      }
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Live event list — bigger cards, each with its own Open CTA */}
        <ul className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {filtered.length === 0 ? (
            <li
              className="mx-auto max-w-xs py-8 text-center text-[13px]"
              style={{ color: "rgba(27,26,23,0.55)" }}
            >
              No events in this filter yet.
            </li>
          ) : (
            filtered.map((e) => {
              const Icon = kindIcon(e.kind);
              return (
                <li
                  key={e.id}
                  className="mb-2 rounded-2xl border p-3 transition hover:shadow-md"
                  style={{
                    background: "#ffffff",
                    borderColor: "rgba(27,26,23,0.08)"
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm"
                      style={{
                        background: PALETTE.honeyBright,
                        color: PALETTE.ink
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span
                          className="text-[9px] font-black uppercase tracking-[0.18em]"
                          style={{ color: PALETTE.honey }}
                        >
                          {kindLabel(e.kind)}
                        </span>
                        <span
                          className="text-[10px] font-bold"
                          style={{ color: "rgba(27,26,23,0.5)" }}
                        >
                          {timeAgo(e.created_at)}
                        </span>
                      </div>
                      <p
                        className="mt-1 text-[13px] font-bold leading-[1.4]"
                        style={{ color: PALETTE.ink }}
                      >
                        {e.summary_text}
                      </p>
                      {(e.source_city || e.source_trade) && (
                        <p
                          className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold"
                          style={{ color: "rgba(27,26,23,0.55)" }}
                        >
                          {e.source_city && (
                            <>
                              <MapPin className="h-2.5 w-2.5" aria-hidden />
                              {e.source_city}
                            </>
                          )}
                          {e.source_trade && (
                            <span className="capitalize">
                              {e.source_city ? " · " : ""}
                              {e.source_trade.replace(/-/g, " ")}
                            </span>
                          )}
                        </p>
                      )}
                      {e.action_url && (
                        <Link
                          href={e.action_url}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.14em] hover:underline"
                          style={{ color: PALETTE.honey }}
                        >
                          Open in Yard
                          <ArrowRight className="h-3 w-3" aria-hidden />
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>

        {/* Footer — big CTA into the Yard so the modal converts */}
        <div
          className="border-t px-4 py-3"
          style={{ borderColor: "rgba(27,26,23,0.10)" }}
        >
          <Link
            href="/trade-off/yard"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[13px] font-black shadow-md transition active:scale-[0.98]"
            style={{ background: PALETTE.honeyBright, color: PALETTE.ink }}
          >
            {mode === "personal" ? "Open my dashboard" : "Explore The Yard"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
