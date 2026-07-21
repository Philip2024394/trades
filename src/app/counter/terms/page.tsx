// /counter/terms — Terms of Posting for The Counter.
// Referenced from the composer modal + the ban notification.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "The Counter · Rules of Posting | The Network"
};

export default function CounterTermsPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
        <Link href="/counter" className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
          <ArrowLeft size={12}/> Back to The Counter
        </Link>
        <h1 className="mt-4 text-[28px] font-black leading-tight text-neutral-900">
          Rules of posting to The Counter
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
          The Counter is the live cross-canteen marketplace stream. Every listing reaches every canteen's Counter strip and this page. To keep it useful for trades + suppliers, four rules are enforced automatically.
        </p>

        <ol className="mt-8 space-y-6">
          <Rule
            n={1}
            title="No other canteens named in title or body"
            body="Post the listing on its own merit. Referencing another canteen ('Get it cheaper at Emma's Plastering') is treated as spam / poaching and flagged automatically."
          />
          <Rule
            n={2}
            title="Construction + trade products or services only"
            body="Tools, materials, plant, hire, jobs, availability — yes. Off-topic (essays, dating, crypto, non-construction retail, loans, escorts) — no. Auto-flagged by body scanner."
          />
          <Rule
            n={3}
            title="No non-construction images"
            body="Every image must show a construction / trade product, tool, material, worksite, or finished job. Selfies, memes, screenshots, or off-topic photos are rejected at upload (Phase 2 image classifier live)."
          />
          <Rule
            n={4}
            title="No canteen banners reposted as listings"
            body="You cannot repost another canteen's hero image as your own listing photo. Auto-detected by image hash (Phase 2)."
          />
        </ol>

        <section className="mt-10 rounded-2xl border-2 bg-white p-5" style={{ borderColor: "rgba(255,179,0,0.55)" }}>
          <h2 className="text-[15px] font-black text-neutral-900">If you break a rule</h2>
          <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-neutral-700">
            <li>· First offence — <strong>72-hour posting ban</strong> from The Counter</li>
            <li>· Second offence in 30 days — <strong>168-hour (7-day) ban</strong></li>
            <li>· Third offence — <strong>30-day ban</strong> pending admin review</li>
          </ul>
          <p className="mt-3 text-[11px] text-neutral-500">
            Your canteen page is not affected by Counter bans — you can still post inside your own canteen. The ban only prevents cross-canteen distribution via The Counter.
          </p>
        </section>

        <p className="mt-8 text-[11px] text-neutral-400">
          Enforcement is automatic. Admin review of flagged posts runs from{" "}
          <Link href="/admin/moderation" className="underline hover:text-neutral-700">/admin/moderation</Link>.
        </p>
      </div>
    </main>
  );
}

function Rule({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex items-start gap-4">
      <span
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-black text-neutral-900"
        style={{ backgroundColor: "#FFB300" }}
      >
        {n}
      </span>
      <div className="min-w-0">
        <h3 className="text-[14px] font-black text-neutral-900">{title}</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-600">{body}</p>
      </div>
    </li>
  );
}
