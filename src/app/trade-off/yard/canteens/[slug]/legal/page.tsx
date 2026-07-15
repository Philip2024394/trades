// /trade-off/yard/canteens/[slug]/legal — merchant-specific terms &
// privacy notice. Linked from the About tab (single "Mike Watson's
// terms & privacy" chip). Covers:
//   - Platform vs merchant responsibility (Thenetworkers hosts, does
//     not moderate or warrant merchant content)
//   - Reporting harmful / misleading / under-18 content routes to
//     thenetworkers.app@gmail.com
//   - Data & privacy for the merchant's canteen
//   - IP + governing law
//
// Reads canteen + admin from the standard server-side loaders so it
// works for real DB canteens and demo canteens alike.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { canteenBySlugFromDb, adminForCanteenFromDb } from "@/lib/canteens.server";
import { BRAND, absolute } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) return { title: "Canteen not found | Thenetworkers" };
  const title = `${canteen.hostDisplayName} · Terms & Privacy | Thenetworkers`;
  const description = `Terms of use and privacy notice for ${canteen.hostDisplayName}'s canteen page on Thenetworkers.app. How content responsibility works, how to report harmful or misleading content, and how your data is handled.`;
  return {
    title,
    description,
    alternates: { canonical: `/trade-off/yard/canteens/${slug}/legal` },
    openGraph: {
      type: "article",
      siteName: BRAND.name,
      title,
      description,
      url: absolute(`/trade-off/yard/canteens/${slug}/legal`)
    }
  };
}

export default async function CanteenLegalPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) notFound();
  const admin = await adminForCanteenFromDb(canteen.id);
  const merchantName = canteen.hostDisplayName;
  const tradeLabel = canteen.tradeLabel;
  const city = admin?.city ?? null;
  const year = new Date().getFullYear();
  const lastUpdated = new Date().toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const contactEmail = "thenetworkers.app@gmail.com";

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 md:px-6 md:pt-10">
      {/* Back to canteen */}
      <div className="mb-6">
        <Link
          href={`/trade-off/yard/canteens/${slug}`}
          className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft size={12} strokeWidth={2.5}/>
          Back to {merchantName}&apos;s canteen
        </Link>
      </div>

      {/* Masthead — reads like a proper policy page, not a mockup */}
      <header className="mb-8 border-b pb-6" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
          Terms of use &amp; privacy notice
        </div>
        <h1
          className="mt-2 text-[28px] font-black leading-tight text-neutral-900 md:text-[34px]"
          style={{ fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' }}
        >
          {merchantName}
        </h1>
        <p className="mt-2 text-[13px] text-neutral-600">
          Governing your use of the {merchantName} canteen page on Thenetworkers.app.
          {city ? ` ${merchantName} operates as a ${tradeLabel} based in ${city}.` : ` ${merchantName} operates as a ${tradeLabel}.`}
        </p>
        <p className="mt-1 text-[11px] font-black uppercase tracking-wider text-neutral-400">
          Last updated · {lastUpdated}
        </p>
      </header>

      <article className="flex flex-col gap-8 text-neutral-800">
        {/* 1 — Who does what */}
        <Section number="1" title="Who publishes this canteen">
          <p>
            This page (the &quot;Canteen&quot;) is a merchant profile published and
            operated by <strong>{merchantName}</strong> using tools provided by
            Thenetworkers.app (the &quot;Platform&quot;), operated by Thenetworkers.
          </p>
          <p>
            {merchantName} is solely responsible for every piece of content
            published on this Canteen — product listings, images, prices,
            services, posts, portfolio jobs, replies, and any other material
            that appears here.
          </p>
          <p>
            Thenetworkers.app provides the hosting and publishing tools only.
            Thenetworkers.app does not create, moderate, verify, endorse, or
            warrant any content on this Canteen and does not act as an agent,
            partner, or representative of {merchantName}.
          </p>
        </Section>

        {/* 2 — No responsibility for merchant content */}
        <Section number="2" title="Content responsibility">
          <p>
            Thenetworkers.app holds <strong>no responsibility</strong> for the
            accuracy, quality, legality, safety, or fitness for purpose of any
            information or images displayed on the {merchantName} Canteen.
            This includes but is not limited to:
          </p>
          <ul className="mt-2 flex flex-col gap-1.5 pl-5" style={{ listStyleType: "disc" }}>
            <li>Product descriptions, specifications, prices, and stock status</li>
            <li>Photographs, videos, and portfolio imagery</li>
            <li>Service descriptions, availability, and pricing</li>
            <li>Ratings, reviews, and testimonials</li>
            <li>Posts, replies, and messages between members</li>
            <li>Contact details and any professional claims (qualifications, insurance, memberships)</li>
          </ul>
          <p className="mt-3">
            Any transaction, contract, or arrangement you enter into with
            {" "}{merchantName} is between you and {merchantName} directly.
            Thenetworkers.app is not a party to that arrangement and provides
            no warranty, guarantee, or refund on the goods or services
            supplied.
          </p>
        </Section>

        {/* 3 — Reporting harmful / misleading / under-18 content */}
        <Section number="3" title="Reporting harmful, misleading, or unsuitable content">
          <p>
            Thenetworkers.app takes reports of harmful or misleading content
            seriously. If you believe any information or image on this
            Canteen is:
          </p>
          <ul className="mt-2 flex flex-col gap-1.5 pl-5" style={{ listStyleType: "disc" }}>
            <li>Misleading, fraudulent, or knowingly inaccurate</li>
            <li>Harmful, unsafe, or dangerous to a reasonable user</li>
            <li>Defamatory, harassing, or infringes on the rights of a third party</li>
            <li>Sexually explicit, violent, or otherwise unsuitable for viewers under 18 years of age</li>
            <li>In breach of UK or applicable local law (including consumer protection, trading standards, and intellectual property law)</li>
          </ul>
          <p className="mt-3">
            Please contact us immediately at{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="font-black text-neutral-900 underline decoration-neutral-400 underline-offset-2 hover:decoration-neutral-900"
            >
              {contactEmail}
            </a>
            . Include the URL of the content, a description of the concern,
            and, where possible, a screenshot. We will acknowledge credible
            reports within five (5) business days and may remove or restrict
            content pending investigation.
          </p>
          <p className="mt-3 rounded-md border-l-4 border-neutral-800 bg-neutral-100 py-3 pl-4 pr-3 text-[13px]">
            <strong>Under-18 notice.</strong> Thenetworkers.app is a
            professional trades network intended for users aged 18 and above.
            If you are under 18 and you have accessed content on this
            Canteen that you believe is unsuitable for you, or if you are a
            parent or guardian raising a concern on behalf of a minor,
            contact us at{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="font-black text-neutral-900 underline decoration-neutral-400 underline-offset-2 hover:decoration-neutral-900"
            >
              {contactEmail}
            </a>{" "}
            immediately and we will act on the report as a priority.
          </p>
        </Section>

        {/* 4 — Data & privacy */}
        <Section number="4" title="Data &amp; privacy">
          <p>
            When you contact {merchantName} through this Canteen (via the
            business card, WhatsApp handoff, contact form, or reply
            composer), the information you provide — such as your name,
            phone number, email address, project details, and any
            attachments — is transmitted to {merchantName} directly.
            {merchantName} is the data controller for that information and
            is solely responsible for how it is stored, used, and disposed
            of.
          </p>
          <p>
            Thenetworkers.app processes limited information on
            {" "}{merchantName}&apos;s behalf as a technical intermediary
            (page views, click events, session cookies) for the purpose of
            operating the Platform. This information is not sold to third
            parties. See the wider Thenetworkers.app privacy notice for
            full details of platform-level processing.
          </p>
          <p>
            You may request access to, correction of, or deletion of any
            personal data {merchantName} holds about you by contacting them
            directly. If you cannot reach {merchantName}, or you wish to
            raise a concern about how your data is being handled, contact
            us at{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="font-black text-neutral-900 underline decoration-neutral-400 underline-offset-2 hover:decoration-neutral-900"
            >
              {contactEmail}
            </a>{" "}
            and we will assist in escalating the request.
          </p>
        </Section>

        {/* 5 — Intellectual property */}
        <Section number="5" title="Intellectual property">
          <p>
            All product images, photographs, portfolio work, copy, and
            branding published on this Canteen are the property of
            {" "}{merchantName} or their licensors, unless otherwise stated.
            Reproduction, redistribution, or commercial use without
            written permission from {merchantName} is prohibited.
          </p>
          <p>
            The Thenetworkers.app name, wordmark, and platform features
            (including the Canteen framework, The Yard, Trade Center, and
            associated tools) are the property of Thenetworkers and are
            protected under UK and international IP law.
          </p>
        </Section>

        {/* 6 — Governing law */}
        <Section number="6" title="Governing law">
          <p>
            This notice is governed by the laws of England &amp; Wales.
            Any dispute arising from or relating to this notice will be
            subject to the exclusive jurisdiction of the courts of
            England &amp; Wales.
          </p>
        </Section>

        {/* 7 — Contact */}
        <Section number="7" title="Contact">
          <p>
            <strong>For matters relating to {merchantName}&apos;s products,
            services, orders, or replies:</strong> use the Card action or
            Contact link on the {merchantName} canteen page to reach the
            merchant directly.
          </p>
          <p>
            <strong>For platform-level matters, content reports, under-18
            safety concerns, or data escalations:</strong> contact
            Thenetworkers.app at{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="font-black text-neutral-900 underline decoration-neutral-400 underline-offset-2 hover:decoration-neutral-900"
            >
              {contactEmail}
            </a>
            .
          </p>
        </Section>
      </article>

      {/* Powered by + copyright */}
      <footer
        className="mt-12 flex flex-col items-center gap-1 border-t pt-6 text-center"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
          Powered by{" "}
          <Link href="/" className="text-neutral-900 hover:underline">
            Thenetworkers.app
          </Link>
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
          © {year} Thenetworkers &middot; All rights reserved
        </div>
      </footer>
    </main>
  );
}

function Section({
  number,
  title,
  children
}: {
  number: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-baseline gap-3 text-[18px] font-black text-neutral-900 md:text-[20px]">
        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-400">
          {number}
        </span>
        <span>{title}</span>
      </h2>
      <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-neutral-700">
        {children}
      </div>
    </section>
  );
}
