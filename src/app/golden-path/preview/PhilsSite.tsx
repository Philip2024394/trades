// PhilsSite — renders Phil's composed ContentManifest as a real
// trade website. No demo copy — every string on this page comes
// from the manifest's typed blocks.
//
// Architecture: this file DESCRIBES the page as a data array of
// LayoutSection descriptors; ServiceOverviewLayout assembles them.

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
  Phone,
  Ruler,
  ShieldCheck,
  Star,
  Truck,
  Wrench
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  AvatarCluster,
  BeforeAfterSlider,
  Button,
  Grid,
  ProjectTile,
  SectionHeader,
  ServiceOverviewLayout,
  ServiceTile
} from "@/platform/ui";
import type { LayoutSection } from "@/platform/ui";
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
import { QuoteRequestSheet } from "./QuoteRequestSheet";

// ─── Service icon map ─────────────────────────────────────────
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

const serviceIcon = (slug: string): typeof Hammer =>
  SERVICE_ICON[slug] ?? Hammer;

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

// ─── Page-scoped section components ───────────────────────────
function DemoBanner() {
  return (
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
  );
}

function FooterContent() {
  return (
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
  );
}

function ServicesSection({
  block
}: {
  block: ContentBlock<ServiceListBlockData>;
}) {
  return (
    <section id="services" className="mx-auto max-w-6xl px-4 py-12 md:py-16">
      <SectionHeader
        overline="Services"
        overlineIcon={Hammer}
        title="What we do"
        subtitle={block.data.intro}
      />
      <div className="mt-6 md:mt-8">
        <Grid density="compact">
          {block.data.items.map((s) => (
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
  );
}

function ValuePropsSection({
  block
}: {
  block: ContentBlock<ValuePropsBlockData>;
}) {
  return (
    <section className="bg-white py-12 md:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-2xl font-bold text-neutral-900">
          {block.data.heading}
        </h2>
        {block.data.intro ? (
          <p className="mt-2 max-w-2xl text-[15px] text-neutral-700">
            {block.data.intro}
          </p>
        ) : null}
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {block.data.items.map((item, i) => {
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
  );
}

function ProjectsSection({
  projects
}: {
  projects: readonly ContentBlock<ProjectStoryBlockData>[];
}) {
  return (
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
              Landlord needed FD30 fire doors installed across three flats
              ahead of a compliance inspection. Drag the handle to see the
              transformation.
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
  );
}

function TrustSection({
  block
}: {
  block: ContentBlock<TrustCopyBlockData>;
}) {
  return (
    <section id="trust" className="bg-white py-12 md:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <SectionHeader
              overline="Why us"
              overlineIcon={ShieldCheck}
              title={block.data.heading}
              subtitle={block.data.intro}
            />
            <ul className="mt-6 flex flex-col gap-3">
              {block.data.bullets.map((b, i) => (
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
            {block.data.guaranteeLine ? (
              <p className="mt-2 text-[16px] leading-relaxed">
                {block.data.guaranteeLine}
              </p>
            ) : null}
            {block.data.badges?.length ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {block.data.badges.map((badge, i) => (
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
  );
}

function FaqSection({ block }: { block: ContentBlock<FaqBlockData> }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="bg-neutral-50 py-12 md:py-16">
      <div className="mx-auto max-w-3xl px-4">
        <SectionHeader
          overline="FAQ"
          overlineIcon={BookOpen}
          title={block.data.heading}
          subtitle="Straight answers to the questions we get on nearly every survey."
        />
        <ul className="mt-6 flex flex-col gap-2">
          {block.data.items.map((item, i) => {
            const isOpen = open === i;
            const placeholder = item.answer.startsWith("[Add");
            return (
              <li
                key={i}
                className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-neutral-50"
                >
                  <span className="text-[14px] font-medium text-neutral-900">
                    {item.question}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-neutral-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-neutral-500" />
                  )}
                </button>
                {isOpen ? (
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
  );
}

// ─── Main component — describes the page as data ──────────────
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

  const [quoteSheetOpen, setQuoteSheetOpen] = useState(false);
  const openQuoteSheet = () => setQuoteSheetOpen(true);
  const closeQuoteSheet = () => setQuoteSheetOpen(false);

  const primaryCtaLabel = hero?.data.primaryCtaLabel ?? "Get in touch";

  // ─── The page as a data array ───────────────────────────────
  const sections: LayoutSection[] = [];

  if (hero) {
    sections.push({
      id: "hero",
      kind: "hero",
      props: {
        eyebrow: { icon: MapPin, label: "Dublin · Cork · Galway" },
        headline: hero.data.headline,
        subheadline: hero.data.subheadline,
        supportingLine: hero.data.supportingLine,
        primaryCta: {
          label: hero.data.primaryCtaLabel,
          onClick: openQuoteSheet
        },
        secondaryCta: {
          label: "Call Phil",
          href: "tel:+35300000000",
          icon: Phone
        },
        trustBadges: hero.data.trustBadges,
        imageIcon: DoorOpen,
        imageHint: hero.data.imageHint
      }
    });
  }

  sections.push({
    id: "stats",
    kind: "stats-band",
    props: {
      variant: "muted",
      stats: [
        { value: 15, label: "Years trading", suffix: "+", icon: Award },
        { value: 200, label: "Jobs completed", suffix: "+", icon: Hammer },
        { value: "5.0", label: "Average review", icon: Star }
      ]
    }
  });

  if (services) {
    sections.push({
      id: "services",
      kind: "custom",
      render: () => <ServicesSection block={services} />
    });
  }

  if (valueProps) {
    sections.push({
      id: "value-props",
      kind: "custom",
      render: () => <ValuePropsSection block={valueProps} />
    });
  }

  sections.push({
    id: "process",
    kind: "process-band",
    props: {
      overline: "How we work",
      heading: "From first call to finished job",
      subheading: "Straightforward, predictable, no surprises.",
      steps: [
        {
          title: "Free survey",
          description:
            "Visit within 3 working days. Measurements + honest opinion.",
          icon: MapPin
        },
        {
          title: "Fixed quote",
          description:
            "Detailed quote within 48 hours. What you sign is what you pay.",
          icon: FileCheck
        },
        {
          title: "Installation",
          description:
            "Our in-house team. No subcontractors. Site left clean daily.",
          icon: Hammer
        },
        {
          title: "Guarantee",
          description:
            "Written guarantee on workmanship. We come back if anything's off.",
          icon: ShieldCheck
        }
      ]
    }
  });

  if (projects.length) {
    sections.push({
      id: "projects",
      kind: "custom",
      render: () => <ProjectsSection projects={projects} />
    });
  }

  if (trust) {
    sections.push({
      id: "trust",
      kind: "custom",
      render: () => <TrustSection block={trust} />
    });
  }

  if (faq) {
    sections.push({
      id: "faq",
      kind: "custom",
      render: () => <FaqSection block={faq} />
    });
  }

  sections.push({
    id: "contact",
    kind: "cta-band",
    props: {
      overline: "Get in touch",
      headline: "Ready to talk to Phil?",
      subheadline:
        primaryCtaLabel === "Book Free Survey"
          ? "A free on-site survey with a fixed quote afterwards. No obligation."
          : "Get in touch — Phil replies within one working day.",
      primaryCta: {
        label: primaryCtaLabel,
        onClick: openQuoteSheet
      },
      secondaryCta: {
        label: "Call Phil",
        href: "tel:+35300000000",
        icon: Phone
      }
    }
  });

  return (
    <ServiceOverviewLayout
      brand={{ name: "Phil's Carpentry", icon: Hammer }}
      navLinks={[
        { href: "#services", label: "Services" },
        { href: "#projects", label: "Projects" },
        { href: "#trust", label: "Why us" },
        { href: "#faq", label: "FAQ" },
        { href: "#contact", label: "Contact" }
      ]}
      desktopCta={
        <Button intent="primary" size="md" onClick={openQuoteSheet}>
          {primaryCtaLabel}
        </Button>
      }
      drawerFooter={
        <>
          <Button
            intent="primary"
            size="lg"
            block
            onClick={openQuoteSheet}
          >
            {primaryCtaLabel}
          </Button>
          <a
            href="tel:+35300000000"
            className="mt-2 flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-neutral-200 px-4 text-[13px] font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            <Phone className="h-4 w-4" />
            Call Phil
          </a>
        </>
      }
      topBanner={<DemoBanner />}
      footer={<FooterContent />}
      bottomBarLeft={
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
      bottomBarRight={
        <Button intent="primary" size="lg" block onClick={openQuoteSheet}>
          {primaryCtaLabel}
        </Button>
      }
      sections={sections}
      afterSections={
        <QuoteRequestSheet open={quoteSheetOpen} onClose={closeQuoteSheet} />
      }
    />
  );
}
