// Xrated Trades — Tips guide: social media for tradies.
// Long-form Article-schema page targeting "how to win customers on
// social media" + related long-tail queries. Reuses the shared
// XratedHeader/Footer and the brand black/yellow rhythm. Body is
// written for working tradies (plain language, no fabricated stats,
// British English). Linked from /trade-off/tips index grid.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { CaseStudyCallout } from "@/components/xrated/tips/CaseStudyCallout";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

const TITLE = "How to win more customers from social media";
const DESCRIPTION =
  "A plain-English guide to social media for tradies — what to post, what to write in the caption, how often to post, which hashtags actually help, and how to turn followers into paying jobs.";
const SLUG = "/trade-off/tips/social-media-customers";
const HERO =
  "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/guide-social-media-customers.png";

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

export default function GuideSocialMediaCustomers() {
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

        <TopicBadge>Marketing</TopicBadge>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {TITLE}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-700 sm:text-base">
          A working tradesperson’s guide to turning Instagram, TikTok
          and Facebook scrollers into paying customers — what to
          post, how to caption it and how often to show up.
        </p>
        <Byline minutes={7} />

        {/* Hero image — generic landing hero, no fabricated swap. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO}
          alt="Tradesperson on site — the kind of image that lands well on social"
          className="mt-6 w-full rounded-2xl border border-neutral-200 object-cover"
        />

        <Section heading="1. Post the work first, the people second">
          <p>
            The fastest way to lose a potential customer scrolling
            through your feed is to lead with selfies. They want to see
            the work. A close-up of a freshly pointed brick wall, a
            kitchen with the worktop just landed, a slate roof you
            finished yesterday afternoon — that is what makes
            someone stop, save the post and tap your bio.
          </p>
          <p>
            Once they have seen three or four pieces of finished work,
            <em> then</em> the “hi I’m Sam from Leeds”
            video lands differently. By that point they have already
            decided you can do the job. The face video just confirms
            you’re someone they could have round.
          </p>
          <Callout>
            Why this works: people scroll fast. They’re looking
            for proof you can do their job, not for a friend. Lead with
            proof. Personality follows.
          </Callout>
        </Section>

        <Section heading="2. Write captions like a tradesperson, not a marketer">
          <p>
            Every caption needs four things and no more. What trade.
            Where the job was. What problem you solved. How to book.
            Thirty to fifty words. No corporate buzzwords. No motivational
            quotes.
          </p>
          <p>
            Here is the formula:
          </p>
          <Bullets>
            <li>
              <strong>Line 1:</strong> the job in one sentence.
              <em> “Re-pointed a Victorian gable in Headingley
              this week.”</em>
            </li>
            <li>
              <strong>Line 2:</strong> the problem you solved.
              <em> “Old lime mortar had washed out and the wind
              was driving rain straight in.”</em>
            </li>
            <li>
              <strong>Line 3:</strong> a small detail only a tradesperson
              would mention — this is what builds credibility with
              buyers who’ve been let down before.
            </li>
            <li>
              <strong>Line 4:</strong> how to book. A WhatsApp link or
              your profile URL is enough.
            </li>
          </Bullets>
        </Section>

        <Section heading="3. Hashtags: five to seven, mixed broad and local">
          <p>
            Stacking thirty hashtags worked in 2018. It does not work
            now — Instagram’s help centre openly says
            relevance matters more than volume. Pick a small set that
            actually describes the job and the place.
          </p>
          <p>
            A roofer in Edinburgh might use: #roofing #scotlandbuilder
            #edinburghtrades #slateroof #leadwork #flatroof #leakrepair.
            A kitchen fitter in Leeds: #kitchenfitter #leedsbuilder
            #yorkshiretrades #howdens #wrenkitchens #subwaytile. Two or
            three broad trade tags, two or three city tags, one or two
            specific to that week’s job.
          </p>
        </Section>

        <Section heading="4. Posting cadence — consistency beats volume">
          <p>
            Two or three posts a week beats one a day. The accounts that
            convert followers into customers post when they have
            something real to show, not on a schedule. If you finish two
            jobs a week, that is two posts. If you take three before/after
            pairs on one big job, that is three posts you can space out.
          </p>
          <p>
            Use Stories for the work-in-progress — the dig out, the
            first courses, the pipework before it gets boarded. Use the
            main feed for the finished result. Stories build the “he
            actually works” feeling; the feed builds the
            “this is the standard you can expect” feeling.
          </p>
        </Section>

        <Section heading="5. Reply to every comment within 24 hours">
          <p>
            The algorithm on every major platform rewards engagement,
            and a fast reply tells it the post is worth pushing further.
            More importantly: every comment from someone who is not
            already your customer is a free lead. Replying with a useful
            answer (not just “thanks!”) is what turns a casual
            comment into a DM into a quote.
          </p>
          <p>
            Set a habit: every morning with your first coffee, open the
            comments, reply to everything from the previous day. Five
            minutes. It compounds.
          </p>
        </Section>

        <Section heading="6. Cross-post to TikTok — be honest about who watches">
          <p>
            If most of your work is for homeowners under thirty-five,
            TikTok is worth the ten extra seconds it takes to reformat a
            video. Time-lapses of a kitchen install, before/after
            transitions on a roof, a clean cut on a piece of timber
            — these travel well there.
          </p>
          <p>
            If your typical customer is older — commercial clients,
            landlords, retirees doing extensions — you can skip
            TikTok and double down on Facebook and Instagram. Be honest
            with yourself about where your buyers are. Posting where
            they aren’t is a tax on your time.
          </p>
        </Section>

        <Section heading="7. Put the booking link in the bio, not the caption">
          <p>
            Instagram still does not allow clickable links in captions.
            Put one link in your bio that goes straight to your Xrated
            profile (or wherever you take enquiries). Every caption ends
            with “link in bio”. Do not send people to a
            Facebook page that opens a separate app — you lose
            half of them in the switch.
          </p>
          <p>
            Your bio link should land on a page that shows a WhatsApp
            button, a phone number and a few examples of work. That is
            three taps from scroll to booking. Anything more and the
            enquiry never happens.
          </p>
        </Section>

        <Section heading="8. The one habit that beats everything else">
          <p>
            Photograph every job. Every job, every time, before you pack
            the van. A roofer, a plumber, a sparks, a tiler — the
            tradies who post regularly are not better photographers,
            they just never leave site without the picture. Five minutes
            at the end of every job. That is the entire system.
          </p>
        </Section>

        <CaseStudyCallout
          slug="demo-jamie-mclean-electrician-edinburgh"
          title="See Jamie's profile →"
          subtitle="Electrician in Edinburgh — the social handles, the intro video, the priced services and the reviews all live on the same one link he shares everywhere."
        />

        <ClosingCta />
      </article>

      <XratedFooter />
    </main>
  );
}

/* ────────────────────────── shared chrome ────────────────────────── */

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
      <div className="prose-trade mt-3 space-y-4 text-[15px] leading-relaxed text-neutral-700 sm:text-base">
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
        Claim your name, get your shareable profile, put the link in your
        social bio. The whole system, set up in five minutes.
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
