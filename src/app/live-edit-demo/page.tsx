// Live Edit demo — a fake merchant page with 3 sections wrapped in
// LiveEditShell. Merchant persona picker at top. Tap "Edit" in the
// sticky footer to reveal outlines + edit buttons. Tap "Publish" to
// simulate a persist.

"use client";

import { useState } from "react";
import { HeroSwapSlot } from "@/apps/hero-swap";
import {
  EditableBeforeAfterSection,
  EditableSection,
  EditableTextSection,
  LiveEditShell
} from "@/apps/live-edit";
import { matchBeforeAfterForMerchant } from "@/apps/before-after";
import type { BeforeAfterPair } from "@/apps/before-after";

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
    ba_keywords: ["internal door replacement", "door replacement"],
    headline: "Fitted in an afternoon. Guaranteed for 10 years.",
    subhead: "UK-wide loft ladder supply + installation, from £249.",
    ctaLabel: "Book a survey"
  },
  {
    id: "roofer",
    label: "Roofer",
    keywords: [
      "roof tiling",
      "slate roof repair",
      "roof slate renovation",
      "roofer"
    ],
    ba_keywords: [
      "roof tiling",
      "roof slate renovation",
      "slate roof repair"
    ],
    headline: "Slate roofs re-done properly. First time.",
    subhead: "20 years on UK roofs. Fully insured. Free callout.",
    ctaLabel: "Get a callout"
  },
  {
    id: "extension-builder",
    label: "Extension Builder",
    keywords: [
      "house extension",
      "single storey extension",
      "extension builder",
      "house renovation"
    ],
    ba_keywords: [
      "house extension",
      "house renovation",
      "house building"
    ],
    headline: "Your extension, delivered. On time. On budget.",
    subhead: "Full design + build. 30+ projects across Yorkshire.",
    ctaLabel: "Book a survey"
  }
];

/** Pre-populate the section with up to 3 pairs matching the merchant's
 *  trade so the demo shows a full 1-main + 2-thumbnail viewer right
 *  away. In production the merchant starts empty and adds their own. */
function initialBeforeAfterPairs(keywords: string[]): BeforeAfterPair[] {
  const matches = matchBeforeAfterForMerchant(keywords).slice(0, 3);
  return matches.map((entry) => ({
    id: entry.id,
    mode: entry.mode,
    before_url: entry.image_url,
    orientation: entry.orientation,
    composite_split: entry.composite_split,
    before_label: entry.before_label,
    after_label: entry.after_label,
    caption: entry.subject
  }));
}

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
            <EditableBeforeAfterSection
              key={`ba-${personaId}`}
              id="before-after-block"
              merchantTradeKeywords={persona.ba_keywords}
              heading="Before / After"
              subhead={`Real ${persona.label.toLowerCase()} jobs. Drag the slider to compare.`}
              initialPairs={initialBeforeAfterPairs(persona.ba_keywords)}
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
