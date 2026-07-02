// Studio dashboard. First screen a merchant sees after signing in.
// Module 0.4 ships a functional landing (recent pages + quick actions);
// richer analytics + AI Co-Pilot arrive in later modules.

import Link from "next/link";
import { loadStudioSession } from "@/lib/studio/session";

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

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
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
