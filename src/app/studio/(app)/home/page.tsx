// Studio dashboard. First screen a merchant sees after signing in.
// Module 0.4 ships a functional landing (recent pages + quick actions);
// richer analytics + AI Co-Pilot arrive in later modules.

import Link from "next/link";
import { loadStudioSession } from "@/lib/studio/session";
import { StudioHomeAiEntry } from "@/components/studio/StudioHomeAiEntry";

const YELLOW = "#FFB300";

export const dynamic = "force-dynamic";

export default async function StudioHomePage() {
  const session = await loadStudioSession();
  // Layout gate already redirected if session was null, but re-checking
  // keeps this component pure for testing.
  if (!session) return null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Welcome back
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        {session.merchant.display_name}
      </h1>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        Your workspace for building and running the {session.brand.name} site.
        Edit pages, manage media, tune your brand, and publish — all in one
        place.
      </p>

      {/* Hero action — installing an App is the "start here" moment
          for any new brand, so it deserves its own row above the
          maintenance-oriented quick actions. */}
      <div className="mt-8">
        <AddAppCard />
      </div>

      {/* AI recommender — for merchants who know what they want but
          don't know which App matches. Retrieval-first: matches only
          come from the live App Registry. */}
      <div className="mt-4">
        <StudioHomeAiEntry />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <QuickAction
          href="/studio/pages"
          title="Edit your website"
          body="Move sections, replace layouts, edit copy — all on the real page."
          cta="Open pages →"
        />
        <QuickAction
          href="/studio/templates"
          title="Browse templates"
          body="10 professionally designed layouts per section. Pick and go."
          cta="Open library →"
        />
        <QuickAction
          href="/studio/brands"
          title="Tune your brand"
          body="Colours, fonts, buttons, spacing. Change once — everywhere updates."
          cta="Open brand →"
        />
        <QuickAction
          href="/studio/media"
          title="Manage media"
          body="Upload, replace, and optimise every image in one library."
          cta="Open media →"
        />
      </div>
    </div>
  );
}

function AddAppCard() {
  return (
    <Link
      href="/studio/apps"
      className="group relative flex overflow-hidden rounded-2xl border-2 border-neutral-900 bg-neutral-900 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-2xl"
    >
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-2/3 opacity-30 transition group-hover:opacity-50"
        style={{
          background:
            "radial-gradient(circle at 80% 40%, #FFB300 0%, transparent 60%)"
        }}
      />
      <div className="relative flex w-full flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="min-w-0">
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            Add an App
          </p>
          <h2 className="mt-1 text-[22px] font-extrabold leading-tight sm:text-[26px]">
            Start with a new App
          </h2>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-white/70">
            Meet the Team, Newsletter, Delivery Zones — install any App and
            we&rsquo;ll create its pages. Pick a hero on the new page and
            you&rsquo;re live.
          </p>
        </div>
        <span
          className="inline-flex h-12 shrink-0 items-center rounded-xl px-5 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition group-hover:brightness-95"
          style={{ background: YELLOW }}
        >
          Browse App Store →
        </span>
      </div>
    </Link>
  );
}

function QuickAction({
  href,
  title,
  body,
  cta
}: {
  href: string;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-md"
    >
      <div>
        <p className="text-[16px] font-extrabold leading-tight text-neutral-900">
          {title}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-neutral-600">
          {body}
        </p>
      </div>
      <span
        className="inline-flex h-10 items-center rounded-xl px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition group-hover:brightness-95"
        style={{ background: YELLOW }}
      >
        {cta}
      </span>
    </Link>
  );
}
