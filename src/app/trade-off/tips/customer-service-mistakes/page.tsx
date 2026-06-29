// Xrated Trades — Tips guide: 5 customer-facing mistakes most tradies
// make. Long-form Article-schema page covering voicemail, slow quotes,
// no-shows, follow-up failures, and the eager-discount trap. Server
// component, reuses XratedHeader/Footer.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { CaseStudyCallout } from "@/components/xrated/tips/CaseStudyCallout";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

const TITLE = "5 customer-facing mistakes most tradies make";
const DESCRIPTION =
  "The five small habits that quietly cost tradies enquiries — bad voicemail, slow quotes, no-shows, no follow-up, and the eager discount. Each one fixable in under a week.";
const SLUG = "/trade-off/tips/customer-service-mistakes";
const HERO =
  "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/3b72a2f8e677-ChatGPT_Image_Jun_27__2026__07_04_17_AM.png";

export const metadata: Metadata = {
  title: `${TITLE} | xratedtrade.com guides`,
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
  author: { "@type": "Organization", name: "xratedtrade.com" },
  publisher: {
    "@type": "Organization",
    name: "xratedtrade.com",
    logo: { "@type": "ImageObject", url: BRAND.logo }
  },
  datePublished: "2026-06-28",
  dateModified: "2026-06-28",
  description: DESCRIPTION,
  mainEntityOfPage: { "@type": "WebPage", "@id": absolute(SLUG) },
  image: HERO
};

export default function GuideCustomerServiceMistakes() {
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

        <TopicBadge>Customer service</TopicBadge>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {TITLE}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-700 sm:text-base">
          The work is rarely the problem. The reason a customer didn’t
          book you is almost always one of these five small things,
          happening before they ever saw a single photo.
        </p>
        <Byline minutes={7} />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO}
          alt="The five customer-facing mistakes most tradies make — and how to fix them"
          className="mt-6 w-full rounded-2xl border border-neutral-200 object-cover"
        />

        <Section heading="1. The ‘leave a message’ voicemail">
          <p>
            A customer rings. You can’t answer because you’re
            on the tools, in a loft, halfway up a ladder. Voicemail
            kicks in and says: “You’ve reached 07*** ***
            ***, please leave a message after the tone.”
          </p>
          <p>
            Half the customers hang up. The other half leave a half-
            message that doesn’t actually tell you what they want.
            Either way, you’ve lost the job to the next tradesperson
            on their list.
          </p>
          <p>
            Fix it tomorrow morning. Record a new voicemail that says:
            “Hi, this is Sam at Sam’s Plumbing. I’m
            on a job — leave your name, your postcode and what
            you need, and I’ll call you back by six tonight.
            Quicker on WhatsApp: same number.”
          </p>
          <p>
            Three things changed: they know who they reached, they have
            a time commitment (by six tonight), and they have a faster
            channel (WhatsApp). Most of them will WhatsApp instead. You
            keep the lead.
          </p>
        </Section>

        <Section heading="2. The quote that arrives three days late">
          <p>
            A customer asks for a quote on Monday. You’re busy.
            You’ll write it up at the weekend. By Thursday they’ve
            had three other quotes, picked one and booked the work.
            Your quote arrives Saturday. Job’s gone.
          </p>
          <p>
            The data is clear here: the first tradesperson to send a
            proper quote wins a disproportionate share of the work, even
            if they’re not the cheapest. Speed signals competence.
          </p>
          <p>
            Set yourself a 24-hour rule. Every quote out within one
            working day, even if it’s a rough estimate marked
            “subject to a site visit”. Use a quote template
            so it takes ten minutes, not an hour. Send via WhatsApp or
            email — whichever they used first.
          </p>
        </Section>

        <Section heading="3. The no-show or the late arrival">
          <p>
            You said 9am. You arrived at 11.30, with no warning. The
            customer took the morning off work. You’ve already
            damaged the relationship and the job hasn’t started.
          </p>
          <p>
            The fix is a single text message thirty minutes before
            arrival: “On my way, about 25 minutes out.” If
            you’re going to be late, you send another: “Held
            up at the last job, will be with you by 10. Sorry —
            still want to come today or shall we reschedule?”
          </p>
          <p>
            Customers don’t mind delays anywhere near as much as
            they mind being ignored. The tradesperson who texts is
            forgiven. The tradesperson who arrives two and a half hours
            late with no warning gets a one-star review and never gets
            booked again.
          </p>
        </Section>

        <Section heading="4. The quote that goes silent">
          <p>
            You sent a quote on Tuesday. You haven’t heard back.
            Most tradies leave it. “If they want me, they’ll
            call.”
          </p>
          <p>
            They won’t. The quote sat in their inbox for an hour,
            they meant to reply, life happened, and now they feel
            awkward replying days later so they don’t reply at
            all. The job is still open. The tradesperson who follows
            up wins it.
          </p>
          <p>
            One polite WhatsApp the next day: “Hi Sarah, just
            checking you got the quote — happy to walk through
            any of it if useful. No pressure either way.” That
            single message wins a meaningful share of jobs that would
            have gone silent. It’s not pushy. It’s
            professional.
          </p>
        </Section>

        <Section heading="5. The eager ‘cash discount’">
          <p>
            A customer asks for the price. You answer: “It’s
            two thousand, or eighteen hundred for cash.”
          </p>
          <p>
            You’ve just told them three things at once. First,
            your headline price was inflated and you knew it. Second,
            you’d rather not give them a paper trail. Third, you
            can probably be pushed further. All three damage the
            relationship before the job has started.
          </p>
          <p>
            Worse, it raises tax and VAT questions you don’t
            want to be answering if HMRC ever has a look. The cash
            discount is a habit from twenty years ago. It doesn’t
            work in 2026. Quote one price. Accept bank transfer, card
            and cash equally. Issue a proper receipt every time.
          </p>
          <Callout>
            Why this works: customers who pay full price feel they got
            a fair deal. Customers who haggle for the cash discount feel
            they’ve outsmarted you — and they’ll
            haggle again at the end of the job when something goes
            wrong.
          </Callout>
        </Section>

        <Section heading="Quick-fix checklist">
          <p>
            All five of these are fixable inside a week. Here’s
            the order:
          </p>
          <Bullets>
            <li>Today: record the new voicemail (3 minutes).</li>
            <li>
              Tonight: write a one-page quote template you can fill in
              and send in 10 minutes.
            </li>
            <li>
              Tomorrow morning: add a “30 mins out” quick
              reply to WhatsApp.
            </li>
            <li>
              This week: set a recurring Friday reminder to follow up
              on any quote that has gone quiet.
            </li>
            <li>
              From the next quote: one price, no cash discount, proper
              receipt every time.
            </li>
          </Bullets>
        </Section>

        <CaseStudyCallout
          slug="demo-marcus-okafor-drywaller-manchester"
          title="See Marcus's clean profile →"
          subtitle="Drywaller in Manchester — quotes written down with the spec, contact form on the page, and a status note telling customers exactly when he can be on site."
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
      {minutes} min read · The xratedtrade.com team
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
        One profile that handles your enquiries, your quotes, your
        reviews and your follow-ups — in the order this guide
        recommends.
      </p>
      <a
        href="/trade-off/signup"
        className="mt-5 inline-flex h-12 items-center gap-2 rounded-lg px-6 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:text-sm"
        style={{
          background: XRATED_BRAND.accent,
          boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
        }}
      >
        Join XratedTrade
      </a>
    </section>
  );
}
