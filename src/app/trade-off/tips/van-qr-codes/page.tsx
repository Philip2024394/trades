// Xrated Trades — Tips guide: QR codes on vans.
// Long-form Article-schema page covering placement, size, contrast,
// the 3-second test, what page to point at, and the laminate-glare
// mistake. Server component, reuses XratedHeader/Footer.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { CaseStudyCallout } from "@/components/xrated/tips/CaseStudyCallout";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";
import { TRADE_OFF_HERO_IMAGES } from "@/lib/tradeOffHeroes";

export const revalidate = 3600;

const TITLE = "QR codes on vans: a practical guide";
const DESCRIPTION =
  "Where to put the QR, what size to print it, what page to point it at, and the laminate mistake that makes it unscannable from six feet away. A working tradie's guide.";
const SLUG = "/trade-off/tips/van-qr-codes";
const HERO =
  "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/guide-van-qr-codes.png";

export const metadata: Metadata = {
  title: `${TITLE} | thenetworkers.app guides`,
  description: DESCRIPTION,
  alternates: { canonical: SLUG },
  openGraph: {
    type: "article",
    siteName: BRAND.name,
    title: TITLE,
    description: DESCRIPTION,
    url: absolute(SLUG),
    images: [{ url: HERO, alt: TITLE }]
  }
};

const ARTICLE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: TITLE,
  author: { "@type": "Organization", name: "thenetworkers.app" },
  publisher: {
    "@type": "Organization",
    name: "thenetworkers.app",
    logo: { "@type": "ImageObject", url: BRAND.logo }
  },
  datePublished: "2026-06-28",
  dateModified: "2026-06-28",
  description: DESCRIPTION,
  mainEntityOfPage: { "@type": "WebPage", "@id": absolute(SLUG) },
  image: HERO
};

export default function GuideVanQrCodes() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ARTICLE_JSONLD) }}
      />

      <article className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <a
          href="/trade-off/tips"
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-neutral-500 transition hover:text-neutral-900"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to all tips
        </a>

        <TopicBadge>Van + signage</TopicBadge>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {TITLE}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-700 sm:text-base">
          A QR on the van turns every red-light queue into a billboard
          that actually converts. Done badly, it’s wallpaper.
          Done well, it’s the cheapest lead-generation a
          tradesperson can run.
        </p>
        <Byline minutes={6} />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO}
          alt="Plumber's van — the kind of vehicle this QR-code guide applies to"
          className="mt-6 w-full rounded-2xl border border-neutral-200 object-cover"
        />

        <Section heading="1. Where to put it — rear quarter, eye-level">
          <p>
            The best spot is the back of the van on the driver-passenger
            side rear quarter, roughly at the height of the average car
            window. That puts it directly in the eyeline of the driver
            behind you at every red light, every traffic jam, every
            school pickup. The roof or the bonnet are useless. The doors
            are blocked when you’re parked up.
          </p>
          <p>
            On a panel van, the rear panel just behind the back wheel
            (the “quarter panel”) is the prime real estate.
            On a flatbed or tipper, the back of the cab works. On a car
            derived van, the rear cargo door bottom corner.
          </p>
        </Section>

        <Section heading="2. Size: 200mm minimum, 300mm comfortable">
          <p>
            For a QR to be scannable from inside the car behind you
            — roughly three metres away — it needs to be at
            least 200mm by 200mm. Most printed signs come out smaller
            because the designer worked in pixels on a screen. Tell
            your sign-writer in writing: minimum 200mm, ideally 250-300mm
            square.
          </p>
          <p>
            Test before committing. Print the design at the size you
            plan to vinyl, stick it on the side of the van, stand three
            metres back, and try to scan. If your phone fumbles for more
            than two seconds, go bigger.
          </p>
        </Section>

        <Section heading="3. Contrast: black on yellow, or black on white. Nothing else.">
          <p>
            Phone cameras read QR codes by detecting contrast between
            light and dark squares. The maximum contrast is black on
            white, with black on bright yellow a close second (and a
            stronger brand match for Xrated). Anything else —
            grey on black, dark blue on dark red, white on light grey
            — reduces scan reliability sharply in real conditions
            (sun glare, dusk, dirty van).
          </p>
          <p>
            Skip the “creative” brand-coloured QR codes you
            see on Pinterest. They look great in a portfolio. They don’t
            scan from a moving Astra.
          </p>
        </Section>

        <Section heading="4. The 3-second test">
          <p>
            Stand three metres from your van. Open your phone’s
            camera (don’t open a special scanner app —
            real customers won’t either). Point at the QR. Count.
            If the camera recognises the code and the link banner pops
            up in under three seconds, you’re good. If it takes
            longer than three seconds, you’ve lost most drivers
            — the lights have changed, they’ve moved on,
            the moment’s gone.
          </p>
        </Section>

        <Section heading="5. Point it at your profile, not Facebook">
          <p>
            Every QR should land on a page designed for instant booking.
            That means your Xrated profile — one URL, one tap to
            WhatsApp, one tap to call, photos of your work, reviews. If
            the QR opens Facebook, the customer has to log in (or
            install the app), scroll past unrelated posts, find your
            page, find your contact — you’ve lost them four
            steps in.
          </p>
          <p>
            A good URL for the QR looks like{" "}
            <code>trade.thenetworkers.app/your-slug</code>. Short. Branded.
            Lands somewhere useful.
          </p>
        </Section>

        <Section heading="6. The one design mistake that ruins everything">
          <p>
            Glossy laminate. Most vinyl print shops will laminate the
            sticker by default to “protect” it. The glossy
            top coat catches sunlight, reflects it back at the
            customer’s phone camera, and ruins the scan.
          </p>
          <p>
            Ask explicitly for <strong>matt laminate</strong>. Matt
            still protects the print from weather and washing. It does
            not reflect the sun. Every scan works at midday, dusk and
            dawn.
          </p>
          <Callout>
            Why this matters: a glossy QR scans 95% of the time in a
            shaded car park, 30% of the time in direct sunlight. Matt
            scans 95% in both. One sentence to the sign-writer fixes it.
          </Callout>
        </Section>

        <Section heading="7. Pair the QR with a tiny call to action">
          <p>
            A QR on its own says nothing. Customers don’t scan
            random codes. Underneath the QR, add three or four words
            in big lettering. Something like:
          </p>
          <Bullets>
            <li><strong>SCAN FOR PRICES</strong></li>
            <li><strong>SCAN FOR A QUOTE</strong></li>
            <li><strong>SCAN TO SEE OUR WORK</strong></li>
            <li><strong>SCAN TO BOOK</strong></li>
          </Bullets>
          <p>
            Telling them why they should scan triples the number of
            people who actually do.
          </p>
        </Section>

        <Section heading="8. Bonus: put the same QR on business cards and invoices">
          <p>
            The same QR design that lives on your van should live on
            your business card and on the bottom of every invoice you
            send. Customers keep invoices. When their neighbour asks
            “who did your bathroom?”, the answer is “here,
            scan this”.
          </p>
          <p>
            Print 250 cards. Stick a QR sticker on the back of every
            quote sheet. Total cost: under twenty pounds. Total reach:
            every customer you’ve ever worked for becomes a
            walking advert.
          </p>
        </Section>

        <CaseStudyCallout
          slug="demo-stuart-kingsley-building-merchant-hull"
          title="See where Stuart's QR code points →"
          subtitle="Building merchant in Hull — counter QR, van QR and printed-quote QR all funnel to one live profile with the depot, hours, account form and trade contact."
        />

        <ClosingCta />
      </article>

      <XratedFooter />
    </main>
  );
}

function TopicBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900"
      style={{ background: XRATED_BRAND.accent }}
    >
      {children}
    </span>
  );
}

function Byline({ minutes }: { minutes: number }) {
  return (
    <p className="mt-4 text-[13px] text-neutral-500">
      {minutes} min read · The thenetworkers.app team
    </p>
  );
}

function Section({
  heading,
  children
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-extrabold leading-snug text-neutral-900 sm:text-2xl">
        {heading}
      </h2>
      <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-neutral-700 sm:text-base">
        {children}
      </div>
    </section>
  );
}

function Bullets({ children }: { children: React.ReactNode }) {
  return (
    <ul className="ml-5 list-disc space-y-2 text-[15px] leading-relaxed text-neutral-700 sm:text-base">
      {children}
    </ul>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border-l-4 bg-neutral-50 p-4 text-[14px] leading-relaxed text-neutral-800 sm:text-[15px]"
      style={{ borderLeftColor: XRATED_BRAND.accent }}
    >
      {children}
    </div>
  );
}

function ClosingCta() {
  return (
    <section
      className="mt-12 overflow-hidden rounded-2xl px-5 py-8 text-center sm:px-10 sm:py-10"
      style={{ background: "#0A0A0A" }}
    >
      <p
        className="text-xs font-bold uppercase tracking-widest"
        style={{ color: XRATED_BRAND.accent }}
      >
        Try Xrated Trades
      </p>
      <h2 className="mt-2 text-xl font-extrabold leading-tight text-white sm:text-3xl">
        Free for 14 days. No card. No commission.
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-[13px] text-white/80 sm:text-sm">
        Every Xrated profile has a built-in QR generator. Print it,
        stick it on the van, point it at the page that books work.
      </p>
      <a
        href="/trade-off/signup"
        className="mt-5 inline-flex h-12 items-center gap-2 rounded-lg px-6 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:text-sm"
        style={{
          background: XRATED_BRAND.accent,
          boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
        }}
      >
        Join Thenetworkers
      </a>
    </section>
  );
}
