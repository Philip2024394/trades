// Xrated Trades — /site-office
//
// Marketing page for the done-for-you setup + retainer service. Sells
// the full Site Office offering: a setup tier + an optional monthly
// retainer to keep the profile fresh. Audience is tradespeople who
// don't want to build their own profile and would rather hand the work
// to our team. Mirrors the /showcase design language (XratedHeader +
// XratedFooter shell, full-bleed dark hero with the building-merchant
// banner overlay) and the /trade-off/pricing card patterns.
//
// Honest framing: prices and 5-day turnaround are advertised. The
// retainer copy uses the gravel analogy verbatim — written by the
// brand owner to keep the trades-native voice intact. No fake people,
// no fake photos: role cards are monogram chips only.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { LEAD_CASE_STUDIES, type LeadCaseStudy } from "@/lib/leadCaseStudies";
import { TRADE_OFF_HERO_IMAGES } from "@/lib/tradeOffHeroes";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { tradeLabel } from "@/lib/tradeOff";
import { absolute, BRAND } from "@/lib/seo";
import { adminWhatsapp } from "@/lib/whatsapp";
import {
  supabase,
  type HammerexTradeOffListing
} from "@/lib/supabase";

export const revalidate = 300;

const TITLE = "The Site Office — we build your Xrated profile for you";
const DESCRIPTION =
  "Done-for-you Xrated profile build. Live in 5 working days from £297. No tech needed — our Setup Lead, Content Curator, Image Specialist, Trade Consultant and Account Manager run the whole job.";
const HERO =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2029,%202026,%2005_17_28%20PM.png";

export const metadata: Metadata = {
  title: `${TITLE} | ${BRAND.name}`,
  description: DESCRIPTION,
  alternates: { canonical: "/site-office" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    locale: "en_GB",
    title: TITLE,
    description: DESCRIPTION,
    url: absolute("/site-office"),
    images: [{ url: HERO, alt: TITLE }]
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [HERO]
  }
};

// Pre-filled WhatsApp intake message — opens with the tradesperson's
// intent already typed so the conversation starts with the trade. The
// blank line is reserved for them to fill before send.
const WA_MESSAGE =
  "Hi Xrated — I'd like to start a Site Office build. My trade: ______";
function waUrl(): string {
  const digits = adminWhatsapp().replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(WA_MESSAGE)}`;
}

// Role-card source. NO PHOTOS, NO NAMES — the monogram is the entire
// visual. Keeps the page honest: these are roles every build runs
// through, not a fake team grid stitched together with stock faces.
const ROLES: { monogram: string; title: string; description: string }[] = [
  {
    monogram: "SL",
    title: "Setup Lead",
    description:
      "Builds your profile from your WhatsApp intake. Products, banners, team grid, FAQs."
  },
  {
    monogram: "CC",
    title: "Content Curator",
    description:
      "Writes your product descriptions, drafts your bio, organises your team page."
  },
  {
    monogram: "IS",
    title: "AI Image Specialist",
    description:
      "Generates landscape banners at the right ratio for your trade. Same style we built for Stuart Kingsley."
  },
  {
    monogram: "TC",
    title: "Trade Consultant",
    description:
      "Reviews your setup against what works for your specific trade. Stops you from missing the obvious."
  },
  {
    monogram: "AM",
    title: "Account Manager",
    description:
      "Your single point of contact in WhatsApp. Day one to day forever."
  }
];

const SETUP_PACKAGES: {
  tier: string;
  price: string;
  popular?: boolean;
  turnaround: string;
  tagline: string;
  bullets: string[];
}[] = [
  {
    tier: "Starter",
    price: "£297",
    turnaround: "3 working days",
    tagline:
      "Fully functional app, finished above 85% of profiles online.",
    bullets: [
      "Up to 10 products",
      "1 lightly edited image per product",
      "Descriptions + key specs researched",
      "All FREE add-ons enabled (Trusted Trades, Shop Mode for merchants)",
      "3 landscape banners + bio + 4-card team grid + 5 FAQs",
      "1 video poster"
    ]
  },
  {
    tier: "Pro",
    price: "£597",
    popular: true,
    turnaround: "5 working days",
    tagline:
      "Everything in Starter — plus product-gallery polish + Google-grade SEO.",
    bullets: [
      "Up to 25 products",
      "Up to 3 images per product (advanced edits + AI fill-ins where missing)",
      "Schema.org product markup (price + rating in Google results)",
      "Custom meta tags + image alt text + sitemap",
      "Google Business Profile linkage",
      "Trade Center Picks editorial + custom domain setup",
      "6 banners + 10 FAQs"
    ]
  },
  {
    tier: "Yard",
    price: "£997",
    turnaround: "7 working days",
    tagline:
      "Everything in Pro — plus full SEO, brand tweaks, and a 1-minute video included.",
    bullets: [
      "50+ products",
      "Up to 5 images per product (full sourcing + AI-generated banners)",
      "Keyword research (5-10 target terms) + local SEO setup",
      "Competitor backlink audit",
      "Up to 2 hours of brand-specific tweaks (colours, layout requests)",
      "1-minute brand video included (£197 value)",
      "Materials Network setup + 12-image gallery + per-product spec sheets"
    ]
  }
];

const RETAINERS: {
  name: string;
  hours: string;
  covers: string;
  price: string;
}[] = [
  {
    name: "Light",
    hours: "~1 hr/mo",
    covers: "Banner swap · copy tweaks · monthly Picks refresh",
    price: "£29/mo"
  },
  {
    name: "Active",
    hours: "~3 hr/mo",
    covers: "New products · banner rotation · seasonal promos",
    price: "£79/mo"
  },
  {
    name: "Managed",
    hours: "~6 hr/mo",
    covers: "Weekly Picks editorial · full product onboarding · promo cycles",
    price: "£149/mo"
  }
];

const CAPABILITIES: { title: string; description: string }[] = [
  {
    title: "Add features",
    description:
      "Want a new section? An editor toggle? A custom domain wired up? Our team builds it. No tickets, no waitlists — just message us."
  },
  {
    title: "Set your app up",
    description:
      "Starting from scratch or halfway through? We finish the build either way. Bio, products, banners, team grid, FAQs — all dialled in."
  },
  {
    title: "Add products",
    description:
      "10 more or a hundred more. We write the descriptions, attach the photos, set the specs, and list them properly."
  },
  {
    title: "Generate banners + images",
    description:
      "Advanced AI landscape banners and product images, same cinematic style we built for Stuart Kingsley's yard. Ready in hours, not days."
  }
];

const STEPS: { title: string; description: string }[] = [
  {
    title: "You message us",
    description:
      "Tap the WhatsApp button. We send a short intake checklist (trade type, business name, products, branding)."
  },
  {
    title: "We build it",
    description:
      "Setup Lead + Content Curator + Image Specialist work the build. You don't lift a finger."
  },
  {
    title: "You review",
    description:
      "We send the live URL. 3 rounds of revisions included."
  },
  {
    title: "You're live",
    description:
      "Your profile lands on xratedtrade.com/<your-name> within 5 working days. Powered by your £14.99 platform plan from then on."
  }
];

type CardListing = Pick<
  HammerexTradeOffListing,
  | "id"
  | "slug"
  | "display_name"
  | "primary_trade"
  | "city"
  | "rating_avg"
  | "rating_count"
  | "avatar_url"
  | "photos"
  | "custom_app_hero_url"
>;

async function loadCardListings(): Promise<CardListing[]> {
  const slugs = LEAD_CASE_STUDIES.map((c) => c.slug);
  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select(
      "id, slug, display_name, primary_trade, city, rating_avg, rating_count, avatar_url, photos, custom_app_hero_url"
    )
    .in("slug", slugs);
  return (res.data ?? []) as CardListing[];
}

function bannerFor(_study: LeadCaseStudy, row?: CardListing): string {
  if (row?.custom_app_hero_url) return row.custom_app_hero_url;
  if (row?.photos && row.photos[0]) return row.photos[0];
  if (row?.avatar_url) return row.avatar_url;
  const tradeKey = row?.primary_trade ?? "";
  return TRADE_OFF_HERO_IMAGES[tradeKey] ?? HERO;
}

export default async function SiteOfficePage() {
  const rows = await loadCardListings();
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      {/* ───────────────────── 1. HERO ───────────────────── */}
      <section
        className="relative isolate overflow-hidden"
        style={{ background: "#0A0A0A" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Left-darkening gradient so the headline stays legible while
            the image carries the right side of the frame. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.75) 40%, rgba(10,10,10,0.45) 75%, rgba(10,10,10,0.15) 100%)"
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
          <p
            className="text-[11px] font-extrabold uppercase tracking-[0.28em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            The Site Office
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-5xl">
            We build your Xrated profile for you.
          </h1>
          <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-white/80 sm:text-base">
            Live in 5 working days. £297 setup. No tech needed. Powered
            by our team.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3 sm:gap-4">
            <a
              href={waUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:text-sm"
              style={{
                background: XRATED_BRAND.accent,
                boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
              }}
            >
              Start on WhatsApp
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center gap-1.5 px-2 text-[13px] font-bold uppercase tracking-wider text-white/80 transition hover:text-white sm:text-sm"
            >
              How it works
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ───────────────────── 2. FIVE ROLES ───────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
          Your build team for this job
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-600 sm:text-[15px]">
          Five roles every Site Office build runs through. Always the
          same crew, always end-to-end.
        </p>
        <ul className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-5">
          {ROLES.map((r) => (
            <li
              key={r.monogram}
              className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-5"
            >
              <span
                className="inline-flex h-12 w-12 items-center justify-center rounded-full text-[13px] font-extrabold tracking-wider text-neutral-900"
                style={{ background: XRATED_BRAND.accent }}
                aria-hidden="true"
              >
                {r.monogram}
              </span>
              <p className="mt-3 text-[15px] font-extrabold text-neutral-900">
                {r.title}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600">
                {r.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ───────────────────── 3. SETUP PACKAGES ───────────────────── */}
      <section className="border-t border-neutral-100 bg-neutral-50 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
            Pick your setup
          </h2>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-neutral-600 sm:text-[15px]">
            One-time fee. The build is yours forever. The £14.99
            platform keeps your app live afterwards — pause your
            retainer any month, your work stays online.
          </p>
          <ul className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
            {SETUP_PACKAGES.map((pkg) => (
              <li
                key={pkg.tier}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 sm:p-7 ${
                  pkg.popular ? "border-2 shadow-lg" : "border-neutral-200"
                }`}
                style={pkg.popular ? { borderColor: XRATED_BRAND.accent } : undefined}
              >
                {pkg.popular && (
                  <span
                    className="absolute -top-3 left-6 inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-extrabold uppercase tracking-wider text-neutral-900"
                    style={{ background: XRATED_BRAND.accent }}
                  >
                    Most popular
                  </span>
                )}
                <p className="text-lg font-extrabold text-neutral-900">
                  {pkg.tier}
                </p>
                <p className="mt-2 text-4xl font-extrabold leading-none text-neutral-900 sm:text-5xl">
                  {pkg.price}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-neutral-500">
                  /one-time &middot; live in {pkg.turnaround}
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-neutral-700">
                  {pkg.tagline}
                </p>
                <ul className="mt-5 flex flex-col gap-2 border-t border-neutral-100 pt-5">
                  {pkg.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-2.5 text-[13px] leading-relaxed text-neutral-700"
                    >
                      <span
                        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                        style={{ background: XRATED_BRAND.accent }}
                        aria-hidden="true"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-[13px] italic leading-relaxed text-neutral-500">
                  Plus the £14.99/mo platform plan to keep your app live.
                </p>
                <a
                  href={waUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-extrabold uppercase tracking-wider transition active:scale-[0.98] sm:text-sm ${
                    pkg.popular ? "text-neutral-900" : "border-2 bg-white"
                  }`}
                  style={
                    pkg.popular
                      ? {
                          background: XRATED_BRAND.accent,
                          boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
                        }
                      : {
                          borderColor: XRATED_BRAND.accent,
                          color: "#0A0A0A"
                        }
                  }
                >
                  Start on WhatsApp
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────────────────── 4. RETAINER PLANS ───────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
          Keep it fresh — or don't
        </h2>
        <blockquote
          className="mt-4 max-w-3xl rounded-2xl border-l-4 bg-neutral-50 px-5 py-4 text-[13px] leading-relaxed text-neutral-700 sm:text-[15px]"
          style={{ borderColor: XRATED_BRAND.accent }}
        >
          “It's like ordering gravel. Say the word ‘enough for now’ and
          we down tools — your app stays live on the £14.99 platform,
          no ties or ribbons. Top up when you're ready to push new
          products, swap banners, or rotate your Trade Center Picks.
          Totally in your hands. Powered by our team to keep the
          empire running.”
        </blockquote>

        <ul className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
          {RETAINERS.map((r) => (
            <li
              key={r.name}
              className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-6"
            >
              <p className="text-lg font-extrabold text-neutral-900">{r.name}</p>
              <p
                className="mt-1 text-[13px] font-bold uppercase tracking-wider"
                style={{ color: "#7a5a00" }}
              >
                {r.hours}
              </p>
              <p className="mt-4 text-[13px] leading-relaxed text-neutral-600">
                {r.covers}
              </p>
              <p className="mt-5 text-3xl font-extrabold leading-none text-neutral-900 sm:text-4xl">
                {r.price}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[13px] text-neutral-500">
          Ad-hoc edits without a retainer — £25-£40 per task. Pause or
          stop any month, no notice period.
        </p>
      </section>

      {/* ───────────────────── 4b. VIDEO PRODUCTION ───────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Hero banner — cinematic still signalling the production
            level of the actual videos + editing we deliver. Container
            aspect 3:2 to match the source image exactly (no crop). */}
        <div className="overflow-hidden rounded-2xl bg-neutral-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2029,%202026,%2004_58_46%20PM.png"
            alt="Cinematic video and editing production preview"
            className="block aspect-[3/2] w-full object-cover"
            loading="lazy"
          />
        </div>

        <p
          className="mt-8 text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          Commercial production
        </p>
        <h2 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
          Cinematic commercial. £197 per minute. Script included.
        </h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-neutral-600 sm:text-[15px]">
          Send us a handful of reference photos &mdash; your yard, your
          team, your work. We turn them into a real movie-standard
          commercial using AI cinematic generation. Not pan-and-zoom
          on a still image. Actual scenes, actual motion, actual feel.
        </p>

        <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
            Pick your tone
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
            Tell us the vibe up front and we cut to match. Your
            customers will feel it the moment the video starts.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                label: "Humour",
                blurb:
                  "Light, cheeky, memorable. For trades whose brand voice is the foreman everyone wants on site."
              },
              {
                label: "Serious",
                blurb:
                  "Confident, measured, credibility-led. For specialist installers, compliance-led trades, B2B."
              },
              {
                label: "Total Pro",
                blurb:
                  "High-end cinematic. Premium camera work, sharp edit, executive energy. For merchants + flagship brands."
              }
            ].map((tone) => (
              <div
                key={tone.label}
                className="flex flex-col gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 p-4"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: "#FFB300" }}
                  />
                  <p className="text-[13px] font-extrabold text-neutral-900">
                    {tone.label}
                  </p>
                </div>
                <p className="text-[13px] leading-snug text-neutral-600">
                  {tone.blurb}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <VideoTile minutes={1} price={197} popular={false} />
          <VideoTile minutes={2} price={394} popular={true} />
          <VideoTile minutes={3} price={591} popular={false} />
        </div>

        <p className="mt-4 text-[13px] text-neutral-500">
          Need longer? £197 per minute, no cap. 4 min = £788. 5 min =
          £985. Simple maths.
        </p>

        <div className="mt-7 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
            What&rsquo;s in every commercial
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              "Script written from your WhatsApp brief",
              "AI cinematic generation from your reference photos",
              "Branded text overlays in your colours",
              "AI voiceover (or send us your own recording)",
              "Royalty-free background music + sound mix",
              "Burned-in subtitles (silent-scroll friendly)",
              "Two cuts delivered: 9:16 vertical + 16:9 horizontal",
              "1 round of revisions included"
            ].map((line) => (
              <li
                key={line}
                className="flex items-start gap-2 text-[13px] text-neutral-700"
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: "#FFB300" }}
                />
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] text-neutral-500">
            Turnaround: 3 working days from brief approval.
          </p>
        </div>

        {/* "Why cinematic" — addresses the obvious "isn't pan-and-zoom
            on stills the same thing?" objection, in the user's voice. */}
        <div className="mt-7 rounded-2xl border-2 border-[#FFB300]/40 bg-[#FFB300]/5 p-5 sm:p-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
            Common question
          </p>
          <h3 className="mt-2 text-lg font-extrabold leading-tight text-neutral-900 sm:text-xl">
            What&rsquo;s the difference between an image video and a
            cinematic-style video?
          </h3>
          <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
            <p>
              It&rsquo;s blockbuster cinema vs reading the breaking-news
              ticker &mdash; same minute of someone&rsquo;s attention, two
              completely different experiences. An image video is a
              slideshow with pan-and-zoom over still photos. A
              cinematic video has real scenes, real motion, real
              depth &mdash; your customer <span className="font-bold">feels</span>{" "}
              something.
            </p>
            <p>
              We live in the age of AI. Competition is growing faster
              than ever &mdash; the seeds your competitors plant today
              bloom in months, not years. The market moves that fast.
              Placement only sticks when the standard is met, and
              cinematic is the standard now.
            </p>
          </div>
        </div>
      </section>

      {/* ───────────────────── 5. CAPABILITY + GRAVEL-DRIVER ───────────────────── */}
      <section className="border-t border-neutral-100 bg-neutral-50 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
            What our team handles for you
          </h2>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-neutral-600 sm:text-[15px]">
            Whatever your app needs — we&rsquo;re on it. No tech to
            learn. No ongoing contract. Just message us when you want
            something done.
          </p>

          <ul className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CAPABILITIES.map((cap) => (
              <li
                key={cap.title}
                className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: "#FFB300" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-extrabold text-neutral-900 sm:text-lg">
                      {cap.title}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
                      {cap.description}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* The gravel-driver block — the user's "no ties or ribbons" voice */}
          <div
            className="relative mt-10 overflow-hidden rounded-3xl px-6 py-8 sm:px-10 sm:py-10"
            style={{ background: "#0A0A0A" }}
          >
            <div className="relative z-10 lg:max-w-[calc(100%-240px)]">
              <p
                className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
                style={{ color: "#FFB300" }}
              >
                No ties. No ribbons.
              </p>
              <h3 className="mt-2 text-xl font-extrabold leading-tight text-white sm:text-2xl">
                Like the last load of gravel.
              </h3>
              <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-white/85 sm:text-[15px]">
                Soon as the last load arrives, you tell the driver
                &mdash; <span className="font-bold text-white">enough for now,
                I&rsquo;ll call when I need more</span>. Same here. Pause
                the retainer any month and your app stays live on the
                £14.99 platform plan. Pick it back up the second you
                want more work done. Totally in your hands &mdash; powered
                by our team when you call.
              </p>
              <p className="mt-5 max-w-3xl text-[13px] leading-relaxed text-white/70 sm:text-[15px]">
                End result: a professional-grade app that sits above
                70% of the working profiles online &mdash; at a fraction
                of the cost, without sparing on the expertise.
              </p>

              {/* Mobile-only inline render — image sits below the copy
                  on small screens so it doesn't overlap text. Desktop
                  uses the absolute-positioned variant below. */}
              <div className="mt-6 flex justify-center lg:hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2029,%202026,%2004_34_54%20PM.png"
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none h-40 w-auto select-none sm:h-48"
                />
              </div>
            </div>
            {/* Desktop-only flush bottom-right variant */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2029,%202026,%2004_34_54%20PM.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 right-0 hidden h-56 w-auto select-none lg:block xl:h-64"
              style={{
                // Fade the leftmost ~3px of the image into the black
                // container — kills the visible PNG edge artifact.
                maskImage:
                  "linear-gradient(to right, transparent 0, #000 3px, #000 100%)",
                WebkitMaskImage:
                  "linear-gradient(to right, transparent 0, #000 3px, #000 100%)"
              }}
            />
          </div>
        </div>
      </section>

      {/* ───────────────────── 6. BUILT THIS WEEK ───────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
          Built recently
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-600 sm:text-[15px]">
          Six profiles we've built across the main trade types. Tap
          any to see what yours could look like.
        </p>

        {/* Mobile horizontal-scroll snap row, 3-col tablet, 6-col desktop. */}
        <ul className="mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:pb-0 lg:grid-cols-6">
          {LEAD_CASE_STUDIES.map((c) => {
            const row = bySlug.get(c.slug);
            const banner = bannerFor(c, row);
            const trade =
              row?.primary_trade ? tradeLabel(row.primary_trade) : c.tradeLabel;
            return (
              <li
                key={c.slug}
                className="w-[78%] shrink-0 snap-start sm:w-auto sm:shrink"
              >
                <a
                  href={`/${c.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:border-neutral-400 hover:shadow-md"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={banner}
                      alt={`${row?.display_name ?? c.name} — ${trade} in ${row?.city ?? c.city}`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-[13px] font-extrabold leading-tight text-neutral-900 sm:text-sm">
                      {row?.display_name ?? c.name}
                    </p>
                    <p className="mt-1 text-[13px] text-neutral-500">
                      {trade} · {row?.city ?? c.city}
                    </p>
                    <p
                      className="mt-3 inline-flex items-center gap-1 text-[13px] font-extrabold text-neutral-900"
                      style={{ color: "#0A0A0A" }}
                    >
                      View profile
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </p>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ───────────────────── 7. HOW IT WORKS ───────────────────── */}
      <section
        id="how-it-works"
        className="border-t border-neutral-100 bg-neutral-50 py-12 sm:py-16"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
            How it works
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-600 sm:text-[15px]">
            WhatsApp in. Live in 5 days. Done.
          </p>
          <ol className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-5"
              >
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-extrabold text-neutral-900"
                  style={{ background: XRATED_BRAND.accent }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <p className="mt-3 text-[15px] font-extrabold text-neutral-900">
                  {step.title}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────────────────── 8. FINAL CTA ───────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div
          className="overflow-hidden rounded-3xl px-6 py-10 text-center sm:px-12 sm:py-14"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-[11px] font-extrabold uppercase tracking-[0.28em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Ready to skip the build?
          </p>
          <h2 className="mx-auto mt-3 max-w-3xl text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Get your profile built by us.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[13px] leading-relaxed text-white/80 sm:text-base">
            £297. Live in 5 days. No contract.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href={waUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:text-sm"
              style={{
                background: XRATED_BRAND.accent,
                boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
              }}
            >
              Start on WhatsApp
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
            <a
              href="/demo-stuart-kingsley-building-merchant-hull"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 text-[13px] font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              See the Stuart Kingsley showcase
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      <XratedFooter />
    </main>
  );
}

function VideoTile({
  minutes,
  price,
  popular
}: {
  minutes: number;
  price: number;
  popular: boolean;
}) {
  const minutesLabel = minutes === 1 ? "1 minute" : `${minutes} minutes`;
  return (
    <div
      className={`flex h-full flex-col rounded-2xl border p-5 sm:p-6 ${
        popular
          ? "border-[#FFB300] bg-white ring-2 ring-[#FFB300]/30"
          : "border-neutral-200 bg-white"
      }`}
    >
      {popular && (
        <p
          className="mb-2 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-900"
          style={{ background: "#FFB300" }}
        >
          Most picked
        </p>
      )}
      <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
        {minutesLabel}
      </p>
      <p className="mt-1 text-3xl font-extrabold leading-none text-neutral-900 sm:text-4xl">
        £{price}
      </p>
      <p className="mt-1 text-[13px] text-neutral-500">one-time</p>
      <p className="mt-3 text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
        {minutes === 1 && "Intro · about us · product showcase."}
        {minutes === 2 && "Multi-scene story · before-after · brand reel."}
        {minutes === 3 && "Full mini-doc · workshop tour · seasonal campaign."}
      </p>
    </div>
  );
}
