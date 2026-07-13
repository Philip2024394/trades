"use client";

// Landing-page activity feed. Portrait container floating in the top-
// left of the hero image, honouring the user's brief:
//   • tall not wide
//   • doesn't cover the whole image
//   • breathing padding on the left + top
//
// Fetches /api/activity/public on mount and re-polls every 30s so it
// feels alive without a WebSocket. Renders newest event at the top;
// subtle fade-in on new arrivals. Clicking any card opens a larger
// live-feed modal (ActivityFeedModal) — "peek" in the panel, "read"
// in the modal.
//
// Development mocks: in non-prod builds, when the API returns zero
// events the panel falls back to a small mock set so the design is
// visible on localhost. In production the panel hides itself instead
// (no fake activity — real events flow in via the write hooks).

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MessageCircle,
  UserPlus,
  Hammer,
  Sparkles,
  Zap,
  ArrowRight,
  Calculator,
  Radio
} from "lucide-react";
import { type ActivityEvent } from "./ActivityFeedModal";
import { ActivityEventDetailModal } from "./ActivityEventDetailModal";

type Event = ActivityEvent;
type Kind = Event["kind"];

const IS_DEV = process.env.NODE_ENV !== "production";

// Localhost-only mocks so the panel + modal are visible on first load
// before real events flow in. Never rendered in production.
function buildDevMocks(): Event[] {
  const now = Date.now();
  const mock = (
    minsAgo: number,
    kind: Kind,
    summary: string,
    action_url: string | null = null,
    trade: string | null = null,
    city: string | null = null
  ): Event => ({
    id: `mock-${kind}-${minsAgo}`,
    kind,
    subject_type: null,
    subject_id: null,
    summary_text: summary,
    action_url,
    source_display_name: null,
    source_trade: trade,
    source_city: city,
    created_at: new Date(now - minsAgo * 60_000).toISOString()
  });
  const withImage = (base: Event, image_url: string): Event => ({
    ...base,
    image_url
  });
  return [
    mock(0, "beacon_fired", "A plumber in Manchester fired a beacon — nearby trades responding now.", "/trade-off/yard", "plumber", "Manchester"),
    withImage(
      mock(1, "thread_hot", "A joiner in Manchester replied on a Yard thread.", "/trade-off/yard", "joiner", "Manchester"),
      "https://ik.imagekit.io/9mrgsv2rp/hero-carpenter-mid-project.jpg"
    ),
    mock(2, "quoting", "An electrician in Cardiff is quoting a rewire.", "/trade-off/yard", "electrician", "Cardiff"),
    mock(4, "project_posted", "New kitchen project in Leeds.", null, null, "Leeds"),
    mock(11, "trade_joined", "A roofer in Glasgow joined the Notebook.", null, "roofer", "Glasgow"),
    withImage(
      mock(18, "tier_upgraded", "A plasterer in Birmingham went Pro.", null, "plasterer", "Birmingham"),
      "https://ik.imagekit.io/9mrgsv2rp/hero-plasterer-finish.jpg"
    ),
    mock(27, "project_posted", "New bathroom project in Bristol.", null, null, "Bristol"),
    mock(34, "thread_hot", "A tiler in Sheffield replied on a Yard thread.", "/trade-off/yard", "tiler", "Sheffield"),
    mock(46, "trade_joined", "A landscaper in Cardiff joined the Notebook.", null, "landscaper", "Cardiff"),
    mock(61, "project_posted", "New extension project in Edinburgh.", null, null, "Edinburgh")
  ];
}

const PALETTE = {
  cream: "#FBF6EC",
  ink: "#1B1A17",
  honey: "#B8860B",
  honeyBright: "#FFB300"
};

function kindIcon(kind: Kind) {
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

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function ActivityFeedPanel({
  mode = "public"
}: {
  mode?: "public" | "personal";
}) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [focusedEvent, setFocusedEvent] = useState<Event | null>(null);

  useEffect(() => {
    let cancelled = false;
    const endpoint =
      mode === "personal" ? "/api/activity/personal" : "/api/activity/public";

    async function pull() {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok: boolean;
          events?: Event[];
        };
        if (cancelled) return;
        if (data.ok && data.events) {
          setEvents(data.events);
          setLoaded(true);
        }
      } catch {
        /* silent */
      }
    }

    pull();
    const t = setInterval(pull, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [mode]);

  // Preview mocks — kick in when the API returned empty AND either:
  //   • we're on localhost (dev), OR
  //   • the URL has ?demo=1 (design preview on any deploy)
  // Once real events start flowing they push the mocks out entirely.
  const [demoQuery, setDemoQuery] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("demo") === "1") setDemoQuery(true);
  }, []);
  const usePreview = events.length === 0 && (IS_DEV || demoQuery);
  const displayEvents = usePreview ? buildDevMocks() : events;

  // Zero real events AND preview off → hide the panel (honest empty).
  if (loaded && displayEvents.length === 0) return null;

  return (
    <div
      className="pointer-events-auto flex w-[240px] flex-col overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md sm:w-[280px]"
      style={{
        background: "rgba(251,246,236,0.94)",
        borderColor: "rgba(27,26,23,0.10)",
        maxHeight: "min(58dvh, 480px)"
      }}
    >
      {/* Header — LIVE dot + label */}
      <header
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: "rgba(27,26,23,0.08)" }}
      >
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: "#22c55e" }}
          >
            <span
              aria-hidden
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
              style={{ backgroundColor: "#22c55e" }}
            />
          </span>
          <span
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: PALETTE.honey }}
          >
            Live
          </span>
        </div>
        <span
          className="text-[10px] font-black uppercase tracking-[0.18em]"
          style={{ color: PALETTE.ink }}
        >
          {mode === "personal" ? "Your day" : "On the site"}
        </span>
      </header>

      {/* Event list — vertical marquee. Content is duplicated so the
          keyframe can translate by -50% and loop seamlessly. No
          scrollbar; hover pauses the animation so users can read.
          Clicking any card opens the single-event detail modal. */}
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{
          // Fade edges so cards enter and exit softly instead of
          // hard-clipping at the container border.
          maskImage:
            "linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)"
        }}
      >
        <ul className="activity-marquee">
          {[...displayEvents, ...displayEvents].map((e, i) => {
            const Icon = kindIcon(e.kind);
            return (
              <li
                key={`${e.id}-${i}`}
                className="border-b"
                style={{ borderColor: "rgba(27,26,23,0.06)" }}
              >
                <button
                  type="button"
                  onClick={() => setFocusedEvent(e)}
                  className="block w-full px-3 py-2 text-left transition hover:bg-black/[0.03]"
                >
                  <div className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: PALETTE.honeyBright,
                        color: PALETTE.ink
                      }}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[11.5px] font-semibold leading-[1.35]"
                        style={{ color: PALETTE.ink }}
                      >
                        {e.summary_text}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <p
                          className="text-[10px] font-bold"
                          style={{ color: "rgba(27,26,23,0.55)" }}
                        >
                          {timeAgo(e.created_at)}
                        </p>
                        {e.kind === "quoting" && (
                          <span
                            className="activity-quoting-chip inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-white"
                            style={{ background: "#0F7A3F" }}
                          >
                            Quoting
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight
                      className="mt-1 h-3 w-3 shrink-0"
                      style={{ color: PALETTE.honey }}
                      aria-hidden
                    />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Footer — one CTA. */}
      <div
        className="border-t px-3 py-2"
        style={{ borderColor: "rgba(27,26,23,0.08)" }}
      >
        <Link
          href="/trade-off/yard"
          className="inline-flex w-full items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.16em] hover:underline"
          style={{ color: PALETTE.honey }}
        >
          {mode === "personal" ? "Open dashboard" : "Explore The Yard"}
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      {focusedEvent && (
        <ActivityEventDetailModal
          event={focusedEvent}
          onClose={() => setFocusedEvent(null)}
        />
      )}
    </div>
  );
}
