// Merchant onboarding — 5-step wizard.
//
// Steps:
//   1. Welcome + confirm trade
//   2. Auto-seed products (runs /api/os/onboarding/seed)
//   3. Show what was seeded + confirm scope
//   4. Publish tile — show embed snippet
//   5. Take me to the Hub
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Loader2,
  CheckCircle2,
  Sparkles,
  Package,
  Layout,
  Rocket,
  ArrowRight,
  Copy,
  Check
} from "lucide-react";
import { SurfaceCard } from "@/platform/ui";
import { FrictionWidget } from "@/components/pilot/FrictionWidget";

type SeedResult = {
  canonicalsSeeded: number;
  offersCreated: number;
  scopeBound: string[];
};

export function OnboardingWizard({
  cohort,
  merchantDisplayName,
  primaryTrade
}: {
  cohort: string;
  merchantDisplayName: string;
  primaryTrade: string;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function runSeed() {
    setSeeding(true);
    setError(null);
    try {
      const res = await fetch("/api/os/onboarding/seed", { method: "POST" });
      const data: { ok: boolean; result?: SeedResult; error?: string } =
        await res.json();
      if (!data.ok || !data.result) {
        setError(data.error || "Seed failed.");
        return;
      }
      setSeedResult(data.result);
      setStep(3);
    } finally {
      setSeeding(false);
    }
  }

  async function finish() {
    setCompleting(true);
    try {
      await fetch("/api/os/onboarding/complete", { method: "POST" });
      window.location.href = "/site-office/hub";
    } finally {
      setCompleting(false);
    }
  }

  const embedSnippet = `<script src="https://thenetworkers.app/embed/ai-visualiser.js" data-merchant="YOUR-BUSINESS-SLUG" async></script>`;

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <FrictionWidget
        screenId={`merchant.onboarding.step-${step}`}
        defaultActor="merchant"
        cohort={cohort}
      />
      <StepIndicator current={step} />

      {step === 1 ? (
        <SurfaceCard variant="primary" padding="lg">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[13px] font-semibold text-amber-900">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Welcome
          </div>
          <h1 className="text-3xl font-bold">Hi {merchantDisplayName}</h1>
          <p className="mt-2 text-[15px] text-neutral-700">
            You'll be operational in about 3 minutes. We'll seed 25
            sample products for you to start with, set up the AI
            Visualiser tile for your trade, and give you the embed
            snippet to drop into your existing site.
          </p>
          <p className="mt-2 text-[13px] text-neutral-500">
            Your trade is set to <b>{primaryTrade.replace(/-/g, " ")}</b>.
            You can change this later from Settings.
          </p>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-neutral-900 px-5 text-[14px] font-bold text-white hover:bg-neutral-800"
          >
            Let's go
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </SurfaceCard>
      ) : null}

      {step === 2 ? (
        <SurfaceCard variant="primary" padding="lg">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-[13px] font-semibold text-blue-900">
            <Package className="h-3.5 w-3.5" aria-hidden />
            Seed sample products
          </div>
          <h1 className="text-2xl font-bold">
            We'll add a starter catalogue for you.
          </h1>
          <p className="mt-2 text-[15px] text-neutral-700">
            Every merchant has to start somewhere. We'll add 25 canonical
            product references, create 5 initial offers at sensible
            prices, and bind them into your AI Visualiser so customer
            renders show real SKUs from day one.
          </p>
          <p className="mt-2 text-[13px] text-neutral-500">
            You can replace or delete any of these later. They're a
            starter, not a commitment.
          </p>
          <button
            type="button"
            onClick={runSeed}
            disabled={seeding}
            className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-neutral-900 px-5 text-[14px] font-bold text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {seeding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Seeding…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden />
                Seed my starter catalogue
              </>
            )}
          </button>
          {error ? (
            <p className="mt-2 text-[13px] text-red-600">{error}</p>
          ) : null}
        </SurfaceCard>
      ) : null}

      {step === 3 && seedResult ? (
        <SurfaceCard variant="success" padding="lg">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[13px] font-semibold text-emerald-900">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Done
          </div>
          <h1 className="text-2xl font-bold">Your catalogue is live.</h1>
          <ul className="mt-4 space-y-2 text-[14px] text-neutral-800">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
              {seedResult.canonicalsSeeded} canonical products in your
              catalogue
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
              {seedResult.offersCreated} offers priced + in stock
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
              AI Visualiser scope bound to{" "}
              {seedResult.scopeBound.map((l) => l.replace(/_/g, " ")).join(", ")}
            </li>
          </ul>
          <div className="mt-6 flex gap-2">
            <Link
              href="/site-office/apps/products"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 text-[13px] font-semibold text-neutral-900 hover:border-neutral-400"
            >
              Review the offers
            </Link>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-neutral-900 px-4 text-[13px] font-bold text-white hover:bg-neutral-800"
            >
              Next: Publish tile
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </SurfaceCard>
      ) : null}

      {step === 4 ? (
        <SurfaceCard variant="primary" padding="lg">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-[13px] font-semibold text-blue-900">
            <Layout className="h-3.5 w-3.5" aria-hidden />
            Publish the tile
          </div>
          <h1 className="text-2xl font-bold">
            Drop this on your existing site.
          </h1>
          <p className="mt-2 text-[15px] text-neutral-700">
            The AI Visualiser tile is a script tag. Paste it once — every
            visitor sees your storefront tile, every render becomes a lead
            in your inbox.
          </p>
          <div className="mt-4 rounded-lg bg-neutral-900 p-4 text-[13px] font-mono text-neutral-100">
            {embedSnippet}
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(embedSnippet);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-800 hover:border-neutral-400"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Copy snippet
              </>
            )}
          </button>
          <p className="mt-2 text-[13px] text-neutral-500">
            Don't have a site? The tile also lives at your public
            profile. It works either way.
          </p>
          <button
            type="button"
            onClick={() => setStep(5)}
            className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-neutral-900 px-5 text-[14px] font-bold text-white hover:bg-neutral-800"
          >
            Finish
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </SurfaceCard>
      ) : null}

      {step === 5 ? (
        <SurfaceCard variant="dark" padding="lg">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-2.5 py-1 text-[13px] font-semibold text-neutral-900">
            <Rocket className="h-3.5 w-3.5" aria-hidden />
            You're live
          </div>
          <h1 className="text-3xl font-bold text-white">Ready for day one.</h1>
          <p className="mt-2 text-[14px] text-white/80">
            Your Hub will show real activity as soon as the first
            homeowner uses your tile. Nothing to configure. If anything
            looks off, hit the "Was this clear?" chip in the corner and
            tell us — that's the fastest path to a fix.
          </p>
          <button
            type="button"
            onClick={finish}
            disabled={completing}
            className="mt-6 inline-flex min-h-[52px] items-center gap-2 rounded-lg bg-amber-500 px-5 text-[15px] font-bold text-neutral-900 hover:bg-amber-400 disabled:opacity-60"
          >
            {completing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Rocket className="h-4 w-4" aria-hidden />
            )}
            Take me to the Hub
          </button>
        </SurfaceCard>
      ) : null}
    </div>
  );
}

function StepIndicator({ current }: { current: 1 | 2 | 3 | 4 | 5 }) {
  const steps = [
    { n: 1, label: "Welcome" },
    { n: 2, label: "Seed" },
    { n: 3, label: "Review" },
    { n: 4, label: "Publish" },
    { n: 5, label: "Launch" }
  ];
  return (
    <ol className="mb-6 flex items-center gap-2">
      {steps.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        return (
          <li key={s.n} className="flex items-center gap-2">
            <div
              className={`flex h-8 min-w-[32px] items-center justify-center rounded-full text-[13px] font-bold ${
                done
                  ? "bg-emerald-500 text-white"
                  : active
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-200 text-neutral-500"
              }`}
            >
              {done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : s.n}
            </div>
            <span
              className={`text-[13px] ${
                active
                  ? "font-semibold text-neutral-900"
                  : "text-neutral-500"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 ? (
              <span className="h-px flex-1 bg-neutral-200" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
