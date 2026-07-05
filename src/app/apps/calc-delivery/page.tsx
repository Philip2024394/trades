// Preview page for the Delivery Zones Calculator app.

import type { Metadata } from "next";
import {
  CALC_DELIVERY_APP_MANIFEST,
  DeliveryCalcApp
} from "@/apps/calc-delivery";

export const metadata: Metadata = {
  title: "Delivery Zones Calculator — App preview",
  description: "Landscape / square / portrait embed sizes for calc-delivery.",
  robots: { index: false, follow: false }
};

export default function DeliveryCalcPreviewPage() {
  return (
    <main className="min-h-screen bg-neutral-50 pb-16">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            App store · Phase 19
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900 md:text-3xl">
            {CALC_DELIVERY_APP_MANIFEST.name}
          </h1>
          <p className="mt-1 max-w-3xl text-[13px] text-neutral-700 md:text-[14px]">
            {CALC_DELIVERY_APP_MANIFEST.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
            <span className="text-neutral-500">Enabled for:</span>
            {CALC_DELIVERY_APP_MANIFEST.tradeAllowlist.map((t) => (
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
              For desktop page embeds — settings + live preview
            </h2>
          </div>
          <DeliveryCalcApp
            size="landscape"
            initialLabel="Phil's Carpentry Yard"
          />
        </section>
        <section className="mb-10">
          <div className="mb-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Square · 1:1
            </div>
            <h2 className="text-[17px] font-semibold text-neutral-900">
              For grid tiles + dashboards (tabbed)
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <DeliveryCalcApp size="square" initialLabel="Phil's Carpentry Yard" />
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
              <DeliveryCalcApp
                size="portrait"
                initialLabel="Phil's Carpentry Yard"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
