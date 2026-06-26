// Xrated Trades — "Help Centre" page.
// Six tutorial-video cards (gradient thumbnail + yellow play-overlay),
// a 3-option Contact card (WhatsApp / Email / FAQ), and a five-article
// "Popular help articles" link list. Every video link points to # for
// now &mdash; we will wire each to a video URL once recorded.
//
// Server component. Matches the /trade-off/pricing design language:
// XratedHeader top, black hero with yellow accent on the punch phrase,
// max-w-5xl body, 13px text floor, XratedFooter bottom.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "Help Centre — Xrated Trades. Get unstuck in 2 minutes.",
  description:
    "Short tutorial videos for every Xrated Trades feature — setting up your profile, adding services with prices, photo uploads, intro video, WhatsApp button, getting reviews. Plus WhatsApp + email support.",
  alternates: { canonical: "/trade-off/help" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Xrated Trades — Help Centre. Get unstuck in 2 minutes.",
    description:
      "Short tutorial videos for every Xrated Trades feature, plus WhatsApp + email support.",
    url: absolute("/trade-off/help")
  }
};

type Tutorial = {
  title: string;
  blurb: string;
  duration: string;
  gradient: string;
  href: string;
};

const TUTORIALS: Tutorial[] = [
  {
    title: "Setting up your profile",
    blurb: "Slug, logo, colour theme &mdash; live in 5 minutes.",
    duration: "2 min",
    gradient: "linear-gradient(135deg, #FFB300 0%, #FF7A00 100%)",
    href: "#"
  },
  {
    title: "Adding services + prices",
    blurb: "List your jobs, set the price, customers see them up front.",
    duration: "2 min",
    gradient: "linear-gradient(135deg, #0A0A0A 0%, #3D3D3D 100%)",
    href: "#"
  },
  {
    title: "Uploading photos",
    blurb: "Drag-drop from your phone gallery &mdash; auto-resized.",
    duration: "2 min",
    gradient: "linear-gradient(135deg, #FFB300 0%, #B07300 100%)",
    href: "#"
  },
  {
    title: "Recording your intro video",
    blurb: "60-second self-hosted clip &mdash; no YouTube ads, no algorithm.",
    duration: "2 min",
    gradient: "linear-gradient(135deg, #0A0A0A 0%, #6B4A00 100%)",
    href: "#"
  },
  {
    title: "Connecting WhatsApp",
    blurb: "One-tap button, customer-side pre-fill, lands in your phone.",
    duration: "2 min",
    gradient: "linear-gradient(135deg, #4F8B3A 0%, #0A0A0A 100%)",
    href: "#"
  },
  {
    title: "Getting reviews",
    blurb: "Send the review link tied to the service you just delivered.",
    duration: "2 min",
    gradient: "linear-gradient(135deg, #FFB300 0%, #0A0A0A 100%)",
    href: "#"
  }
];

const POPULAR_ARTICLES: Array<{ title: string; href: string }> = [
  { title: "Why hasn't my xratedtrade.com URL gone live yet?", href: "#" },
  { title: "How do I change my slug after signup?", href: "#" },
  { title: "What happens when my 14-day trial ends?", href: "#" },
  { title: "How do I move my reviews from a directory site?", href: "#" },
  { title: "Can I have more than one URL for different services?", href: "#" }
];

export default function HelpCentrePage() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      {/* Hero — black surface, yellow accent on the punch phrase. */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Help Centre
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            Get unstuck in{" "}
            <span style={{ color: XRATED_BRAND.accent }}>2 minutes.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
            Every feature has its own short video. Two minutes, no fluff,
            real screen recordings.{" "}
            <span className="font-bold text-white">
              Can&rsquo;t find what you need? WhatsApp us &mdash; replies
              within an hour during working hours.
            </span>
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> 6 tutorial videos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> WhatsApp + email support
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dot accent /> Searchable FAQ
            </span>
          </div>
        </div>
      </section>

      {/* Section 1 &mdash; 6-card tutorial-video grid */}
      <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Tutorial videos
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Tap any card to play. Every video is under 2 minutes.
        </p>

        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TUTORIALS.map((t) => (
            <li key={t.title}>
              <a
                href={t.href}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-lg"
              >
                {/* Gradient thumbnail with yellow play button. */}
                <div
                  className="relative flex h-36 items-center justify-center sm:h-40"
                  style={{ background: t.gradient }}
                >
                  <span
                    className="inline-flex h-14 w-14 items-center justify-center rounded-full transition group-hover:scale-110"
                    style={{
                      background: XRATED_BRAND.accent,
                      boxShadow: `0 6px 18px ${XRATED_BRAND.accent}55`
                    }}
                    aria-hidden="true"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#0A0A0A" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                  <span
                    className="absolute right-3 top-3 rounded-full bg-black/70 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
                  >
                    {t.duration}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <h3 className="text-sm font-extrabold text-neutral-900 sm:text-base">
                    {t.title}
                  </h3>
                  <p
                    className="mt-1 text-xs leading-relaxed text-neutral-600"
                    dangerouslySetInnerHTML={{ __html: t.blurb }}
                  />
                  <span
                    className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-neutral-900"
                  >
                    Watch{" "}
                    <span
                      aria-hidden="true"
                      className="transition group-hover:translate-x-0.5"
                      style={{ color: XRATED_BRAND.accent }}
                    >
                      &rarr;
                    </span>
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Section 2 &mdash; Contact card with 3 options. */}
      <section className="mx-auto max-w-5xl px-4 pt-14 sm:px-6 sm:pt-20">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Can&rsquo;t find what you need?
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Three ways to get help. WhatsApp is the fastest.
        </p>

        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* WhatsApp */}
          <li>
            <a
              href="https://wa.me/62812337669?text=Hi%20Xrated%20Trades%20support"
              className="group flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-lg"
            >
              <span
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: XRATED_BRAND.accent }}
                aria-hidden="true"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#0A0A0A" aria-hidden="true">
                  <path d="M20.52 3.48A11.95 11.95 0 0 0 12.07 0C5.49 0 .12 5.37.12 11.95c0 2.11.55 4.17 1.6 5.98L0 24l6.23-1.64a11.94 11.94 0 0 0 5.84 1.49h.01c6.59 0 11.95-5.37 11.95-11.95 0-3.19-1.24-6.19-3.51-8.42ZM12.08 21.85h-.01a9.92 9.92 0 0 1-5.06-1.39l-.36-.21-3.69.97.99-3.6-.24-.37a9.86 9.86 0 0 1-1.52-5.3c0-5.46 4.45-9.91 9.92-9.91 2.65 0 5.13 1.03 7 2.91a9.85 9.85 0 0 1 2.9 7c0 5.46-4.45 9.9-9.93 9.9Zm5.45-7.42c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48a9.05 9.05 0 0 1-1.67-2.07c-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.21 5.09 4.5.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z" />
                </svg>
              </span>
              <h3 className="mt-3 text-sm font-extrabold text-neutral-900 sm:text-base">
                WhatsApp support
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                Fastest. Replies within an hour during working hours
                (Mon&ndash;Sat).
              </p>
              <span
                className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-neutral-900"
              >
                Open WhatsApp{" "}
                <span aria-hidden="true" style={{ color: XRATED_BRAND.accent }}>
                  &rarr;
                </span>
              </span>
            </a>
          </li>

          {/* Email */}
          <li>
            <a
              href="mailto:support@xratedtrade.com"
              className="group flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-lg"
            >
              <span
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: XRATED_BRAND.accent }}
                aria-hidden="true"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 7 9-7" />
                </svg>
              </span>
              <h3 className="mt-3 text-sm font-extrabold text-neutral-900 sm:text-base">
                Email
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                support@xratedtrade.com &mdash; replies within one
                business day.
              </p>
              <span
                className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-neutral-900"
              >
                Send email{" "}
                <span aria-hidden="true" style={{ color: XRATED_BRAND.accent }}>
                  &rarr;
                </span>
              </span>
            </a>
          </li>

          {/* FAQ */}
          <li>
            <a
              href="/trade-off/faq"
              className="group flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-lg"
            >
              <span
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: XRATED_BRAND.accent }}
                aria-hidden="true"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
                  <circle cx="12" cy="17" r="0.5" fill="#0A0A0A" />
                </svg>
              </span>
              <h3 className="mt-3 text-sm font-extrabold text-neutral-900 sm:text-base">
                FAQ
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                Searchable list of the questions we get every week.
              </p>
              <span
                className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-neutral-900"
              >
                Browse FAQ{" "}
                <span aria-hidden="true" style={{ color: XRATED_BRAND.accent }}>
                  &rarr;
                </span>
              </span>
            </a>
          </li>
        </ul>
      </section>

      {/* Section 3 &mdash; Popular help articles list. */}
      <section className="mx-auto max-w-5xl px-4 pt-14 sm:px-6 sm:pt-20">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Popular help articles
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          The five articles we send most often.
        </p>

        <ul className="mt-6 flex flex-col gap-2">
          {POPULAR_ARTICLES.map((a) => (
            <li key={a.title}>
              <a
                href={a.href}
                className="group flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 transition hover:border-neutral-300 hover:shadow-sm"
              >
                <span className="text-xs font-semibold text-neutral-800 sm:text-sm">
                  {a.title}
                </span>
                <span
                  aria-hidden="true"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition group-hover:translate-x-0.5"
                  style={{ background: XRATED_BRAND.accent, color: "#0A0A0A" }}
                >
                  &rarr;
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Closing CTA &mdash; black surface mirroring the hero. */}
      <section className="mx-auto mt-12 max-w-5xl px-4 pb-2 sm:px-6">
        <div
          className="overflow-hidden rounded-2xl px-5 py-8 text-center sm:px-10 sm:py-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: XRATED_BRAND.accent }}
          >
            Still stuck?
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Message us. We&rsquo;ll fix it.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-xs text-white/80 sm:text-sm">
            WhatsApp lands directly on the founder&rsquo;s phone. No
            ticketing system, no chatbot &mdash; just a quick reply.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://wa.me/62812337669?text=Hi%20Xrated%20Trades%20support"
              className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:text-sm"
              style={{
                background: XRATED_BRAND.accent,
                boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
              }}
            >
              WhatsApp support
            </a>
            <a
              href="/trade-off/pricing"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              See pricing
            </a>
          </div>
        </div>
      </section>

      <XratedFooter />
    </main>
  );
}

function Dot({ accent = false }: { accent?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ background: accent ? XRATED_BRAND.accent : "rgba(255,255,255,0.6)" }}
    />
  );
}
