// Preview page for the Bricks & Blocks Calculator app.

import type { Metadata } from "next";
import {
  BricksCalcApp,
  CALC_BRICKS_APP_MANIFEST
} from "@/apps/calc-bricks";

export const metadata: Metadata = {
  title: "Bricks & Blocks Calculator — App preview",
  description: "Landscape / square / portrait embed sizes for calc-bricks.",
  robots: { index: false, follow: false }
};

export default function BricksCalcPreviewPage() {
  return (
    <main className="min-h-screen bg-neutral-50 pb-16">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            App store · Phase 6
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900 md:text-3xl">
            {CALC_BRICKS_APP_MANIFEST.name}
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] text-neutral-700 md:text-[15px]">
            {CALC_BRICKS_APP_MANIFEST.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
            <span className="text-neutral-500">Enabled for:</span>
            {CALC_BRICKS_APP_MANIFEST.tradeAllowlist.map((t) => (
              <span
                key={t}
                className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <section className="mb-10">
          <div className="mb-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Landscape · 4:3 / 16:9
            </div>
            <h2 className="text-[17px] font-semibold text-neutral-900">
              For desktop page embeds
            </h2>
          </div>
          <BricksCalcApp size="landscape" whatsappNumber="+353000000000" />
        </section>
        <section className="mb-10">
          <div className="mb-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Square · 1:1
            </div>
            <h2 className="text-[17px] font-semibold text-neutral-900">
              For grid tiles + dashboards
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <BricksCalcApp size="square" whatsappNumber="+353000000000" />
          </div>
        </section>
        <section className="mb-10">
          <div className="mb-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Portrait · 3:4 / 4:5
            </div>
            <h2 className="text-[17px] font-semibold text-neutral-900">
              For sidebars + mobile hero widgets
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="max-w-sm">
              <BricksCalcApp size="portrait" whatsappNumber="+353000000000" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
