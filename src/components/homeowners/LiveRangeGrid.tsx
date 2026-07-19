"use client";

// Live-action range grid — the "A house is never finished. Neither is
// your SiteBook." section on /homeowners.
//
// Each of the 8 cards cycles through 3-4 real project statuses
// (Just posted → Quoting → Contract agreed → Complete) with a pulse
// dot next to the pill, so the section reads as live projects
// happening right now — not a static timeline.
//
// One shared 3-second tick timer drives all 8 cards to keep DOM
// updates cheap. Each card has a per-card offset so they don't sync,
// which makes the section feel like real independent activity.
//
// This section is the load-bearing convince moment — visitor sees it
// ONCE before hitting Signup, so it must feel real.

import { useEffect, useState } from "react";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

type Status = {
  label:  string;
  tone:   "green" | "amber" | "blue" | "grey" | "red";
  pulse?: boolean;
};

type LiveCard = {
  time:      string;
  scale:     string;
  title:     string;
  body:      string;
  statuses:  Status[];
};

const CARDS: LiveCard[] = [
  {
    time: "Tonight, 11pm", scale: "£80", title: "Broken door lock",
    body: "Locksmith responds in 30 min. Job logged. Receipt saved. One less thing to remember.",
    statuses: [
      { label: "Just posted",              tone: "green", pulse: true },
      { label: "3 locksmiths responding",  tone: "amber", pulse: true },
      { label: "Booked · 30 min ETA",      tone: "blue" },
      { label: "Complete · warranty saved", tone: "grey" }
    ]
  },
  {
    time: "Next month", scale: "£450", title: "Loft ladder install",
    body: "One trade replies with a fixed quote. Photos before + after.",
    statuses: [
      { label: "Beacon firing",            tone: "green", pulse: true },
      { label: "2 quotes in",              tone: "amber" },
      { label: "£450 · contract agreed",   tone: "blue" },
      { label: "Scheduled · 14 March",     tone: "grey" }
    ]
  },
  {
    time: "This spring", scale: "£1,200", title: "Garden shed build",
    body: "Two trades collaborate — foundation + carpentry. Warranty logged for 10 years.",
    statuses: [
      { label: "Draft",                    tone: "grey" },
      { label: "3 quotes in",              tone: "amber", pulse: true },
      { label: "£1,200 accepted",          tone: "blue" },
      { label: "In progress · 60%",        tone: "green", pulse: true }
    ]
  },
  {
    time: "Year 3", scale: "£38,000", title: "Kitchen refit",
    body: "Kitchen fitter + plumber + tiler + electrician. All in your SiteBook. All coordinating.",
    statuses: [
      { label: "Multi-trade brief live",   tone: "green", pulse: true },
      { label: "Plumber quoting",          tone: "amber", pulse: true },
      { label: "Tiler joined",             tone: "amber" },
      { label: "Electrician quoting",      tone: "amber", pulse: true }
    ]
  },
  {
    time: "Year 5", scale: "£4,900", title: "Bathroom refresh",
    body: "Rebook the same plumber from year 2. Their warranty is still on file. One tap.",
    statuses: [
      { label: "Rebooking same plumber",   tone: "blue" },
      { label: "Quote £4,900",             tone: "amber" },
      { label: "Contract agreed",          tone: "green", pulse: true },
      { label: "Booked · Feb",             tone: "grey" }
    ]
  },
  {
    time: "Year 8", scale: "£280,000", title: "Loft + rear extension",
    body: "Architect + structural + 6 trades. Full drawings, quotes, sign-offs — one workspace.",
    statuses: [
      { label: "Architect reviewing",      tone: "amber" },
      { label: "6 trades brief live",      tone: "green", pulse: true },
      { label: "Structural £45k in",       tone: "blue" },
      { label: "Full build · Q2 start",    tone: "grey" }
    ]
  },
  {
    time: "Year 12", scale: "£150", title: "Boiler service",
    body: "Auto-reminder pings you. Same heating engineer. One-click rebook.",
    statuses: [
      { label: "Auto-reminder sent",       tone: "amber", pulse: true },
      { label: "One-tap rebook",           tone: "blue" },
      { label: "Same engineer · 3rd time", tone: "green" },
      { label: "Complete · warranty renewed", tone: "grey" }
    ]
  },
  {
    time: "Year 20", scale: "Priceless", title: "Sell the house",
    body: "Give the buyer the SiteBook export. 20 years of records. Adds real value at completion.",
    statuses: [
      { label: "Export ready",             tone: "blue" },
      { label: "Buyer received file",      tone: "amber" },
      { label: "+£12k on valuation",       tone: "green", pulse: true },
      { label: "Sale complete",            tone: "grey" }
    ]
  }
];

// One tick every 3s drives all cards. Per-card offset (cardIndex % length)
// staggers status changes so they don't sync.
const TICK_INTERVAL_MS = 3000;

export function LiveRangeGrid({ variant = "grid" }: { variant?: "grid" | "row" }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  if (variant === "row") {
    // Auto-scrolling marquee — cards drift slowly leftward in an
    // infinite loop. Cards are rendered twice so when the first set
    // slides out on the left, the duplicate is already in view for
    // seamless continuity. No scrollbar, no manual scroll — feels
    // like a live projects ticker. Pauses on hover. Respects
    // prefers-reduced-motion (keyframe defined in globals.css).
    return (
      <div className="-mx-4 overflow-hidden pb-1 sm:-mx-6">
        <div className="animate-marquee-scroll flex w-max gap-3 pl-4 sm:pl-6">
          {[...CARDS, ...CARDS].map((card, i) => {
            const originalIdx = i % CARDS.length;
            const statusIdx   = (tick + originalIdx) % card.statuses.length;
            const current     = card.statuses[statusIdx];
            return (
              <div
                key={`${card.title}-${i}`}
                className="w-[240px] shrink-0 sm:w-[260px]"
                aria-hidden={i >= CARDS.length}
              >
                <LiveCard card={card} status={current}/>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map((card, i) => {
        const statusIdx = (tick + i) % card.statuses.length;
        const current   = card.statuses[statusIdx];
        return (
          <LiveCard key={card.title} card={card} status={current}/>
        );
      })}
    </div>
  );
}

function LiveCard({ card, status }: { card: LiveCard; status: Status }) {
  const toneStyles: Record<Status["tone"], { bg: string; fg: string; dot: string }> = {
    green: { bg: "rgba(22,101,52,0.20)",  fg: "#86EFAC", dot: "#22C55E" },
    amber: { bg: "rgba(245,158,11,0.20)", fg: "#FCD34D", dot: "#F59E0B" },
    blue:  { bg: "rgba(59,130,246,0.20)", fg: "#93C5FD", dot: "#3B82F6" },
    grey:  { bg: "rgba(255,255,255,0.10)",fg: "#D4D4D8", dot: "#71717A" },
    red:   { bg: "rgba(220,38,38,0.20)",  fg: "#FCA5A5", dot: "#DC2626" }
  };
  const s = toneStyles[status.tone];

  return (
    <div
      className="rounded-2xl border border-white/25 bg-white/10 p-4 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:border-white/50 hover:bg-white/15"
      style={{
        // Extra warmth: subtle yellow tint on top of the frosted white
        // pushes the glassmorphism toward the brand rather than a cold
        // Windows-Aero feel. Overlays cleanly against any hero image.
        backgroundImage:
          "linear-gradient(135deg, rgba(255,179,0,0.06) 0%, rgba(255,255,255,0.04) 100%)"
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-white/75">{card.time}</p>
        <p className="text-[13px] font-black drop-shadow" style={{ color: BRAND_YELLOW }}>{card.scale}</p>
      </div>

      <p className="mt-2 text-[14px] font-black text-white drop-shadow-sm">{card.title}</p>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/80">{card.body}</p>

      {/* Live status pill — animates in on each tick */}
      <div className="mt-3 flex items-center gap-2">
        <span
          key={status.label}
          className="animate-[fadeIn_0.4s_ease-out] inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
          style={{ backgroundColor: s.bg, color: s.fg }}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${status.pulse ? "animate-pulse" : ""}`}
            style={{ backgroundColor: s.dot, boxShadow: status.pulse ? `0 0 8px ${s.dot}` : undefined }}
          />
          {status.label}
        </span>
      </div>
    </div>
  );
}
