// Xrated Trades — Contact page.
// Platform contact surface. Stripe risk reviewers and customers alike
// expect a single named email + response-time commitment. The static
// form below uses a `mailto:` action so we don't introduce a new
// backend route — keeps the surface zero-dependency until Resend is
// wired in.

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

const SUPPORT_EMAIL = "support@xratedtrade.com";

export const metadata: Metadata = {
  title: "Contact — Xrated Trades",
  description:
    "Email support@xratedtrade.com. Paid tier: within 1 business day. Free tier: within 3 business days. Plus acceptable use guidance.",
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Contact — Xrated Trades",
    description:
      "Direct email contact, response-time commitments, and acceptable use links.",
    url: absolute("/contact")
  }
};

export default function ContactPage() {
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
            Contact
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            Talk to a human.
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-white/75 sm:text-sm">
            One inbox, one team, replies during UK business hours. No
            ticket-queue gymnastics.
          </p>
        </div>
      </section>

      <article className="mx-auto mt-10 flex max-w-3xl flex-col gap-8 px-4 text-[13px] leading-relaxed text-neutral-800 sm:px-6 sm:text-sm">
        <section>
          <h2 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
            Email
          </h2>
          <p className="mt-3">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-extrabold underline"
              style={{ color: "#0A0A0A" }}
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p className="mt-3">
            <strong>Response time:</strong> within{" "}
            <span className="font-bold">1 business day</span> for paid
            tier accounts, within{" "}
            <span className="font-bold">3 business days</span> for free
            tier and general enquiries. Business days are Monday–Friday,
            excluding Republic of Ireland public holidays.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
            Send a message
          </h2>
          <p className="mt-3 text-[13px] text-neutral-700">
            Drafting here pre-fills your default mail app. We don't store
            anything you type on this page.
          </p>
          <form
            action={`mailto:${SUPPORT_EMAIL}`}
            method="post"
            encType="text/plain"
            className="mt-5 flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold uppercase tracking-wider text-neutral-700">
                Your name
              </span>
              <input
                type="text"
                name="name"
                required
                className="min-h-[44px] rounded-lg border border-neutral-300 px-3 py-2 text-[13px] text-neutral-900 focus:border-neutral-900 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold uppercase tracking-wider text-neutral-700">
                Your email
              </span>
              <input
                type="email"
                name="email"
                required
                className="min-h-[44px] rounded-lg border border-neutral-300 px-3 py-2 text-[13px] text-neutral-900 focus:border-neutral-900 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold uppercase tracking-wider text-neutral-700">
                Subject
              </span>
              <input
                type="text"
                name="subject"
                required
                className="min-h-[44px] rounded-lg border border-neutral-300 px-3 py-2 text-[13px] text-neutral-900 focus:border-neutral-900 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold uppercase tracking-wider text-neutral-700">
                Message
              </span>
              <textarea
                name="message"
                required
                rows={6}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-[13px] text-neutral-900 focus:border-neutral-900 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-12 min-h-[44px] items-center justify-center rounded-lg px-5 text-[13px] font-extrabold uppercase tracking-wider text-black transition active:scale-[0.98]"
              style={{ background: XRATED_BRAND.accent }}
            >
              Open in mail app
            </button>
          </form>
          <p className="mt-3 text-[13px] text-neutral-600">
            Form not opening? Email{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-bold underline"
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            directly.
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
