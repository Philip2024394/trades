// Xrated Trades — public FAQ page.
// Server-rendered <details>/<summary> accordions (no JS needed) for
// the 12 questions tradies ask most often. Emits FAQPage JSON-LD so
// Google can surface the Q&As in AI Overview / featured snippets.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute, faqJsonLd } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "FAQ — Xrated Trades. Everything tradies ask, answered.",
  description:
    "Quick answers to the questions tradies ask every day — pricing, trial, reviews, slugs, insurance, cancellation and more. Built for trades who want clarity before they sign up.",
  alternates: { canonical: "/trade-off/faq" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Xrated Trades FAQ — everything tradies ask.",
    description:
      "Quick answers on pricing, the 14-day trial, reviews, slugs, insurance and cancellation — for tradies thinking about signing up.",
    url: absolute("/trade-off/faq")
  }
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "Do I need a website?",
    a: "No. Your Xrated URL — xratedtrade.com/your-name — replaces a website for most working tradies. You get a fully-branded profile with your photos, services with prices, reviews, opening hours, contact buttons and a QR code for the van, all in one shareable link. Most tradies who try Xrated cancel the £19.99/mo Wix or Squarespace site they were paying for and never miss it."
  },
  {
    q: "Can customers call me directly?",
    a: "Yes. The Call Now button is built in on the Paid tier and dials your phone the second a customer taps it — no app required on their side, no forwarding number, no fee. You can choose to show or hide the Call button independently of the WhatsApp button, so if you only want enquiries through WhatsApp you can disable the dialler. Free-tier profiles do not include the Call button."
  },
  {
    q: "Can I change prices?",
    a: "Yes, instantly. Edit any service price from your dashboard and the change is live on your profile inside a second — no rebuild, no review queue, no waiting. You can also schedule a price change to go live on a specific date (handy for seasonal trades). All prices live on your services subpage and on the headline service cards."
  },
  {
    q: "Can I upload videos?",
    a: "Yes — Paid-tier profiles get a self-hosted intro video tile, up to 60 seconds. The video sits next to your name and trade so customers can see and hear you before they pick up the phone. We compress and host the video for you so there's no YouTube logo, no recommended-videos overlay, and nothing to set up — just upload the file."
  },
  {
    q: "Can I use WhatsApp?",
    a: "Yes. WhatsApp is the primary contact channel on every tier — Free, Paid and Verified. Customers tap one button and land in a pre-filled WhatsApp chat addressed to your number with the job context already typed. WhatsApp Business numbers work too, and you can switch which number is wired up from the dashboard at any time."
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. No contracts, no notice period. Cancel from the dashboard and your subscription stops at the end of the current month (or the current year, if you went annual). Your profile auto-reverts to the free-for-life tier on hammerexdirect.com — you keep your slug, your reviews, your photos and your services. Nothing is deleted."
  },
  {
    q: "Is the subscription tax deductible?",
    a: "Most tradies put the Xrated subscription through their business as a marketing or advertising expense. Tax rules differ by country — UK self-employed and sole-trader Ltd treat advertising spend differently to US Schedule C or Australian ABN — so we recommend you check with your accountant before claiming it. But legitimately-used marketing tools typically qualify. At £14.99/mo = £179.88/yr in deductible spend that often comes off your taxable income, the effective cost is even lower than the sticker price."
  },
  {
    q: "Can I hide my address?",
    a: "Yes. By default we show your city only — never the street. You can also choose to show a wider catchment area (handy for mobile trades who service multiple towns) or pinpoint to a specific neighbourhood if you'd rather customers know you're local. The map widget always blurs the exact street unless you opt in."
  },
  {
    q: "What happens to my reviews if I cancel?",
    a: "Your reviews stay yours forever. They migrate with your slug from xratedtrade.com to the free-for-life tier on hammerexdirect.com and remain visible on your profile. Customers can still submit new reviews on the Free tier as a read-only display — they just won't be moderated through the priority queue. If you resubscribe later, everything reconnects automatically."
  },
  {
    q: "How does the 14-day trial work?",
    a: "Everyone starts free with no card on signup. Your first 14 days unlock every Paid-tier feature — brandable xratedtrade.com URL, intro video, contact form, custom theme, the lot. On day 15 you either subscribe to keep premium (£14.99/mo or £139.99/yr) or your profile auto-reverts to the free-for-life tier on hammerexdirect.com. Either change happens automatically."
  },
  {
    q: "Do I need to upload insurance documents?",
    a: "Only if you do private / direct-to-customer work and you want the Insured add-on badge on a Verified profile. Site tradies are usually covered by the principal contractor's master policy and do not need to upload anything — you can still be Verified without an insurance badge. The Insurance add-on is optional on Verified and not used on Free or Paid at all."
  },
  {
    q: "Will my slug always be mine?",
    a: "Yes — once you claim it, no one else can take it. Your slug stays reserved to your account whether you're on Free, Paid or Verified, and it persists across cancellations and resubscriptions. If you ever rename your business we can move you to a new slug and 301-redirect the old one so existing shared links keep working."
  },
  {
    q: "What if I work in two trades?",
    a: "You can list a primary trade plus up to three secondary trades on every tier. Customers searching for any of your trades will find you, and your profile shows all four with separate service lists and price cards. Your URL stays a single slug — secondary trades appear inside the profile, not as separate URLs."
  }
];

export default function FaqPage() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQ)) }}
      />

      {/* Hero — black surface, yellow eyebrow, yellow accent on H1 */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            FAQ
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            <span style={{ color: XRATED_BRAND.accent }}>Everything</span>{" "}
            tradies ask.
          </h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
            Quick answers to the questions we get every day. Can't find
            yours? WhatsApp the team and we'll add it here.
          </p>
        </div>
      </section>

      {/* FAQ list — server-rendered <details> accordions, no JS */}
      <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
        <ul className="flex flex-col gap-3">
          {FAQ.map((qa) => (
            <li key={qa.q}>
              <details
                className="group rounded-2xl border border-neutral-200 bg-white p-4 transition open:border-[color:var(--accent)]"
                style={{ ["--accent" as never]: XRATED_BRAND.accent }}
              >
                <summary className="flex min-h-[44px] cursor-pointer list-none items-start justify-between gap-3 text-sm font-bold text-neutral-900 marker:content-[''] sm:text-base">
                  <span>{qa.q}</span>
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-extrabold transition group-open:rotate-45"
                    style={{ background: XRATED_BRAND.accent, color: "#0A0A0A" }}
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                  {qa.a}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      {/* Closing CTA — mirrors pricing-page rhythm */}
      <section className="mx-auto mt-12 max-w-5xl px-4 pb-2 sm:px-6">
        <div
          className="overflow-hidden rounded-2xl px-5 py-8 text-center sm:px-10 sm:py-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: XRATED_BRAND.accent }}
          >
            Still curious?
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Start your 14-day free trial.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-xs text-white/80 sm:text-sm">
            Full Paid-tier access for 14 days. No card on signup. Your
            slug, your reviews and your work stay yours forever — no
            matter what tier you end up on.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/trade-off/signup"
              className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:text-sm"
              style={{
                background: XRATED_BRAND.accent,
                boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
              }}
            >
              Join XratedTrade
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
