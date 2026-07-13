"use client";

// Single-event detail popup. Opens when the user taps any card in the
// marquee panel. Renders the full event: icon + kind label, summary,
// image (when provided), source metadata (city, trade), timestamp,
// and one or two action buttons — "View live on the app" (for anything
// with an action_url) and "Complete task" (for system_tip kind).
//
// Cream + amber palette to match the landing hero. ESC + backdrop
// click close.

import { useEffect } from "react";
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
  CheckCircle2,
  Calculator,
  Radio
} from "lucide-react";
import type { ActivityEvent } from "./ActivityFeedModal";

const PALETTE = {
  cream: "#FBF6EC",
  ink: "#1B1A17",
  honey: "#B8860B",
  honeyBright: "#FFB300"
};

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
    case "quoting":
      return Calculator;
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
      return "Task";
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

function longTimeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 60) return "just now";
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const d = Math.floor(diff / 86400);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function ActivityEventDetailModal({
  event,
  onClose
}: {
  event: ActivityEvent;
  onClose: () => void;
}) {
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

  const Icon = kindIcon(event.kind);
  const isTask = event.kind === "system_tip";
  const image = event.image_url ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={kindLabel(event.kind)}
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(20,17,10,0.72)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          background: PALETTE.cream,
          borderColor: "rgba(27,26,23,0.10)"
        }}
      >
        {/* Image band — capped height so the modal always fits inside
            typical mobile viewports. Object-cover so the banner still
            reads as a photo strip. */}
        {image && (
          <div className="relative h-28 w-full bg-[#F7F0E0] sm:h-32">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {/* Kind row */}
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex h-9 w-9 items-center justify-center rounded-full shadow-sm"
              style={{ background: PALETTE.honeyBright, color: PALETTE.ink }}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p
                  className="text-[10px] font-black uppercase tracking-[0.20em]"
                  style={{ color: PALETTE.honey }}
                >
                  {kindLabel(event.kind)}
                </p>
                {event.kind === "quoting" && (
                  <span
                    className="activity-quoting-chip inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-white"
                    style={{ background: "#0F7A3F" }}
                  >
                    Live
                  </span>
                )}
              </div>
              <p
                className="text-[11px] font-bold"
                style={{ color: "rgba(27,26,23,0.55)" }}
              >
                {longTimeAgo(event.created_at)}
              </p>
            </div>
          </div>

          {/* Summary */}
          <h2
            className="mt-4 text-[18px] font-black leading-tight sm:text-[20px]"
            style={{ color: PALETTE.ink }}
          >
            {event.summary_text}
          </h2>

          {/* Meta */}
          {(event.source_city || event.source_trade) && (
            <p
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold"
              style={{ color: "rgba(27,26,23,0.60)" }}
            >
              {event.source_city && (
                <>
                  <MapPin className="h-3 w-3" aria-hidden />
                  {event.source_city}
                </>
              )}
              {event.source_trade && (
                <span className="capitalize">
                  {event.source_city ? " · " : ""}
                  {event.source_trade.replace(/-/g, " ")}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Action row — red Close is always present; the primary
            context action (Complete task / View live on the app) sits
            beside it when applicable. */}
        <div
          className="border-t bg-white/40 px-5 py-3 sm:px-6"
          style={{ borderColor: "rgba(27,26,23,0.10)" }}
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full px-5 text-[13px] font-black text-white shadow-md transition active:scale-[0.97]"
              style={{ background: "#8B0F0F" }}
            >
              <X className="h-4 w-4" aria-hidden />
              Close
            </button>
            {isTask && (
              <button
                type="button"
                onClick={() => {
                  /* v1: closes the modal; wire to task-complete API next */
                  onClose();
                }}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full px-5 text-[13px] font-black shadow-md transition active:scale-[0.97]"
                style={{ background: "#0F7A3F", color: "#ffffff" }}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Complete task
              </button>
            )}
            {event.action_url && !isTask && (
              <Link
                href={event.action_url}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full px-5 text-[13px] font-black shadow-md transition active:scale-[0.97]"
                style={{ background: PALETTE.honeyBright, color: PALETTE.ink }}
              >
                View live on the app
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
