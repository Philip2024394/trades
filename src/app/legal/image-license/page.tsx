// /legal/image-license — Site Interest image use terms.
//
// Targeted by:
//   • JSON-LD ImageObject.license + acquireLicensePage in the
//     /trade-off/search page, so Google Images crawler follows the
//     link to a real page instead of 404.
//   • Bottom-of-page link on Site Interest for humans who want to
//     know what they can/can't do with a shared image.
//
// Kept static and plain-language — no lawyer-speak. Real licensing
// / DMCA takedown flow lives in admin, not here.

import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/seo";

export const metadata: Metadata = {
  title: `Image use — ${BRAND.name}`,
  description:
    "How Site Interest images on Thenetworkers can and can't be used, shared, and licensed.",
  robots: { index: true, follow: true }
};

export default function ImageLicensePage() {
  return (
    <main
      className="mx-auto min-h-screen max-w-3xl px-4 pb-16 pt-10 md:px-6 md:pt-14"
      style={{ backgroundColor: "#FBF6EC", color: "#1B1A17" }}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
        Legal
      </div>
      <h1
        className="mt-1 text-[28px] font-black leading-tight text-neutral-900 md:text-[36px]"
        style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
      >
        Using Site Interest images
      </h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-neutral-700">
        Every photo on Site Interest is either (a) part of a curated visual library commissioned or licensed by {BRAND.name}, or (b) submitted by a trade professional who owns the work depicted. Both categories carry the same rules.
      </p>

      <Section title="What you CAN do">
        <ul className="list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-neutral-800">
          <li><strong>Save for personal reference.</strong> Screenshot, download, or save an image to your own device or personal project board for inspiration on a job you&apos;re planning.</li>
          <li><strong>Share the link.</strong> Send the URL of the search result to a friend, family member, WhatsApp group, or social feed. The image loads from {BRAND.name} in context, with the credited trade attached.</li>
          <li><strong>Discuss it with a trade.</strong> Show the image on your phone to a trade you&apos;re getting a quote from — that&apos;s exactly what it&apos;s here for.</li>
          <li><strong>Include in a personal project brief.</strong> Paste the image into a document you&apos;re preparing for your own home project.</li>
        </ul>
      </Section>

      <Section title="What you CAN'T do">
        <ul className="list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-neutral-800">
          <li><strong>Remove the watermark.</strong> Every image is served with a {BRAND.name} watermark baked into the file. Cropping, editing, or otherwise obscuring it isn&apos;t allowed.</li>
          <li><strong>Republish commercially.</strong> Selling the image, using it in paid ads for a competing platform, or including it in a product / listing you don&apos;t own violates both {BRAND.name}&apos;s terms and (in most cases) the submitting trade&apos;s copyright.</li>
          <li><strong>Claim you did the work.</strong> If the image is credited to another trade, don&apos;t pass it off as your own portfolio. Trades who do this lose their submission privileges immediately.</li>
          <li><strong>Train an AI on it.</strong> Bulk scraping Site Interest images for machine-learning training sets is explicitly prohibited; every image lands with source metadata that we can prove ownership on.</li>
        </ul>
      </Section>

      <Section title="If you're the trade who submitted an image">
        <p className="text-[13px] leading-relaxed text-neutral-800">
          You keep copyright on the work in the photo. Submitting to {BRAND.name} grants us a non-exclusive licence to display the image on Site Interest, on your canteen, and (via approved shares) on external social channels — always with your credit attached. You can request removal at any time from your admin dashboard.
        </p>
      </Section>

      <Section title="If you see an image that shouldn't be here">
        <p className="text-[13px] leading-relaxed text-neutral-800">
          Email <a className="underline decoration-neutral-400 underline-offset-2 hover:decoration-neutral-900" href="mailto:hello@thenetworkers.app">hello@thenetworkers.app</a> with the image URL and a one-line reason. We review takedown requests within 48 hours and don&apos;t require a formal DMCA notice for good-faith reports.
        </p>
      </Section>

      <div className="mt-10 border-t pt-6 text-[11.5px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.20)" }}>
        Last updated 16 July 2026.{" "}
        <Link href="/trade-off/search" className="underline decoration-neutral-400 underline-offset-2 hover:decoration-neutral-900">
          Return to Site Interest
        </Link>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[16px] font-black text-neutral-900 md:text-[18px]">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
