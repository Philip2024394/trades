// Live Edit demo — a fake merchant page with 3 sections wrapped in
// LiveEditShell. Merchant persona picker at top. Tap "Edit" in the
// sticky footer to reveal outlines + edit buttons. Tap "Publish" to
// simulate a persist.

"use client";

import { useState } from "react";
import { HeroSwapSlot } from "@/apps/hero-swap";
import {
  EditableSection,
  EditableTextSection,
  LiveEditShell
} from "@/apps/live-edit";

const PERSONAS = [
  {
    id: "loft-ladder",
    label: "Loft Ladder Installer",
    keywords: [
      "loft ladders",
      "loft ladder installation",
      "loft ladder installer",
      "loft ladders showroom",
      "loft ladder company"
    ],
    headline: "Fitted in an afternoon. Guaranteed for 10 years.",
    subhead: "UK-wide loft ladder supply + installation, from £249.",
    ctaLabel: "Book a survey"
  },
  {
    id: "site-carpenter",
    label: "Site Carpenter",
    keywords: [
      "site carpenter",
      "first-fix carpenter",
      "carpenter formwork",
      "roofing carpenter",
      "carpenter roofing"
    ],
    headline: "First-fix carpentry. On site, on time.",
    subhead: "Frames, roofs, formwork. 15 years across new-build + refurb.",
    ctaLabel: "Get a quote"
  }
];

export default function LiveEditDemoPage() {
  const [personaId, setPersonaId] = useState(PERSONAS[0].id);
  const persona = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0];

  return (
    <LiveEditShell
      merchantId="demo-merchant"
      pageSlug="landing"
      onPublish={async () => {
        // Real production: POST to /api/merchant-page/publish which
        // would write the draft state to a merchant_pages table.
        await new Promise((r) => setTimeout(r, 500));
      }}
    >
      <main className="min-h-screen bg-neutral-50 pb-32">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
              Live Edit · Merchant demo
            </div>
            <h1 className="mt-2 text-2xl font-bold text-neutral-900 md:text-3xl">
              This is what a merchant sees on their live site
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] text-neutral-700">
              Tap <strong>Edit</strong> in the sticky footer → every editable
              section reveals an outline + edit button. Change anything, then
              tap <strong>Publish live</strong> to save.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PERSONAS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersonaId(p.id)}
                  className={`rounded-full border-2 px-3 py-1.5 text-[12px] font-medium transition ${
                    personaId === p.id
                      ? "border-amber-400 bg-amber-50 text-neutral-900"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-4 py-8">
          <EditableSection
            id="landing-hero"
            type="hero"
            label="Hero"
            hasInlineEditor
          >
            <div className="rounded-3xl border border-neutral-200 bg-white p-3 shadow-sm">
              <HeroSwapSlot
                key={personaId}
                merchantTradeKeywords={persona.keywords}
                headline={persona.headline}
                subhead={persona.subhead}
                ctaLabel={persona.ctaLabel}
                slotKey="landing_hero"
                siteSlotKeys={[
                  "landing_hero",
                  "about_hero",
                  "services_hero",
                  "contact_hero"
                ]}
              />
            </div>
          </EditableSection>

          <div className="mt-6 rounded-3xl border border-neutral-200 bg-white">
            <EditableTextSection
              id="about-block"
              initial={{
                eyebrow: "Why us",
                headline: `${persona.label}s that show up when they say they will.`,
                subhead:
                  "Real reviews. Fixed prices. A tradesperson who returns your call.",
                ctaLabel: "See recent work"
              }}
            />
          </div>

          <div className="mt-6 rounded-3xl border border-neutral-200 bg-white">
            <EditableTextSection
              id="cta-block"
              initial={{
                eyebrow: "Ready when you are",
                headline: "Get a quote in under 24 hours.",
                subhead:
                  "Message us with what you need and a photo. We reply the same day, weekdays 8–6.",
                ctaLabel: "Message us"
              }}
            />
          </div>
        </div>
      </main>
    </LiveEditShell>
  );
}
