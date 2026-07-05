// Business Modules grid — honest inventory surface.
//
// Groups modules by state (shipped / available-addon / partner /
// coming-soon) so the merchant can see at a glance what's real today.
// Trade-relevant modules float to the top of their group.

import Link from "next/link";
import { BUSINESS_MODULES } from "@/lib/studio/modules";
import type { BusinessModule, ModuleState } from "@/lib/studio/modules";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const BLUE = "#2563EB";
const AMBER = "#F59E0B";
const NEUTRAL = "#525252";

const STATE_META: Record<
  ModuleState,
  { label: string; color: string; note: string }
> = {
  shipped: {
    label: "Live now",
    color: GREEN,
    note: "Working today. Tap to open."
  },
  "available-addon": {
    label: "Enable in add-ons",
    color: BLUE,
    note: "Real, but requires enabling — free or £-priced add-on."
  },
  partner: {
    label: "Recommended partner",
    color: AMBER,
    note: "We don't build these ourselves yet. We recommend a real one."
  },
  "coming-soon": {
    label: "Waitlist",
    color: NEUTRAL,
    note: "On the roadmap. Join waitlist to hear first."
  }
};

const STATE_ORDER: ModuleState[] = [
  "shipped",
  "available-addon",
  "partner",
  "coming-soon"
];

export function BusinessModulesGrid({
  primaryTrade
}: {
  primaryTrade: string;
}) {
  // Order modules within each group: trade-relevant first, then alpha.
  function orderForTrade(mods: BusinessModule[]): BusinessModule[] {
    return [...mods].sort((a, b) => {
      const aRelevant =
        a.expectedByTrades.length === 0 ||
        a.expectedByTrades.includes(primaryTrade);
      const bRelevant =
        b.expectedByTrades.length === 0 ||
        b.expectedByTrades.includes(primaryTrade);
      if (aRelevant && !bRelevant) return -1;
      if (!aRelevant && bRelevant) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Business modules
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        What's shipped. What's coming.
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        Honest inventory. Every module is labelled by what it really is
        today — live, enabled via add-on, recommended partner, or on the
        roadmap. No fake modules.
      </p>

      {STATE_ORDER.map((state) => {
        const mods = orderForTrade(
          BUSINESS_MODULES.filter((m) => m.state === state)
        );
        if (mods.length === 0) return null;
        const meta = STATE_META[state];
        return (
          <section key={state} className="mt-10">
            <div className="flex items-baseline gap-3">
              <span
                className="rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white"
                style={{ background: meta.color }}
              >
                {meta.label}
              </span>
              <p className="text-[11px] text-neutral-600">{meta.note}</p>
            </div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mods.map((m) => (
                <li key={m.id}>
                  <ModuleCard module={m} primaryTrade={primaryTrade} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ModuleCard({
  module,
  primaryTrade
}: {
  module: BusinessModule;
  primaryTrade: string;
}) {
  const meta = STATE_META[module.state];
  const tradeRelevant =
    module.expectedByTrades.length > 0 &&
    module.expectedByTrades.includes(primaryTrade);

  const bodyClass =
    "flex h-full flex-col justify-between gap-3 rounded-2xl border p-4 shadow-sm transition";

  const content = (
    <>
      <div>
        <div className="flex items-start justify-between gap-2">
          <span
            className="text-[26px]"
            role="img"
            aria-hidden="true"
          >
            {module.glyph}
          </span>
          <div className="flex flex-col items-end gap-1">
            {tradeRelevant && (
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
                style={{ background: YELLOW, color: "#0A0A0A" }}
              >
                For your trade
              </span>
            )}
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
              style={{ background: meta.color }}
            >
              {meta.label}
            </span>
          </div>
        </div>
        <p className="mt-2 text-[15px] font-extrabold leading-tight text-neutral-900">
          {module.name}
        </p>
        <p className="mt-0.5 text-[11px] font-bold text-neutral-500">
          {module.tagline}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-neutral-600">
          {module.description}
        </p>
        {module.partner && (
          <p className="mt-2 text-[10px] font-bold text-amber-800">
            → {module.partner.name} · {module.partner.note}
          </p>
        )}
      </div>
      <div>
        {module.state === "shipped" && module.route && (
          <span
            className="inline-flex w-fit items-center rounded-lg px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-neutral-900"
            style={{ background: YELLOW }}
          >
            Open →
          </span>
        )}
        {module.state === "available-addon" && (
          <span
            className="inline-flex w-fit items-center rounded-lg border border-neutral-400 bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-neutral-800"
          >
            Enable →
          </span>
        )}
        {module.state === "partner" && module.partner && (
          <span
            className="inline-flex w-fit items-center rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-amber-900"
          >
            Visit {module.partner.name} ↗
          </span>
        )}
        {module.state === "coming-soon" && (
          <span
            className="inline-flex w-fit items-center rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-neutral-700"
          >
            On the roadmap
          </span>
        )}
      </div>
    </>
  );

  const shellStyle = {
    borderColor: tradeRelevant ? YELLOW : "#E5E5E5",
    background: "#FFFFFF"
  } as const;

  if (module.state === "shipped" && module.route) {
    return (
      <Link
        href={module.route}
        className={`${bodyClass} hover:-translate-y-0.5 hover:border-neutral-900 hover:shadow-md`}
        style={shellStyle}
      >
        {content}
      </Link>
    );
  }
  if (module.state === "available-addon" && module.route) {
    return (
      <Link
        href={module.route}
        className={`${bodyClass} hover:-translate-y-0.5 hover:border-neutral-900 hover:shadow-md`}
        style={shellStyle}
      >
        {content}
      </Link>
    );
  }
  if (module.state === "partner" && module.partner) {
    return (
      <a
        href={module.partner.url}
        target="_blank"
        rel="noreferrer noopener"
        className={`${bodyClass} no-underline hover:-translate-y-0.5 hover:shadow-md`}
        style={shellStyle}
      >
        {content}
      </a>
    );
  }
  return (
    <div className={bodyClass} style={shellStyle}>
      {content}
    </div>
  );
}
