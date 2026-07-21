// /toolbox — The Toolbox. Canonical name for the full resource
// ecosystem — data tools + guides + directories, grouped by user
// intent. Renamed from /explore on 2026-07-20 — /explore is now a
// permanent 308 redirect to this URL.
//
// Tagline (Philip 2026-07-20): "Everything at hand's reach."
//
// Six intent tracks:
//   1. Hire     — /trades, /regions, /check-quote, /vs
//   2. Cost     — /price-index, /cost/*
//   3. Fund     — /grants
//   4. Learn    — /answers, /vault, /what-is
//   5. Career   — /careers, /apprenticeships
//   6. Locate   — /regions, /trades/[trade]/[city]
//
// Ranks for high-intent discovery queries:
//   "the networkers toolbox", "uk trade tools", "trade resources uk"

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight, Wrench, TrendingUp, ShieldCheck, HelpCircle,
  Sparkles, GraduationCap, BookOpen, BookMarked, MapPin, Calculator,
  Building, ClipboardList, LucideIcon
} from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;

export const metadata: Metadata = {
  title:       `The Toolbox · everything at hand's reach — ${BRAND.name}`,
  description: `The Networkers Toolbox — every UK trade tool, guide, and directory in one place. UK Trade Price Index, Grants Tracker, Quote Checker, Q&A hub, Career Guides, The Vault, regional coverage. Free.`,
  alternates:  { canonical: `/toolbox` },
  openGraph:   {
    type:     "website",
    siteName: BRAND.name,
    title:    `The Toolbox — The Networkers`,
    description: `Everything at hand's reach — every UK trade tool + guide in one place.`,
    url:      absolute(`/toolbox`)
  },
  robots: { index: true, follow: true }
};

type Tile = {
  href:        string;
  title:       string;
  description: string;
  Icon:        LucideIcon;
  meta:        string;
  featured?:   boolean;
};

type Track = {
  eyebrow: string;
  intent:  string;
  Icon:    LucideIcon;
  tint:    string;      // header eyebrow colour
  tiles:   Tile[];
};

const TRACKS: Track[] = [
  {
    eyebrow: "1 · Hire",
    intent:  "I need to hire a UK trade",
    Icon:    Wrench,
    tint:    "#FFB300",
    tiles: [
      { href: "/trades",           title: "Trades directory",       description: "Verified UK trades by category — hire direct, no lead broker, no commission.",              Icon: Wrench,   meta: "6 core trades · 60 city pages", featured: true },
      { href: "/regions",          title: "By UK region",           description: "Browse by North West, Yorkshire, Scotland, London, and more.",                              Icon: MapPin,   meta: "7 UK regions" },
      { href: "/check-quote",      title: "Quote sanity checker",   description: "Paste any UK trade quote — instant fair / high / low verdict.",                             Icon: Sparkles, meta: "Free · No signup" }
    ]
  },
  {
    eyebrow: "2 · Cost",
    intent:  "I want to understand what things cost",
    Icon:    TrendingUp,
    tint:    "#F59E0B",
    tiles: [
      { href: "/price-index",           title: "UK Trade Price Index",     description: "Monthly-verified day rates + hourly rates + regional multipliers for every core trade.", Icon: TrendingUp, meta: "Refreshed monthly", featured: true },
      { href: "/cost/kitchen-extension", title: "Kitchen extension cost",  description: "£30k-£75k UK 2026 — full breakdown by size, region, and finish tier.",                    Icon: Calculator, meta: "5 cost projects" },
      { href: "/cost/new-boiler",       title: "New boiler cost",          description: "£1,650-£2,900 UK 2026 — combi, system, regular, with grant offset.",                     Icon: Calculator, meta: "" }
    ]
  },
  {
    eyebrow: "3 · Fund",
    intent:  "I want to see UK grants I can claim",
    Icon:    ShieldCheck,
    tint:    "#166534",
    tiles: [
      { href: "/grants",                title: "UK Grants Tracker",         description: "Every live UK grant + scheme — Boiler Upgrade, ECO4, Home Upgrade, Warmer Homes Scotland, 0% VAT.", Icon: ShieldCheck, meta: "8 schemes tracked", featured: true },
      { href: "/grants#boiler-upgrade-scheme",       title: "Boiler Upgrade Scheme",        description: "£7,500 off a heat pump replacement in England + Wales.", Icon: ShieldCheck, meta: "Ofgem-administered" },
      { href: "/grants#warm-homes-scotland",         title: "Warmer Homes Scotland",        description: "Fully-funded retrofit for eligible Scottish households.", Icon: ShieldCheck, meta: "Scottish Gov" }
    ]
  },
  {
    eyebrow: "4 · Learn",
    intent:  "I want to understand a topic before I commit",
    Icon:    BookOpen,
    tint:    "#0A0A0A",
    tiles: [
      { href: "/answers",         title: "Q&A Hub",             description: "30 straight answers to the UK's most-asked trade + construction questions.",                    Icon: HelpCircle,  meta: "30 QAPage-schema leaves", featured: true },
      { href: "/vault",           title: "The Vault",           description: "Long-form editorial — how to hire, spot cowboys, read a quote, structure payments.",            Icon: BookOpen,   meta: "8 articles · Reviewed quarterly" },
      { href: "/what-is",         title: "Trade Encyclopaedia", description: "Plain-English definitions — what plumbers, electricians, carpenters, plasterers, roofers do.",  Icon: BookMarked, meta: "6 core trades explained" }
    ]
  },
  {
    eyebrow: "5 · Career",
    intent:  "I want to become a UK trade",
    Icon:    GraduationCap,
    tint:    "#B45309",
    tiles: [
      { href: "/careers",              title: "Career Guides",          description: "How to become a UK plumber, electrician, carpenter, plasterer, roofer, bricklayer — qualifications + earnings + routes.", Icon: GraduationCap, meta: "6 trades · IfATE-sourced", featured: true },
      { href: "/apprenticeships/apply", title: "Apprenticeship apply",  description: "16+ young people applying to local trades. Free. Verified employers only reach out.",                                     Icon: Sparkles,     meta: "The Networkers supports UK trade youth" },
      { href: "/apprenticeships",      title: "Live apprenticeships",   description: "Employers browsing here: reveal an apprentice's WhatsApp for 1 washer.",                                                   Icon: ClipboardList, meta: "Employer view" }
    ]
  },
  {
    eyebrow: "6 · Locate",
    intent:  "I want to browse by UK location",
    Icon:    MapPin,
    tint:    "#7C3AED",
    tiles: [
      { href: "/regions",              title: "UK Regions",             description: "Regional pricing + city coverage + region-specific grants.",                          Icon: MapPin, meta: "7 regions · 8 UK cities", featured: true },
      { href: "/trades/plumber/london",     title: "London plumbers",   description: "Verified plumbers in Greater London.",                                                Icon: Building, meta: "London coverage" },
      { href: "/trades/electrician/manchester", title: "Manchester electricians", description: "Verified electricians in Greater Manchester.",                             Icon: Building, meta: "North West coverage" }
    ]
  }
];

export default function ToolboxPage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "The Toolbox", item: absolute("/toolbox") }
    ]
  };
  const totalTiles = TRACKS.reduce((n, t) => n + t.tiles.length, 0);

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 md:py-12">
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">The Toolbox</span>
        </nav>

        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            Everything at hand's reach
          </p>
          <h1 className="mt-1 text-[36px] font-black leading-tight text-neutral-900 md:text-[52px]">
            The Toolbox
          </h1>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 md:text-[15px]">
            {totalTiles} tools, guides, and directories — grouped by what you're trying to do. Every surface free, evidence-first, monthly-refreshed. Everything The Networkers builds, in one place.
          </p>
        </header>

        {/* Track jump nav */}
        <nav aria-label="Skip to intent track" className="mt-6">
          <ul className="flex flex-wrap gap-1.5">
            {TRACKS.map((t) => (
              <li key={t.eyebrow}>
                <a
                  href={`#${slug(t.eyebrow)}`}
                  className="inline-flex items-center gap-1 rounded-full border-2 bg-white px-3 py-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-800 hover:-translate-y-0.5 transition"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                >
                  <t.Icon size={11} strokeWidth={2.6} style={{ color: t.tint }}/>
                  {t.intent}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Track sections */}
        <div className="mt-10 space-y-12">
          {TRACKS.map((t) => (
            <section key={t.eyebrow} id={slug(t.eyebrow)} className="scroll-mt-24">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: t.tint }}
                >
                  <t.Icon size={16} strokeWidth={2.6} className={t.tint === "#0A0A0A" || t.tint === "#166534" || t.tint === "#7C3AED" || t.tint === "#B45309" ? "text-white" : "text-neutral-900"}/>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: t.tint }}>
                    {t.eyebrow}
                  </p>
                  <h2 className="text-[20px] font-black leading-tight text-neutral-900 md:text-[26px]">
                    {t.intent}
                  </h2>
                </div>
              </div>

              <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {t.tiles.map((tile) => (
                  <li key={tile.href} className={tile.featured ? "md:col-span-1" : ""}>
                    <Link
                      href={tile.href}
                      className="group flex h-full flex-col rounded-2xl border-2 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                      style={{ borderColor: tile.featured ? t.tint : "rgba(139,69,19,0.10)" }}
                    >
                      <div className="flex items-start gap-2">
                        <tile.Icon size={16} strokeWidth={2.4} className="mt-0.5 shrink-0" style={{ color: t.tint }}/>
                        <h3 className="text-[15px] font-black leading-snug text-neutral-900">
                          {tile.title}
                        </h3>
                      </div>
                      <p className="mt-2 line-clamp-3 text-[12px] leading-snug text-neutral-600">
                        {tile.description}
                      </p>
                      <div className="mt-auto flex items-center justify-between pt-3">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                          {tile.meta || " "}
                        </span>
                        <ArrowUpRight size={12} strokeWidth={2.6} className="text-neutral-400 group-hover:text-neutral-900"/>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Trust footer */}
        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> Every price + fact cross-checked against UK Trade Price Index + regulators · Monthly refresh</span>
        </footer>
      </div>
    </main>
  );
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
