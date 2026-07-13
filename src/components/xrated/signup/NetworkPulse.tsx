"use client";

// Network Pulse — the "electric feed" sidebar on the signup page.
// Eight stacked cards that show the ecosystem is alive:
//   1. Live joining counter (heartbeat)
//   2. Activity ticker (continuous scroll)
//   3. 24h launch preview
//   4. Country flag stat strip
//   5. Free vs Pro chip strip
//   6. Trade Chat pulse (rotating single-line)
//   7. Founding 100 scarcity gate
//   8. Trust strip
//
// Design lineage: Loom's "N videos captured today" counter, Slack's
// "teams active right now" strip, Linear's motion-first onboarding.
// Every element is mock-driven initially — swap for Supabase realtime
// once the schema lands. Mock events are plausible (drawn from real
// canteen seed data) so the design reads as honest even pre-launch.
//
// Mobile — see SignupPulseStrip.tsx for the compact horizontal
// version that sits above the form on narrow viewports.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Zap,
  Users,
  Rocket,
  Flame,
  TrendingUp,
  ShieldCheck,
  MessageSquare,
  Hammer,
  Plug,
  Wrench,
  PaintBucket,
  HardHat,
  Home,
  Ruler,
  Sparkles
} from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

const HEARTBEAT_CSS = `
@keyframes network-pulse-tick {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.06); }
  100% { transform: scale(1); }
}
@keyframes network-ticker-scroll {
  0%   { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}
.network-ticker-track {
  animation: network-ticker-scroll 60s linear infinite;
  will-change: transform;
}
.network-ticker-shell:hover .network-ticker-track {
  animation-play-state: paused;
}
.network-count-pulse {
  animation: network-pulse-tick 1.2s cubic-bezier(0.4, 0, 0.2, 1);
}
@media (prefers-reduced-motion: reduce) {
  .network-ticker-track { animation: none; }
  .network-count-pulse { animation: none; }
}
`;

type ActivityEvent = {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number | string }>;
  title: string;
  meta: string;
  ago: string;
};

// Plausible mock events — sourced from the canteen seed data so the
// names + trades match what a curious buyer would see on the real app.
// Order is display-only; the ticker duplicates the list for the
// translateY(-50%) seamless loop.
const MOCK_ACTIVITY: ActivityEvent[] = [
  { icon: Hammer,    title: "Sarah W. joined",              meta: "Plasterer · Manchester",  ago: "2 min ago" },
  { icon: Rocket,    title: "Mike Watson boosted a listing", meta: "Kitchen Fitters · Trade Center", ago: "4 min ago" },
  { icon: Users,     title: "UK Kitchen Fitters hit 128",    meta: "Canteen · Founding 100", ago: "12 min ago" },
  { icon: Zap,       title: "Craig McDermott's app went live", meta: "Sparks · Leeds", ago: "18 min ago" },
  { icon: MessageSquare, title: "New Trade Chat thread",     meta: "\"NW sparks day rates 2026\"", ago: "24 min ago" },
  { icon: Plug,      title: "Jason Hardy joined",             meta: "Scaffolder · Glasgow", ago: "31 min ago" },
  { icon: Wrench,    title: "Dean W. published",              meta: "Bathroom Fitter · Leeds", ago: "42 min ago" },
  { icon: PaintBucket, title: "Rachel Simms went Pro",        meta: "Kitchen Fitter · Manchester", ago: "1 hour ago" },
  { icon: HardHat,   title: "Marcus Thorne joined",           meta: "Bricklayer · Bristol", ago: "1 hour ago" },
  { icon: Home,      title: "Priya Menon draft saved",        meta: "Interior · London", ago: "2 hours ago" },
  { icon: Sparkles,  title: "Tom Fisher hit 5-star × 50",    meta: "Joiner · Sheffield", ago: "3 hours ago" }
];

// Rotating Trade Chat headlines — cycle every 8s so the page feels
// alive without dragging attention off the form.
const CHAT_HEADLINES = [
  "🔥 NW sparks day rates 2026 — hit £320?",
  "🏗️ Best plasterboard supplier in North England?",
  "🔨 Building-merchant Verified tier goes live Aug 1",
  "🚚 Any Leeds sparks free next week?",
  "📐 Tile pricing 2026 — quotes coming in high",
  "🪵 Timber merchant bulk-buy hit 12 committed"
];

// Peers going live in the next 24 hours — drives the "you're joining
// with these people" social proof. Curated from real drafts once the
// DB is wired; mock is representative until then.
const LAUNCHING_SOON: Array<{ initial: string; name: string; trade: string; city: string; when: string }> = [
  { initial: "M", name: "Marcus Thorne", trade: "Bricklayer", city: "Bristol",   when: "in 4 hours" },
  { initial: "P", name: "Priya Menon",   trade: "Interior",   city: "London",    when: "in 6 hours" },
  { initial: "D", name: "Dean Whitaker", trade: "Bathroom",   city: "Leeds",     when: "tomorrow"   },
  { initial: "A", name: "Alex Hughes",   trade: "Kitchen",    city: "Manchester", when: "tomorrow"  }
];

// Weighted country counts — order signals where the density is.
const COUNTRY_STATS: Array<{ flag: string; code: string; count: number }> = [
  { flag: "🇬🇧", code: "UK", count: 2847 },
  { flag: "🇮🇪", code: "IE", count: 341 },
  { flag: "🇦🇺", code: "AU", count: 89 },
  { flag: "🇨🇦", code: "CA", count: 62 }
];

export function NetworkPulse() {
  const [joinCount, setJoinCount] = useState(127);
  const [countPulseKey, setCountPulseKey] = useState(0);
  const [chatIdx, setChatIdx] = useState(0);

  // Simulated live increment — weighted-random tick every 22-38s so
  // the counter feels like a real feed. Swap for a Supabase realtime
  // channel subscription once the DB schema lands.
  useEffect(() => {
    let cancelled = false;
    const schedule = () => {
      const delay = 22000 + Math.floor(Math.random() * 16000);
      const t = setTimeout(() => {
        if (cancelled) return;
        setJoinCount((n) => n + 1);
        setCountPulseKey((k) => k + 1);
        schedule();
      }, delay);
      return t;
    };
    const t = schedule();
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  // Rotate Trade Chat headline every 8s.
  useEffect(() => {
    const t = setInterval(() => setChatIdx((i) => (i + 1) % CHAT_HEADLINES.length), 8000);
    return () => clearInterval(t);
  }, []);

  const foundingSlotsLeft = 43;

  return (
    <aside className="flex flex-col gap-3">
      <style>{HEARTBEAT_CSS}</style>

      {/* Card 1 — Live joining counter */}
      <section
        className="relative overflow-hidden rounded-xl border p-4 shadow-sm"
        style={{
          borderColor: `${BRAND_GREEN_DARK}55`,
          background: `linear-gradient(135deg, ${BRAND_GREEN_DARK}18 0%, #FFFFFF 60%)`
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
              style={{ backgroundColor: BRAND_GREEN_DARK }}
            />
            <span
              className="relative inline-flex h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: BRAND_GREEN_DARK }}
            />
          </span>
          <span
            className="text-[10px] font-black uppercase tracking-[0.28em]"
            style={{ color: BRAND_GREEN_DARK }}
          >
            Live
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            key={countPulseKey}
            className="network-count-pulse inline-block text-[36px] font-black leading-none tabular-nums text-neutral-900"
          >
            {joinCount}
          </span>
          <span className="text-[12px] font-black text-neutral-500">tradies</span>
        </div>
        <p className="mt-0.5 text-[12px] leading-snug text-neutral-600">
          joined in the last 24 hours
        </p>
      </section>

      {/* Card 2 — Activity ticker (continuous scroll) */}
      <section
        className="network-ticker-shell overflow-hidden rounded-xl border bg-white shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div
          className="flex items-center gap-1.5 border-b px-3 py-2"
          style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: `${BRAND_YELLOW}0F` }}
        >
          <Zap size={12} color={BRAND_BLACK} strokeWidth={2.5}/>
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
            Right now on Thenetworkers
          </span>
        </div>
        <div
          className="relative h-[240px] overflow-hidden"
          style={{
            maskImage: "linear-gradient(to bottom, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)"
          }}
        >
          <ul className="network-ticker-track flex flex-col">
            {[...MOCK_ACTIVITY, ...MOCK_ACTIVITY].map((event, i) => {
              const Icon = event.icon;
              return (
                <li
                  key={`${event.title}-${i}`}
                  className="flex items-start gap-2 border-b px-3 py-2.5"
                  style={{ borderColor: "rgba(139,69,19,0.06)" }}
                >
                  <div
                    className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${BRAND_YELLOW}22` }}
                  >
                    <Icon size={11} color={BRAND_BLACK} strokeWidth={2.5}/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11.5px] font-black text-neutral-900">
                      {event.title}
                    </div>
                    <div className="truncate text-[10px] font-bold text-neutral-500">
                      {event.meta}
                    </div>
                    <div className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-neutral-400">
                      {event.ago}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Card 3 — Going live in the next 24 hours */}
      <section
        className="overflow-hidden rounded-xl border bg-white shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div
          className="flex items-center justify-between border-b px-3 py-2"
          style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: `${BRAND_YELLOW}0F` }}
        >
          <div className="flex items-center gap-1.5">
            <Rocket size={12} color={BRAND_BLACK} strokeWidth={2.5}/>
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
              Going live · 24h
            </span>
          </div>
          <span className="text-[10px] font-black text-neutral-500">{LAUNCHING_SOON.length}</span>
        </div>
        <ul className="flex flex-col">
          {LAUNCHING_SOON.map((peer, i) => (
            <li
              key={peer.name}
              className="flex items-center gap-2 px-3 py-2"
              style={i < LAUNCHING_SOON.length - 1 ? { borderBottom: "1px solid rgba(139,69,19,0.06)" } : undefined}
            >
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-black shadow-sm"
                style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
              >
                {peer.initial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-black text-neutral-900">
                  {peer.name}
                </div>
                <div className="truncate text-[10px] font-bold text-neutral-500">
                  {peer.trade} · {peer.city}
                </div>
              </div>
              <span
                className="flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                style={{ backgroundColor: `${BRAND_GREEN_DARK}18`, color: BRAND_GREEN_DARK }}
              >
                {peer.when}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Card 4 — Country flag stats */}
      <section
        className="rounded-xl border bg-white p-3 shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div className="mb-2 flex items-center gap-1.5">
          <TrendingUp size={12} color={BRAND_BLACK} strokeWidth={2.5}/>
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
            Live worldwide
          </span>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {COUNTRY_STATS.map((c) => (
            <li
              key={c.code}
              className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1"
              style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
            >
              <span className="text-[13px] leading-none">{c.flag}</span>
              <span className="text-[10px] font-black text-neutral-700">{c.code}</span>
              <span className="text-[10px] font-black tabular-nums text-neutral-500">{c.count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Card 5 — Free vs Pro tier density */}
      <section
        className="overflow-hidden rounded-xl border bg-white shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div className="flex">
          <div className="flex-1 border-r p-3" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <div className="text-[9px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Free forever
            </div>
            <div className="mt-1 text-[18px] font-black tabular-nums text-neutral-900">2,631</div>
            <div className="text-[10px] font-bold text-neutral-500">tradies</div>
          </div>
          <div className="flex-1 p-3" style={{ backgroundColor: `${BRAND_YELLOW}0F` }}>
            <div
              className="text-[9px] font-black uppercase tracking-[0.22em]"
              style={{ color: BRAND_BLACK }}
            >
              Network Pro
            </div>
            <div className="mt-1 text-[18px] font-black tabular-nums text-neutral-900">216</div>
            <div className="text-[10px] font-bold text-neutral-500">Founding 100 perk</div>
          </div>
        </div>
      </section>

      {/* Card 6 — Trade Chat rotating headline */}
      <section
        className="overflow-hidden rounded-xl border bg-white p-3 shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <Flame size={11} color={BRAND_BLACK} strokeWidth={2.5}/>
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
            Hot in Trade Chat
          </span>
        </div>
        <div className="min-h-[36px] text-[12px] font-black leading-snug text-neutral-800">
          {CHAT_HEADLINES[chatIdx]}
        </div>
      </section>

      {/* Card 7 — Founding 100 scarcity gate */}
      <section
        className="relative overflow-hidden rounded-xl border-2 p-4 shadow-sm"
        style={{
          borderColor: BRAND_YELLOW,
          background: `linear-gradient(135deg, ${BRAND_YELLOW}22 0%, #FFFFFF 60%)`
        }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-black uppercase tracking-[0.28em]"
            style={{ color: BRAND_BLACK }}
          >
            Founding 100
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-neutral-900"
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            {foundingSlotsLeft} slots left
          </span>
        </div>
        <div className="mt-2 text-[13px] font-black leading-tight text-neutral-900">
          Free premium apps forever.
        </div>
        <p className="mt-1 text-[11px] leading-snug text-neutral-600">
          First 100 verified trades keep every premium App Store install free for life, even after downgrade.
        </p>
      </section>

      {/* Card 8 — Trust strip */}
      <section
        className="rounded-xl border bg-white p-3 shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <ul className="flex flex-col gap-1.5">
          <TrustLine label="Free-for-life. Not a trial." />
          <TrustLine label="No commission. Ever." />
          <TrustLine label="14 UK trades represented" />
          <TrustLine label="Every account WhatsApp-verified" />
        </ul>
      </section>
    </aside>
  );
}

function TrustLine({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-700">
      <ShieldCheck size={11} color={BRAND_GREEN_DARK} strokeWidth={2.5} className="flex-shrink-0"/>
      {label}
    </li>
  );
}
