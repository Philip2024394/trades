// Studio home — Business Builder positioning.
//
// Three stacked surfaces in priority order:
//   1. Trade-card hero — "start a fresh build" trade grid
//   2. Growth Coach — top 3 next wins on live merchant state
//   3. Business Modules teaser — see the honest module inventory
//   4. Legacy quick actions — keep for merchants used to them

import Link from "next/link";
import { loadStudioSession } from "@/lib/studio/session";
import { StudioHomeHero } from "@/components/studio/StudioHomeHero";
import { GrowthCoachCard } from "@/components/studio/GrowthCoachCard";
import { BusinessDiscoveryInput } from "@/components/studio/BusinessDiscoveryInput";
import { IndustryBrainCard } from "@/components/studio/IndustryBrainCard";

const YELLOW = "#FFB300";

export const dynamic = "force-dynamic";

export default async function StudioHomePage() {
  const session = await loadStudioSession();
  if (!session) return null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <StudioHomeHero merchantName={session.merchant.display_name} />

      {/* Business Discovery — the LLM path alternative to picking a
          trade card. Retrieval-constrained: extracted trade, outcomes,
          coverage, modules must all exist in real registries. */}
      <div className="mt-8">
        <BusinessDiscoveryInput />
      </div>

      {/* Growth Coach — always the retention hook */}
      <div className="mt-6">
        <GrowthCoachCard />
      </div>

      {/* Industry Brain — first live consumer of the Knowledge Graph.
          Retrieval-constrained Q&A over Domains + Package + Merchant
          data; hallucinations dropped server-side. */}
      <div className="mt-6">
        <IndustryBrainCard />
      </div>

      {/* Business Modules teaser */}
      <div className="mt-6">
        <Link
          href="/studio/modules"
          className="group flex flex-col justify-between gap-4 overflow-hidden rounded-2xl border-2 border-neutral-900 bg-neutral-900 p-6 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-2xl sm:flex-row sm:items-center"
        >
          <div className="min-w-0">
            <p
              className="text-[10px] font-extrabold uppercase tracking-widest"
              style={{ color: YELLOW }}
            >
              Your business modules
            </p>
            <h2 className="mt-1 text-[22px] font-extrabold leading-tight">
              See what's shipped, what's coming
            </h2>
            <p className="mt-1 max-w-md text-[12px] text-white/70">
              Website, Verified Badges, Coverage Radius, Local SEO,
              Growth Coach, Storm Mode, Payments — all live. Stock,
              CRM, Analytics — honest waitlist. No fake modules.
            </p>
          </div>
          <span
            className="inline-flex h-12 shrink-0 items-center rounded-xl px-5 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition group-hover:brightness-95"
            style={{ background: YELLOW }}
          >
            Open modules →
          </span>
        </Link>
      </div>

      {/* Legacy quick actions — kept for muscle-memory */}
      <p
        className="mt-10 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500"
      >
        Jump into an area
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction
          href="/studio/pages"
          title="Edit pages"
          body="Move sections, replace layouts, edit copy on the real page."
          cta="Open →"
        />
        <QuickAction
          href="/studio/blueprints"
          title="Blueprints"
          body="45+ full business blueprints — pick one, publish live."
          cta="Browse →"
        />
        <QuickAction
          href="/studio/brands"
          title="Brand"
          body="Colours, fonts, buttons, spacing — one place, everywhere updates."
          cta="Tune →"
        />
        <QuickAction
          href="/studio/media"
          title="Media"
          body="Upload, replace, and optimise every image in one library."
          cta="Open →"
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
      className="group flex flex-col justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-md"
    >
      <div>
        <p className="text-[14px] font-extrabold leading-tight text-neutral-900">
          {title}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">
          {body}
        </p>
      </div>
      <span
        className="inline-flex w-fit items-center rounded-lg px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-neutral-900 transition group-hover:brightness-95"
        style={{ background: YELLOW }}
      >
        {cta}
      </span>
    </Link>
  );
}
