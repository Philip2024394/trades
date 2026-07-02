"use client";

// Machine Finder — rule-based decision-tree "AI". Merchant defines
// questions, each answer maps to recommended machine slugs. Result page
// ranks machines by how many answers matched, then deep-links to each.

import Link from "next/link";
import { useState } from "react";
import {
  PLANT_CATEGORIES,
  type PlantCategoryConfig,
  type PlantCategorySlug,
  type PlantMachineFinder
} from "@/lib/plantHire";

export function PlantMachineFinderWizard({
  cfg,
  fleet,
  merchantSlug
}: {
  cfg: PlantMachineFinder;
  fleet: { slug: PlantCategorySlug; cfg: PlantCategoryConfig; label: string }[];
  merchantSlug: string;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  if (cfg.questions.length === 0) return null;
  const total = cfg.questions.length;
  const done = step >= total;

  const pick = (key: string, recommends: string[]) => {
    setAnswers((prev) => ({ ...prev, [key]: recommends }));
    setStep((s) => s + 1);
  };
  const back = () => setStep((s) => Math.max(0, s - 1));
  const restart = () => {
    setStep(0);
    setAnswers({});
  };

  // Scoring — machines get 1 point per matched answer.
  const scores: Record<string, number> = {};
  for (const slugs of Object.values(answers)) {
    for (const s of slugs) scores[s] = (scores[s] ?? 0) + 1;
  }
  const results = fleet
    .map((f) => ({ ...f, score: scores[f.slug] ?? 0 }))
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const fallback = fleet.slice(0, 6).map((f) => ({ ...f, score: 0 }));
  const finalList: (typeof fleet[number] & { score: number })[] =
    results.length > 0 ? results : fallback;

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        {!done ? (
          <button
            type="button"
            onClick={back}
            disabled={step === 0}
            className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-widest text-neutral-500 transition hover:text-neutral-900 disabled:opacity-40"
          >
            ← Back
          </button>
        ) : (
          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-widest text-neutral-500 transition hover:text-neutral-900"
          >
            ↺ Start again
          </button>
        )}
        <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${total}`}>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i < step ? "w-6 bg-[#FFB300]" : "w-3 bg-neutral-200"
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
          {done ? "Done" : `${step + 1} / ${total}`}
        </span>
      </div>

      {!done && (
        <div>
          <h2 className="text-[18px] font-extrabold leading-tight text-neutral-900 sm:text-[22px]">
            {cfg.questions[step].question}
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {cfg.questions[step].options.map((opt) => (
              <li key={opt.label}>
                <button
                  type="button"
                  onClick={() => pick(cfg.questions[step].key, opt.recommends)}
                  className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left text-[13px] font-bold text-neutral-800 transition hover:-translate-y-0.5 hover:border-[#FFB300] hover:shadow-md"
                >
                  {opt.label}
                  <span aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {done && (
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            Your shortlist
          </p>
          <h2 className="mt-1 text-[22px] font-extrabold leading-tight text-neutral-900">
            {finalList.length} matches — best fit first.
          </h2>
          <p className="mt-1 text-[12px] text-neutral-500">
            Ranked by how many of your answers matched each machine&rsquo;s typical use.
          </p>
          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {finalList.map((f) => {
              const meta = PLANT_CATEGORIES.find((m) => m.slug === f.slug);
              return (
                <li key={f.slug}>
                  <Link
                    href={`/${merchantSlug}/plant-hire/machines/${f.slug}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:-translate-y-0.5 hover:border-[#FFB300] hover:shadow-lg"
                  >
                    <div className="relative aspect-video overflow-hidden bg-neutral-50">
                      {f.cfg.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={f.cfg.image_url}
                          alt={f.label}
                          loading="lazy"
                          className="h-full w-full object-contain p-2"
                        />
                      ) : (
                        <div
                          className="grid h-full w-full place-items-center text-center"
                          style={{
                            background:
                              "linear-gradient(135deg, #1f2937 0%, #111827 60%, #0a0a0a 100%)"
                          }}
                        >
                          <span className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
                            Photo pending
                          </span>
                        </div>
                      )}
                      {f.score > 0 && (
                        <span
                          className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-black"
                          style={{ background: "#FFB300" }}
                        >
                          {f.score} match{f.score === 1 ? "" : "es"}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 p-3">
                      <p className="text-[13px] font-extrabold leading-tight text-neutral-900">
                        {meta?.label ?? f.label}
                      </p>
                      {f.cfg.price_day_pence && f.cfg.price_day_pence > 0 && (
                        <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                          from £{(f.cfg.price_day_pence / 100).toFixed(0)}/day
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
