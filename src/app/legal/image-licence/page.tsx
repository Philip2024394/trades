// /legal/image-licence — Site Interest STORE commercial licence.
//
// Distinct from /legal/image-license (US-spelling, social-share
// friendly terms for images seen in the wider platform search).
// This page is the paid commercial licence that comes with each
// Store purchase. Plain-English + enforceable.

import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/seo";

export const metadata: Metadata = {
  title:       `Image commercial licence — ${BRAND.name}`,
  description: "Site Interest commercial licence — what you can and can't do with an image you've purchased.",
  robots:      { index: true, follow: true }
};

export default function StoreLicencePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
        Site Interest
      </div>
      <h1 className="text-[28px] font-black text-neutral-900 md:text-[36px]">
        Commercial image licence
      </h1>
      <p className="mt-2 text-[13px] text-neutral-500">
        Version 1.0 · Effective 2026-07-17 · Applies to all image purchases from{" "}
        <Link href="/store" className="underline">Site Interest / Store</Link>.
      </p>

      <div className="mt-8 space-y-8">
        <Section title="Summary in plain English">
          <ul className="ml-4 list-disc space-y-1.5">
            <li>You bought a permanent right to use the image for your own commercial purposes.</li>
            <li>You may put it anywhere your business needs — website, ads, brochures, social, print, van signs, packaging.</li>
            <li>You may NOT sell the image, hand it off to other stock sites, or claim you own it.</li>
            <li>You may NOT use it in ways that are defamatory, misleading, or illegal.</li>
          </ul>
        </Section>

        <Section title="1. What you can do (permitted uses)">
          <ul className="ml-4 list-disc space-y-1.5">
            <li>Use the image in any of YOUR OWN commercial materials — marketing campaigns, printed collateral, digital ads, social media posts, product packaging, website hero images, business cards, van livery, exhibition stands, presentations, e-books, videos, YouTube thumbnails, podcast art, email signatures, blog posts, PDF downloads.</li>
            <li>Modify the image — crop, filter, colour-correct, overlay text, composite with other elements.</li>
            <li>Use the image indefinitely — the licence has no expiry.</li>
            <li>Include the image inside client deliverables you produce as an agency, provided the image is part of a broader design and not the primary sold asset.</li>
          </ul>
        </Section>

        <Section title="2. What you can't do (prohibited uses)">
          <ul className="ml-4 list-disc space-y-1.5">
            <li><span className="font-black">No resale as-is.</span> You may not resell, license, sub-license, distribute, redistribute, or lend the raw image file (or a version that&apos;s functionally the same) to any third party.</li>
            <li><span className="font-black">No stock library upload.</span> You may not upload the image to Shutterstock, Adobe Stock, Getty, iStock, Envato, Etsy, Creative Market, Freepik, Unsplash, Pexels, Pixabay, any AI training dataset, or any similar image marketplace, wallpaper platform, or repository.</li>
            <li><span className="font-black">No sole-image products.</span> You may not sell prints, mugs, posters, T-shirts, phone cases, wallpaper, or any physical or digital product whose primary purpose is the image itself.</li>
            <li><span className="font-black">No claim of ownership.</span> You do not own the underlying image. Thenetworkers Ltd owns the copyright. You bought a licence, not the copyright.</li>
            <li><span className="font-black">No defamatory or unlawful use.</span> No pornographic, hateful, misleading, illegal, or harmful contexts. No use that could reasonably damage the reputation of any person depicted or implied.</li>
            <li><span className="font-black">No AI training.</span> You may not use the image to train, fine-tune, or evaluate any machine-learning model.</li>
          </ul>
        </Section>

        <Section title="3. Ownership">
          Thenetworkers Ltd retains full copyright to every image sold via Site Interest.
          Every image is hand-curated AI imagery, generated and reviewed in-house, and owned outright by Thenetworkers Ltd — no third-party
          model releases, no photographer credit, no royalty chain. You are buying a
          non-exclusive commercial licence, not the underlying intellectual property.
        </Section>

        <Section title="4. Multiple people / teams">
          The licence is granted to the purchasing person or entity. If your business has
          multiple employees, they may use the image for that business&apos;s commercial
          purposes. If you are an agency, you may use the image inside deliverables produced
          for your clients, but each client is not granted a standalone licence — the licence
          is anchored to the purchasing entity.
        </Section>

        <Section title="5. Exclusive licences (upgrade)">
          Standard purchases are non-exclusive — multiple businesses may licence the same
          image. If you need exclusivity so nobody else on the platform can use a specific
          image going forward, contact us for an exclusive licence upgrade. Existing licensees
          before the upgrade retain their licences.
        </Section>

        <Section title="6. Download + delivery">
          Full-resolution files are delivered via a secure download link emailed after
          payment. Download links remain valid for 30 days. Your licence to use the image is
          permanent regardless of when you last downloaded the file. If you lose your file
          later, contact support with your order number for a re-download.
        </Section>

        <Section title="7. Refunds">
          Because digital goods are delivered instantly, refunds are only offered for
          duplicate purchases, technical delivery failures, or if the image was not what was
          shown at time of purchase. Contact support within 14 days.
        </Section>

        <Section title="8. Enforcement">
          Breach of this licence terminates your rights immediately. Thenetworkers Ltd
          reserves the right to require removal of the image from any platform where it has
          been misused, and to seek damages proportionate to the misuse (including the fees
          that would have been payable under a proper redistribution or exclusive licence).
        </Section>

        <Section title="9. Governing law">
          This licence is governed by the laws of England and Wales. Disputes are subject to
          the exclusive jurisdiction of the courts of England and Wales.
        </Section>

        <Section title="Contact">
          Questions about a specific use case, or interested in a volume / redistributor
          licence?{" "}
          <a href="mailto:hello@thenetworkers.app" className="underline">
            hello@thenetworkers.app
          </a>
          .
        </Section>
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-3 text-[11px] text-neutral-500">
        <Link href="/store" className="hover:text-neutral-900">← Back to Site Interest</Link>
        <span>© {new Date().getFullYear()} Thenetworkers Ltd</span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[16px] font-black text-neutral-900 md:text-[18px]">{title}</h2>
      <div className="mt-2 text-[13px] leading-relaxed text-neutral-700">{children}</div>
    </div>
  );
}
