"use client";

// The Notebook client shell — hero + week stats + actions-needed +
// filter chips + chronological event feed. Single-column mobile-first
// per the platform Mobile UI Kit rule; the sidebar-style stat strip
// collapses gracefully on narrow viewports.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Filter,
  BookOpen,
  MessageCircle,
  Phone,
  Star,
  Users,
  Package,
  Rocket,
  TrendingUp,
  MegaphoneOff,
  Sparkles,
  Bell,
  Clock,
  ChevronRight
} from "lucide-react";
import type { NotebookEvent, NotebookFilter, NotebookWeekStats } from "@/lib/notebook";
import { filterNotebook, sortNotebook } from "@/lib/notebook";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

const FILTER_LABELS: Record<NotebookFilter, string> = {
  "all": "All",
  "actions-needed": "Actions needed",
  "leads": "Leads",
  "reviews": "Reviews",
  "canteen": "Canteen",
  "products": "Products",
  "boost": "Boost"
};

export function NotebookShell({
  merchantSlug,
  merchantDisplayName,
  merchantTradeLabel,
  merchantCity,
  merchantAvatarUrl,
  bannerUrl,
  canteenHref,
  events,
  stats
}: {
  merchantSlug: string;
  merchantDisplayName: string;
  merchantTradeLabel: string;
  merchantCity: string;
  merchantAvatarUrl: string | null;
  bannerUrl: string | null;
  canteenHref: string;
  events: NotebookEvent[];
  stats: NotebookWeekStats;
}) {
  const [filter, setFilter] = useState<NotebookFilter>("all");
  const displayed = useMemo(
    () => sortNotebook(filterNotebook(events, filter)),
    [events, filter]
  );
  const actionsNeeded = useMemo(
    () => sortNotebook(events.filter((e) => e.actionRequired)),
    [events]
  );

  return (
    <div className="pb-16">
      {/* Hero — merchant banner + Notebook framing + week stats */}
      <section
        className="relative overflow-hidden border-b"
        style={{
          backgroundColor: BRAND_BLACK,
          borderColor: `${BRAND_YELLOW}33`,
          backgroundImage: bannerUrl
            ? `linear-gradient(160deg, rgba(10,10,10,0.78) 0%, rgba(42,26,10,0.82) 55%, rgba(10,10,10,0.90) 100%), url('${bannerUrl}')`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        <div className="mx-auto max-w-5xl px-3 py-6 md:px-6 md:py-8">
          <Link
            href={canteenHref}
            className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-400 hover:text-white"
          >
            <ArrowLeft size={11} strokeWidth={2.5}/>
            Back to your canteen
          </Link>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
            {/* Identity */}
            <div className="flex items-center gap-3">
              <div
                className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border-2 shadow-lg"
                style={{
                  borderColor: BRAND_YELLOW,
                  backgroundImage: merchantAvatarUrl ? `url('${merchantAvatarUrl}')` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: !merchantAvatarUrl ? BRAND_YELLOW : undefined
                }}
              >
                {!merchantAvatarUrl && (
                  <div className="flex h-full w-full items-center justify-center text-[20px] font-black" style={{ color: BRAND_BLACK }}>
                    {merchantDisplayName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <BookOpen size={12} color={BRAND_YELLOW} strokeWidth={2.5}/>
                  <span
                    className="text-[10px] font-black uppercase tracking-[0.24em]"
                    style={{ color: BRAND_YELLOW }}
                  >
                    Your Notebook
                  </span>
                </div>
                <h1 className="text-[22px] font-black leading-tight text-white md:text-[26px]">
                  {merchantDisplayName}
                </h1>
                <div className="text-[11px] font-bold text-neutral-400">
                  {merchantTradeLabel}{merchantCity ? ` · ${merchantCity}` : ""}
                </div>
              </div>
            </div>

            {/* Private-only badge — reassures merchants that nobody
                else sees this feed. */}
            <div
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm md:ml-auto"
              style={{ borderColor: `${BRAND_YELLOW}88`, backgroundColor: "rgba(255,255,255,0.05)" }}
            >
              <MegaphoneOff size={11} color={BRAND_YELLOW} strokeWidth={2.5}/>
              Private · only you see this
            </div>
          </div>

          {/* This-week stat strip */}
          <div className="mt-5 grid grid-cols-3 gap-2 md:grid-cols-6">
            <StatCell icon={MessageCircle} label="Leads · 7d" value={stats.leads}/>
            <StatCell icon={Star} label="Reviews · 7d" value={stats.reviews}/>
            <StatCell icon={Users} label="Canteen · 7d" value={stats.canteenMentions}/>
            <StatCell icon={Package} label="Products · 7d" value={stats.productEnquiries}/>
            <StatCell icon={Rocket} label="Active boosts" value={stats.activeBoosts}/>
            <StatCell
              icon={Bell}
              label="Actions needed"
              value={stats.actionsNeeded}
              highlight={stats.actionsNeeded > 0}
            />
          </div>
        </div>
      </section>

      {/* Actions-needed strip — only renders when there are
          time-sensitive items. Sits directly under the hero so the
          merchant can't miss it. */}
      {actionsNeeded.length > 0 && (
        <section
          className="border-b"
          style={{
            backgroundColor: `${BRAND_YELLOW}18`,
            borderColor: `${BRAND_YELLOW}88`
          }}
        >
          <div className="mx-auto max-w-5xl px-3 py-4 md:px-6">
            <div className="mb-2 flex items-center gap-1.5">
              <Bell size={12} color={BRAND_BLACK} strokeWidth={2.5}/>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-neutral-900">
                Needs your attention
              </span>
              <span className="text-[10px] font-black text-neutral-500">
                · {actionsNeeded.length}
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {actionsNeeded.map((e) => (
                <li key={e.id}>
                  <ActionCard event={e}/>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Filter chip bar — sticky under the header offset */}
      <section
        className="sticky top-[64px] z-10 border-b bg-white/85 backdrop-blur"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-3 py-3 md:px-6">
          <div className="flex items-center gap-1 pr-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">
            <Filter size={11}/>
            Filter
          </div>
          {(Object.entries(FILTER_LABELS) as [NotebookFilter, string][]).map(([k, label]) => (
            <FilterChip
              key={k}
              active={filter === k}
              onClick={() => setFilter(k)}
              label={label}
            />
          ))}
        </div>
      </section>

      {/* Event feed */}
      <section className="mx-auto max-w-5xl px-3 pt-6 md:px-6">
        {displayed.length === 0 ? (
          <EmptyState filter={filter} onReset={() => setFilter("all")}/>
        ) : (
          <ul className="flex flex-col gap-3">
            {displayed.map((e) => (
              <li key={e.id}>
                <NotebookEventCard event={e}/>
              </li>
            ))}
          </ul>
        )}

        {/* How the Notebook works — footer explainer */}
        <div
          className="mt-6 rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: `${BRAND_YELLOW}44` }}
        >
          <div className="mb-2 flex items-center gap-1.5">
            <Sparkles size={12} color={BRAND_BLACK} strokeWidth={2.5}/>
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
              How your Notebook works
            </span>
          </div>
          <ul className="grid grid-cols-1 gap-2 text-[12px] leading-snug text-neutral-700 md:grid-cols-2">
            <FooterPoint>Every WhatsApp tap, review, canteen mention, product view, and boost lands here — nowhere else.</FooterPoint>
            <FooterPoint>Private by design. Nobody else sees your Notebook — not other trades, not customers, not the platform.</FooterPoint>
            <FooterPoint>Actions needed float to the top with a 72-hour window countdown. Miss nothing time-sensitive.</FooterPoint>
            <FooterPoint>Weekly stats let you see momentum without opening a dashboard — leads, reviews, mentions, product views.</FooterPoint>
          </ul>
        </div>
      </section>
    </div>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
  highlight = false
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number | string }>;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-lg border p-2.5 shadow-sm"
      style={{
        borderColor: highlight ? BRAND_YELLOW : `${BRAND_YELLOW}55`,
        backgroundColor: highlight ? `${BRAND_YELLOW}22` : "rgba(255,255,255,0.05)"
      }}
    >
      <div className="flex items-center gap-1">
        <Icon size={11} color={highlight ? BRAND_YELLOW : "#D4D4D4"} strokeWidth={2.5}/>
        <span
          className="text-[9px] font-black uppercase tracking-wider"
          style={{ color: highlight ? BRAND_YELLOW : "#A3A3A3" }}
        >
          {label}
        </span>
      </div>
      <div className="text-[20px] font-black leading-none tabular-nums text-white">
        {value}
      </div>
    </div>
  );
}

function ActionCard({ event }: { event: NotebookEvent }) {
  const remaining = event.deadlineAt ? formatRemaining(event.deadlineAt) : null;
  return (
    <article
      className="flex items-start gap-3 rounded-xl border-2 bg-white p-3 shadow-md"
      style={{ borderColor: BRAND_YELLOW }}
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: BRAND_YELLOW }}
      >
        <Bell size={13} color={BRAND_BLACK} strokeWidth={2.5}/>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-[13px] font-black text-neutral-900">
            {event.title}
          </h3>
          {remaining && (
            <span className="inline-flex flex-shrink-0 items-center gap-1 text-[10px] font-black uppercase tracking-wider" style={{ color: "#7A5300" }}>
              <Clock size={10} strokeWidth={2.5}/>
              {remaining}
            </span>
          )}
        </div>
        {event.body && (
          <p className="mt-1 text-[12px] leading-snug text-neutral-700">{event.body}</p>
        )}
        {event.meta && (
          <div className="mt-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">
            {event.meta}
          </div>
        )}
        {event.action && (
          <Link
            href={event.action.href}
            className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition active:scale-[0.97]"
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            {event.action.label}
            <ChevronRight size={12} strokeWidth={2.5}/>
          </Link>
        )}
      </div>
    </article>
  );
}

const TONE_META: Record<NotebookEvent["tone"], { icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number | string }>; label: string; accent: string }> = {
  "lead":            { icon: MessageCircle, label: "Lead",           accent: BRAND_GREEN_DARK },
  "review":          { icon: Star,          label: "Review",         accent: BRAND_YELLOW },
  "canteen":         { icon: Users,         label: "Canteen",        accent: "#7A5300" },
  "product":         { icon: Package,       label: "Product",        accent: "#525252" },
  "boost":           { icon: Rocket,        label: "Boost",          accent: BRAND_GREEN_DARK },
  "milestone":       { icon: TrendingUp,    label: "Milestone",      accent: BRAND_YELLOW },
  "action-required": { icon: Bell,          label: "Needs response", accent: BRAND_YELLOW }
};

function NotebookEventCard({ event }: { event: NotebookEvent }) {
  const tone = TONE_META[event.tone];
  const ToneIcon = tone.icon;
  const isPhone = event.kind === "lead-call";
  const IconOverride = isPhone ? Phone : ToneIcon;
  return (
    <article
      className="flex items-start gap-3 rounded-xl border bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${tone.accent}18`, color: tone.accent }}
      >
        <IconOverride size={15} color={tone.accent} strokeWidth={2.5}/>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="text-[9px] font-black uppercase tracking-[0.22em]"
            style={{ color: tone.accent }}
          >
            {tone.label}
          </span>
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
            {formatAgo(event.when)}
          </span>
        </div>
        <h3 className="mt-0.5 text-[13px] font-black leading-snug text-neutral-900">
          {event.title}
        </h3>
        {event.body && (
          <p className="mt-1 text-[12px] leading-snug text-neutral-600">{event.body}</p>
        )}
        {event.meta && (
          <div className="mt-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">
            {event.meta}
          </div>
        )}
        {event.action && (
          <Link
            href={event.action.href}
            className="mt-2 inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[10px] font-black uppercase tracking-wider text-neutral-800 transition hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            {event.action.label}
            <ChevronRight size={11} strokeWidth={2.5}/>
          </Link>
        )}
      </div>
    </article>
  );
}

function FilterChip({
  active,
  onClick,
  label
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-black uppercase tracking-wider transition"
      style={
        active
          ? { backgroundColor: BRAND_YELLOW, borderColor: BRAND_YELLOW, color: BRAND_BLACK }
          : { backgroundColor: "#FFFFFF", borderColor: "rgba(139,69,19,0.20)", color: "#525252" }
      }
    >
      {label}
    </button>
  );
}

function EmptyState({
  filter,
  onReset
}: {
  filter: NotebookFilter;
  onReset: () => void;
}) {
  if (filter === "all") {
    return (
      <div
        className="mx-auto mt-6 max-w-md rounded-2xl border border-dashed p-8 text-center"
        style={{ borderColor: "rgba(139,69,19,0.25)", backgroundColor: "#FFFFFF" }}
      >
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${BRAND_YELLOW}22` }}
        >
          <BookOpen size={22} color={BRAND_BLACK} strokeWidth={2}/>
        </div>
        <p className="mt-3 text-[10px] font-black uppercase tracking-[0.28em] text-neutral-500">
          Nothing yet
        </p>
        <h3 className="mt-1 text-[16px] font-black text-neutral-900">
          Your Notebook is quiet.
        </h3>
        <p className="mt-1.5 text-[12px] leading-snug text-neutral-500">
          Once you're live, every lead, review, canteen mention, product view, and boost lands here.
        </p>
      </div>
    );
  }
  return (
    <div
      className="mx-auto mt-6 max-w-md rounded-2xl border border-dashed p-8 text-center"
      style={{ borderColor: "rgba(139,69,19,0.25)", backgroundColor: "#FFFFFF" }}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-neutral-500">
        No matches
      </p>
      <h3 className="mt-1 text-[16px] font-black text-neutral-900">
        No events match this filter.
      </h3>
      <button
        onClick={onReset}
        className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
        style={{ backgroundColor: BRAND_YELLOW }}
      >
        Show everything
      </button>
    </div>
  );
}

function FooterPoint({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5">
      <Sparkles size={11} color={BRAND_YELLOW} strokeWidth={2.5} className="mt-0.5 flex-shrink-0"/>
      <span>{children}</span>
    </li>
  );
}

function formatAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  const mins = Math.floor(ms / (60 * 1000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatRemaining(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return "closed";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}
