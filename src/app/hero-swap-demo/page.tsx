// Hero Swap demo page.
//
// Shows the live "change image" flow working end-to-end with 3 real
// merchant personas. Pick a persona → their hero shows an image
// matched to their trade keywords → tap "Change image" → swap in one
// tap → try edits and watch the advisory suggestion chip appear.

"use client";

import { useState } from "react";
import { HeroSwapSlot } from "@/apps/hero-swap";

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
    id: "wood-turner",
    label: "Wood Turner",
    keywords: [
      "wood turning",
      "staircase balusters",
      "staircase spindles",
      "turned wooden staircase parts",
      "turning wood"
    ],
    headline: "Hand-turned balusters, spindles + newel posts.",
    subhead: "Every profile, every timber. Traditional workshop, made to order.",
    ctaLabel: "Request a sample"
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

export default function HeroSwapDemoPage() {
  const [personaId, setPersonaId] = useState(PERSONAS[0].id);
  const persona = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0];

  return (
    <main className="min-h-screen bg-neutral-50 pb-16">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            Hero Swap · Live demo
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900 md:text-3xl">
            Live &quot;change image&quot; flow
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-neutral-700 md:text-[14px]">
            Pick a trade persona below → their hero shows only images
            matched to their trade keywords (strict). Tap{" "}
            <strong>Change image</strong> on the hero to swap. Try edits
            and watch the advisory chip suggest a better layout.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
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
        <div className="rounded-3xl border border-neutral-200 bg-white p-3 shadow-sm">
          <HeroSwapSlot
            key={personaId}
            merchantTradeKeywords={persona.keywords}
            headline={persona.headline}
            subhead={persona.subhead}
            ctaLabel={persona.ctaLabel}
          />
        </div>

        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">
            What to try
          </div>
          <ul className="mt-2 space-y-2 text-[13px] text-neutral-800">
            <li>
              <strong>Swap the hero:</strong> tap the{" "}
              <em>Change image</em> chip on the bottom-right of the hero
              → pick any thumbnail → hero updates instantly. Only images
              legal for the current trade appear.
            </li>
            <li>
              <strong>Try a layout preset:</strong> the picker shows the
              3 layouts. Card layout renders text on a solid card beside
              the image.
            </li>
            <li>
              <strong>Trigger a suggestion:</strong> in the sheet,
              crank <em>Vignette</em> above 30. A blue advisor chip will
              appear suggesting the Card preset. Tap <em>Try it</em>.
            </li>
            <li>
              <strong>Persona switch:</strong> use the persona buttons
              above the hero to see the carousel change — a wood turner
              never sees loft ladder images and vice versa.
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
