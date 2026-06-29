// Xrated Trades — About page.
// Plain platform-level explainer: what Trade Off is, who runs it,
// where we operate from, how to get in touch. Stripe risk reviewers
// expect every live-subscription site to have one; visitors searching
// the brand name also land here when they're sanity-checking us.

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Introduction — xratedtrade.com",
  description:
    "xratedtrade.com is a construction trades directory and profile platform for UK tradespeople and customers worldwide. Independent, Ireland-based, no lead-gen middleman.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Introduction — xratedtrade.com",
    description:
      "Who we are, who runs us, where we operate from, and how to reach us.",
    url: absolute("/about")
  }
};

export default function AboutPage() {
  return (
    <main className="bg-white pb-20">
      <XratedHeader />

      <section
        className="border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <p
            className="text-[13px] font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Introduction
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            A trades directory built for tradies — not for lead-gen
            middlemen.
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-white/75 sm:text-sm">
            xratedtrade.com gives tradespeople a
            shareable profile customers can actually read, share and
            trust. No pay-per-lead. No bidding on your own name. Just one
            link that does the work of a website, quote form and business
            card combined.
          </p>
        </div>
      </section>

      <article className="mx-auto mt-10 flex max-w-3xl flex-col gap-8 px-4 text-[13px] leading-relaxed text-neutral-800 sm:px-6 sm:text-sm">
        <Section title="What xratedtrade.com is">
          <p>
            xratedtrade.com is a construction trades directory and SaaS
            platform. Tradespeople get a public profile under a clean
            URL (<code>xratedtrade.com/your-name</code>) with reviews,
            photos, prices, service cards, WhatsApp contact and the rest
            of the surface their customers expect.
          </p>
          <p>
            Customers searching for a tradesperson get a profile they can
            read end-to-end, share with a partner or property manager,
            and act on in one tap.
          </p>
          <p>
            Our primary audience is the <strong>UK</strong>, but every
            page on the platform is reachable worldwide and our trades
            directory accepts profiles from any country.
          </p>
        </Section>

        <Section title="Who runs it">
          <p>
            We're an independent team building tools for the trades that
            big lead-gen sites have spent a decade overcharging for. We
            don't sell leads. We don't take commission on jobs. We don't
            insert ourselves between you and your customer.
          </p>
          <p>
            Our deal with tradies is the same one a good supplier offers:
            a fair price, no surprises, no upsells, and every product
            update included for as long as you're a member.
          </p>
        </Section>

        <Section title="Where we operate from">
          <p>
            Our operating entity is based in the{" "}
            <strong>Republic of Ireland</strong>. Our payment processor
            is Stripe Payments Europe (also Ireland). We serve customers
            worldwide; statutory consumer rights vary by jurisdiction and
            we honour the strongest applicable protections in each market
            — see our{" "}
            <Link href="/legal/refunds" className="font-bold underline">
              Refund Policy
            </Link>{" "}
            for the detail.
          </p>
        </Section>

        <Section title="What we're not">
          <p>
            We're not a job platform, an agency, or a bidding site. We
            don't broker jobs and we don't take a cut of the work you
            quote. xratedtrade.com is a profile platform — what your customer
            sees and what your reputation is built on.
          </p>
        </Section>

        <Section title="Get in touch">
          <p>
            Questions, partnerships, press, or a bug to report? Our{" "}
            <Link href="/contact" className="font-bold underline">
              Contact page
            </Link>{" "}
            has the right address for each, including the response-time
            commitment per tier.
          </p>
        </Section>
      </article>

      <XratedFooter />
    </main>
  );
}

function Section({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}
