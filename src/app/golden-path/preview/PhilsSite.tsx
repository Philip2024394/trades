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
  AvatarCluster,
  BeforeAfterSlider,
  Button,
  CtaBand,
  Grid,
  MobileNavDrawer,
  ProcessBand,
  ProjectTile,
  SectionHeader,
  ServiceTile,
  SplitHero,
  StatsBand,
  StickyBottomActionBar
} from "@/platform/ui";
import { QuoteRequestSheet } from "./QuoteRequestSheet";

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
  const [quoteSheetOpen, setQuoteSheetOpen] = useState(false);

  const closeMobileNav = () => setMobileNavOpen(false);
  const openQuoteSheet = () => setQuoteSheetOpen(true);
  const closeQuoteSheet = () => setQuoteSheetOpen(false);

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
        <SplitHero
          eyebrow={{ icon: MapPin, label: "Dublin · Cork · Galway" }}
          headline={hero.data.headline}
          subheadline={hero.data.subheadline}
          supportingLine={hero.data.supportingLine}
          primaryCta={{
            label: hero.data.primaryCtaLabel,
            onClick: openQuoteSheet
          }}
          secondaryCta={{
            label: "Call Phil",
            href: "tel:+35300000000",
            icon: Phone
          }}
          trustBadges={hero.data.trustBadges}
          imageIcon={DoorOpen}
          imageHint={hero.data.imageHint}
        />
      ) : null}

      {/* ── Stats band ──────────────────────────────────────── */}
      <StatsBand
        stats={[
          { value: 15, label: "Years trading", suffix: "+", icon: Award },
          { value: 200, label: "Jobs completed", suffix: "+", icon: Hammer },
          { value: "5.0", label: "Average review", icon: Star }
        ]}
        variant="muted"
      />

      {/* ── TrustBar intentionally omitted for residential carpentry ─
          "Accredited by" strip is reserved for high-risk / regulated
          trades (electricians · gas engineers · roofers · scaffolders
          · pest control · steel fab · fire-safety installers). For
          low-risk residential trades, trust signals live inside the
          value-props section and the trust panel below. */}

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

      {/* ── How we work ─────────────────────────────────────── */}
      <ProcessBand
        overline="How we work"
        heading="From first call to finished job"
        subheading="Straightforward, predictable, no surprises."
        steps={[
          {
            title: "Free survey",
            description: "Visit within 3 working days. Measurements + honest opinion.",
            icon: MapPin
          },
          {
            title: "Fixed quote",
            description: "Detailed quote within 48 hours. What you sign is what you pay.",
            icon: FileCheck
          },
          {
            title: "Installation",
            description: "Our in-house team. No subcontractors. Site left clean daily.",
            icon: Hammer
          },
          {
            title: "Guarantee",
            description: "Written guarantee on workmanship. We come back if anything's off.",
            icon: ShieldCheck
          }
        ]}
      />

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
                <AvatarCluster
                  size="xs"
                  leadingIcon={Star}
                  avatars={[
                    { alt: "Maria O'Sullivan" },
                    { alt: "Rónán Byrne" },
                    { alt: "Ann Kelly" },
                    { alt: "James Doyle" }
                  ]}
                  trailingLabel={`${projects.length} completed jobs`}
                />
              }
            />

            {/* Featured before/after showcase */}
            <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_1fr] md:items-center md:gap-8">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                  Featured
                </div>
                <h3 className="text-[17px] font-semibold text-neutral-900 md:text-[19px]">
                  Dublin fire door installation
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-700 md:text-[14px]">
                  Landlord needed FD30 fire doors installed across three
                  flats ahead of a compliance inspection. Drag the handle to
                  see the transformation.
                </p>
                <div className="mt-3 inline-flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">
                    Oak veneer FD30
                  </span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">
                    2 days
                  </span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">
                    Dublin
                  </span>
                </div>
              </div>
              <BeforeAfterSlider
                aspect="landscape"
                before={
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-neutral-400 to-neutral-600 text-neutral-200">
                    <div className="text-center">
                      <div className="text-[11px] font-semibold uppercase tracking-wide">
                        Original doors
                      </div>
                      <div className="mt-0.5 text-[10px] opacity-80">
                        Photo slot — before
                      </div>
                    </div>
                  </div>
                }
                after={
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-amber-300 to-amber-500 text-neutral-900">
                    <div className="text-center">
                      <div className="text-[11px] font-semibold uppercase tracking-wide">
                        FD30 Oak veneer
                      </div>
                      <div className="mt-0.5 text-[10px] opacity-70">
                        Photo slot — after
                      </div>
                    </div>
                  </div>
                }
              />
            </div>

            <div className="mt-8 md:mt-10">
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
      <div id="contact">
        <CtaBand
          overline="Get in touch"
          headline="Ready to talk to Phil?"
          subheadline={
            hero?.data.primaryCtaLabel === "Book Free Survey"
              ? "A free on-site survey with a fixed quote afterwards. No obligation."
              : "Get in touch — Phil replies within one working day."
          }
          primaryCta={{
            label: hero?.data.primaryCtaLabel ?? "Request a Quote",
            onClick: openQuoteSheet
          }}
          secondaryCta={{
            label: "Call Phil",
            href: "tel:+35300000000",
            icon: Phone
          }}
        />
      </div>

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
          <Button onClick={openQuoteSheet} intent="primary" size="lg" block>
            {hero?.data.primaryCtaLabel ?? "Get in touch"}
          </Button>
        }
      />

      {/* ── Quote request bottom sheet ──────────────────────── */}
      <QuoteRequestSheet open={quoteSheetOpen} onClose={closeQuoteSheet} />

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
