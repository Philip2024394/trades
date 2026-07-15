// /legal/takedown — Formal DMCA / UK IP takedown notice form.
//
// Every field required by (a) the US DMCA safe-harbour statute (17
// USC 512(c)(3)) and (b) UK Copyright, Designs and Patents Act
// 1988 s.97A takedown process. Pre-fills kind=dmca_takedown and
// includes the sworn-under-penalty-of-perjury tick without which
// the ticket won't submit.
//
// Response SLA: 24 hours (severity='high').

import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/seo";
import { TakedownForm } from "./TakedownForm";

export const metadata: Metadata = {
  title: `Copyright takedown — ${BRAND.name}`,
  description:
    "Submit a formal DMCA / UK copyright takedown notice. We review every notice within 24 hours.",
  robots: { index: true, follow: true }
};

export default function TakedownPage() {
  return (
    <main
      className="mx-auto min-h-screen max-w-3xl px-4 pb-16 pt-10 md:px-6 md:pt-14"
      style={{ backgroundColor: "#FBF6EC", color: "#1B1A17" }}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
        Legal · IP takedown
      </div>
      <h1
        className="mt-1 text-[28px] font-black leading-tight text-neutral-900 md:text-[36px]"
        style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
      >
        Copyright takedown notice
      </h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-neutral-700">
        If content on {BRAND.name} infringes a copyright or trademark you own (or are authorised to enforce), this is the fastest path to removal. Every notice is reviewed within <strong>24 hours</strong>. Bad-faith notices are logged and may result in liability under UK CDPA 1988 or US DMCA 17 USC 512(f).
      </p>

      <div
        className="mt-4 rounded-xl border p-4"
        style={{ borderColor: "rgba(184,134,11,0.35)", backgroundColor: "rgba(255,179,0,0.08)" }}
      >
        <p className="text-[12px] leading-relaxed text-neutral-800">
          <strong>Before you submit:</strong> If you don&apos;t own the copyright yourself but represent someone who does, state that in the &ldquo;Ownership claim&rdquo; field. Attach proof of ownership or authority (registration certificate, licence agreement, agency contract) if you can — it speeds review.
        </p>
      </div>

      <TakedownForm/>

      <div className="mt-8 border-t pt-6 text-[11.5px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.20)" }}>
        Prefer email? Send the same information to{" "}
        <a className="underline" href="mailto:takedown@thenetworkers.app">takedown@thenetworkers.app</a>
        {" "}— we treat email submissions identically. For general support (not copyright), use{" "}
        <Link href="/support/ticket" className="underline">/support/ticket</Link>.
      </div>
    </main>
  );
}
