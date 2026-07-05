"use client";

// StudioHomeHero — Business Builder positioning.
//
// PRD "Business Discovery" step 1: big trade cards. When merchant taps
// one we deep-link into the wizard pre-seeded with that trade so they
// skip step 1.
//
// Emoji glyphs today, real hero art later (per user's plan to supply
// images). The current single mock image lives at
// /public/blueprint-preview-mock.svg and can be re-used per card if
// desired.

import Link from "next/link";

const YELLOW = "#FFB300";

type TradeCard = {
  slug: string;
  label: string;
  glyph: string;
  hint: string;
};

const HERO_TRADES: TradeCard[] = [
  { slug: "builder", label: "Builder", glyph: "🏗", hint: "Extensions, loft, refurb" },
  { slug: "plant-hire", label: "Plant Hire", glyph: "🚜", hint: "Diggers, dumpers, telehandlers" },
  { slug: "building-merchant", label: "Merchant", glyph: "🧱", hint: "Trade + retail, credit accounts" },
  { slug: "electrician", label: "Electrician", glyph: "⚡", hint: "NICEIC / NAPIT, EICR, EV" },
  { slug: "plumber", label: "Plumber", glyph: "🚿", hint: "Bathrooms, emergency, boilers" },
  { slug: "roofer", label: "Roofing", glyph: "🏠", hint: "Repair, re-roof, storm response" },
  { slug: "landscaper", label: "Landscaping", glyph: "🌳", hint: "Design + build + maintenance" },
  { slug: "groundworker", label: "Groundworks", glyph: "👷", hint: "Foundations, drainage, driveways" },
  { slug: "carpenter", label: "Carpenter", glyph: "🔨", hint: "Doors, kitchens, staircases" },
  { slug: "kitchen-fitter", label: "Kitchen Fitter", glyph: "🍳", hint: "Fit + supply, showroom" },
  { slug: "handyman", label: "Handyman", glyph: "🛠", hint: "Small jobs, half-day rates" },
  { slug: "gas-engineer", label: "Gas Engineer", glyph: "🔥", hint: "Boilers, CP12s, breakdowns" }
];

export function StudioHomeHero({
  merchantName
}: {
  merchantName: string;
}) {
  return (
    <div>
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Business Builder · Welcome back
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        {merchantName}
      </h1>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        Not a website builder — a business builder. Pick a trade and we
        assemble everything your business needs: site, pages, trust
        badges, coverage, growth coach, verified compliance. Publish
        live in 60 seconds.
      </p>

      <div className="mt-8">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Start a fresh build
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {HERO_TRADES.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/studio/blueprints/wizard?trade=${encodeURIComponent(t.slug)}`}
                className="group flex h-full flex-col justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-900 hover:shadow-lg"
              >
                <div>
                  <span
                    className="text-[26px]"
                    role="img"
                    aria-hidden="true"
                  >
                    {t.glyph}
                  </span>
                  <p className="mt-2 text-[14px] font-extrabold text-neutral-900">
                    {t.label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-neutral-500">
                    {t.hint}
                  </p>
                </div>
                <span
                  className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-neutral-900 transition group-hover:brightness-95"
                  style={{ background: YELLOW }}
                >
                  Build →
                </span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/studio/blueprints"
              className="group flex h-full flex-col justify-between gap-3 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-4 transition hover:-translate-y-0.5 hover:border-neutral-900 hover:bg-white"
            >
              <div>
                <span
                  className="text-[26px]"
                  role="img"
                  aria-hidden="true"
                >
                  ➕
                </span>
                <p className="mt-2 text-[14px] font-extrabold text-neutral-900">
                  Browse 45+ blueprints
                </p>
                <p className="mt-0.5 text-[10px] text-neutral-500">
                  Every construction trade + specialist
                </p>
              </div>
              <span className="inline-flex w-fit items-center rounded-full border border-neutral-400 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-neutral-700">
                Browse all →
              </span>
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
