// /live-edit-demo/ai-visualiser — visual demo page for the AI Visualiser
// app. Shows the three tile sizes side-by-side, and lets you launch the
// full end-to-end flow against a demo merchant + kitchen scope.

"use client";

import { useState } from "react";
import {
  AiVisualiserSquare,
  AiVisualiserLandscape,
  AiVisualiserPortrait,
  AiVisualiserFlow
} from "@/apps/ai-visualiser";

const DEMO_MERCHANT_ID =
  process.env.NEXT_PUBLIC_AI_VISUALISER_DEMO_MERCHANT_ID ||
  "00000000-0000-0000-0000-000000000001";
const DEMO_MERCHANT_NAME = "Redgrave Kitchens";

const DEMO_SCOPE = [
  {
    slug: "kitchen_full",
    display_name: "Kitchen",
    synonyms: ["kitchen"]
  }
];

export default function AiVisualiserDemoPage() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-6">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Demo
        </p>
        <h1 className="mt-1 text-3xl font-bold">AI Visualiser</h1>
        <p className="mt-1 text-[14px] text-neutral-600 md:max-w-2xl">
          The three storefront sizes side-by-side. Each opens the same
          end-to-end flow: register → upload → design → render → send to
          merchant.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div>
          <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            Square
          </div>
          <AiVisualiserSquare
            merchantId={DEMO_MERCHANT_ID}
            scope={DEMO_SCOPE}
            headlineNoun="kitchen"
            onLaunch={() => setOpen(true)}
          />
        </div>
        <div>
          <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            Portrait
          </div>
          <AiVisualiserPortrait
            merchantId={DEMO_MERCHANT_ID}
            scope={DEMO_SCOPE}
            headlineNoun="kitchen"
            onLaunch={() => setOpen(true)}
          />
        </div>
        <div className="md:col-span-3">
          <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            Landscape (gold-path slot)
          </div>
          <AiVisualiserLandscape
            merchantId={DEMO_MERCHANT_ID}
            scope={DEMO_SCOPE}
            headlineNoun="kitchen"
            onLaunch={() => setOpen(true)}
          />
        </div>
      </section>

      {open ? (
        <AiVisualiserFlow
          merchantId={DEMO_MERCHANT_ID}
          merchantDisplayName={DEMO_MERCHANT_NAME}
          primaryLeafSlug="kitchen_full"
          source="merchant-page"
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
