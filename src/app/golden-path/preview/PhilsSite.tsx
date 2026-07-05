// PhilsSite — renders Phil's composed ContentManifest as a real
// trade website. No demo copy — every string on this page comes from
// the manifest's typed blocks.

"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  CalendarClock,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  FileCheck,
  Hammer,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  Truck
} from "lucide-react";
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

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* ── Demo banner ─────────────────────────────────────── */}
      <div className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-[12px]">
          <div className="flex items-center gap-2 text-amber-900">
            <Camera className="h-3.5 w-3.5" /> Golden Path preview — this
            site was composed by the platform, not hand-authored.
          </div>
          <Link
            href="/golden-path"
            className="inline-flex items-center gap-1 rounded-full bg-amber-900 px-2.5 py-1 font-medium text-white hover:bg-amber-800"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Golden Path
          </Link>
        </div>
      </div>

      {/* ── Site nav ────────────────────────────────────────── */}
      <nav className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white">
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
          <a
            href="#contact"
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 text-[12px] font-semibold text-neutral-900 hover:bg-amber-300"
          >
            {hero?.data.primaryCtaLabel ?? "Get in touch"}
          </a>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      {hero ? (
        <section className="relative overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 text-white">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_theme(colors.amber.500)_0%,_transparent_50%)]" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-amber-200">
                  <MapPin className="h-3 w-3" />
                  Dublin · Cork · Galway
                </div>
                <h1 className="text-3xl font-bold leading-tight md:text-5xl">
                  {hero.data.headline}
                </h1>
                {hero.data.subheadline ? (
                  <p className="mt-4 text-[15px] text-neutral-200 md:text-[17px]">
                    {hero.data.subheadline}
                  </p>
                ) : null}
                {hero.data.supportingLine ? (
                  <p className="mt-2 text-[13px] text-neutral-300">
                    {hero.data.supportingLine}
                  </p>
                ) : null}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <a
                    href="#contact"
                    className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-[14px] font-semibold text-neutral-900 hover:bg-amber-300"
                  >
                    {hero.data.primaryCtaLabel}
                  </a>
                  <a
                    href="tel:+35300000000"
                    className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-3 text-[14px] font-semibold text-white hover:bg-white/10"
                  >
                    <Phone className="h-4 w-4" />
                    Call Phil
                  </a>
                </div>
                {hero.data.trustBadges?.length ? (
                  <div className="mt-6 flex flex-wrap gap-2 text-[11px]">
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
              <div className="hidden md:block">
                <div className="rounded-2xl border border-white/10 bg-neutral-800/50 p-4 backdrop-blur">
                  <div className="aspect-[4/3] w-full rounded-xl bg-neutral-700/50">
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-neutral-500">
                      <Camera className="h-8 w-8" />
                      <div className="text-[11px]">
                        Hero image slot
                      </div>
                      <div className="text-[11px] text-neutral-600">
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
        <section id="services" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold text-neutral-900">
            What we do
          </h2>
          {services.data.intro ? (
            <p className="mt-2 max-w-2xl text-[15px] text-neutral-700">
              {services.data.intro}
            </p>
          ) : null}
          <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {services.data.items.map((s) => (
              <div
                key={s.slug}
                className={`rounded-2xl border p-5 transition ${
                  s.featured
                    ? "border-amber-300 bg-amber-50"
                    : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      s.featured
                        ? "bg-amber-400 text-neutral-900"
                        : "bg-neutral-900 text-white"
                    }`}
                  >
                    <Hammer className="h-4 w-4" />
                  </div>
                  {s.featured ? (
                    <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-neutral-900">
                      Featured
                    </span>
                  ) : null}
                </div>
                <h3 className="text-[15px] font-semibold text-neutral-900">
                  {s.title}
                </h3>
                <p className="mt-1 text-[13px] text-neutral-700">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Value props ─────────────────────────────────────── */}
      {valueProps ? (
        <section className="bg-white py-16">
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
        <section id="projects" className="bg-neutral-50 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-bold text-neutral-900">
                Recent projects
              </h2>
              <div className="text-[13px] text-neutral-500">
                {projects.length} completed jobs
              </div>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.slice(0, 6).map((p) => (
                <article
                  key={p.slug}
                  className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                >
                  <div className="aspect-[4/3] bg-neutral-200">
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-neutral-500">
                      <Camera className="h-8 w-8" />
                      <div className="text-[11px]">
                        {p.data.photoCount} photos
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="mb-1 flex items-center gap-2 text-[11px] text-neutral-500">
                      {p.data.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {p.data.location}
                        </span>
                      ) : null}
                      {p.data.duration ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {p.data.duration}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-[15px] font-semibold text-neutral-900">
                      {p.data.title}
                    </h3>
                    <p className="mt-1 text-[12px] text-neutral-600">
                      {p.data.solution}
                    </p>
                    {p.data.customerQuote ? (
                      <blockquote className="mt-3 rounded-lg bg-amber-50 p-3 text-[12px] italic text-neutral-800">
                        &ldquo;{p.data.customerQuote.text}&rdquo;
                        <div className="mt-1 text-[11px] not-italic text-neutral-600">
                          — {p.data.customerQuote.attribution}
                        </div>
                      </blockquote>
                    ) : (
                      <div className="mt-3 rounded-lg bg-neutral-100 p-3 text-[11px] italic text-neutral-500">
                        Customer quote coming — the coach will nudge Phil to
                        request one.
                      </div>
                    )}
                    {p.data.materials.length ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {p.data.materials.slice(0, 3).map((m, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-700"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Trust ───────────────────────────────────────────── */}
      {trust ? (
        <section id="trust" className="bg-white py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div>
                <h2 className="text-2xl font-bold text-neutral-900">
                  {trust.data.heading}
                </h2>
                {trust.data.intro ? (
                  <p className="mt-2 text-[15px] text-neutral-700">
                    {trust.data.intro}
                  </p>
                ) : null}
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
        <section id="faq" className="bg-neutral-50 py-16">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl font-bold text-neutral-900">
              {faq.data.heading}
            </h2>
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
      <section id="contact" className="bg-neutral-900 py-16 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">
            Ready to talk to Phil?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] text-neutral-300">
            {hero?.data.primaryCtaLabel === "Book Free Survey"
              ? "A free on-site survey with a fixed quote afterwards. No obligation."
              : "Get in touch — Phil replies within one working day."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="tel:+35300000000"
              className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-[14px] font-semibold text-neutral-900 hover:bg-amber-300"
            >
              <Phone className="h-4 w-4" />
              Call Phil
            </a>
            <a
              href="mailto:phil@example.com"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-3 text-[14px] font-semibold text-white hover:bg-white/10"
            >
              {hero?.data.primaryCtaLabel ?? "Get in touch"}
            </a>
          </div>
        </div>
      </section>

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
