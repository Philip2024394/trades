// Xrated Trades — Tips guide: using reviews to win bigger jobs.
// Long-form Article-schema page covering review curation for B2B,
// pinning best reviews, getting reviews from PMs/architects,
// verified-trade badge in B2B searches. Server component, reuses
// XratedHeader/Footer.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { CaseStudyCallout } from "@/components/xrated/tips/CaseStudyCallout";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";
import { TRADE_OFF_HERO_IMAGES } from "@/lib/tradeOffHeroes";

export const revalidate = 3600;

const TITLE = "How to use Xrated reviews to win bigger jobs";
const DESCRIPTION =
  "Commercial buyers, project managers and architects read reviews differently from homeowners. Here's how to curate, pin and present yours so you win £10k+ jobs, not £200 jobs.";
const SLUG = "/trade-off/tips/win-bigger-jobs";
const HERO =
  "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/guide-win-bigger-jobs.png";

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

export default function GuideWinBiggerJobs() {
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

        <TopicBadge>Bigger jobs</TopicBadge>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {TITLE}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-700 sm:text-base">
          A homeowner reads reviews to feel safe. A project manager
          reads them to do due diligence on a 30-grand contract. They
          want different things. Your profile should answer both.
        </p>
        <Byline minutes={7} />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO}
          alt="General builder on a larger commercial job — the kind of work this guide targets"
          className="mt-6 w-full rounded-2xl border border-neutral-200 object-cover"
        />

        <Section heading="1. Pin your best three reviews to the top">
          <p>
            Commercial buyers do not scroll to your fortieth review.
            They read the first three and form a judgement. Whichever
            three are at the top need to do the heavy lifting.
          </p>
          <p>
            Pick three reviews that, between them, cover: the size of
            job you want to win, the speed/professionalism question,
            and the “would they hire you again” question.
            On your Xrated profile, those are the ones you pin. On
            Google, you can’t pin — but you can make sure
            those reviews are the ones you collect most recently, so
            they sit at the top by default.
          </p>
        </Section>

        <Section heading="2. Curate by job SIZE, not just quality">
          <p>
            Twenty five-star reviews from £200 boiler services don’t
            win you a £30k extension contract. The buyer scrolling your
            profile is checking whether you’ve done work at their
            scale before.
          </p>
          <p>
            When you ask for reviews after a bigger job, gently prompt
            the customer to mention the size. “If you mention the
            kitchen was a full refit it really helps future customers
            who are looking for the same.” Not a script. Just a
            nudge. The review that says “great work on our
            &pound;14k kitchen extension” works differently from
            the one that says “great work, thanks!”.
          </p>
        </Section>

        <Section heading="3. Get reviews from PMs, architects and surveyors">
          <p>
            Homeowner reviews tell future homeowners you’re
            trustworthy. They don’t move the needle with a project
            manager who’s briefing a building company. The PM is
            asking different questions: did you turn up when you said?
            Did you communicate cleanly with the QS? Did you sequence
            your work to fit the programme? Were your RAMS in order?
          </p>
          <p>
            After a job where you worked alongside a PM, an architect
            or a surveyor, ask <em>them</em> for a review on top of the
            client. “Would really appreciate a couple of lines on
            my profile — the kind of thing other PMs and architects
            would find useful.” A single review from a known
            chartered professional outweighs ten homeowner reviews for
            B2B work.
          </p>
        </Section>

        <Section heading="4. Use the verified-trade badge to stand out in B2B searches">
          <p>
            When a commercial buyer searches Xrated for “general
            builder Manchester”, they see a list. The verified
            tradies have a badge. The unverified ones don’t. For
            a homeowner that’s a nice-to-have. For a procurement
            team it’s the filter they apply before looking at any
            individual profile.
          </p>
          <p>
            The Verified tier on Xrated is backed by an active company
            registration check. If you’re chasing bigger work,
            the upgrade pays for itself with the first B2B contract it
            opens. Optional add-on badges for insurance and on-site
            verification add another layer for high-risk trades (gas,
            electrical, scaffolding).
          </p>
        </Section>

        <Section heading="5. Reviews that mention budgets, timelines and sequencing">
          <p>
            The reviews that win bigger work tend to share three
            features. They mention <strong>budget</strong> (so the buyer
            can compare scale). They mention <strong>timeline</strong>{" "}
            (so the buyer knows you can hit a programme). They mention{" "}
            <strong>sequencing</strong> — how your work fitted
            around other trades on site.
          </p>
          <p>
            You can’t script those reviews. But you can prompt
            for them with a single line in your follow-up: “If
            anything stood out about how we fitted around the
            electrician and the plasterer, that’s the bit other
            project managers really want to know.”
          </p>
        </Section>

        <Section heading="6. The trust gap closes faster with photos in the review">
          <p>
            A buyer reading a review with attached photos closes the
            trust gap in half the time. They’re not just reading a
            stranger’s opinion — they’re seeing the
            work that opinion describes. That is the closest thing to a
            site visit you can give them.
          </p>
          <p>
            Every review collection moment on a bigger job should
            include a photo. Wide shot of the finished area. One detail
            shot. Submitted with the review. Your Xrated profile
            attaches photos to the relevant review automatically; on
            Google you do it manually.
          </p>
        </Section>

        <Section heading="7. Build a one-page case study for the standout jobs">
          <p>
            On the biggest jobs — the ones you would happily do a
            dozen of — treat the review like the start of a case
            study, not the end of a job. Two paragraphs from the client.
            A row of photos. A line about the scope, the budget range
            and the timeline. The Xrated Job Diary add-on does this in
            the dashboard; without it, a pinned post on your profile
            does the same job.
          </p>
          <p>
            Commercial buyers prefer case studies to star ratings. Star
            ratings tell them you’re competent. Case studies tell
            them you’re competent <em>at the specific kind of
            work they’re hiring for</em>.
          </p>
        </Section>

        <Section heading="8. Quote bigger numbers without flinching">
          <p>
            The last piece is internal. Tradies who’ve spent years
            quoting £400 jobs flinch when they have to type £40,000 into
            a quote. The customer notices. They lose confidence in your
            number before they’ve even read it.
          </p>
          <p>
            The review work you’ve just done is your proof you
            belong at that price level. Read it before you write the
            quote. The number you send is the same number the people in
            your reviews paid — and they were happy. Stand on
            that.
          </p>
        </Section>

        <CaseStudyCallout
          slug="demo-charlotte-pemberton-kitchen-manufacturer-bath"
          title="See Charlotte's £40k kitchen showcase →"
          subtitle="Kitchen manufacturer in Bath — bespoke in-frame kitchens from £22k, ten-metre island runs from £38k. The reviews back up the price tag."
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
        Pin your best reviews. Add a case-study page. Show buyers
        you’ve done the work before. Start free, upgrade only
        when bigger jobs land.
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
