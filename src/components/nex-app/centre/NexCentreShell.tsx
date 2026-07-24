"use client";

// NexCentreShell — the mobile discovery surface for NEX Centre.
// Full-dark premium theme matching the rest of the NEX ecosystem
// (Contacts · Modules dashboard container · Footer). Warm-yellow
// accent throughout, glass cards on deep charcoal, ambient orb glow,
// fine spatial grid. WhatsApp green is the ONLY non-yellow accent —
// used solely on the message CTA because it carries meaning users
// already understand.

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import {
  ArrowLeft, Bell, Sparkles, ArrowRight, ShieldCheck, MessageSquarePlus, Zap
} from "lucide-react";
import { StatusBar } from "../shell/StatusBar";
import { SupplierCard } from "./SupplierCard";
import { SupplierSheet } from "./SupplierSheet";
import { CATEGORIES, FEATURED_SUPPLIER, NEARBY_SUPPLIERS, UNCLAIMED_SUPPLIERS, searchSuppliers } from "@/lib/nex/centre/_mock";
import type { Supplier } from "@/lib/nex/centre/_types";

// ── Design tokens ───────────────────────────────────────────────────
// Kept in-file so the whole Centre reads as one system; cascades to
// child components via prop drilling or exported reference.
export const T = {
  bg:           "#06060E",
  surface:      "rgba(22, 22, 32, 0.72)",
  surfaceSolid: "#12121C",
  surfaceElev:  "rgba(32, 32, 46, 0.82)",
  border:       "rgba(255, 255, 255, 0.06)",
  borderWarm:   "rgba(251, 191, 36, 0.20)",
  text:         "#F5F5FA",
  textMuted:    "#9797A8",
  textFaint:    "#6A6A7A",
  accent:       "#FBBF24",
  accentDeep:   "#F59E0B",
  accentGrad:   "linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)",
  accentSoft:   "rgba(251, 191, 36, 0.12)",
  whatsapp:     "#25D366",
  online:       "#22C55E"
};

export function NexCentreShell() {
  const [query, setQuery]      = useState("");
  const [categoryId, setCat]   = useState("all");
  const [open, setOpen]        = useState<Supplier | null>(null);

  const allSuppliers: Supplier[] = useMemo(
    () => [FEATURED_SUPPLIER, ...NEARBY_SUPPLIERS, ...UNCLAIMED_SUPPLIERS],
    []
  );

  const hasFilter = query.length > 0 || categoryId !== "all";

  const filtered = useMemo(() => {
    let list = searchSuppliers(allSuppliers, query);
    if (categoryId !== "all") {
      const cat = CATEGORIES.find((c) => c.id === categoryId);
      const kw = cat?.label.toLowerCase() ?? "";
      list = list.filter(
        (s) =>
          s.category.toLowerCase().includes(kw) ||
          (s.tags ?? []).some((t) => t.toLowerCase().includes(kw))
      );
    }
    return list;
  }, [allSuppliers, query, categoryId]);

  return (
    <div
      className="relative mx-auto flex min-h-screen max-w-md flex-col overflow-hidden"
      style={{ background: T.bg, color: T.text }}
    >
      {/* Ambient warm glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-24 -top-32 h-[420px] w-[420px] rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, #F59E0B 0%, transparent 65%)", filter: "blur(80px)" }}
        />
        <div
          className="absolute -right-32 top-1/2 h-[380px] w-[380px] rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, #FBBF24 0%, transparent 65%)", filter: "blur(90px)" }}
        />
        <div
          className="absolute bottom-0 left-1/4 h-[320px] w-[320px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #FCD34D 0%, transparent 65%)", filter: "blur(90px)" }}
        />
      </div>

      {/* Fine spatial grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
          backgroundSize: "56px 56px"
        }}
      />

      <div className="relative z-10 flex flex-col">
        <div style={{ filter: "invert(1)" }}>
          <StatusBar />
        </div>

        {/* ── Sticky header ─────────────────────────────────────── */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-5 pt-3 pb-3"
          style={{
            background: "rgba(6, 6, 14, 0.72)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            borderBottom: `1px solid ${T.border}`
          }}
        >
          <Link
            href="/nex-app"
            aria-label="Back to home"
            className="grid h-9 w-9 place-items-center rounded-full"
            style={{ background: T.surfaceElev, border: `1px solid ${T.border}`, color: T.text }}
          >
            <ArrowLeft size={18} strokeWidth={1.75} />
          </Link>
          <h1
            className="text-[15px] font-black uppercase tracking-[0.24em]"
            style={{
              background: T.accentGrad,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text"
            }}
          >
            NEX Centre
          </h1>
          <button
            type="button"
            aria-label="Notifications"
            className="relative grid h-9 w-9 place-items-center rounded-full"
            style={{ background: T.surfaceElev, border: `1px solid ${T.border}`, color: T.text }}
          >
            <Bell size={17} strokeWidth={1.75} />
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
              style={{ background: T.accent, boxShadow: `0 0 0 3px rgba(251,191,36,0.18)` }}
            />
          </button>
        </header>

        {/* ── Hero ──────────────────────────────────────────────── */}
        <section className="relative px-5 pt-5 pb-2">
          {/* NEX character overlay, right-anchored */}
          <div
            className="pointer-events-none absolute right-0 -bottom-2"
            style={{ top: -12, width: "42%" }}
            aria-hidden
          >
            <Image
              src="/nex-app/general/hero-nex-overlay.png"
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 45vw, 200px"
              className="object-contain object-bottom"
            />
          </div>

          <div className="relative z-10" style={{ maxWidth: "62%" }}>
            <div className="flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-[0.28em]"
                 style={{ color: T.accent }}>
              <Sparkles size={9} strokeWidth={2.5} />
              Discover
            </div>
            <h2 className="mt-2 text-[28px] font-black leading-[1.02] tracking-tight"
                style={{ color: T.text }}>
              Every supplier.
            </h2>
            <h2
              className="text-[28px] font-black leading-[1.02] tracking-tight"
              style={{
                background: T.accentGrad,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text"
              }}
            >
              One&nbsp;conversation.
            </h2>
          </div>
        </section>

        {/* ── AI Search ─────────────────────────────────────────── */}
        <div className="relative z-10 px-5 pt-4">
          <div
            className="flex items-center gap-3 rounded-2xl px-3 py-3"
            style={{
              background: T.surface,
              backdropFilter: "blur(18px) saturate(180%)",
              WebkitBackdropFilter: "blur(18px) saturate(180%)",
              border: `1px solid ${T.border}`,
              boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 40px -20px rgba(0,0,0,0.55), 0 0 0 1px rgba(251,191,36,0.05)"
            }}
          >
            <span
              className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-[#141416]"
              style={{
                background: T.accentGrad,
                boxShadow: "0 6px 16px -4px rgba(251,191,36,0.55)"
              }}
            >
              <Sparkles size={15} strokeWidth={2.5} />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Ask NEX  ·  "6 bags of cement"'
              aria-label="Ask NEX"
              className="flex-1 bg-transparent text-[13.5px] outline-none placeholder:opacity-45"
              style={{ color: T.text }}
            />
          </div>
          <p className="mt-2 px-1 text-[10.5px]" style={{ color: T.textFaint }}>
            Try &ldquo;electrician near me&rdquo; · &ldquo;oak flooring&rdquo; · &ldquo;van hire this weekend&rdquo;
          </p>
        </div>

        {/* ── Live pulse strip ──────────────────────────────────── */}
        <div className="relative z-10 mt-3 flex items-center gap-4 px-5 text-[11px]"
             style={{ color: T.textMuted }}>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: T.online, boxShadow: `0 0 0 3px rgba(34,197,94,0.22)` }}
            />
            <span className="font-black" style={{ color: T.text }}>1,247</span> online
          </span>
          <span>
            <span className="font-black" style={{ color: T.text }}>340</span> quotes today
          </span>
          <span className="ml-auto flex items-center gap-1"
                style={{ color: T.accent }}>
            <ShieldCheck size={11} strokeWidth={2} />
            Verified
          </span>
        </div>

        {/* ── Category chips ────────────────────────────────────── */}
        <div className="scrollbar-none mt-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {CATEGORIES.map((c) => {
            const active = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[11.5px] font-bold transition-all"
                style={{
                  background: active ? T.accentGrad : T.surface,
                  color: active ? "#141416" : T.textMuted,
                  border: active ? "none" : `1px solid ${T.border}`,
                  boxShadow: active ? "0 6px 20px -6px rgba(251,191,36,0.55)" : "none",
                  backdropFilter: active ? "none" : "blur(12px)",
                  WebkitBackdropFilter: active ? "none" : "blur(12px)"
                }}
                aria-pressed={active}
              >
                {c.emoji && <span aria-hidden>{c.emoji}</span>}
                {c.label}
              </button>
            );
          })}
        </div>

        {/* ── Featured hero card ────────────────────────────────── */}
        {FEATURED_SUPPLIER && !hasFilter && (
          <section className="mt-6 px-5">
            <SectionEyebrow icon={<Zap size={10} strokeWidth={2.5} />} label="Featured today" />
            <FeaturedHero supplier={FEATURED_SUPPLIER} onOpen={() => setOpen(FEATURED_SUPPLIER)} />
          </section>
        )}

        {/* ── Nearby row ────────────────────────────────────────── */}
        {!hasFilter && (
          <section className="mt-7">
            <header className="mx-5 mb-3 flex items-baseline justify-between">
              <SectionEyebrow label="Near you" />
              <button type="button"
                      className="flex items-center gap-1 text-[11px] font-bold"
                      style={{ color: T.accent }}>
                See all <ArrowRight size={11} strokeWidth={2.25} />
              </button>
            </header>
            <div className="scrollbar-none flex gap-3 overflow-x-auto px-5 pb-1">
              {NEARBY_SUPPLIERS.map((s) => (
                <SupplierCard key={s.id} supplier={s} onOpen={() => setOpen(s)} variant="grid" />
              ))}
            </div>
          </section>
        )}

        {/* ── Full results list ─────────────────────────────────── */}
        <section className="mt-7 px-5">
          <header className="mb-3 flex items-baseline justify-between">
            <SectionEyebrow label={query ? "Results" : "All suppliers"} />
            <span className="text-[11px]" style={{ color: T.textFaint }}>
              {filtered.length}
            </span>
          </header>
          <div className="flex flex-col gap-3">
            {filtered.length === 0 && (
              <div className="rounded-2xl px-4 py-10 text-center text-[12.5px]"
                   style={{
                     background: T.surface,
                     backdropFilter: "blur(12px)",
                     WebkitBackdropFilter: "blur(12px)",
                     border: `1px solid ${T.border}`,
                     color: T.textFaint
                   }}>
                Nothing matched. Try a different word — NEX also understands
                natural questions.
              </div>
            )}
            {filtered.map((s) => (
              <SupplierCard key={s.id} supplier={s} onOpen={() => setOpen(s)} variant="list" />
            ))}
          </div>
        </section>

        {/* ── Claim your business CTA ───────────────────────────── */}
        <section className="mt-8 mb-10 px-5">
          <div
            className="relative overflow-hidden rounded-3xl p-5"
            style={{
              background: T.surface,
              backdropFilter: "blur(16px) saturate(180%)",
              WebkitBackdropFilter: "blur(16px) saturate(180%)",
              border: `1px solid ${T.borderWarm}`,
              boxShadow: "0 20px 60px -24px rgba(251,191,36,0.35)"
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-45"
              style={{ background: "radial-gradient(circle, #F59E0B 0%, transparent 65%)", filter: "blur(40px)" }}
            />
            <div className="relative flex items-start gap-3">
              <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl text-[#141416]"
                    style={{
                      background: T.accentGrad,
                      boxShadow: "0 8px 20px -4px rgba(251,191,36,0.55)"
                    }}>
                <MessageSquarePlus size={20} strokeWidth={2.25} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-black" style={{ color: T.text }}>
                  Is your business here?
                </div>
                <div className="mt-1 text-[12px] leading-[1.45]"
                     style={{ color: T.textMuted }}>
                  Claim your listing in 30 seconds. Free forever. NEX never
                  sells leads, never takes commission.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3 text-[12.5px] font-black text-[#141416] transition-transform active:scale-[0.98]"
              style={{
                background: T.accentGrad,
                boxShadow: "0 12px 30px -6px rgba(251,191,36,0.55)"
              }}
            >
              Claim your business <ArrowRight size={13} strokeWidth={2.5} />
            </button>
          </div>
        </section>
      </div>

      <SupplierSheet supplier={open} onClose={() => setOpen(null)} />
    </div>
  );
}

// ── Small primitives ───────────────────────────────────────────────

function SectionEyebrow({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-[0.24em]"
        style={{ color: T.textMuted }}>
      {icon && <span style={{ color: T.accent }}>{icon}</span>}
      {label}
    </h3>
  );
}

// ── Featured hero card — full-bleed image + gradient overlay ───────

function FeaturedHero({ supplier: s, onOpen }: { supplier: Supplier; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative -mt-1 flex w-full flex-col overflow-hidden rounded-3xl text-left transition-transform active:scale-[0.99]"
      style={{
        background: T.surfaceSolid,
        border: `1px solid ${T.border}`,
        boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 60px -24px rgba(0,0,0,0.7)"
      }}
      aria-label={`Featured: ${s.name}`}
    >
      {/* Hero photo */}
      <div className="relative h-52 w-full overflow-hidden" style={{ background: T.surfaceSolid }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={s.photo_url}
          alt=""
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          loading="lazy"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, transparent 30%, rgba(6,6,14,0.35) 65%, rgba(6,6,14,0.95) 100%)" }}
        />
        <span
          className="absolute left-4 top-4 flex items-center gap-1 rounded-full px-2.5 py-1 text-[9.5px] font-black uppercase tracking-widest text-[#141416]"
          style={{
            background: T.accentGrad,
            boxShadow: "0 6px 18px -3px rgba(251,191,36,0.65)"
          }}
        >
          <Sparkles size={10} strokeWidth={2.5} />
          Featured
        </span>
        {typeof s.rating === "number" && (
          <span
            className="absolute right-4 top-4 rounded-full px-2 py-1 text-[10.5px] font-black"
            style={{
              background: "rgba(6,6,14,0.55)",
              backdropFilter: "blur(8px)",
              color: T.text
            }}
          >
            ★ {s.rating.toFixed(1)}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-4 pb-4">
          {s.logo_url && (
            <span className="grid h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl"
                  style={{ background: T.surfaceSolid, border: `2px solid ${T.surfaceSolid}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.logo_url} alt="" className="h-full w-full object-cover" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <div className="truncate text-[17px] font-black text-white">{s.name}</div>
              {s.verified && <ShieldCheck size={13} strokeWidth={2.25} style={{ color: T.accent }} />}
            </div>
            <div className="mt-0.5 truncate text-[11.5px]" style={{ color: "rgba(255,255,255,0.72)" }}>
              {s.category} · {s.location}
            </div>
          </div>
        </div>
      </div>

      {s.headline && (
        <p className="px-4 pt-4 text-[12.5px] leading-[1.55]" style={{ color: T.textMuted }}>
          {s.headline}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-4 pt-3">
        {s.tags?.slice(0, 3).map((t) => (
          <span
            key={t}
            className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
            style={{
              background: T.accentSoft,
              color: T.accent,
              border: `1px solid ${T.borderWarm}`
            }}
          >
            {t}
          </span>
        ))}
        <span
          className="ml-auto flex items-center gap-1 rounded-full px-3 py-1 text-[10.5px] font-black text-white"
          style={{ background: T.whatsapp, boxShadow: "0 6px 16px -4px rgba(37,211,102,0.55)" }}
        >
          Message
          <ArrowRight size={10} strokeWidth={2.75} />
        </span>
      </div>
    </button>
  );
}
