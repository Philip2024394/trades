"use client";

// Brand Vault Home — the six-zone merchant home screen per V2 Part 5.
// Client component so we can add Cmd+K palette, floating AI button,
// and interactive quick actions in later slices.

import Link from "next/link";
import { useState } from "react";
import {
  Sparkles, Palette, Type as TypeIcon, Camera, BookOpen,
  Car, CreditCard, Globe, FileText, Shirt, Map,
  Zap, Wrench, Wand2, Download, ArrowUpRight,
  MessageSquare, TrendingUp, Clock, ChevronRight, Bell
} from "lucide-react";
import type { BrandRecord } from "@/lib/design/brand/schema";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";
const BG_CREAM     = "#FBF6EC";

type Props = {
  merchant: { name: string; trade: string; slug: string };
  brand:    BrandRecord | null;
  brandVersion:  number;
  brandUpdatedAt: string | null;
  vanSessions: Array<{
    id: string; businessName: string; vanSlug: string; vanColour: string;
    status: string; thumbnailUrl: string | null; startedAt: string;
  }>;
  activity: Array<{ type: string; createdAt: string }>;
  signals:  Array<{
    id: string; kind: string; title: string; body: string;
    actionUrl: string | null; actionLabel: string | null; priority: number;
  }>;
};

export function BrandVaultHome(props: Props) {
  const healthScore = computeBrandHealth(props.brand, props.vanSessions.length);
  const firstName = props.merchant.name.split(" ")[0] || "there";

  return (
    <div className="min-h-screen" style={{ backgroundColor: BG_CREAM, color: BRAND_BLACK }}>
      {/* ─── ZONE 1 · Hero ────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-10 pb-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[13px] font-black text-neutral-600">Welcome back, {firstName} 👋</p>
            <h1 className="mt-1 text-3xl font-black leading-tight sm:text-4xl">{props.merchant.name}</h1>
            {props.merchant.trade && (
              <p className="mt-1 text-[13px] font-semibold text-neutral-500 capitalize">{props.merchant.trade.replace(/-/g, " ")}</p>
            )}
          </div>
          <BrandHealthCard score={healthScore.overall} axes={healthScore.axes}/>
        </div>
      </section>

      {/* ─── ZONE 2 · Quick Actions ──────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-6">
        <div className="flex flex-wrap gap-2">
          <QuickAction icon={<Sparkles size={13}/>} label="Generate" href="/logo/van" primary/>
          <QuickAction icon={<Wand2 size={13}/>} label="Improve"    href="#improve"/>
          <QuickAction icon={<ArrowUpRight size={13}/>} label="Compare" href="#compare"/>
          <QuickAction icon={<Download size={13}/>} label="Export"     href="#export"/>
          <QuickAction icon={<MessageSquare size={13}/>} label="Ask AI" href="#ask-ai"/>
        </div>
      </section>

      {/* ─── ZONE 3 · My Brand ──────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-6">
        <SectionHeader title="My Brand"/>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <BrandTile icon={<Palette size={16}/>} label="Logo"       version={props.brand?.logo?.masterSvg ? "set" : "—"} href="/studio/brands"/>
          <BrandTile icon={<Zap size={16}/>}     label="Colours"    version={props.brand ? `${countColours(props.brand)} set` : "—"} href="/studio/brands"/>
          <BrandTile icon={<TypeIcon size={16}/>} label="Typography" version={props.brand?.typography?.primary || "—"} href="/studio/brands"/>
          <BrandTile icon={<BookOpen size={16}/>} label="Brand Guide" version={props.brandVersion > 0 ? `v${props.brandVersion}` : "—"} href="/studio/brands"/>
          <BrandTile icon={<Camera size={16}/>}   label="Photography" version={props.brand?.imagery?.portfolio?.length ? `${props.brand.imagery.portfolio.length} photos` : "—"} href="/studio/brands"/>
        </div>
      </section>

      {/* ─── ZONE 4 · My Assets ─────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-6">
        <SectionHeader title="My Assets" action={{ label: "See all", href: "/studio/vault/assets" }}/>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <AssetTile icon={<Car size={16}/>}        label="Van"           status="Ready"    thumbnailUrl={props.vanSessions[0]?.thumbnailUrl ?? null} href="/logo/van"/>
          <AssetTile icon={<CreditCard size={16}/>} label="Cards"         status="Pending"  thumbnailUrl={null}                                         href="#business-card"/>
          <AssetTile icon={<Globe size={16}/>}      label="Website"       status="Draft"    thumbnailUrl={null}                                         href="#website"/>
          <AssetTile icon={<FileText size={16}/>}   label="Invoice"       status="Pending"  thumbnailUrl={null}                                         href="#invoice"/>
          <AssetTile icon={<Map size={16}/>}        label="Signage"       status="Pending"  thumbnailUrl={null}                                         href="#signage"/>
          <AssetTile icon={<Shirt size={16}/>}      label="Workwear"      status="Pending"  thumbnailUrl={null}                                         href="#workwear"/>
        </div>
      </section>

      {/* ─── ZONE 5 · Recent Activity ────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-6">
        <SectionHeader title="Recent Activity"/>
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {props.activity.length === 0 ? (
            <p className="p-4 text-[13px] text-neutral-500">Nothing yet. Your generated assets, brand edits, and exports will land here.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {props.activity.slice(0, 6).map((a, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                  <Clock size={13} className="text-neutral-400"/>
                  <span className="font-black">{prettyEventName(a.type)}</span>
                  <span className="ml-auto text-neutral-500">{formatTimeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ─── ZONE 6 · AI Recommendations ─────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <SectionHeader title="AI Recommendations" action={{ label: "From Mate", href: "#mate" }}/>
        {props.signals.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-[13px] text-neutral-500">
              Mate's brain is quiet right now. Once you publish your first assets, seasonal ideas and improvement suggestions will surface here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {props.signals.map((s) => (
              <li key={s.id} className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-3">
                {s.priority <= 1 ? <TrendingUp size={16} className="mt-0.5 text-amber-600"/> : <Bell size={16} className="mt-0.5 text-neutral-400"/>}
                <div className="flex-1">
                  <p className="text-[13px] font-black">{s.title}</p>
                  <p className="mt-0.5 text-[12px] text-neutral-600">{s.body}</p>
                </div>
                {s.actionUrl && (
                  <Link href={s.actionUrl} className="rounded-full px-3 py-1 text-[11px] font-black transition hover:brightness-95" style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}>
                    {s.actionLabel ?? "Open"}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────

function SectionHeader({ title, action }: { title: string; action?: { label: string; href: string } }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h2 className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">{title}</h2>
      {action && (
        <Link href={action.href} className="text-[11px] font-black text-neutral-600 hover:text-neutral-900">
          {action.label} <ChevronRight size={10} className="inline"/>
        </Link>
      )}
    </div>
  );
}

function QuickAction({ icon, label, href, primary = false }: { icon: React.ReactNode; label: string; href: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-black transition hover:brightness-95 " +
        (primary ? "" : "border border-neutral-300 bg-white hover:bg-neutral-50")
      }
      style={primary ? { backgroundColor: BRAND_BLACK, color: BRAND_YELLOW } : undefined}
    >
      {icon} {label}
    </Link>
  );
}

function BrandTile({ icon, label, version, href }: { icon: React.ReactNode; label: string; version: string; href: string }) {
  return (
    <Link href={href} className="group flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-3 transition hover:shadow-md">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: BG_CREAM, color: BRAND_BLACK }}>{icon}</span>
      <div>
        <p className="text-[12px] font-black">{label}</p>
        <p className="text-[10px] text-neutral-500">{version}</p>
      </div>
    </Link>
  );
}

function AssetTile({ icon, label, status, thumbnailUrl, href }: { icon: React.ReactNode; label: string; status: string; thumbnailUrl: string | null; href: string }) {
  const statusColour = status === "Ready" ? "text-green-700" : status === "Draft" ? "text-neutral-500" : "text-amber-700";
  return (
    <Link href={href} className="group flex flex-col rounded-2xl border border-neutral-200 bg-white p-2 transition hover:shadow-md">
      <div className="aspect-square overflow-hidden rounded-xl bg-neutral-100">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt={label} className="h-full w-full object-contain"/>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-400">{icon}</div>
        )}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between">
        <p className="text-[11px] font-black">{label}</p>
        <p className={`text-[9px] font-black uppercase tracking-wider ${statusColour}`}>{status}</p>
      </div>
    </Link>
  );
}

function BrandHealthCard({ score, axes }: { score: number; axes: Record<string, number> }) {
  const stars = "★★★★★".slice(0, Math.max(1, Math.round(score / 20)));
  return (
    <div className="w-64 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Brand Health</p>
        <span className="text-[10px] font-black text-amber-500">{stars}</span>
      </div>
      <p className="mt-1 text-2xl font-black">{score}%</p>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-neutral-600">
        {Object.entries(axes).map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between">
            <span className="capitalize">{k}</span>
            <span className="font-black text-neutral-900">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────

function countColours(brand: BrandRecord): number {
  let n = 0;
  if (brand.colour?.primary)   n++;
  if (brand.colour?.secondary) n++;
  if (brand.colour?.accent)    n++;
  return n;
}

/** Deterministic Brand Health score.
 *  Real Design Critic score replaces this once V3 Q12 goes live per
 *  the Networkers implementation notes in V2 Part 5. */
function computeBrandHealth(brand: BrandRecord | null, vanSessions: number): { overall: number; axes: Record<string, number> } {
  if (!brand) return { overall: 0, axes: { identity: 0, consistency: 0, premium: 0, print: 0 } };
  const identity      = brand.name && brand.industry ? 100 : 40;
  const consistency   = countColours(brand) === 3 ? 96 : 70;
  const premium       = brand.tagline && brand.positioning ? 92 : 65;
  const printReady    = brand.logo?.masterSvg ? 100 : 60;
  const marketingReady = vanSessions > 0 ? 90 : 50;
  const axes = { identity, consistency, premium, print: printReady, marketing: marketingReady };
  const overall = Math.round(
    Object.values(axes).reduce((a, b) => a + b, 0) / Object.values(axes).length
  );
  return { overall, axes };
}

function prettyEventName(type: string): string {
  return type.replace(/\.v\d+$/, "").replace(/\./g, " · ").replace(/([A-Z])/g, " $1").trim();
}

function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1)     return "just now";
  if (mins < 60)    return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)     return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
