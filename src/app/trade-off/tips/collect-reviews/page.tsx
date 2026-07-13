// Xrated Trades — Tips guide: collecting reviews.
// Long-form Article-schema page covering WHEN to ask, HOW to ask,
// one-tap links, replying to reviews, the legal line on paid reviews.
// Server component, reuses XratedHeader/Footer.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { CaseStudyCallout } from "@/components/xrated/tips/CaseStudyCallout";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

const TITLE = "How to collect reviews customers actually leave";
const DESCRIPTION =
  "The exact moment to ask, the exact words to use, and the one-tap link that turns 'I'll do it later' into a five-star review while you're still on the doorstep.";
const SLUG = "/trade-off/tips/collect-reviews";
const HERO =
  "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/a31c641dcfb0-ChatGPT_Image_Jun_27__2026__05_57_40_AM.png";

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

export default function GuideCollectReviews() {
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

        <TopicBadge>Reviews</TopicBadge>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {TITLE}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-700 sm:text-base">
          Most tradies do excellent work and end up with three reviews
          on Google. Not because the work was bad — because the
          asking was wrong. Here’s the system that works.
        </p>
        <Byline minutes={6} />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO}
          alt="A five-star review on a customer's phone — what good review-collection looks like"
          className="mt-6 w-full rounded-2xl border border-neutral-200 object-cover"
        />

        <Section heading="1. WHEN to ask — the end of the job, on site">
          <p>
            The moment to ask for a review is the moment you finish.
            Not three days later by text. Not next week by email. The
            customer is standing next to you, looking at the finished
            kitchen, the spotless bathroom, the new roof — and
            they’re happy. They will not be this happy in
            seventy-two hours. They will be back to their normal life,
            with their normal stress, and your job will be a fading
            memory.
          </p>
          <p>
            Tradies who collect lots of reviews ask while the customer
            is still beaming. Tradies who collect almost none ask after
            the customer’s gone back to work and forgotten.
          </p>
        </Section>

        <Section heading="2. HOW to ask — one sentence, no apology">
          <p>
            The wrong way: “Sorry to bother you, if you’ve
            got a minute and you don’t mind, would you maybe
            consider possibly leaving a review somewhere?” Every
            hedge in that sentence gives them an out.
          </p>
          <p>
            The right way: “If you’re happy with how it’s
            turned out, I’d really appreciate a quick review —
            here’s the link. Takes thirty seconds.”
          </p>
          <p>
            Notice what changed: there is no apology, there is a
            condition (“if you’re happy”) that gives
            them a graceful out if they aren’t, and there is a
            time anchor (“thirty seconds”) that lowers the
            barrier.
          </p>
        </Section>

        <Section heading="3. The one-tap review link">
          <p>
            Your review link should open straight to a form with the
            star rating already on screen. Not a homepage. Not a sign-in
            page. Not a captcha. One tap to the rating, one tap to
            submit. Anything more than that and most people will start
            but not finish.
          </p>
          <p>
            On Xrated, every profile has a built-in review link
            (<code>your-slug/review</code>). On Google, you use the
            short PlaceID link from your Google Business Profile. Save
            it as a quick reply on WhatsApp Business so you can send it
            in two taps without typing.
          </p>
        </Section>

        <Section heading="4. Hand them the phone with the form open">
          <p>
            This is the part nobody talks about. Don’t read out
            the URL. Don’t even text it. Open the form on{" "}
            <em>your</em> phone, then hand them the phone. They tap the
            stars, type a sentence, hit submit. Done before they’ve
            even thought about it.
          </p>
          <p>
            This single change — from “here’s the
            link, please do it later” to “here, just tap the
            stars” — is the difference between a few reviews
            a year and a few reviews a week.
          </p>
        </Section>

        <Section heading="5. Reply to every review — positive and negative">
          <p>
            Future customers don’t just read your reviews. They
            read your replies. A short, warm reply to every five-star
            review (“Thanks Karen, really enjoyed working with
            you on the kitchen”) shows you’re a real person
            who pays attention.
          </p>
          <p>
            More importantly: reply to the bad reviews. Not defensively.
            Not with excuses. With the facts, calmly. “Hi James,
            sorry it ended up like this. We agreed the price was for X,
            you asked for Y on day two, and the extra was on the invoice.
            Happy to chat if I’ve misunderstood.” Future
            customers see a professional. They discount the bad review
            and book you anyway.
          </p>
        </Section>

        <Section heading="6. The legal line: don’t buy reviews, don’t fake them">
          <p>
            Under UK consumer protection law (the Digital Markets,
            Competition and Consumers Act 2024), publishing fake reviews
            or commissioning fake reviews is a banned practice that can
            trigger Competition and Markets Authority action. It is not
            a grey area. Don’t pay anyone to leave a review. Don’t
            write reviews for customers and ask them to copy-paste.
            Don’t ask your staff or your family to leave reviews
            without disclosing the relationship.
          </p>
          <p>
            You don’t need to. Real reviews from real jobs,
            collected properly, will outweigh anything you could buy.
            And the moment a competitor or a customer notices the
            pattern, your reputation collapses.
          </p>
        </Section>

        <Section heading="7. Make it easy to leave a photo with the review">
          <p>
            A review with a photo is worth ten without. Future customers
            see the work the previous customer is talking about, in the
            previous customer’s own home. That’s evidence
            no marketing can manufacture.
          </p>
          <p>
            When you hand them the phone with the form open, take the
            finished photo first — the wide shot of the kitchen,
            the close-up of the brickwork — then prompt them
            during the form: “Tap the camera icon and add the
            photo we just took.” Twenty seconds. Done.
          </p>
        </Section>

        <Section heading="8. The follow-up message — one day, then never">
          <p>
            If they didn’t do it on site, one WhatsApp message
            the next day works. “Hope you’re still happy
            with the work. If you get a sec, here’s the review
            link — really appreciate it.” If they don’t
            reply, leave it. Never chase a second time. Pestering wins
            no reviews and loses you future referrals.
          </p>
        </Section>

        <CaseStudyCallout
          slug="demo-charlotte-pemberton-kitchen-manufacturer-bath"
          title="See Charlotte's 12 client reviews →"
          subtitle="Kitchen manufacturer in Bath — twelve named reviews tied to specific kitchens, with the service quoted and what they liked about the build."
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
        Every Xrated profile has a one-tap review form built in. Hand
        them the phone, get the review, walk to the van.
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
