// Public landing page for the Xrated Trades Affiliate Programme.
// Sales pitch + sign-up CTA. Three-feature row beneath the hero.
//
// We deliberately don't push tradesperson-side signup here — affiliates
// are a separate audience (publishers, content creators, anyone with
// an audience that includes self-employed tradies).
import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { listActiveCampaigns } from "@/lib/affiliateCampaigns";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Affiliate Programme | Thenetworkers",
  description:
    "Earn £10 for every tradesperson who joins Thenetworkers via your link. Free to join, paid monthly.",
  robots: { index: true, follow: true }
};

export default async function AffiliatesLandingPage() {
  const campaigns = await listActiveCampaigns();
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-12">
        {/* Hero placeholder — yellow eyebrow, big headline, CTA */}
        <p className="text-[13px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
          Affiliate Programme
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-5xl">
          Earn £10 for every tradesperson who joins via your link.
        </h1>
        <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-brand-muted sm:text-base">
          Free to join. Paid monthly once you reach £50. British plumbers,
          electricians, joiners and decorators sign up to thenetworkers.app
          every day. If you have an audience that overlaps with the trades,
          we&apos;ll pay you to point them at us.
        </p>
        {campaigns.length > 0 && (
          <div className="mt-6 rounded-xl border border-brand-accent bg-brand-accent/10 p-4 text-[13px] leading-snug text-brand-text">
            <p className="font-extrabold uppercase tracking-[0.18em] text-brand-accent">
              Current promotions
            </p>
            <ul className="mt-2 space-y-1">
              {campaigns.map((c) => (
                <li key={c.id}>
                  <strong>{c.title}</strong>
                  {c.description ? <> — {c.description}</> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/affiliates/signup"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-brand-accent px-6 text-[13px] font-bold text-black transition hover:opacity-90"
          >
            Join the programme — free
          </Link>
          <Link
            href="/affiliates/login"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-brand-line px-6 text-[13px] font-bold text-brand-text transition hover:bg-brand-surface"
          >
            Already in? Log in
          </Link>
        </div>

        {/* Three feature columns */}
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FeatureCard
            title="Permanent link"
            body="Your link thenetworkers.app/?ref=N never expires. 30-day cookie window from the first click."
          />
          <FeatureCard
            title="£10 per upgrade"
            body="When a referred tradesperson upgrades to a paid plan, you earn £10 — pending → approved after 14 days."
          />
          <FeatureCard
            title="Monthly payouts"
            body="Bank transfer, PayPal or Wise. £50 minimum payout. Standard banking fees apply."
          />
        </div>

        {/* Compliance note — set expectations honestly */}
        <div className="mt-12 rounded-xl border border-brand-line bg-brand-surface p-4 text-[13px] leading-relaxed text-brand-muted">
          <p className="font-bold text-brand-text">Before you join</p>
          <p className="mt-2">
            You are not employed by thenetworkers.app — you operate as an
            independent affiliate. Posting your links on platforms or in
            content involving children, minors, or sexual material is
            strictly prohibited and results in immediate ban with frozen
            funds. Standard banking fees are deducted from payouts.
          </p>
        </div>
      </section>
      <XratedFooter />
    </main>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-brand-line bg-brand-surface p-5">
      <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-brand-accent">
        {title}
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed text-brand-text">{body}</p>
    </div>
  );
}
