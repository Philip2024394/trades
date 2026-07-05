// PhilsSite — renders Phil's composed ContentManifest as a real
// trade website. No demo copy — every string on this page comes from
// the manifest's typed blocks.

"use client";

import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  Award,
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarClock,
  Camera,
  ChefHat,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  DoorClosed,
  DoorOpen,
  FileCheck,
  Flame,
  Frame,
  Grid3x3,
  Hammer,
  Layers,
  MapPin,
  Menu,
  Phone,
  Ruler,
  ShieldCheck,
  Star,
  Truck,
  Wrench,
  X
} from "lucide-react";
import {
  Alert,
  Button,
  Grid,
  MobileNavDrawer,
  ProjectTile,
  SectionHeader,
  ServiceTile,
  StickyBottomActionBar
} from "@/platform/ui";

/** Service slug → Lucide icon. Falls back to Hammer for anything not
 *  registered here. Extend as new services appear in trade seeds. */
const SERVICE_ICON: Record<string, typeof Hammer> = {
  "door-installation": DoorOpen,
  "fire-doors": Flame,
  "composite-doors": ShieldCheck,
  "internal-doors": DoorClosed,
  "custom-doors": Ruler,
  "kitchen-fitting": ChefHat,
  "fitted-wardrobes": Archive,
  decking: Layers,
  flooring: Grid3x3,
  "commercial-fit-out": Building2,
  "small-repairs": Wrench,
  architraves: Frame
};

function serviceIcon(slug: string): typeof Hammer {
  return SERVICE_ICON[slug] ?? Hammer;
}
import { useMemo, useState } from "react";
import type {
  ContentBlock,
  ContentManifest,
  FaqBlockData,
  HeroBlockData,
  ProjectStoryBlockData,
  ServiceListBlockData,
  TrustCopyBlockData,
  ValuePropsBlockData
} from "@/platform/content";

const ICON_MAP: Record<string, typeof Award> = {
  Award,
  BadgeCheck,
  CalendarClock,
  Camera,
  Check,
  Clock,
  FileCheck,
  Hammer,
  ShieldCheck,
  Truck
};

export function PhilsSite({ manifest }: { manifest: ContentManifest }) {
  const home = manifest.pages.find((p) => p.slug === "home");

  const { hero, services, valueProps, trust, faq } = useMemo(() => {
    const blocks = home?.sections.flatMap((s) => s.blocks) ?? [];
    return {
      hero: blocks.find((b) => b.kind === "hero") as
        | ContentBlock<HeroBlockData>
        | undefined,
      services: blocks.find((b) => b.kind === "service-list") as
        | ContentBlock<ServiceListBlockData>
        | undefined,
      valueProps: blocks.find((b) => b.kind === "value-props") as
        | ContentBlock<ValuePropsBlockData>
        | undefined,
      trust: blocks.find((b) => b.kind === "trust-copy") as
        | ContentBlock<TrustCopyBlockData>
        | undefined,
      faq: blocks.find((b) => b.kind === "faq") as
        | ContentBlock<FaqBlockData>
        | undefined
    };
  }, [home]);

  const projects = useMemo(() => {
    const map = new Map<string, ContentBlock<ProjectStoryBlockData>>();
    for (const page of manifest.pages) {
      for (const section of page.sections) {
        for (const block of section.blocks) {
          if (block.kind === "project-story" && !map.has(block.slug)) {
            map.set(block.slug, block as ContentBlock<ProjectStoryBlockData>);
          }
        }
      }
    }
    return Array.from(map.values());
  }, [manifest]);

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* ── Demo banner ─────────────────────────────────────── */}
      <div className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2 text-[12px]">
          <div className="flex min-w-0 items-center gap-2 text-amber-900">
            <Camera className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden truncate sm:inline">
              Golden Path preview — this site was composed by the platform,
              not hand-authored.
            </span>
            <span className="truncate sm:hidden">Golden Path preview</span>
          </div>
          <Link
            href="/golden-path"
            className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-full bg-amber-900 px-2.5 py-1 font-medium text-white hover:bg-amber-800"
          >
            <ArrowLeft className="h-3 w-3" />
            <span className="hidden sm:inline">Back to Golden Path</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </div>
      </div>

      {/* ── Site nav ────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white">
              <Hammer className="h-4 w-4" />
            </div>
            <div className="text-[15px] font-bold text-neutral-900">
              Phil&apos;s Carpentry
            </div>
          </div>
          <div className="hidden items-center gap-6 text-[13px] text-neutral-700 md:flex">
            <a href="#services" className="hover:text-neutral-900">
              Services
            </a>
            <a href="#projects" className="hover:text-neutral-900">
              Projects
            </a>
            <a href="#trust" className="hover:text-neutral-900">
              Why us
            </a>
            <a href="#faq" className="hover:text-neutral-900">
              FAQ
            </a>
            <a href="#contact" className="hover:text-neutral-900">
              Contact
            </a>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="#contact"
              className="hidden min-h-[44px] items-center gap-1.5 rounded-full bg-amber-400 px-4 text-[13px] font-semibold text-neutral-900 hover:bg-amber-300 md:inline-flex"
            >
              {hero?.data.primaryCtaLabel ?? "Get in touch"}
            </a>
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-200 text-neutral-900 hover:bg-neutral-50 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile nav drawer ───────────────────────────────── */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog">
          <div
            className="absolute inset-0 bg-neutral-900/60"
            onClick={closeMobileNav}
          />
          <div className="absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <span className="text-[15px] font-bold text-neutral-900">
                Phil&apos;s Carpentry
              </span>
              <button
                type="button"
                onClick={closeMobileNav}
                aria-label="Close menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4">
              <ul className="flex flex-col gap-1 text-[15px]">
                {[
                  { href: "#services", label: "Services" },
                  { href: "#projects", label: "Projects" },
                  { href: "#trust", label: "Why us" },
                  { href: "#faq", label: "FAQ" },
                  { href: "#contact", label: "Contact" }
                ].map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={closeMobileNav}
                      className="flex min-h-[44px] items-center rounded-lg px-3 text-neutral-900 hover:bg-neutral-50"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="border-t border-neutral-200 p-4">
              <a
                href="#contact"
                onClick={closeMobileNav}
                className="flex min-h-[48px] items-center justify-center rounded-full bg-amber-400 px-4 text-[14px] font-semibold text-neutral-900 hover:bg-amber-300"
              >
                {hero?.data.primaryCtaLabel ?? "Get in touch"}
              </a>
              <a
                href="tel:+35300000000"
                onClick={closeMobileNav}
                className="mt-2 flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-neutral-200 px-4 text-[13px] font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                <Phone className="h-4 w-4" />
                Call Phil
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Hero ────────────────────────────────────────────── */}
      {hero ? (
        <section className="relative overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 text-white">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_theme(colors.amber.500)_0%,_transparent_50%)]" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-16 md:py-24">
            <div className="grid grid-cols-[1fr_112px] items-center gap-4 sm:grid-cols-[1fr_140px] sm:gap-6 md:grid-cols-2 md:gap-10">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-amber-200">
                  <MapPin className="h-3 w-3" />
                  Dublin · Cork · Galway
                </div>
                <h1 className="text-[22px] font-bold leading-[1.15] sm:text-3xl md:text-5xl md:leading-tight">
                  {hero.data.headline}
                </h1>
                {hero.data.subheadline ? (
                  <p className="mt-3 text-[13px] leading-relaxed text-neutral-200 md:mt-4 md:text-[17px]">
                    {hero.data.subheadline}
                  </p>
                ) : null}
                {hero.data.supportingLine ? (
                  <p className="mt-2 hidden text-[13px] text-neutral-300 sm:block">
                    {hero.data.supportingLine}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <a
                    href="#contact"
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-amber-400 px-4 text-[13px] font-semibold text-neutral-900 hover:bg-amber-300 md:min-h-[48px] md:px-5 md:text-[14px]"
                  >
                    {hero.data.primaryCtaLabel}
                  </a>
                  <a
                    href="tel:+35300000000"
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/30 px-4 text-[13px] font-semibold text-white hover:bg-white/10 md:min-h-[48px] md:px-5 md:text-[14px]"
                  >
                    <Phone className="h-4 w-4" />
                    Call Phil
                  </a>
                </div>
                {hero.data.trustBadges?.length ? (
                  <div className="mt-5 hidden flex-wrap gap-2 text-[11px] sm:flex">
                    {hero.data.trustBadges.map((badge, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-white"
                      >
                        <BadgeCheck className="h-3 w-3 text-amber-300" />
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div>
                <div className="rounded-2xl border border-white/10 bg-neutral-800/50 p-2 backdrop-blur md:p-4">
                  <div className="aspect-square w-full rounded-xl bg-gradient-to-br from-neutral-700/70 to-neutral-800/60 md:aspect-[4/3]">
                    <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-neutral-400 md:gap-2">
                      <Camera className="h-6 w-6 md:h-8 md:w-8" />
                      <div className="hidden text-[11px] md:block">
                        Hero image slot
                      </div>
                      <div className="hidden text-center text-[11px] text-neutral-600 md:block">
                        {hero.data.imageHint}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Services ────────────────────────────────────────── */}
      {services ? (
        <section id="services" className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <SectionHeader
            overline="Services"
            overlineIcon={Hammer}
            title="What we do"
            subtitle={services.data.intro}
          />
          <div className="mt-6 md:mt-8">
            <Grid density="compact">
              {services.data.items.map((s) => (
                <ServiceTile
                  key={s.slug}
                  icon={serviceIcon(s.slug)}
                  title={s.title}
                  description={s.description}
                  featured={s.featured}
                />
              ))}
            </Grid>
          </div>
        </section>
      ) : null}

      {/* ── Value props ─────────────────────────────────────── */}
      {valueProps ? (
        <section className="bg-white py-12 md:py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-bold text-neutral-900">
              {valueProps.data.heading}
            </h2>
            {valueProps.data.intro ? (
              <p className="mt-2 max-w-2xl text-[15px] text-neutral-700">
                {valueProps.data.intro}
              </p>
            ) : null}
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {valueProps.data.items.map((item, i) => {
                const Icon = ICON_MAP[item.iconHint ?? ""] ?? Check;
                return (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-[14px] font-semibold text-neutral-900">
                      {item.title}
                    </h3>
                    <p className="text-[13px] leading-relaxed text-neutral-700">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Projects ────────────────────────────────────────── */}
      {projects.length ? (
        <section id="projects" className="bg-neutral-50 py-12 md:py-16">
          <div className="mx-auto max-w-6xl px-4">
            <SectionHeader
              overline="Portfolio"
              overlineIcon={Camera}
              title="Recent projects"
              subtitle="Real finished jobs. Real materials. Real customer feedback."
              trailing={
                <span>
                  {projects.length}{" "}
                  {projects.length === 1 ? "completed job" : "completed jobs"}
                </span>
              }
            />
            <div className="mt-6 md:mt-8">
              <Grid density="cards">
                {projects.slice(0, 6).map((p) => (
                  <ProjectTile
                    key={p.slug}
                    title={p.data.title}
                    location={p.data.location}
                    duration={p.data.duration}
                    photoCount={p.data.photoCount}
                    solution={p.data.solution}
                    materials={p.data.materials}
                    customerQuote={p.data.customerQuote}
                  />
                ))}
              </Grid>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Trust ───────────────────────────────────────────── */}
      {trust ? (
        <section id="trust" className="bg-white py-12 md:py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div>
                <SectionHeader
                  overline="Why us"
                  overlineIcon={ShieldCheck}
                  title={trust.data.heading}
                  subtitle={trust.data.intro}
                />
                <ul className="mt-6 flex flex-col gap-3">
                  {trust.data.bullets.map((b, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[14px] text-neutral-800"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl bg-neutral-900 p-6 text-white">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-semibold text-neutral-900">
                  <ShieldCheck className="h-3 w-3" />
                  Our promise
                </div>
                {trust.data.guaranteeLine ? (
                  <p className="mt-2 text-[16px] leading-relaxed">
                    {trust.data.guaranteeLine}
                  </p>
                ) : null}
                {trust.data.badges?.length ? (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {trust.data.badges.map((badge, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] text-white"
                      >
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── FAQ ─────────────────────────────────────────────── */}
      {faq ? (
        <section id="faq" className="bg-neutral-50 py-12 md:py-16">
          <div className="mx-auto max-w-3xl px-4">
            <SectionHeader
              overline="FAQ"
              overlineIcon={BookOpen}
              title={faq.data.heading}
              subtitle="Straight answers to the questions we get on nearly every survey."
            />
            <ul className="mt-6 flex flex-col gap-2">
              {faq.data.items.map((item, i) => {
                const open = openFaq === i;
                const placeholder = item.answer.startsWith("[Add");
                return (
                  <li
                    key={i}
                    className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : i)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-neutral-50"
                    >
                      <span className="text-[14px] font-medium text-neutral-900">
                        {item.question}
                      </span>
                      {open ? (
                        <ChevronUp className="h-4 w-4 text-neutral-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-neutral-500" />
                      )}
                    </button>
                    {open ? (
                      <div
                        className={`border-t border-neutral-200 px-4 py-3 text-[13px] ${
                          placeholder
                            ? "bg-amber-50 italic text-amber-800"
                            : "text-neutral-700"
                        }`}
                      >
                        {item.answer}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ── Contact ─────────────────────────────────────────── */}
      <section id="contact" className="bg-neutral-900 py-12 md:py-16 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">
            Ready to talk to Phil?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] text-neutral-300">
            {hero?.data.primaryCtaLabel === "Book Free Survey"
              ? "A free on-site survey with a fixed quote afterwards. No obligation."
              : "Get in touch — Phil replies within one working day."}
          </p>
          <div className="mx-auto mt-6 flex max-w-md flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
            <a
              href="tel:+35300000000"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-amber-400 px-5 text-[14px] font-semibold text-neutral-900 hover:bg-amber-300"
            >
              <Phone className="h-4 w-4" />
              Call Phil
            </a>
            <a
              href="mailto:phil@example.com"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-white/30 px-5 text-[14px] font-semibold text-white hover:bg-white/10"
            >
              {hero?.data.primaryCtaLabel ?? "Get in touch"}
            </a>
          </div>
        </div>
      </section>

      {/* ── Sticky mobile action bar ────────────────────────── */}
      <StickyBottomActionBar
        left={
          <Button
            href="tel:+35300000000"
            intent="secondary"
            size="lg"
            icon={Phone}
            block
          >
            Call Phil
          </Button>
        }
        right={
          <Button href="#contact" intent="primary" size="lg" block>
            {hero?.data.primaryCtaLabel ?? "Get in touch"}
          </Button>
        }
      />

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-neutral-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 md:flex-row">
          <div className="flex items-center gap-2 text-[12px] text-neutral-600">
            <Hammer className="h-3.5 w-3.5" />
            Phil&apos;s Carpentry · Dublin, Ireland · 15+ years
          </div>
          <Link
            href="/golden-path"
            className="inline-flex items-center gap-1 text-[12px] text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Golden Path demo
          </Link>
        </div>
      </footer>
    </div>
  );
}
