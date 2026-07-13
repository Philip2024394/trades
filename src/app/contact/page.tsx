// Xrated Trades — Contact page.
// Platform contact surface. The form below posts to /api/contact which
// routes the structured intake via Resend to the admin inbox — the
// reason dropdown lands in the subject line so the team can triage
// straight from the inbox. We deliberately do not show a public email
// address on this page; the form is the only intake channel here.

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";
import { FaqAccordion } from "./FaqAccordion";
import { ContactForm } from "./ContactForm";
import { OpeningHoursPill } from "./OpeningHoursPill";

export const revalidate = 3600;

const CONTACT_HERO_IMAGE =
  "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/contact-hero.png";

export const metadata: Metadata = {
  title: "Contact — Thenetworkers",
  description:
    "Send a message to the Thenetworkers team. Replies within 24 hours, UK business hours. Plus acceptable use guidance.",
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Contact — Thenetworkers",
    description:
      "Send a message to the Thenetworkers team. Replies within 24 hours.",
    url: absolute("/contact")
  }
};

export default function ContactPage() {
  return (
    <main className="bg-white pb-20">
      <XratedHeader />

      {/* Full-bleed hero — mirrors the /trade-off/tips hero pattern.
          Edge-to-edge image, dark left-to-right gradient overlay, eyebrow
          + headline + subtitle stacked over the dark side. */}
      <section className="relative min-h-[420px] w-full overflow-hidden border-b border-neutral-200 sm:min-h-[520px] md:min-h-[600px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={CONTACT_HERO_IMAGE}
          alt="Talk to our team — Thenetworkers support"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.55) 45%, rgba(10,10,10,0.15) 75%, rgba(10,10,10,0) 100%)"
          }}
        />
        <div className="relative mx-auto flex min-h-[420px] max-w-5xl flex-col justify-end px-4 pb-12 pt-16 sm:min-h-[520px] sm:px-6 sm:pb-16 sm:pt-20 md:min-h-[600px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              className="text-[13px] font-bold uppercase tracking-[0.22em]"
              style={{ color: XRATED_BRAND.accent }}
            >
              Contact us
            </p>
            <OpeningHoursPill/>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white drop-shadow-md sm:text-4xl md:text-5xl">
            Talk to our team.
          </h1>
          <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-white/90 drop-shadow sm:text-sm">
            Tell us what you need. We reply within 24 hours from our team.
          </p>
        </div>
      </section>

      <article className="mx-auto mt-10 flex max-w-3xl flex-col gap-8 px-4 text-[13px] leading-relaxed text-neutral-800 sm:px-6 sm:text-sm">
        <section>
          <h2 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
            Get in touch
          </h2>
          <p className="mt-3">
            Use the form below to reach the team. One inbox, one team,
            replies during UK business hours. No ticket-queue gymnastics.
          </p>
          <p className="mt-3">
            <strong>Response time:</strong> we reply{" "}
            <span className="font-bold">within 24 hours</span>. UK hours,
            Monday–Friday, 9am–6pm. Weekend messages get picked up
            Monday morning.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
            Common questions
          </h2>
          <p className="mt-3 text-[13px] text-neutral-700">
            If you can't find your answer here, the form below reaches the
            team directly.
          </p>
          <FaqAccordion />
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
            Send a message
          </h2>
          <p className="mt-3 text-[13px] text-neutral-700">
            Structured intake — pick a reason, give us your details,
            we'll route it to the right team member and reply within 24
            hours.
          </p>
          <ContactForm />
          <p className="mt-4 text-[13px] text-neutral-600">
            Drop us a message above — the form is the fastest way to reach
            the right person on the team.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
            Before you write
          </h2>
          <p className="mt-3">
            We expect tradespeople and customers to use the platform
            within our Acceptable Use Policy — no fake reviews, no
            impersonation, no illegal trades, no scraping, no harassment.
            Breaches can lead to suspension, removal of content, refusal
            of refund, or a full account ban.
          </p>
          <p className="mt-3">
            Read the full policy:{" "}
            <Link href="/legal/aup" className="font-bold underline">
              Acceptable Use Policy
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
            Other useful pages
          </h2>
          <ul className="mt-3 ml-4 flex list-disc flex-col gap-2">
            <li>
              <Link href="/about" className="font-bold underline">
                About Xrated Trades
              </Link>
            </li>
            <li>
              <Link href="/status" className="font-bold underline">
                Service status
              </Link>
            </li>
            <li>
              <Link href="/legal/refunds" className="font-bold underline">
                Refund Policy
              </Link>
            </li>
            <li>
              <Link href="/legal/privacy" className="font-bold underline">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/legal/terms" className="font-bold underline">
                Terms & Conditions
              </Link>
            </li>
          </ul>
        </section>
      </article>

      <XratedFooter />
    </main>
  );
}
